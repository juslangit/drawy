// The layout Claude returns, and the checks every answer goes through before Drawy uses it.
// Claude only ever sends data in this shape; Drawy's own code draws and exports it.
const ICONS = require('./icon-names.json');

const TYPES = {
  panel: 'a plain frame or card that holds other things',
  window: 'a panel with a title bar; text = the title',
  button: 'a pressable button; text and/or icon (icon only = an icon button)',
  label: 'plain text (score, hints, names, numbers)',
  title: 'big decorated heading text, such as the game name',
  bar: 'a progress bar (health, mana, XP, loading); value 0..1, optional text and icon',
  slider: 'a draggable slider (volume); value 0..1, optional text',
  toggle: 'an on/off switch; value 1 = on, optional text beside it',
  checkbox: 'a tick box; value 1 = ticked, text beside it',
  input: 'a text field; text = placeholder',
  icon: 'a single icon with no frame',
  image: 'a framed slot for art the game fills in (portrait, item, minimap); text = what goes there',
  badge: 'a small pill showing a count or currency, usually icon + number (coins, gems, level)',
  tabs: 'a row of tabs; text = tab names separated by "|", value = index of the selected tab',
  list: 'a framed list; text = rows separated by "|"',
  divider: 'a thin line or ornament that separates sections',
  joystick: 'an on-screen touch joystick (round base and knob)',
};
const VARIANTS = ['primary', 'secondary', 'danger', 'success', 'plain'];
const ALIGNS = ['left', 'center', 'right'];
const BACKGROUNDS = ['transparent', 'dim', 'theme'];

const elementSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'short readable unique id, e.g. "play-button", "health-bar"' },
    type: { type: 'string', enum: Object.keys(TYPES) },
    mark: { type: 'integer', description: 'the number of the drawn mark this element comes from, 0 if none' },
    x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' },
    text: { type: 'string' },
    icon: { type: 'string', enum: ['', ...ICONS] },
    variant: { type: 'string', enum: VARIANTS },
    value: { type: 'number' },
    align: { type: 'string', enum: ALIGNS },
  },
  required: ['id', 'type', 'mark', 'x', 'y', 'w', 'h', 'text', 'icon', 'variant', 'value', 'align'],
  additionalProperties: false,
};

const LAYOUT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'one or two short sentences to the user about what you made or changed' },
    background: { type: 'string', enum: BACKGROUNDS },
    elements: { type: 'array', items: elementSchema },
  },
  required: ['reply', 'background', 'elements'],
  additionalProperties: false,
};

const MAX_ELEMENTS = 200;
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// Check one element field by field. Anything unknown is dropped or replaced, never trusted.
function cleanElement(raw, size) {
  if (!raw || typeof raw !== 'object' || !TYPES[raw.type]) return null;
  const w = clamp(Math.round(num(raw.w, 100)), 8, size.w);
  const h = clamp(Math.round(num(raw.h, 40)), 4, size.h);
  return {
    id: slug(raw.id) || raw.type,
    type: raw.type,
    mark: Math.max(0, Math.round(num(raw.mark))),
    x: clamp(Math.round(num(raw.x)), 0, size.w - w),
    y: clamp(Math.round(num(raw.y)), 0, size.h - h),
    w,
    h,
    text: String(raw.text ?? '').slice(0, 400),
    icon: ICONS.includes(raw.icon) ? raw.icon : '',
    variant: VARIANTS.includes(raw.variant) ? raw.variant : 'primary',
    value: clamp(num(raw.value, raw.type === 'tabs' ? 0 : 0.7), 0, raw.type === 'tabs' ? 20 : 1),
    align: ALIGNS.includes(raw.align) ? raw.align : 'center',
  };
}

function cleanLayout(raw, size) {
  const elements = [];
  const seen = new Set();
  for (const item of Array.isArray(raw?.elements) ? raw.elements.slice(0, MAX_ELEMENTS) : []) {
    const el = cleanElement(item, size);
    if (!el) continue;
    let id = el.id;
    for (let n = 2; seen.has(id); n++) id = `${el.id}-${n}`;
    seen.add(id);
    elements.push({ ...el, id });
  }
  return {
    reply: String(raw?.reply ?? '').slice(0, 2000),
    background: BACKGROUNDS.includes(raw?.background) ? raw.background : 'transparent',
    elements,
  };
}

module.exports = { TYPES, VARIANTS, ALIGNS, BACKGROUNDS, ICONS, LAYOUT_SCHEMA, cleanLayout, cleanElement, slug };
