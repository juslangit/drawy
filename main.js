const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { Projects } = require('./src/projects');
const { runClaude } = require('./src/claude');
const { cleanLayout, slug } = require('./src/schema');

let win = null;
let projects = null;
let running = null; // the Claude request in progress: { stop }

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1040,
    minHeight: 640,
    title: 'Drawy',
    backgroundColor: '#0f1117',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ---------- Asking Claude ---------- */

function describeMarks(marks) {
  if (!marks.length) return 'There are no marks: the user has not drawn anything yet.';
  return marks.map((m) => `- Mark ${m.n}: box x=${m.x} y=${m.y} w=${m.w} h=${m.h}. ${m.note ? `The user says: "${m.note}"` : 'No description: work out what it is from the drawing.'}`).join('\n');
}

function context({ project, screen, marks }) {
  return [
    `Canvas: ${project.size.w} x ${project.size.h} pixels.`,
    `Theme the user picked: ${project.theme} (Drawy draws the style; you only lay it out, but you can match the wording to it).`,
    project.note ? `The game: ${project.note}` : '',
    `This screen: "${screen.name}". ${screen.note ? `The user says about it: "${screen.note}"` : ''}`,
    '',
    'Marks on the sketch:',
    describeMarks(marks),
  ].filter((l) => l !== '').join('\n');
}

async function ask({ slug: s, screenId, image, marks, message, ui }) {
  if (running) throw new Error('Claude is still working on the last request.');
  const project = projects.load(s).project;
  const screen = project.screens.find((x) => x.id === screenId);
  if (!screen) throw new Error('That screen no longer exists.');
  const generating = message == null;
  const text = generating
    ? `${context({ project, screen, marks })}\n\nTurn this sketch into the UI layout.`
    : `${context({ project, screen, marks })}\n\nThe current layout:\n${JSON.stringify(ui)}\n\nThe user asks: ${message}`;
  const images = image ? [{ mediaType: 'image/png', data: image }] : [];
  const cwd = projects.dir(s);

  const attempt = async (sessionId) => {
    const job = runClaude({ text, images, sessionId, cwd });
    running = job;
    try { return await job.promise; } finally { running = null; }
  };
  let answer;
  try {
    answer = await attempt(generating ? null : screen.sessionId);
  } catch (err) {
    if (!err.lostSession) throw err;
    answer = await attempt(null);
  }
  // Save the conversation so the next chat message on this screen carries on from it.
  const fresh = projects.load(s).project;
  const sc = fresh.screens.find((x) => x.id === screenId);
  if (sc) {
    sc.sessionId = answer.sessionId;
    projects.saveProject(s, fresh);
  }
  return { ...cleanLayout(answer.data, project.size), sessionId: answer.sessionId };
}

/* ---------- Export ---------- */

function writeExport({ slug: s, screenName, files, font }) {
  const dir = path.join(projects.dir(s), 'export', slug(screenName) || 'screen');
  fs.rmSync(dir, { recursive: true, force: true });
  for (const f of files) {
    const rel = path.normalize(f.path);
    if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (f.dataUrl) fs.writeFileSync(full, Buffer.from(f.dataUrl.slice(f.dataUrl.indexOf(',') + 1), 'base64'));
    else fs.writeFileSync(full, f.text);
  }
  if (font) {
    const fontsDir = path.join(__dirname, 'renderer', 'fonts');
    fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
    fs.copyFileSync(path.join(fontsDir, `${font}.ttf`), path.join(dir, 'fonts', `${font}.ttf`));
    fs.copyFileSync(path.join(fontsDir, `OFL-${font}.txt`), path.join(dir, 'fonts', `OFL-${font}.txt`));
  }
  return dir;
}

/* ---------- IPC ---------- */

function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  });
}

handle('projects:list', () => projects.list());
handle('projects:create', (opts) => projects.create(opts));
handle('projects:open', (s) => projects.load(s));
handle('project:save', (s, project) => projects.saveProject(s, project));
handle('sketch:save', (s, id, sketch) => projects.saveSketch(s, id, sketch));
handle('ui:save', (s, id, ui) => projects.saveUi(s, id, ui));
handle('screen:delete', (s, id) => projects.deleteScreen(s, id));
handle('ai:ask', (req) => ask(req));
handle('ai:stop', () => { if (running) running.stop(); });
handle('export:write', (req) => writeExport(req));
handle('shell:openFolder', (dir) => shell.openPath(dir));
handle('shell:projectFolder', (s) => shell.openPath(projects.dir(s)));

app.whenReady().then(() => {
  // DRAWY_HOME lets tests keep their projects away from the real ones.
  projects = new Projects(process.env.DRAWY_HOME || path.join(app.getPath('documents'), 'Drawy'));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => {
  if (running) running.stop();
  app.quit();
});
