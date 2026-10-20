/* Drawy: draw a game screen, describe the parts, generate a themed UI, try it, tweak it, export it. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const { THEMES, drawElement, drawBackground, exportParts, iconsReady } = window.DrawyThemes;
const SK = window.DrawySketch;
const api = window.drawy;

const TYPE_INFO = {
  panel: 'Panel', window: 'Window', button: 'Button', label: 'Label', title: 'Title', bar: 'Bar',
  slider: 'Slider', toggle: 'Toggle', checkbox: 'Checkbox', input: 'Text field', icon: 'Icon',
  image: 'Image slot', badge: 'Badge', tabs: 'Tabs', list: 'List', divider: 'Divider', joystick: 'Joystick',
};
const DEFAULT_SIZE = {
  panel: [640, 520], window: [760, 560], button: [420, 96], label: [360, 56], title: [900, 160], bar: [520, 44],
  slider: [560, 64], toggle: [360, 64], checkbox: [360, 60], input: [520, 80], icon: [96, 96], image: [240, 240],
  badge: [240, 64], tabs: [720, 80], list: [560, 420], divider: [600, 24], joystick: [240, 240],
};
const INTERACTIVE = new Set(['button', 'slider', 'toggle', 'checkbox', 'tabs', 'input', 'joystick']);

const S = {
  slug: null, project: null, screens: {}, screenId: null,
  mode: 'draw', tool: 'pen', penSize: 4,
  view: { k: 1, ox: 0, oy: 0, dpr: 1 },
  selected: null, hover: null, hlMark: null,
  busy: false, ghost: false, backdrop: 'scene',
  hist: {}, // per screen: { sketch: {undo, redo}, ui: {undo, redo} }
  tryValues: {}, tryHover: null, tryPressed: null,
  reveal: null, drag: null, guides: [], live: null, editTxn: false,
};

const cur = () => S.screens[S.screenId];
const theme = () => THEMES[S.project.theme] || THEMES.cartoon;
const size = () => S.project.size;
const screenMeta = () => S.project.screens.find((s) => s.id === S.screenId);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------- Saving ---------- */
const timers = {};
function later(key, fn, ms = 350) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => { delete timers[key]; fn(); }, ms);
  pending[key] = fn;
}
const pending = {};
async function flush() {
  for (const [key, fn] of Object.entries(pending)) {
    if (timers[key]) { clearTimeout(timers[key]); delete timers[key]; await fn(); }
    delete pending[key];
  }
}
const saveSketch = (id = S.screenId) => later('sk' + id, () => api.screens.saveSketch(S.slug, id, S.screens[id].sketch).catch(showError));
const saveUi = (id = S.screenId) => later('ui' + id, () => api.screens.saveUi(S.slug, id, S.screens[id].ui).catch(showError));
const saveProject = () => later('project', () => api.projects.save(S.slug, S.project).catch(showError));
function showError(err) { addMessage('error', err.message || String(err)); }

/* ---------- Undo ---------- */
function hist() {
  if (!S.hist[S.screenId]) S.hist[S.screenId] = { sketch: { undo: [], redo: [] }, ui: { undo: [], redo: [] } };
  return S.hist[S.screenId];
}
const sketchSnap = () => clone(cur().sketch);
const uiSnap = () => clone({ background: cur().ui.background, elements: cur().ui.elements });
function pushSketch() { const h = hist().sketch; h.undo.push(sketchSnap()); if (h.undo.length > 100) h.undo.shift(); h.redo = []; updateUndo(); }
function pushUi() { const h = hist().ui; h.undo.push(uiSnap()); if (h.undo.length > 100) h.undo.shift(); h.redo = []; updateUndo(); }
function undo(redo = false) {
  const kind = S.mode === 'draw' ? 'sketch' : 'ui';
  const h = hist()[kind];
  const from = redo ? h.redo : h.undo, to = redo ? h.undo : h.redo;
  if (!from.length) return;
  to.push(kind === 'sketch' ? sketchSnap() : uiSnap());
  const snap = from.pop();
  if (kind === 'sketch') { cur().sketch = snap; saveSketch(); renderMarks(); }
  else { Object.assign(cur().ui, snap); if (!cur().ui.elements.find((e) => e.id === S.selected)) S.selected = null; saveUi(); renderInspect(); }
  updateUndo(); render(); thumbSoon();
}
function updateUndo() {
  if (!S.screenId) return;
  const h = hist()[S.mode === 'draw' ? 'sketch' : 'ui'];
  $('#undo').disabled = !h.undo.length;
  $('#redo').disabled = !h.redo.length;
}

/* ---------- Projects ---------- */
async function loadProjects(open) {
  const list = await api.projects.list();
  const sel = $('#project-select');
  sel.innerHTML = list.map((p) => `<option value="${esc(p.slug)}">${esc(p.name)}</option>`).join('');
  if (!list.length) {
    $('#welcome').hidden = false; $('#workspace').hidden = true;
    return;
  }
  $('#welcome').hidden = true; $('#workspace').hidden = false;
  let last = open;
  if (!last) { try { last = localStorage.getItem('lastProject'); } catch {} }
  if (!list.find((p) => p.slug === last)) last = list[0].slug;
  await openProject(last);
}

async function openProject(slug) {
  await flush();
  const data = await api.projects.open(slug);
  S.slug = slug; S.project = data.project; S.screens = data.screens; S.hist = {};
  for (const id of Object.keys(S.screens)) if (!S.screens[id].ui.log) S.screens[id].ui.log = [];
  $('#project-select').value = slug;
  try { localStorage.setItem('lastProject', slug); } catch {}
  $('#theme-select').value = S.project.theme;
  $('#project-note').value = S.project.note || '';
  await loadFonts();
  const first = S.project.screens[0].id;
  let screen = first;
  try { screen = localStorage.getItem('lastScreen:' + slug) || first; } catch {}
  if (!S.screens[screen]) screen = first;
  switchScreen(screen, true);
  fit();
}

function switchScreen(id, initial) {
  S.screenId = id; S.selected = null; S.hlMark = null; S.reveal = null; S.tryValues = {};
  try { localStorage.setItem('lastScreen:' + S.slug, id); } catch {}
  $('#screen-note').value = screenMeta().note || '';
  const hasUi = cur().ui.elements.length > 0;
  setMode(initial ? (hasUi ? 'edit' : 'draw') : hasUi ? (S.mode === 'draw' ? 'edit' : S.mode) : 'draw');
  renderMarks(); renderChat(); renderInspect(); renderScreens(); updateUndo(); render();
}

async function loadFonts() {
  const t = theme();
  try { await document.fonts.load(`${t.weight} 40px "${t.font}"`); } catch {}
}

/* ---------- Modes and tools ---------- */
function setMode(mode) {
  S.mode = mode;
  const stage = $('#stage');
  stage.classList.toggle('mode-draw', mode === 'draw');
  stage.classList.toggle('mode-edit', mode === 'edit');
  stage.classList.toggle('mode-try', mode === 'try');
  $$('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  if (mode === 'try') { S.tryValues = {}; S.tryHover = S.tryPressed = null; }
  if (mode !== 'edit') S.selected = null;
  const tab = mode === 'draw' ? 'describe' : mode === 'edit' ? (activeTab() === 'describe' ? 'inspect' : activeTab()) : activeTab();
  showTab(tab);
  updateHint(); updateUndo(); renderInspect(); render();
}
function setTool(tool, sizeVal) {
  S.tool = tool;
  if (sizeVal) S.penSize = sizeVal;
  $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool && (tool !== 'pen' || +b.dataset.size === S.penSize)));
  $('#stage').classList.toggle('tool-eraser', tool === 'eraser');
  updateHint();
}
function updateHint() {
  const h = $('#stage-hint');
  let text = '';
  if (!S.project) return;
  const hasStrokes = cur().sketch.strokes.length > 0;
  const hasUi = cur().ui.elements.length > 0;
  if (S.mode === 'draw' && S.tool === 'group') text = '<b>Group:</b> drag a box around strokes to make them one thing';
  else if (S.mode === 'draw' && !hasStrokes) text = 'Draw your screen: boxes for buttons and panels, lines for bars, and write the words. Then press <b>Generate</b>.';
  else if (S.mode !== 'draw' && !hasUi) text = hasStrokes ? 'No UI yet. Press <b>Generate</b> to turn your drawing into UI.' : 'No UI yet. Go to <b>Draw</b> and sketch your screen first.';
  else if (S.mode === 'try') text = 'Try it: press buttons, drag sliders, flip toggles. Nothing here is saved.';
  h.innerHTML = text;
  h.hidden = !text;
}

