// Asking Claude Code to read a drawing and answer with a layout (data, never code).
// Each request is one `claude -p` run; --resume keeps the screen's conversation going.
const { spawn } = require('child_process');
const { findClaude, childEnv, killTree } = require('./env');
const { TYPES, ICONS, LAYOUT_SCHEMA } = require('./schema');

const SYSTEM_PROMPT = `You are Drawy, a game UI designer. The user draws a rough sketch of a game screen with one pen on a blank canvas, writes what each drawn mark is, and you turn it into a clean, usable game UI layout. You answer only with the layout data; Drawy draws it in the theme the user picked and exports it for their game engine.

# What you get
- A picture of the sketch. Each mark (a group of strokes) has a thin coloured box and a number tag. The picture is scaled down; all coordinates you read and write are in canvas pixels (the canvas size is given below).
- A list of the marks with their boxes and the user's description of each. The description is the truth: if the user wrote "health bar" next to something that looks like a box, it is a health bar. Handwriting inside a mark is usually its text.
- For changes: the current layout and what the user wants changed.

# Element types
${Object.entries(TYPES).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

# Fields
- x, y, w, h: the element's box in canvas pixels (x, y = top-left). Start from the mark's box, then tidy up: straighten, align elements that were meant to line up, give repeated items (a column of menu buttons, a row of slots) the same size and even spacing, centre things that were drawn roughly centred, and keep about 24 px or more from the canvas edges. Keep the user's composition; do not move things far from where they were drawn.
- Sensible sizes at 1080p: buttons 64-120 px tall, menu buttons 360-560 px wide, icon buttons square 72-120 px, bars 28-56 px tall, sliders, toggles and checkboxes with a text label 360-560 px wide and 56-80 px tall (the label sits inside their box, on the left), labels 32-72 px tall (the text fills the box height), titles 100-220 px tall.
- text: the words to show, in the user's language and case style; short and game-like. "" for none.
- icon: one icon name from the list, or "". Use icons where a game would (settings gear, pause, close x, coins, heart for health, star for XP). Icons: ${ICONS.join(', ')}.
- variant: primary (the main action), secondary (other actions), danger (quit, delete, health), success (confirm, buy, stamina), plain (quiet, no strong colour).
- value: 0..1 for bar, slider, toggle (1 on), checkbox (1 ticked); the selected tab index for tabs; 0 otherwise.
- align: text alignment, mainly for labels; "center" otherwise.
- mark: the number of the mark the element came from (0 for things you added).
- Order matters: elements later in the list are drawn on top, so list panels and windows before the things inside them.
- background: "transparent" for an in-game HUD over the game, "dim" for a pop-up or pause menu over the game, "theme" for a full screen menu with its own themed background.

# Rules
- One element per mark unless the description asks for more (for example "3 buttons: Play, Options, Quit" drawn as one scribble becomes three buttons).
- You may add small things that are clearly implied (a close button on a window the user called a pop-up), but say so in your reply. Never invent big features.
- When changing a layout, return the whole new layout, keeping every element the user did not ask about exactly as it is (same id, box and fields).
- reply: one or two short plain sentences to the user. Reply in the language the user writes in.`;

function runClaude({ text, images = [], sessionId = null, cwd }) {
  const claude = findClaude();
  if (!claude) {
    return { promise: Promise.reject(new Error('Claude Code is not installed. Install it from https://claude.com/claude-code and sign in, then try again.')), stop() {} };
  }
  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--tools', '',
    '--strict-mcp-config',
    '--json-schema', JSON.stringify(LAYOUT_SCHEMA),
    '--append-system-prompt', SYSTEM_PROMPT,
  ];
  if (sessionId) args.push('--resume', sessionId);

  let child;
  const promise = new Promise((resolve, reject) => {
    child = spawn(claude, args, { cwd, env: childEnv() });
    let buffer = '';
    let stderr = '';
    let result = null;
    let session = sessionId;
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev.session_id) session = ev.session_id;
        if (ev.type === 'result') result = ev;
      }
    });
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (child.killed && !result) return reject(new Error('Stopped.'));
      if (!result) {
        const detail = stderr.trim().split(/\r?\n/).slice(-3).join('\n');
        const err = new Error(detail || `Claude Code stopped unexpectedly (exit code ${code}).`);
        err.lostSession = /No conversation found/i.test(detail);
        return reject(err);
      }
      if (result.is_error) return reject(new Error(String(result.result || 'Claude could not finish.')));
      let data = result.structured_output;
      if (!data && typeof result.result === 'string') {
        try { data = JSON.parse(result.result.slice(result.result.indexOf('{'), result.result.lastIndexOf('}') + 1)); } catch {}
      }
      if (!data) return reject(new Error('Claude did not send back a layout. Try again.'));
      resolve({ data, sessionId: session });
    });
    const content = [
      ...images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })),
      { type: 'text', text },
    ];
    child.stdin.end(JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
  });
  return { promise, stop: () => killTree(child) };
}

module.exports = { runClaude };