/* ---------- Tabs ---------- */
const activeTab = () => ($('.tab.active') || {}).dataset?.tab || 'describe';
function showTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  for (const p of ['describe', 'chat', 'inspect']) $(`#pane-${p}`).hidden = p !== name;
}
$$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

/* ---------- Canvas and view ---------- */
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
let frameQueued = false;
function render() {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(() => { frameQueued = false; draw(); });
}
DrawyThemes.onIconLoad(() => { render(); thumbSoon(); });

function fit() {
  const wrap = $('#screen-wrap');
  const r = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  if (!S.project) return;
  const m = 28;
  const k = Math.min((r.width - m * 2) / size().w, (r.height - m * 2) / size().h);
  S.view = { k, ox: (r.width - size().w * k) / 2, oy: (r.height - size().h * k) / 2, dpr };
  $('#zoom-label').textContent = `${size().w}×${size().h} · ${Math.round(k * 100)}%`;
  render();
}
new ResizeObserver(fit).observe($('#screen-wrap'));

const toCanvas = (e) => {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left - S.view.ox) / S.view.k, (e.clientY - r.top - S.view.oy) / S.view.k];
};

let sceneCache = null;
function sceneBackdrop(w, h) {
  if (sceneCache && sceneCache.width === w && sceneCache.height === h) return sceneCache;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#6fb7ff'); sky.addColorStop(0.62, '#cfe8ff'); sky.addColorStop(0.63, '#7cc96b'); sky.addColorStop(1, '#3f8f45');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff7c8'; g.beginPath(); g.arc(w * 0.78, h * 0.2, Math.min(w, h) * 0.07, 0, Math.PI * 2); g.fill();
  const hill = (y, amp, color, seed) => {
    g.fillStyle = color; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, y + Math.sin(x / w * 6 + seed) * amp + Math.sin(x / w * 17 + seed * 2) * amp * 0.3);
    g.lineTo(w, h); g.closePath(); g.fill();
  };
  hill(h * 0.55, h * 0.05, '#8fc7e8', 1); hill(h * 0.62, h * 0.04, '#6ab85c', 3); hill(h * 0.76, h * 0.03, '#4c9a48', 5);
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (const [cx, cy, s] of [[0.2, 0.16, 1], [0.48, 0.1, 0.7], [0.62, 0.26, 0.85]]) {
    for (const [dx, dy, r] of [[0, 0, 40], [40, 8, 32], [-38, 10, 30], [10, -18, 30]]) { g.beginPath(); g.arc(cx * w + dx * s, cy * h + dy * s, r * s, 0, Math.PI * 2); g.fill(); }
  }
  sceneCache = c;
  return c;
}
function drawBackdrop(g, w, h, kind) {
  if (kind === 'scene') g.drawImage(sceneBackdrop(w, h), 0, 0);
  else if (kind === 'dark') { g.fillStyle = '#16181f'; g.fillRect(0, 0, w, h); }
  else if (kind === 'light') { g.fillStyle = '#f2f3f6'; g.fillRect(0, 0, w, h); }
  else {
    const s = 32;
    g.fillStyle = '#2a2d36'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#353945';
    for (let y = 0; y < h; y += s) for (let x = (y / s) % 2 ? s : 0; x < w; x += s * 2) g.fillRect(x, y, s, s);
  }
}

const easeBack = (p) => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };

// Draw a UI onto a context in canvas coordinates. Shared by the stage and thumbnails.
function paintUi(g, ui, t, opts = {}) {
  drawBackground(g, t, size().w, size().h, ui.background);
  const now = performance.now();
  let animating = false;
  ui.elements.forEach((el) => {
    let state = 'normal';
    let value;
    if (opts.try) {
      if (S.tryValues[el.id] !== undefined) value = S.tryValues[el.id];
      if (S.tryPressed === el.id) state = 'pressed';
      else if (S.tryHover === el.id) state = 'hover';
    }
    const live = opts.live && S.live && S.live.id === el.id ? S.live : null;
    const e = live ? { ...el, ...live.rect } : el;
    const order = opts.reveal ? opts.reveal.order.get(el.id) : undefined;
    if (order !== undefined) {
      const p = clamp((now - opts.reveal.t0 - order * 85) / 420, 0, 1);
      if (p < 1) animating = true;
      if (p <= 0) return;
      const s = 0.55 + 0.45 * easeBack(p);
      g.save();
      g.globalAlpha = Math.min(1, p * 1.6);
      g.translate(e.x + e.w / 2, e.y + e.h / 2); g.scale(s, s); g.translate(-(e.x + e.w / 2), -(e.y + e.h / 2));
      drawElement(g, t, e, { state, value });
      g.restore();
    } else {
      drawElement(g, t, e, { state, value });
    }
  });
  return animating;
}

function draw() {
  const { k, ox, oy, dpr } = S.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!S.project || !cur()) return;
  const W = size().w, H = size().h;
  const sc = cur();
  // canvas shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#000'; ctx.fillRect(ox, oy, W * k, H * k);
  ctx.restore();
  ctx.save();
  ctx.translate(ox, oy); ctx.scale(k, k);
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  let again = false;

  if (S.mode === 'draw') {
    ctx.fillStyle = '#f7f6f2'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#dcdad2';
    const step = 60, r = 1.6 / k;
    for (let y = step; y < H; y += step) for (let x = step; x < W; x += step) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(139,123,255,.25)'; ctx.lineWidth = 1 / k; ctx.setLineDash([8 / k, 8 / k]);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    SK.drawSketch(ctx, sc.sketch, { marks: true, notes: true, scale: 0.85 / k, highlight: S.hlMark });
    if (S.drag && S.drag.kind === 'pen') SK.drawStroke(ctx, S.drag.stroke);
    if (S.drag && S.drag.kind === 'group') {
      const b = S.drag.box;
      ctx.fillStyle = 'rgba(139,123,255,.12)'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#8b7bff'; ctx.lineWidth = 2 / k; ctx.setLineDash([8 / k, 6 / k]); ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
    }
    if (S.tool === 'eraser' && S.pointer) {
      ctx.strokeStyle = '#ff5c7a'; ctx.lineWidth = 2 / k;
      ctx.beginPath(); ctx.arc(S.pointer[0], S.pointer[1], 16 / k, 0, Math.PI * 2); ctx.stroke();
    }
  } else {
    drawBackdrop(ctx, W, H, S.backdrop);
    again = paintUi(ctx, sc.ui, theme(), { try: S.mode === 'try', live: S.mode === 'edit', reveal: S.reveal });
    if (!again) S.reveal = null;
    if (S.ghost) {
      ctx.save(); ctx.globalAlpha = 0.35;
      SK.drawSketch(ctx, sc.sketch, { ink: '#ff3d7f' });
      ctx.restore();
    }
    if (S.mode === 'edit') drawEditOverlay();
  }
  ctx.restore();
  if (again) render();
}

function elRect(el) { return S.live && S.live.id === el.id ? { ...el, ...S.live.rect } : el; }
function handles(r) {
  const { x, y, w, h } = r;
  return { nw: [x, y], n: [x + w / 2, y], ne: [x + w, y], e: [x + w, y + h / 2], se: [x + w, y + h], s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2] };
}
function drawEditOverlay() {
  const k = S.view.k;
  const els = cur().ui.elements;
  const hov = els.find((e) => e.id === S.hover);
  if (hov && hov.id !== S.selected) {
    ctx.strokeStyle = 'rgba(139,123,255,.7)'; ctx.lineWidth = 1.5 / k;
    ctx.strokeRect(hov.x, hov.y, hov.w, hov.h);
  }
  const sel = els.find((e) => e.id === S.selected);
  if (sel) {
    const r = elRect(sel);
    ctx.strokeStyle = '#8b7bff'; ctx.lineWidth = 2 / k;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    const hs = 9 / k;
    for (const [hx, hy] of Object.values(handles(r))) {
      ctx.fillStyle = '#fff'; ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeStyle = '#8b7bff'; ctx.lineWidth = 1.5 / k; ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }
    const label = `${TYPE_INFO[sel.type]} · ${Math.round(r.w)}×${Math.round(r.h)}`;
    ctx.font = `600 ${12 / k}px -apple-system, system-ui, sans-serif`;
    const tw = ctx.measureText(label).width + 12 / k;
    const ly = r.y > 26 / k ? r.y - 24 / k : r.y + r.h + 6 / k;
    ctx.fillStyle = '#8b7bff'; ctx.beginPath(); ctx.roundRect(r.x, ly, tw, 18 / k, 4 / k); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, r.x + 6 / k, ly + 9.5 / k);
  }
  ctx.strokeStyle = '#ff3d7f'; ctx.lineWidth = 1 / k;
  for (const gd of S.guides) {
    ctx.beginPath();
    if (gd.x !== undefined) { ctx.moveTo(gd.x, 0); ctx.lineTo(gd.x, size().h); } else { ctx.moveTo(0, gd.y); ctx.lineTo(size().w, gd.y); }
    ctx.stroke();
  }
}

/* ---------- Pointer: drawing ---------- */
canvas.addEventListener('pointerdown', (e) => {
  if (!S.project || S.busy && S.mode === 'draw') return;
  canvas.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  if (S.mode === 'draw') drawDown(p, e);
  else if (S.mode === 'edit') editDown(p, e);
  else tryDown(p);
});
canvas.addEventListener('pointermove', (e) => {
  if (!S.project) return;
  const p = toCanvas(e);
  S.pointer = p;
  if (S.mode === 'draw') drawMove(p, e);
  else if (S.mode === 'edit') editMove(p, e);
  else tryMove(p);
});
canvas.addEventListener('pointerup', (e) => {
  if (!S.project) return;
  const p = toCanvas(e);
  if (S.mode === 'draw') drawUp(p);
  else if (S.mode === 'edit') editUp();
  else tryUp(p);
});
canvas.addEventListener('pointerleave', () => { S.pointer = null; if (S.mode === 'try') { S.tryHover = null; } render(); });
canvas.addEventListener('dblclick', () => {
  if (S.mode === 'edit' && S.selected) { showTab('inspect'); const t = $('#f-text'); if (t) { t.focus(); t.select(); } }
});

function drawDown(p) {
  const sk = cur().sketch;
  if (S.tool === 'pen') {
    S.drag = { kind: 'pen', stroke: { id: 0, w: S.penSize, pts: [p] } };
  } else if (S.tool === 'eraser') {
    S.drag = { kind: 'eraser', before: sketchSnap(), removed: false };
    eraseAt(p);
  } else if (S.tool === 'group') {
    S.drag = { kind: 'group', start: p, box: { x: p[0], y: p[1], w: 0, h: 0 } };
  }
  void sk;
  render();
}
function eraseAt(p) {
  const sk = cur().sketch;
  const hit = new Set(SK.strokesHit(sk, p[0], p[1], 16 / S.view.k));
  if (!hit.size) return;
  sk.strokes = sk.strokes.filter((s) => !hit.has(s.id));
  S.drag.removed = true;
}
function drawMove(p, e) {
  if (!S.drag) { if (S.tool === 'eraser') render(); return; }
  if (S.drag.kind === 'pen') {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) S.drag.stroke.pts.push(toCanvas(ev));
  } else if (S.drag.kind === 'eraser') eraseAt(p);
  else if (S.drag.kind === 'group') {
    const [x0, y0] = S.drag.start;
    S.drag.box = { x: Math.min(x0, p[0]), y: Math.min(y0, p[1]), w: Math.abs(p[0] - x0), h: Math.abs(p[1] - y0) };
  }
  render();
}
function drawUp() {
  const d = S.drag;
  S.drag = null;
  if (!d) return;
  const sk = cur().sketch;
  if (d.kind === 'pen') {
    pushSketch();
    sk.strokes.push({ id: sk.nextStroke++, w: d.stroke.w, pts: SK.simplify(d.stroke.pts) });
    sketchChanged();
  } else if (d.kind === 'eraser' && d.removed) {
    const h = hist().sketch; h.undo.push(d.before); h.redo = []; updateUndo();
    sketchChanged();
  } else if (d.kind === 'group') {
    if (d.box.w > 8 && d.box.h > 8) {
      const before = sketchSnap();
      if (SK.groupInBox(sk, d.box)) { const h = hist().sketch; h.undo.push(before); h.redo = []; updateUndo(); sketchChanged(); }
    }
  }
  render();
}
function sketchChanged() {
  const sk = cur().sketch;
  const before = new Set(sk.marks.map((m) => m.id));
  SK.regroup(sk);
  const fresh = sk.marks.filter((m) => !before.has(m.id)).map((m) => m.id);
  saveSketch(); renderMarks(fresh); updateHint(); thumbSoon();
}

/* ---------- Pointer: editing ---------- */
function hitElement(p) {
  const els = cur().ui.elements;
  for (let i = els.length - 1; i >= 0; i--) {
    const e = els[i];
    if (p[0] >= e.x && p[0] <= e.x + e.w && p[1] >= e.y && p[1] <= e.y + e.h) return e;
  }
  return null;
}
function hitHandle(p) {
  const sel = cur().ui.elements.find((e) => e.id === S.selected);
  if (!sel) return null;
  const r = 9 / S.view.k;
  for (const [name, [hx, hy]] of Object.entries(handles(sel))) if (Math.abs(p[0] - hx) <= r && Math.abs(p[1] - hy) <= r) return name;
  return null;
}
function editDown(p) {
  const handle = hitHandle(p);
  if (handle) {
    const el = cur().ui.elements.find((e) => e.id === S.selected);
    S.drag = { kind: 'resize', handle, start: p, orig: { x: el.x, y: el.y, w: el.w, h: el.h }, moved: false };
    return;
  }
  const el = hitElement(p);
  select(el ? el.id : null);
  if (el) S.drag = { kind: 'move', start: p, orig: { x: el.x, y: el.y, w: el.w, h: el.h }, moved: false };
}
function snapRect(r, el, mode) {
  const th = 7 / S.view.k;
  const xs = [0, size().w / 2, size().w], ys = [0, size().h / 2, size().h];
  for (const o of cur().ui.elements) {
    if (o.id === el.id) continue;
    xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h);
  }
  const guides = [];
  const snapAxis = (cands, edges, apply) => {
    let best = null;
    for (const c of cands) for (const [edge, val] of edges) { const d = c - val; if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, c, edge }; }
    if (best) { apply(best); return best.c; }
    return null;
  };
  if (mode === 'move') {
    const gx = snapAxis(xs, [['l', r.x], ['c', r.x + r.w / 2], ['r', r.x + r.w]], (b) => { r.x += b.d; });
    const gy = snapAxis(ys, [['t', r.y], ['c', r.y + r.h / 2], ['b', r.y + r.h]], (b) => { r.y += b.d; });
    if (gx !== null) guides.push({ x: gx });
    if (gy !== null) guides.push({ y: gy });
  } else {
    const h = mode;
    if (h.includes('e')) { const g = snapAxis(xs, [['r', r.x + r.w]], (b) => { r.w += b.d; }); if (g !== null) guides.push({ x: g }); }
    if (h.includes('w')) { const g = snapAxis(xs, [['l', r.x]], (b) => { r.x += b.d; r.w -= b.d; }); if (g !== null) guides.push({ x: g }); }
    if (h.includes('s')) { const g = snapAxis(ys, [['b', r.y + r.h]], (b) => { r.h += b.d; }); if (g !== null) guides.push({ y: g }); }
    if (h.includes('n')) { const g = snapAxis(ys, [['t', r.y]], (b) => { r.y += b.d; r.h -= b.d; }); if (g !== null) guides.push({ y: g }); }
  }
  S.guides = guides;
  return r;
}
function editMove(p, e) {
  if (!S.drag) {
    const h = hitHandle(p);
    const el = hitElement(p);
    canvas.style.cursor = h ? ({ n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' })[h] : el ? 'move' : 'default';
    const id = el ? el.id : null;
    if (id !== S.hover) { S.hover = id; render(); }
    return;
  }
  const d = S.drag;
  const dx = p[0] - d.start[0], dy = p[1] - d.start[1];
  if (!d.moved && Math.hypot(dx, dy) * S.view.k < 3) return;
  d.moved = true;
  const el = cur().ui.elements.find((x) => x.id === S.selected);
  let r = { ...d.orig };
  if (d.kind === 'move') { r.x += dx; r.y += dy; }
  else {
    const hh = d.handle;
    if (hh.includes('e')) r.w = d.orig.w + dx;
    if (hh.includes('s')) r.h = d.orig.h + dy;
    if (hh.includes('w')) { r.x = d.orig.x + dx; r.w = d.orig.w - dx; }
    if (hh.includes('n')) { r.y = d.orig.y + dy; r.h = d.orig.h - dy; }
    if (e.shiftKey) { const ratio = d.orig.w / d.orig.h; if (Math.abs(dx) > Math.abs(dy)) r.h = r.w / ratio; else r.w = r.h * ratio; }
  }
  r = e.altKey ? r : snapRect(r, el, d.kind === 'move' ? 'move' : d.handle);
  r.w = Math.max(12, r.w); r.h = Math.max(8, r.h);
  r.x = clamp(r.x, -r.w + 20, size().w - 20); r.y = clamp(r.y, -r.h + 20, size().h - 20);
  S.live = { id: el.id, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) } };
  render();
}
function editUp() {
  const d = S.drag;
  S.drag = null; S.guides = [];
  if (d && d.moved && S.live) {
    pushUi();
    const el = cur().ui.elements.find((x) => x.id === S.live.id);
    Object.assign(el, S.live.rect);
    S.live = null;
    saveUi(); renderInspect(); thumbSoon();
  }
  S.live = null;
  render();
}
function select(id) {
  S.selected = id;
  if (id) showTab('inspect');
  renderInspect(); render();
}

/* ---------- Pointer: trying ---------- */
function tryTarget(p) {
  const el = hitElement(p);
  return el && INTERACTIVE.has(el.type) ? el : null;
}
function sliderValue(el, p) {
  const lw = el.text ? Math.min(el.w * 0.32, 260) : 0;
  const kr = el.h * 0.42;
  return clamp((p[0] - (el.x + lw + kr)) / (el.w - lw - kr * 2), 0, 1);
}
function toast(text) {
  const t = $('#try-toast');
  t.textContent = text; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 1600);
}
const nameOf = (el) => (el.text ? `“${el.text.split('|')[0]}”` : el.icon ? `${el.icon} ${TYPE_INFO[el.type].toLowerCase()}` : el.id);
function tryDown(p) {
  const el = tryTarget(p);
  if (!el) return;
  S.tryPressed = el.id;
  if (el.type === 'slider') S.tryValues[el.id] = sliderValue(el, p);
  render();
}
function tryMove(p) {
  const el = tryTarget(p);
  const id = el ? el.id : null;
  canvas.style.cursor = el ? 'pointer' : 'default';
  if (S.tryPressed) {
    const pressed = cur().ui.elements.find((e) => e.id === S.tryPressed);
    if (pressed && pressed.type === 'slider') { S.tryValues[pressed.id] = sliderValue(pressed, p); render(); return; }
  }
  if (id !== S.tryHover) { S.tryHover = id; render(); }
}
function tryUp(p) {
  const id = S.tryPressed;
  S.tryPressed = null;
  const el = tryTarget(p);
  const pressed = cur().ui.elements.find((e) => e.id === id);
  if (pressed && pressed.type === 'slider') toast(`${nameOf(pressed)} set to ${Math.round(S.tryValues[pressed.id] * 100)}%`);
  else if (el && el.id === id) {
    if (el.type === 'button') toast(`${nameOf(el)} pressed`);
    else if (el.type === 'toggle' || el.type === 'checkbox') {
      const v = (S.tryValues[el.id] ?? el.value) > 0.5 ? 0 : 1;
      S.tryValues[el.id] = v;
      toast(`${nameOf(el)} ${v ? 'on' : 'off'}`);
    } else if (el.type === 'tabs') {
      const names = el.text.split('|');
      const i = clamp(Math.floor((p[0] - el.x) / (el.w / names.length)), 0, names.length - 1);
      S.tryValues[el.id] = i;
      toast(`Tab “${names[i].trim()}”`);
    } else if (el.type === 'input') toast(`${nameOf(el)} field tapped`);
    else if (el.type === 'joystick') toast('Joystick touched');
  }
  render();
}

/* ---------- Describe pane ---------- */
function renderMarks(fresh = []) {
  const sk = cur().sketch;
  const ul = $('#marks');
  const focused = document.activeElement && document.activeElement.dataset.mark;
  $('#marks-empty').hidden = sk.marks.length > 0;
  const described = sk.marks.filter((m) => m.note.trim()).length;
  $('#marks-count').textContent = sk.marks.length ? `${described} of ${sk.marks.length} described` : '';
  ul.innerHTML = sk.marks.map((m) => `
    <li class="mark ${fresh.includes(m.id) ? 'fresh' : ''} ${S.hlMark === m.id ? 'hl' : ''}" data-id="${m.id}" style="--mc:${SK.markColor(m.id)}">
      <span class="num">${m.id}</span>
      <input data-mark="${m.id}" value="${esc(m.note)}" placeholder="What is this? e.g. play button" aria-label="What mark ${m.id} is" autocomplete="off">
      ${m.manual ? `<button class="mark-tag" data-ungroup="${m.id}" title="You grouped this by hand. Click to let Drawy group it again.">grouped</button>` : ''}
    </li>`).join('');
  if (focused) { const inp = ul.querySelector(`input[data-mark="${focused}"]`); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
}
$('#marks').addEventListener('input', (e) => {
  const id = +e.target.dataset.mark;
  if (!id) return;
  const m = cur().sketch.marks.find((x) => x.id === id);
  if (m) { m.note = e.target.value; saveSketch(); render(); }
  const sk = cur().sketch;
  $('#marks-count').textContent = `${sk.marks.filter((x) => x.note.trim()).length} of ${sk.marks.length} described`;
});
$('#marks').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const inputs = $$('#marks input');
  const i = inputs.indexOf(e.target);
  if (inputs[i + 1]) inputs[i + 1].focus(); else e.target.blur();
});
$('#marks').addEventListener('focusin', (e) => { const id = +e.target.dataset.mark; if (id) highlightMark(id); });
$('#marks').addEventListener('focusout', () => highlightMark(null));
$('#marks').addEventListener('mouseover', (e) => { const li = e.target.closest('.mark'); if (li && !document.activeElement?.dataset?.mark) highlightMark(+li.dataset.id); });
$('#marks').addEventListener('mouseleave', () => { if (!document.activeElement?.dataset?.mark) highlightMark(null); });
$('#marks').addEventListener('click', (e) => {
  const id = +e.target.dataset.ungroup;
  if (!id) return;
  pushSketch();
  const m = cur().sketch.marks.find((x) => x.id === id);
  if (m) m.manual = false;
  sketchChanged(); render();
});
function highlightMark(id) {
  if (S.hlMark === id) return;
  S.hlMark = id;
  $$('#marks .mark').forEach((li) => li.classList.toggle('hl', +li.dataset.id === id));
  render();
}
$('#screen-note').addEventListener('input', (e) => { screenMeta().note = e.target.value; saveProject(); });
$('#project-note').addEventListener('input', (e) => { S.project.note = e.target.value; saveProject(); });

/* ---------- Generate and chat ---------- */
function marksForClaude() {
  const sk = cur().sketch;
  return sk.marks.map((m) => ({ n: m.id, ...SK.markBox(sk, m), note: m.note.trim() })).filter((m) => m.w);
}
function setBusy(on, label) {
  S.busy = on;
  $('#building').hidden = !on;
  if (label) $('#building-text').textContent = label;
  $('#screen-wrap').classList.toggle('is-building', on);
  $('#generate').disabled = on;
  $('#send').disabled = on;
  $('#stop').hidden = !on;
  $('#chat-status').textContent = on ? 'Claude is working…' : '';
  $('#chat-status').classList.toggle('working', on);
}
async function generate() {
  if (S.busy || !S.project) return;
  const sk = cur().sketch;
  if (!sk.strokes.length) { setMode('draw'); updateHint(); flashHint(); return; }
  const missing = sk.marks.filter((m) => !m.note.trim()).length;
  await flush();
  const screenId = S.screenId;
  setBusy(true, missing ? `Claude is reading your sketch (guessing ${missing} undescribed mark${missing > 1 ? 's' : ''})` : 'Claude is reading your sketch');
  const t0 = performance.now();
  try {
    const r = await api.ai.ask({ slug: S.slug, screenId, image: SK.sketchImage(sk, size()), marks: marksForClaude() });
    applyLayout(screenId, r, null, true);
    logMessage(screenId, 'assistant', r.reply || 'Here is your UI.', Math.round((performance.now() - t0) / 1000));
  } catch (err) {
    if (err.message !== 'Stopped.') logMessage(screenId, 'error', err.message);
  } finally {
    setBusy(false);
  }
}
function applyLayout(screenId, r, prevIds, all) {
  const sc = S.screens[screenId];
  const meta = S.project.screens.find((s) => s.id === screenId);
  if (meta && r.sessionId) meta.sessionId = r.sessionId;
  if (S.screenId === screenId) pushUi();
  else { const h = S.hist[screenId]; if (h) { h.ui.undo.push(clone({ background: sc.ui.background, elements: sc.ui.elements })); h.ui.redo = []; } }
  sc.ui.background = r.background;
  sc.ui.elements = r.elements;
  saveUi(screenId); thumbSoon();
  if (S.screenId !== screenId) return;
  const order = new Map();
  let i = 0;
  for (const el of r.elements) if (all || !prevIds.has(el.id)) order.set(el.id, i++);
  S.reveal = order.size ? { t0: performance.now(), order } : null;
  if (S.selected && !r.elements.find((e) => e.id === S.selected)) S.selected = null;
  if (S.mode === 'draw') setMode('edit');
  renderInspect(); updateHint(); render();
}
async function sendChat(text) {
  if (S.busy || !text.trim()) return;
  if (!cur().ui.elements.length && !cur().sketch.strokes.length) { logMessage(S.screenId, 'error', 'Draw something first, then Generate. After that you can ask for changes here.'); return; }
  await flush();
  const screenId = S.screenId;
  logMessage(screenId, 'user', text);
  setBusy(true, 'Claude is changing the UI');
  const prevIds = new Set(cur().ui.elements.map((e) => e.id));
  const t0 = performance.now();
  try {
    const sc = cur();
    const r = await api.ai.ask({ slug: S.slug, screenId, image: SK.sketchImage(sc.sketch, size()), marks: marksForClaude(), message: text, ui: { background: sc.ui.background, elements: sc.ui.elements } });
    applyLayout(screenId, r, prevIds, false);
    logMessage(screenId, 'assistant', r.reply || 'Done.', Math.round((performance.now() - t0) / 1000));
  } catch (err) {
    if (err.message !== 'Stopped.') logMessage(screenId, 'error', err.message);
  } finally {
    setBusy(false);
  }
}
function logMessage(screenId, role, text, secs) {
  const sc = S.screens[screenId];
  sc.ui.log.push({ role, text, secs, at: Date.now() });
  if (sc.ui.log.length > 200) sc.ui.log.splice(0, sc.ui.log.length - 200);
  saveUi(screenId);
  if (screenId === S.screenId) renderChat();
}
function addMessage(role, text) { if (S.screenId) logMessage(S.screenId, role, text); }
function renderChat() {
  const box = $('#messages');
  const log = cur().ui.log;
  if (!log.length) {
    box.innerHTML = `<div class="empty"><h3>Change it by asking</h3><p>After you Generate, tell Claude what to change. It answers by changing the UI on the right.</p>
      <div class="idea-list">
        <button data-say="Make the main button bigger and add a settings icon button in the top right corner"><b>Bigger button, add settings</b><small>Resize and add things</small></button>
        <button data-say="Line up all the buttons and give them the same size and spacing"><b>Tidy the layout</b><small>Align and space evenly</small></button>
        <button data-say="Add a coins counter and a gems counter at the top left"><b>Add currency counters</b><small>Badges with icons</small></button>
      </div></div>`;
    return;
  }
  box.innerHTML = log.map((m) => {
    if (m.role === 'user') return `<div class="msg user">${esc(m.text)}</div>`;
    if (m.role === 'error') return `<div class="msg error">${esc(m.text)}</div>`;
    return `<div class="msg assistant">${window.renderMarkdown(m.text)}${m.secs ? `<div class="muted small-text">${m.secs}s</div>` : ''}</div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}
$('#messages').addEventListener('click', (e) => {
  const b = e.target.closest('[data-say]');
  if (b) { $('#prompt').value = b.dataset.say; $('#prompt').focus(); }
});
$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('#prompt').value;
  if (!t.trim() || S.busy) return;
  $('#prompt').value = '';
  sendChat(t);
});
$('#prompt').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#composer').requestSubmit(); }
});
$('#stop').addEventListener('click', () => api.ai.stop());
$('#building-stop').addEventListener('click', () => api.ai.stop());
$('#generate').addEventListener('click', generate);
function flashHint() { const h = $('#stage-hint'); h.hidden = false; h.animate([{ transform: 'translateX(-50%) scale(1.06)' }, { transform: 'translateX(-50%) scale(1)' }], 300); }

/* ---------- Inspect pane ---------- */
let iconUrls = null;
function iconUrl(name) {
  if (!iconUrls) iconUrls = {};
  if (!iconUrls[name]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#cfd3e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${window.DRAWY_ICONS[name]}</svg>`;
    iconUrls[name] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  return iconUrls[name];
}
const opt = (v, label, sel) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${esc(label)}</option>`;
function renderInspect() {
  const box = $('#inspect');
  if (!S.project) return;
  const ui = cur().ui;
  const el = ui.elements.find((e) => e.id === S.selected);
  if (!el) {
    box.innerHTML = `
      <div class="insp-title"><b>${esc(screenMeta().name)}</b><span class="chip-type">Screen</span></div>
      <label class="field"><span>Screen name</span><input id="f-screen-name" value="${esc(screenMeta().name)}" maxlength="40" autocomplete="off"></label>
      <label class="field"><span>Behind the UI</span><select id="f-background">
        ${opt('transparent', 'Nothing: an in-game HUD over the game', ui.background)}
        ${opt('dim', 'Dimmed game: a pop-up or pause menu', ui.background)}
        ${opt('theme', 'Themed background: a full menu screen', ui.background)}
      </select></label>
      <div class="section-label">Add</div>
      <div class="add-row"><select id="f-add" class="mini-select">${Object.entries(TYPE_INFO).map(([k, v]) => opt(k, v, 'button')).join('')}</select><button class="btn small" id="f-add-go">Add</button></div>
      <div class="section-label">Layers <span class="muted">(top is in front)</span></div>
      ${ui.elements.length ? `<ul class="layers">${[...ui.elements].reverse().map((e) => `<li data-sel="${esc(e.id)}"><span>${esc(e.text ? e.text.split('|')[0] : e.icon || e.id)}</span><span class="t">${TYPE_INFO[e.type]}</span></li>`).join('')}</ul>` : '<p class="muted small-text">No UI yet. Draw, then Generate.</p>'}
      <p class="muted small-text" style="margin-top:16px">Click something on the canvas to change it. Drag to move, pull the corners to resize, hold Shift to keep its shape, Alt to skip snapping.</p>`;
    return;
  }
  const valueField = ['bar', 'slider', 'toggle', 'checkbox', 'tabs'].includes(el.type);
  const tabCount = el.type === 'tabs' ? Math.max(1, el.text.split('|').length) : 0;
  box.innerHTML = `
    <div class="insp-title"><b>${esc(el.id)}</b><span class="chip-type">${TYPE_INFO[el.type]}</span>${el.mark ? `<span class="muted small-text">from mark ${el.mark}</span>` : ''}</div>
    <label class="field"><span>Type</span><select id="f-type">${Object.entries(TYPE_INFO).map(([k, v]) => opt(k, v, el.type)).join('')}</select></label>
    <label class="field"><span>Text ${['tabs', 'list'].includes(el.type) ? '<small class="muted">(separate with |)</small>' : ''}</span><input id="f-text" value="${esc(el.text)}" autocomplete="off"></label>
    <div class="field"><span>Colour</span><select id="f-variant">${['primary', 'secondary', 'danger', 'success', 'plain'].map((v) => opt(v, v[0].toUpperCase() + v.slice(1), el.variant)).join('')}</select></div>
    ${valueField ? `<div class="field"><span>${el.type === 'tabs' ? 'Selected tab' : el.type === 'toggle' || el.type === 'checkbox' ? 'On' : 'Value'}</span><div class="range-row">
      <input type="range" id="f-value" min="0" max="${el.type === 'tabs' ? tabCount - 1 : el.type === 'toggle' || el.type === 'checkbox' ? 1 : 1}" step="${el.type === 'tabs' || el.type === 'toggle' || el.type === 'checkbox' ? 1 : 0.01}" value="${el.value}">
      <span id="f-value-label" class="muted small-text">${el.type === 'tabs' ? Math.round(el.value) + 1 : el.type === 'toggle' || el.type === 'checkbox' ? (el.value > 0.5 ? 'on' : 'off') : Math.round(el.value * 100) + '%'}</span></div></div>` : ''}
    ${el.type === 'label' ? `<label class="field"><span>Align</span><select id="f-align">${['left', 'center', 'right'].map((v) => opt(v, v, el.align)).join('')}</select></label>` : ''}
    <div class="field"><span>Position and size</span><div class="grid4">
      ${['x', 'y', 'w', 'h'].map((k) => `<label>${k.toUpperCase()}<input type="number" data-geo="${k}" value="${el[k]}"></label>`).join('')}
    </div></div>
    <div class="field"><span>Icon</span><div class="icon-grid" id="f-icons">
      <button data-icon="" class="${el.icon ? '' : 'sel'}" title="No icon"><span class="none">none</span></button>
      ${Object.keys(window.DRAWY_ICONS).map((n) => `<button data-icon="${n}" class="${el.icon === n ? 'sel' : ''}" title="${n}"><img src="${iconUrl(n)}" alt="${n}"></button>`).join('')}
    </div></div>
    <div class="row-actions">
      <button class="btn small" id="f-dup" title="⌘D">Duplicate</button>
      <button class="btn small" id="f-front">Bring forward</button>
      <button class="btn small" id="f-back">Send back</button>
      <button class="btn small danger" id="f-del" title="Delete">Delete</button>
    </div>`;
}
function changeSelected(fn, commit) {
  const el = cur().ui.elements.find((e) => e.id === S.selected);
  if (!el) return;
  if (!S.editTxn) { pushUi(); S.editTxn = true; }
  fn(el);
  if (commit) S.editTxn = false;
  saveUi(); render(); thumbSoon();
}
$('#inspect').addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'f-screen-name') { screenMeta().name = t.value || 'Screen'; saveProject(); renderScreens(); return; }
  if (t.id === 'f-text') changeSelected((el) => { el.text = t.value; });
  if (t.id === 'f-value') changeSelected((el) => {
    el.value = +t.value;
    $('#f-value-label').textContent = el.type === 'tabs' ? Math.round(el.value) + 1 : el.type === 'toggle' || el.type === 'checkbox' ? (el.value > 0.5 ? 'on' : 'off') : Math.round(el.value * 100) + '%';
  });
  if (t.dataset.geo && t.value !== '') changeSelected((el) => { el[t.dataset.geo] = Math.round(+t.value); if (t.dataset.geo === 'w' || t.dataset.geo === 'h') el[t.dataset.geo] = Math.max(8, el[t.dataset.geo]); });
});
$('#inspect').addEventListener('change', (e) => {
  const t = e.target;
  S.editTxn = false;
  if (t.id === 'f-background') { pushUi(); cur().ui.background = t.value; saveUi(); render(); thumbSoon(); }
  if (t.id === 'f-type') changeSelected((el) => { el.type = t.value; if (t.value === 'tabs' && !el.text.includes('|')) el.value = 0; }, true), renderInspect();
  if (t.id === 'f-variant') changeSelected((el) => { el.variant = t.value; }, true);
  if (t.id === 'f-align') changeSelected((el) => { el.align = t.value; }, true);
  if (t.id === 'f-text' && cur().ui.elements.find((x) => x.id === S.selected)?.type === 'tabs') renderInspect();
});
$('#inspect').addEventListener('focusout', () => { S.editTxn = false; });
$('#inspect').addEventListener('click', (e) => {
  const t = e.target.closest('button, li');
  if (!t) return;
  if (t.dataset.sel) { select(t.dataset.sel); return; }
  if (t.dataset.icon !== undefined) { changeSelected((el) => { el.icon = t.dataset.icon; }, true); renderInspect(); return; }
  if (t.id === 'f-add-go') addElement($('#f-add').value);
  if (t.id === 'f-dup') duplicate();
  if (t.id === 'f-del') removeSelected();
  if (t.id === 'f-front' || t.id === 'f-back') {
    const els = cur().ui.elements;
    const i = els.findIndex((x) => x.id === S.selected);
    const j = t.id === 'f-front' ? i + 1 : i - 1;
    if (i < 0 || j < 0 || j >= els.length) return;
    pushUi(); [els[i], els[j]] = [els[j], els[i]]; saveUi(); render(); thumbSoon();
  }
});
function uniqueId(base) {
  const ids = new Set(cur().ui.elements.map((e) => e.id));
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
  return id;
}
function addElement(type) {
  const [w, h] = DEFAULT_SIZE[type];
  const sample = { button: 'Play', label: 'Score: 0', title: 'My Game', window: 'Settings', tabs: 'Items|Skills|Map', list: 'First|Second|Third', input: 'Your name', toggle: 'Music', checkbox: 'Sound', slider: 'Volume', image: 'Portrait', badge: '1,250' };
  const el = {
    id: uniqueId(type), type, mark: 0,
    x: Math.round((size().w - w) / 2), y: Math.round((size().h - h) / 2), w, h,
    text: sample[type] || '', icon: { icon: 'star', badge: 'coins', bar: 'heart' }[type] || '', variant: type === 'bar' ? 'danger' : 'primary',
    value: type === 'tabs' ? 0 : type === 'checkbox' || type === 'toggle' ? 1 : 0.7, align: 'center',
  };
  pushUi(); cur().ui.elements.push(el); saveUi(); thumbSoon();
  if (S.mode !== 'edit') setMode('edit');
  S.reveal = { t0: performance.now(), order: new Map([[el.id, 0]]) };
  select(el.id); updateHint();
}
function duplicate() {
  const el = cur().ui.elements.find((e) => e.id === S.selected);
  if (!el) return;
  const copy = { ...clone(el), id: uniqueId(el.id.replace(/-\d+$/, '')), x: Math.min(size().w - el.w, el.x + 24), y: Math.min(size().h - el.h, el.y + 24) };
  pushUi(); cur().ui.elements.push(copy); saveUi(); thumbSoon(); select(copy.id);
}
function removeSelected() {
  if (!S.selected) return;
  pushUi();
  cur().ui.elements = cur().ui.elements.filter((e) => e.id !== S.selected);
  S.selected = null; saveUi(); renderInspect(); updateHint(); render(); thumbSoon();
}

/* ---------- Screens ---------- */
function thumbSize() { const r = size().w / size().h; return r >= 1 ? [128, Math.round(128 / r)] : [Math.round(72 * r), 72]; }
function paintThumb(c, id) {
  const [tw, th] = thumbSize();
  const dpr = window.devicePixelRatio || 1;
  c.width = tw * dpr; c.height = th * dpr; c.style.width = tw + 'px'; c.style.height = th + 'px';
  const g = c.getContext('2d');
  g.setTransform(dpr * tw / size().w, 0, 0, dpr * th / size().h, 0, 0);
  const sc = S.screens[id];
  if (sc.ui.elements.length) { drawBackdrop(g, size().w, size().h, 'scene'); paintUi(g, sc.ui, theme()); }
  else { g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, size().w, size().h); SK.drawSketch(g, sc.sketch, {}); }
}
function renderScreens() {
  const box = $('#screens');
  box.innerHTML = S.project.screens.map((s) => `
    <div class="screen-thumb ${s.id === S.screenId ? 'active' : ''}" data-screen="${s.id}" role="button" tabindex="0" title="${esc(s.name)}">
      <canvas></canvas><span>${esc(s.name)}</span>
      ${S.project.screens.length > 1 ? `<button class="x" data-del="${s.id}" aria-label="Delete ${esc(s.name)}">✕</button>` : ''}
    </div>`).join('');
  $$('.screen-thumb', box).forEach((el) => paintThumb($('canvas', el), el.dataset.screen));
}
const thumbSoon = () => later('thumbs', () => {
  const el = $(`.screen-thumb[data-screen="${S.screenId}"] canvas`);
  if (el) paintThumb(el, S.screenId);
}, 250);
$('#screens').addEventListener('click', async (e) => {
  const del = e.target.closest('[data-del]');
  if (del) {
    e.stopPropagation();
    const s = S.project.screens.find((x) => x.id === del.dataset.del);
    if (!confirm(`Delete the screen “${s.name}” and its drawing? This cannot be undone.`)) return;
    S.project.screens = S.project.screens.filter((x) => x.id !== s.id);
    delete S.screens[s.id];
    await api.projects.save(S.slug, S.project);
    await api.screens.remove(S.slug, s.id);
    if (S.screenId === s.id) switchScreen(S.project.screens[0].id); else renderScreens();
    return;
  }
  const t = e.target.closest('[data-screen]');
  if (t && t.dataset.screen !== S.screenId) switchScreen(t.dataset.screen);
});
$('#screen-add').addEventListener('click', async () => {
  const id = 's' + (S.project.nextScreen++);
  const names = ['Main menu', 'HUD', 'Pause', 'Settings', 'Shop', 'Inventory', 'Game over', 'Level select'];
  const used = new Set(S.project.screens.map((s) => s.name));
  const name = names.find((n) => !used.has(n)) || `Screen ${S.project.screens.length + 1}`;
  S.project.screens.push({ id, name, note: '', sessionId: null });
  S.screens[id] = { sketch: { strokes: [], marks: [], nextStroke: 1, nextMark: 1 }, ui: { background: 'transparent', elements: [], log: [] } };
  await api.projects.save(S.slug, S.project);
  switchScreen(id);
  setMode('draw');
});

/* ---------- Export ---------- */
function piece(el, t, opts, pad) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(el.w + pad * 2); c.height = Math.ceil(el.h + pad * 2);
  const g = c.getContext('2d');
  g.translate(pad - el.x, pad - el.y);
  drawElement(g, t, el, opts);
  return c.toDataURL('image/png');
}
const FRAME_TYPES = new Set(['panel', 'window', 'button', 'input', 'image', 'badge', 'list']);
async function exportScreen() {
  if (!S.project) return;
  const sc = cur();
  if (!sc.ui.elements.length) { addMessage('error', 'There is no UI on this screen yet. Draw it and press Generate first.'); showTab('chat'); return; }
  const t = theme();
  await loadFonts();
  // Draw once so every icon starts loading, then wait for them before the real pass.
  const warm = document.createElement('canvas').getContext('2d');
  sc.ui.elements.forEach((el) => { for (const p of ['all', ...exportParts(el)]) drawElement(warm, t, el, ['hover', 'pressed', 'disabled'].includes(p) ? { state: p } : { part: p }); });
  await iconsReady();
  const pad = t.pad;
  const files = [];
  const full = document.createElement('canvas');
  full.width = size().w; full.height = size().h;
  const fg = full.getContext('2d');
  drawBackground(fg, t, size().w, size().h, sc.ui.background);
  sc.ui.elements.forEach((el) => drawElement(fg, t, el));
  files.push({ path: 'screen.png', dataUrl: full.toDataURL('image/png') });
  const elements = sc.ui.elements.map((el) => {
    const parts = {};
    for (const p of exportParts(el)) {
      const file = `images/${el.id}@${p}.png`;
      files.push({ path: file, dataUrl: piece(el, t, ['hover', 'pressed', 'disabled'].includes(p) ? { state: p } : { part: p }, pad) });
      parts[p] = file;
    }
    const file = `images/${el.id}.png`;
    files.push({ path: file, dataUrl: piece(el, t, {}, pad) });
    const out = {
      id: el.id, type: el.type, x: el.x, y: el.y, w: el.w, h: el.h,
      text: el.text, icon: el.icon, variant: el.variant, value: el.value, align: el.align,
      image: { file, x: el.x - pad, y: el.y - pad, w: el.w + pad * 2, h: el.h + pad * 2 },
      parts,
    };
    if (FRAME_TYPES.has(el.type)) {
      const edge = Math.ceil(t.radius + (t.panel.edgeW || 0) + (t.outline ? t.outline.width : 0) + 4);
      const top = el.type === 'window' ? Math.ceil(Math.max(48, Math.min(96, el.h * 0.14))) + 4 : edge;
      out.nineSlice = { left: pad + edge, top: pad + top, right: pad + edge, bottom: pad + edge + (el.type === 'button' ? t.depth : 0) };
    }
    return out;
  });
  const layout = {
    drawy: 1,
    screen: screenMeta().name,
    canvas: { w: size().w, h: size().h },
    theme: S.project.theme,
    background: sc.ui.background,
    font: { family: t.font, file: `fonts/${t.font}.ttf`, weight: t.weight, uppercase: !!t.upper },
    pad,
    elements,
  };
  files.push({ path: 'layout.json', text: JSON.stringify(layout, null, 2) });
  files.push({ path: 'README.txt', text: readme(layout) });
  try {
    const dir = await api.exportScreen({ slug: S.slug, screenName: screenMeta().name, files, font: t.font });
    S.exportDir = dir;
    const pngs = files.filter((f) => f.dataUrl).length;
    $('#export-summary').textContent = `${screenMeta().name}: ${elements.length} elements, ${pngs} pictures, in the ${t.name} theme.`;
    $('#export-tree').textContent = `${dir}\n  layout.json   where everything goes\n  screen.png    the whole screen\n  images/       one picture per element, plus @hover, @pressed, @track, @fill...\n  fonts/        ${t.font}.ttf and its licence (OFL)\n  README.txt    how to use it`;
    $('#export-dialog').showModal();
  } catch (err) { showError(err); }
}
function readme(layout) {
  return `Drawy export: ${layout.screen}
Canvas ${layout.canvas.w} x ${layout.canvas.h}, theme "${layout.theme}".

layout.json lists every element with its box (x, y, w, h in canvas pixels, top-left origin)
and its pictures:
- image.file is the element as it looks, with its text and icon. Its picture is bigger than
  the box by "pad" (${layout.pad} px) on every side, for the shadow and glow, so draw it at
  image.x, image.y (the box minus pad).
- parts are the extra pictures for game code: @blank (the frame with no text, so you can
  write your own), @hover / @pressed / @disabled (button states), @track and @fill (bars and
  sliders: crop or scale the fill by the value), @knob, @on / @off (toggles and checkboxes),
  @base (joysticks). They are all the same size as image.
- nineSlice (frames only) is how far in from each edge of the picture the corners end, for
  stretching a frame to a new size without warping its corners (Godot NinePatchRect patch
  margins, Unity sprite borders, Phaser NineSlice).
- text, icon, variant, value and align are what the element says and does; draw live text
  with the font in fonts/ (${layout.font.family}${layout.font.uppercase ? ', upper case' : ''}).
- background: "transparent" means draw it over the game, "dim" means darken the game under it,
  "theme" means screen.png already includes a full background.

The fonts are under the SIL Open Font License (see fonts/), free to ship in games.
Icons are from Lucide (ISC licence).
`;
}
$('#export').addEventListener('click', exportScreen);
$('#export-close').addEventListener('click', () => $('#export-dialog').close());
$('#export-open').addEventListener('click', () => { if (S.exportDir) api.openFolder(S.exportDir); $('#export-dialog').close(); });

/* ---------- New project ---------- */
let newTheme = 'cartoon';
function themePreview(c, id) {
  const t = THEMES[id];
  const W = 320, H = 200;
  const dpr = window.devicePixelRatio || 1;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  t.background(g, W, H);
  const els = [
    { id: 'p', type: 'button', x: 70, y: 36, w: 180, h: 54, text: 'Play', icon: 'play', variant: 'primary', value: 0 },
    { id: 'b', type: 'bar', x: 66, y: 112, w: 188, h: 26, text: '', icon: 'heart', variant: 'danger', value: 0.7 },
    { id: 's', type: 'button', x: 126, y: 150, w: 44, h: 44, text: '', icon: 'settings', variant: 'secondary', value: 0 },
    { id: 'c', type: 'button', x: 178, y: 150, w: 44, h: 44, text: '', icon: 'trophy', variant: 'success', value: 0 },
  ];
  const scaled = { ...t, radius: t.radius * 0.5, depth: Math.round(t.depth * 0.5), pad: 10, outline: t.outline ? { ...t.outline, width: Math.max(2, t.outline.width * 0.6) } : null, shadow: t.shadow ? { ...t.shadow, blur: t.shadow.blur * 0.5, dx: t.shadow.dx * 0.5, dy: t.shadow.dy * 0.5 } : null, edgeW: (t.edgeW || 0) * 0.6 };
  els.forEach((el) => drawElement(g, scaled, el));
}
function renderThemeCards() {
  const box = $('#theme-cards');
  box.innerHTML = Object.entries(THEMES).map(([id, t]) => `<button type="button" class="theme-card ${id === newTheme ? 'sel' : ''}" data-theme="${id}"><canvas></canvas><b>${t.name}</b><small>${t.blurb}</small></button>`).join('');
  $$('.theme-card', box).forEach((b) => themePreview($('canvas', b), b.dataset.theme));
}
$('#theme-cards').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme]');
  if (!b) return;
  newTheme = b.dataset.theme;
  $$('.theme-card').forEach((x) => x.classList.toggle('sel', x === b));
});
async function openNewDialog() {
  $('#new-error').hidden = true;
  $('#new-form').reset();
  await Promise.all(Object.values(THEMES).map((t) => document.fonts.load(`${t.weight} 40px "${t.font}"`).catch(() => {})));
  renderThemeCards();
  $('#new-dialog').showModal();
  // Icons decode a moment later; draw the cards again once they are in.
  setTimeout(async () => { await iconsReady(); renderThemeCards(); }, 60);
  $('#new-name').focus();
}
$('#new-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#new-name').value.trim();
  if (!name) return;
  const [w, h] = new FormData($('#new-form')).get('size').split('x').map(Number);
  try {
    const slug = await api.projects.create({ name, width: w, height: h, theme: newTheme });
    const data = await api.projects.open(slug);
    data.project.note = $('#new-note').value.trim();
    await api.projects.save(slug, data.project);
    $('#new-dialog').close();
    await loadProjects(slug);
  } catch (err) {
    $('#new-error').textContent = err.message; $('#new-error').hidden = false;
  }
});
$('#new-cancel').addEventListener('click', () => $('#new-dialog').close());
$('#project-new').addEventListener('click', openNewDialog);
$('#welcome-new').addEventListener('click', openNewDialog);
$('#project-select').addEventListener('change', (e) => openProject(e.target.value));
$('#project-folder').addEventListener('click', () => S.slug && api.projects.folder(S.slug));

/* ---------- Top bar and stage bar ---------- */
$('#theme-select').innerHTML = Object.entries(THEMES).map(([id, t]) => `<option value="${id}">${t.name}</option>`).join('');
$('#theme-select').addEventListener('change', async (e) => {
  S.project.theme = e.target.value;
  saveProject();
  await loadFonts();
  if (S.mode === 'draw' && cur().ui.elements.length) setMode('edit');
  S.reveal = { t0: performance.now(), order: new Map(cur().ui.elements.map((el, i) => [el.id, i * 0.35])) };
  render(); renderScreens();
});
$('#undo').addEventListener('click', () => undo(false));
$('#redo').addEventListener('click', () => undo(true));
$$('.seg-btn').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
$$('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool, b.dataset.size ? +b.dataset.size : 0)));
$('#clear').addEventListener('click', () => {
  if (!cur().sketch.strokes.length) return;
  pushSketch();
  const sk = cur().sketch;
  sk.strokes = []; sk.marks = [];
  sketchChanged(); render();
});
$('#ghost').addEventListener('change', (e) => { S.ghost = e.target.checked; render(); });
$('#backdrop').addEventListener('change', (e) => { S.backdrop = e.target.value; try { localStorage.setItem('backdrop', S.backdrop); } catch {} render(); });
try { S.backdrop = localStorage.getItem('backdrop') || 'scene'; $('#backdrop').value = S.backdrop; } catch {}

/* ---------- Keyboard ---------- */
window.addEventListener('keydown', (e) => {
  if (!S.project || $('dialog[open]')) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 'Enter') { e.preventDefault(); generate(); return; }
  if (typing) { if (e.key === 'Escape') document.activeElement.blur(); return; }
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
  if (mod) return;
  const key = e.key.toLowerCase();
  if (key === 'd') setMode('draw');
  else if (key === 'e') setMode('edit');
  else if (key === 't') setMode('try');
  else if (S.mode === 'draw' && ['1', '2', '3'].includes(key)) setTool('pen', [4, 8, 16][+key - 1]);
  else if (S.mode === 'draw' && key === 'x') setTool('eraser');
  else if (S.mode === 'draw' && key === 'g') setTool('group');
  else if (S.mode !== 'draw' && key === 's') { S.ghost = !S.ghost; $('#ghost').checked = S.ghost; render(); }
  else if (S.mode === 'edit' && S.selected && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); removeSelected(); }
  else if (S.mode === 'edit' && e.key === 'Escape') select(null);
  else if (S.mode === 'edit' && S.selected && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!e.repeat) S.editTxn = false;
    changeSelected((el) => { el.x += d[0]; el.y += d[1]; });
    renderInspect();
  }
});
window.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow')) S.editTxn = false; });

/* ---------- Splitter ---------- */
(function splitter() {
  const left = $('#left');
  let saved = 0;
  try { saved = parseInt(localStorage.getItem('leftWidth'), 10); } catch {}
  if (saved) left.style.width = `${saved}px`;
  let dragging = false;
  $('#splitter').addEventListener('mousedown', (e) => { dragging = true; document.body.classList.add('dragging'); e.preventDefault(); });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    left.style.width = `${Math.max(300, Math.min(e.clientX, window.innerWidth - 560))}px`;
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('dragging');
    try { localStorage.setItem('leftWidth', parseInt(left.style.width, 10)); } catch {}
  });
})();

window.addEventListener('beforeunload', () => { flush(); });

/* ---------- Start ---------- */
setTool('pen', 4);
loadProjects().then(fit).catch((err) => {
  document.body.insertAdjacentHTML('beforeend', `<p class="error" style="padding:20px">${esc(err.message)}</p>`);
});
