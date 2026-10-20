// Drawing UI elements in a theme. The same code paints the stage, the thumbnails and every
// exported PNG, so what you see is exactly what the game gets.
(function () {
  /* ---------- Colour helpers ---------- */
  function parse(c) {
    if (c.startsWith('#')) {
      const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 1];
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  const fmt = ([r, g, b, a]) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+a.toFixed(3)})`;
  const mix = (c, to, t) => {
    const a = parse(c), b = parse(to);
    return fmt([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3]]);
  };
  const lighten = (c, t) => mix(c, '#ffffff', t);
  const darken = (c, t) => mix(c, '#000000', t);
  const alpha = (c, a) => { const p = parse(c); return fmt([p[0], p[1], p[2], a]); };

  /* ---------- Themes ---------- */
  const THEMES = {
    cartoon: {
      name: 'Cartoon', blurb: 'Chunky, bright, thick outlines',
      font: 'Fredoka', weight: 700, upper: false, spacing: 0,
      radius: 26, corner: 'round', outline: { color: '#22183a', width: 5 }, depth: 8,
      shadow: { color: 'rgba(20,10,40,.28)', blur: 0, dx: 0, dy: 7 }, gloss: true, pad: 20,
      text: '#2a1f4a', hud: '#ffffff', hudStroke: '#22183a', hudStrokeW: 0.2, muted: '#8a83a8',
      panel: { fill: ['#ffffff', '#e9eeff'], edge: null, edgeW: 0, inner: null },
      header: { fill: ['#8a6bff', '#6243e8'], text: '#ffffff' },
      inset: { fill: ['#e4e8f7', '#f4f6ff'], text: '#2a1f4a' },
      track: '#3a2f5e',
      colors: {
        primary: { fill: ['#6fe063', '#2fae3c'], text: '#ffffff' },
        secondary: { fill: ['#62b4ff', '#2f7de0'], text: '#ffffff' },
        danger: { fill: ['#ff7a7a', '#e2384a'], text: '#ffffff' },
        success: { fill: ['#ffd84a', '#ffa800'], text: '#ffffff' },
        plain: { fill: ['#ffffff', '#e2e7f6'], text: '#2a1f4a' },
      },
      textStroke: '#22183a', textStrokeW: 0.16,
      background: (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#5ec8ff'); g.addColorStop(1, '#9b7bff');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.save(); ctx.translate(w / 2, h * 1.1); ctx.fillStyle = 'rgba(255,255,255,.08)';
        for (let i = 0; i < 16; i++) {
          ctx.rotate(Math.PI / 8); ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.lineTo(-w * 0.12, -h * 2); ctx.lineTo(w * 0.12, -h * 2); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      },
    },
    fantasy: {
      name: 'Fantasy', blurb: 'Parchment, wood and gold',
      font: 'Cinzel', weight: 700, upper: true, spacing: 0.04,
      radius: 10, corner: 'round', outline: null, depth: 0,
      shadow: { color: 'rgba(0,0,0,.45)', blur: 18, dx: 0, dy: 6 }, gloss: false, rivets: true, pad: 28,
      text: '#3b2410', hud: '#fff1cf', hudStroke: '#2a1808', hudStrokeW: 0.16, muted: '#8a6a44',
      panel: { fill: ['#f3e5c0', '#d8bd84'], edge: '#5b3a1c', edgeW: 7, inner: '#c99a3e' },
      header: { fill: ['#82522a', '#5b3a1c'], text: '#ffe7a8' },
      inset: { fill: ['#e2cd98', '#efe0b8'], text: '#3b2410' },
      track: '#3a2614',
      colors: {
        primary: { fill: ['#c8412f', '#8c2216'], edge: '#40150a', inner: '#e8b752', text: '#ffe7a8' },
        secondary: { fill: ['#a3713f', '#6c4421'], edge: '#3a220e', inner: '#d9a441', text: '#ffe7a8' },
        danger: { fill: ['#8c2424', '#5a1010'], edge: '#2e0707', inner: '#c98a3e', text: '#ffd9c0' },
        success: { fill: ['#5d8a30', '#3a5c1a'], edge: '#1f3309', inner: '#d9b14a', text: '#fff1c4' },
        plain: { fill: ['#f3e5c0', '#d8bd84'], edge: '#5b3a1c', inner: '#c99a3e', text: '#3b2410' },
      },
      edgeW: 5, textStroke: '#2a1206', textStrokeW: 0.1,
      background: (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, w * 0.7);
        g.addColorStop(0, '#5a3a20'); g.addColorStop(1, '#1e1209');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 3;
        for (let y = 40; y < h; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + 14, w * 0.7, y - 14, w, y + 6); ctx.stroke(); }
      },
    },
    scifi: {
      name: 'Sci-fi', blurb: 'Neon lines, cut corners, glow',
      font: 'Orbitron', weight: 700, upper: true, spacing: 0.08,
      radius: 16, corner: 'chamfer', outline: null, depth: 0,
      shadow: null, glow: true, brackets: true, pad: 24,
      text: '#d4f9ff', hud: '#d4f9ff', hudStroke: 'rgba(0,16,32,.85)', hudStrokeW: 0.1, muted: '#6aa3b8',
      panel: { fill: ['rgba(12,32,54,.9)', 'rgba(6,16,30,.94)'], edge: '#3fe0ff', edgeW: 2, inner: 'rgba(63,224,255,.22)' },
      header: { fill: ['rgba(63,224,255,.28)', 'rgba(63,224,255,.08)'], text: '#eaffff' },
      inset: { fill: ['rgba(0,10,22,.9)', 'rgba(0,18,34,.9)'], text: '#d4f9ff' },
      track: 'rgba(0,22,40,.9)',
      colors: {
        primary: { fill: ['rgba(63,224,255,.42)', 'rgba(20,110,190,.3)'], edge: '#3fe0ff', text: '#f0ffff' },
        secondary: { fill: ['rgba(150,125,255,.4)', 'rgba(80,50,190,.3)'], edge: '#a492ff', text: '#f3efff' },
        danger: { fill: ['rgba(255,77,109,.45)', 'rgba(150,20,50,.35)'], edge: '#ff4d6d', text: '#fff0f3' },
        success: { fill: ['rgba(61,255,168,.4)', 'rgba(10,130,90,.3)'], edge: '#3dffa8', text: '#efffF7' },
        plain: { fill: ['rgba(12,32,54,.85)', 'rgba(6,16,30,.9)'], edge: 'rgba(140,220,255,.55)', text: '#d4f9ff' },
      },
      edgeW: 2,
      background: (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#04101f'); g.addColorStop(1, '#0a1f38');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(63,224,255,.07)'; ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      },
    },
    pixel: {
      name: 'Pixel', blurb: 'Retro 8-bit, hard edges',
      font: 'PressStart2P', weight: 400, upper: true, spacing: 0, pixel: true,
      radius: 12, corner: 'pixel', outline: { color: '#0d0b1a', width: 6 }, depth: 6,
      shadow: { color: 'rgba(0,0,0,.45)', blur: 0, dx: 6, dy: 6 }, bevel: true, pad: 20,
      text: '#f4f1de', hud: '#ffffff', hudStroke: '#0d0b1a', hudStrokeW: 0.18, muted: '#8b9bb4',
      panel: { fill: ['#3a4466', '#3a4466'], edge: null, edgeW: 0, inner: null },
      header: { fill: ['#262b44', '#262b44'], text: '#feae34' },
      inset: { fill: ['#181425', '#181425'], text: '#c0cbdc' },
      track: '#181425',
      colors: {
        primary: { fill: ['#e43b44', '#e43b44'], text: '#ffffff' },
        secondary: { fill: ['#0099db', '#0099db'], text: '#ffffff' },
        danger: { fill: ['#a22633', '#a22633'], text: '#ffffff' },
        success: { fill: ['#63c74d', '#63c74d'], text: '#ffffff' },
        plain: { fill: ['#c0cbdc', '#c0cbdc'], text: '#181425' },
      },
      textStroke: '#0d0b1a', textStrokeW: 0.14,
      background: (ctx, w, h) => {
        ctx.fillStyle = '#1b1530'; ctx.fillRect(0, 0, w, h);
        let s = 7;
        const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 160; i++) { ctx.fillStyle = rnd() > 0.8 ? '#feae34' : '#5a6988'; const z = rnd() > 0.85 ? 8 : 4; ctx.fillRect(Math.floor(rnd() * w / 4) * 4, Math.floor(rnd() * h / 4) * 4, z, z); }
      },
    },
    minimal: {
      name: 'Minimal', blurb: 'Clean, soft and modern',
      font: 'Inter', weight: 650, upper: false, spacing: -0.01,
      radius: 18, corner: 'round', outline: null, depth: 0,
      shadow: { color: 'rgba(15,20,40,.2)', blur: 26, dx: 0, dy: 10 }, pad: 34,
      text: '#14161f', hud: '#ffffff', hudStroke: null, hudShadow: 'rgba(0,0,0,.55)', muted: '#8a90a2',
      panel: { fill: ['rgba(255,255,255,.94)', 'rgba(247,248,252,.94)'], edge: 'rgba(20,25,40,.08)', edgeW: 1.5, inner: null },
      header: null,
      inset: { fill: ['#eef0f5', '#eef0f5'], text: '#14161f' },
      track: 'rgba(120,130,160,.4)',
      colors: {
        primary: { fill: ['#5a74ff', '#4560f5'], text: '#ffffff' },
        secondary: { fill: ['#ffffff', '#f1f2f7'], edge: 'rgba(20,25,40,.1)', text: '#14161f' },
        danger: { fill: ['#ff5a69', '#f23d4f'], text: '#ffffff' },
        success: { fill: ['#26c97f', '#18b06b'], text: '#ffffff' },
        plain: { fill: ['rgba(255,255,255,.7)', 'rgba(255,255,255,.7)'], edge: 'rgba(20,25,40,.1)', text: '#14161f' },
      },
      edgeW: 1.5,
      background: (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#2a3147'); g.addColorStop(1, '#141826');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      },
    },
  };

  // The bar/fill colour each variant uses.
  const BAR = { primary: '#3d9cff', secondary: '#ffc23d', danger: '#ff4152', success: '#4cd964', plain: '#b8c0d6' };

  /* ---------- Icons (lucide, drawn from SVG) ---------- */
  const iconCache = new Map();
  let onIconLoad = () => {};
  function icon(name, color, strokeW = 2.2) {
    const key = `${name}|${color}|${strokeW}`;
    let img = iconCache.get(key);
    if (!img) {
      const body = (window.DRAWY_ICONS || {})[name];
      if (!body) return null;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
      img = new Image();
      img.onload = () => onIconLoad();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      iconCache.set(key, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }
  // Wait until every icon a set of elements needs is decoded (for exports and thumbnails).
  async function iconsReady() {
    await Promise.all([...iconCache.values()].map((img) => (img.complete ? null : img.decode().catch(() => {}))));
  }

  function drawIcon(ctx, t, name, cx, cy, size, color, outlined) {
    const sw = t.pixel ? 2.6 : t.font === 'Fredoka' ? 2.6 : 2.2;
    if (outlined && (t.hudStroke || t.textStroke)) {
      const back = icon(name, t.hudStroke || t.textStroke, sw + 3.2);
      if (back) ctx.drawImage(back, cx - size / 2, cy - size / 2, size, size);
    }
    const img = icon(name, color, sw);
    if (!img) return;
    if (t.glow) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = size * 0.3; }
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    if (t.glow) ctx.restore();
  }

  /* ---------- Shapes ---------- */
  function shape(ctx, t, x, y, w, h, r) {
    r = Math.max(0, Math.min(r ?? t.radius, w / 2, h / 2));
    ctx.beginPath();
    if (t.corner === 'chamfer') {
      ctx.moveTo(x + r, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - r);
      ctx.lineTo(x + w - r, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + r); ctx.closePath();
    } else if (t.corner === 'pixel') {
      const s = Math.max(2, Math.round(r / 2));
      const n = r >= s * 2 ? 2 : 1;
      ctx.moveTo(x + s * n, y); ctx.lineTo(x + w - s * n, y);
      for (let i = n - 1; i >= 0; i--) { ctx.lineTo(x + w - s * i, y + s * (n - 1 - i)); ctx.lineTo(x + w - s * i, y + s * (n - i)); }
      ctx.lineTo(x + w, y + h - s * n);
      for (let i = 1; i <= n; i++) { ctx.lineTo(x + w - s * (i - 1), y + h - s * (n - i)); ctx.lineTo(x + w - s * i, y + h - s * (n - i)); }
      ctx.lineTo(x + s * n, y + h);
      for (let i = n - 1; i >= 0; i--) { ctx.lineTo(x + s * i, y + h - s * (n - 1 - i)); ctx.lineTo(x + s * i, y + h - s * (n - i)); }
      ctx.lineTo(x, y + s * n);
      for (let i = 1; i <= n; i++) { ctx.lineTo(x + s * (i - 1), y + s * (n - i)); ctx.lineTo(x + s * i, y + s * (n - i)); }
      ctx.closePath();
    } else {
      ctx.roundRect(x, y, w, h, r);
    }
  }

  function grad(ctx, fill, y, h) {
    if (fill[0] === fill[1]) return fill[0];
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, fill[0]); g.addColorStop(1, fill[1]);
    return g;
  }

  function stateFill(fill, state) {
    if (state === 'hover') return fill.map((c) => lighten(c, 0.12));
    if (state === 'pressed') return fill.map((c) => darken(c, 0.12));
    return fill;
  }

  // One framed surface: shadow, depth, outline, body, edge, inner line, gloss, ornaments.
  // Returns how far the face moved down (pressed buttons sink into their depth).
  function frame(ctx, t, x, y, w, h, spec, state = 'normal', opts = {}) {
    const r = opts.r ?? t.radius;
    const depth = opts.flat ? 0 : t.depth;
    const sink = state === 'pressed' ? depth : 0;
    const faceH = h - depth;
    const fill = stateFill(spec.fill, state);
    const ow = t.outline ? t.outline.width : 0;

    if (t.shadow && !opts.noShadow && state !== 'pressed') {
      ctx.save();
      ctx.shadowColor = t.shadow.color; ctx.shadowBlur = t.shadow.blur;
      ctx.shadowOffsetX = t.shadow.dx; ctx.shadowOffsetY = t.shadow.dy;
      shape(ctx, t, x - ow, y - ow, w + ow * 2, h + ow * 2, r + ow);
      ctx.fillStyle = t.outline ? t.outline.color : fill[1];
      ctx.fill();
      ctx.restore();
    }
    if (t.outline) {
      shape(ctx, t, x - ow, y - ow + sink, w + ow * 2, h - sink + ow * 2, r + ow);
      ctx.fillStyle = t.outline.color; ctx.fill();
    }
    if (depth) {
      shape(ctx, t, x, y + sink, w, faceH + depth - sink, r);
      ctx.fillStyle = darken(fill[1], 0.28); ctx.fill();
    }
    const fy = y + sink;
    shape(ctx, t, x, fy, w, faceH, r);
    if (t.glow && spec.edge) { ctx.save(); ctx.shadowColor = alpha(spec.edge, state === 'hover' ? 0.9 : 0.6); ctx.shadowBlur = state === 'hover' ? 26 : 16; }
    ctx.fillStyle = grad(ctx, fill, fy, faceH); ctx.fill();
    if (t.glow && spec.edge) ctx.restore();

    if (t.bevel) {
      ctx.save(); shape(ctx, t, x, fy, w, faceH, r); ctx.clip();
      const b = Math.max(4, Math.round(Math.min(w, faceH) * 0.07));
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x, fy, w, b);
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x, fy + faceH - b, w, b);
      ctx.restore();
    }
    if (t.gloss && !opts.noGloss) {
      ctx.save(); shape(ctx, t, x, fy, w, faceH, r); ctx.clip();
      const gh = faceH * 0.46;
      shape(ctx, t, x + 6, fy + 5, w - 12, gh, Math.max(0, r - 6));
      ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fill();
      ctx.restore();
    }
    const edge = spec.edge === undefined ? null : spec.edge;
    const ew = spec.edgeW ?? t.edgeW ?? 0;
    if (edge && ew) {
      shape(ctx, t, x + ew / 2, fy + ew / 2, w - ew, faceH - ew, Math.max(0, r - ew / 2));
      ctx.lineWidth = ew; ctx.strokeStyle = state === 'hover' && t.glow ? lighten(edge, 0.3) : edge; ctx.stroke();
    }
    if (spec.inner && w > 40 && faceH > 30) {
      const i = ew + 4;
      shape(ctx, t, x + i, fy + i, w - i * 2, faceH - i * 2, Math.max(0, r - i));
      ctx.lineWidth = t.corner === 'chamfer' ? 1 : 2; ctx.strokeStyle = spec.inner; ctx.stroke();
    }
    if (t.rivets && !opts.noOrnament && w > 70 && faceH > 50) {
      const d = ew + 10;
      for (const [cx, cy] of [[x + d, fy + d], [x + w - d, fy + d], [x + d, fy + faceH - d], [x + w - d, fy + faceH - d]]) {
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#e8c062'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#5b3a1c'; ctx.stroke();
      }
    }
    if (t.brackets && !opts.noOrnament && w > 60 && faceH > 40) {
      const L = Math.min(26, w * 0.2, faceH * 0.3);
      ctx.strokeStyle = lighten(edge || '#3fe0ff', 0.35); ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + w - L - 4, fy + 4); ctx.lineTo(x + w - 4, fy + 4); ctx.lineTo(x + w - 4, fy + 4 + L);
      ctx.moveTo(x + 4, fy + faceH - 4 - L); ctx.lineTo(x + 4, fy + faceH - 4); ctx.lineTo(x + 4 + L, fy + faceH - 4);
      ctx.stroke();
    }
    return { sink, faceY: fy, faceH };
  }

  /* ---------- Text ---------- */
  function setFont(ctx, t, size, weight) {
    ctx.font = `${weight ?? t.weight} ${Math.max(6, size)}px "${t.font}"`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(t.spacing || 0) * size}px`;
  }
  function fitSize(ctx, t, text, maxW, maxH, weight) {
    let size = maxH;
    if (t.pixel) size = Math.max(8, Math.floor(size / 4) * 4);
    setFont(ctx, t, size, weight);
    const w = ctx.measureText(text).width;
    if (w > maxW && w > 0) size = Math.floor(size * maxW / w);
    if (t.pixel) size = Math.max(8, Math.floor(size / 2) * 2);
    return Math.max(6, size);
  }
  const caseOf = (t, text) => (t.upper ? text.toUpperCase() : text);

  // Text with the theme's outline/glow. style: { color, stroke, strokeW (fraction of size), glow, shadow }
  function text(ctx, t, str, x, y, maxW, maxH, style = {}) {
    str = caseOf(t, str);
    if (!str) return 0;
    const size = fitSize(ctx, t, str, maxW, maxH, style.weight);
    setFont(ctx, t, size, style.weight);
    ctx.textAlign = style.align || 'center';
    ctx.textBaseline = 'middle';
    const yy = y + size * (t.font === 'PressStart2P' ? 0.06 : t.font === 'Cinzel' ? 0.04 : 0.02);
    if (style.shadow) {
      ctx.save(); ctx.shadowColor = style.shadow; ctx.shadowBlur = size * 0.25; ctx.shadowOffsetY = size * 0.05;
      ctx.fillStyle = style.color; ctx.fillText(str, x, yy); ctx.restore();
    }
    if (style.stroke) {
      ctx.lineJoin = t.pixel ? 'miter' : 'round';
      ctx.lineWidth = Math.max(2, size * (style.strokeW ?? 0.15)) * 2;
      ctx.strokeStyle = style.stroke; ctx.strokeText(str, x, yy);
    }
    if (style.glow) { ctx.save(); ctx.shadowColor = style.glow; ctx.shadowBlur = size * 0.4; }
    ctx.fillStyle = style.fill || style.color;
    ctx.fillText(str, x, yy);
    if (style.glow) ctx.restore();
    return size;
  }

  const hudStyle = (t) => ({ color: t.hud, stroke: t.hudStroke, strokeW: t.hudStrokeW, glow: t.glow ? 'rgba(63,224,255,.8)' : null, shadow: t.hudShadow });
  const btnStyle = (t, c) => ({
    color: c.text,
    stroke: t.textStroke && c.text === '#ffffff' ? t.textStroke : t.textStroke && t.font === 'Cinzel' ? t.textStroke : null,
    strokeW: t.textStrokeW,
    glow: t.glow ? alpha(c.edge || '#3fe0ff', 0.9) : null,
  });

  // Icon then text, centred as one group inside a box.
  function content(ctx, t, el, x, y, w, h, style, iconColor, outlined) {
    const str = el.text;
    const padX = Math.max(12, h * 0.28);
    if (el.icon && !str) {
      const s = Math.min(w, h) * 0.56;
      drawIcon(ctx, t, el.icon, x + w / 2, y + h / 2, s, iconColor, outlined);
      return;
    }
    if (!el.icon) {
      text(ctx, t, str, x + w / 2, y + h / 2, w - padX * 2, h * (t.pixel ? 0.34 : 0.42), style);
      return;
    }
    const s = h * 0.5;
    const gap = h * 0.18;
    const maxText = w - padX * 2 - s - gap;
    const shown = caseOf(t, str);
    const size = fitSize(ctx, t, shown, maxText, h * (t.pixel ? 0.34 : 0.42), style.weight);
    setFont(ctx, t, size, style.weight);
    const tw = ctx.measureText(shown).width;
    const start = x + (w - (s + gap + tw)) / 2;
    drawIcon(ctx, t, el.icon, start + s / 2, y + h / 2, s, iconColor, outlined);
    text(ctx, t, str, start + s + gap + tw / 2, y + h / 2, tw + 2, size, style);
  }

  const colorsOf = (t, el) => t.colors[el.variant] || t.colors.primary;
  const panelSpec = (t) => ({ fill: t.panel.fill, edge: t.panel.edge, edgeW: t.panel.edgeW, inner: t.panel.inner });

  /* ---------- Elements ---------- */
  // opts: { state, part, value, noText }
  // part is for export: 'all' (default), 'blank' (frame only), 'track', 'fill', 'knob', 'on', 'off', 'base'
  function drawElement(ctx, t, el, opts = {}) {
    const state = opts.state || 'normal';
    const part = opts.part || 'all';
    const value = opts.value ?? el.value;
    const { x, y, w, h } = el;
    const blank = part === 'blank';
    ctx.save();
    if (state === 'disabled') { ctx.globalAlpha = 0.5; ctx.filter = 'grayscale(1)'; }
    if (t.pixel) ctx.imageSmoothingEnabled = false;

    switch (el.type) {
      case 'panel': {
        frame(ctx, t, x, y, w, h, panelSpec(t), 'normal', { flat: true, noGloss: true, r: t.radius * 1.2 });
        if (!blank && el.text) text(ctx, t, el.text, x + w / 2, y + Math.min(60, h * 0.12), w - 40, Math.min(44, h * 0.08), { color: t.text });
        break;
      }
      case 'window': {
        const r = t.radius * 1.2;
        frame(ctx, t, x, y, w, h, panelSpec(t), 'normal', { flat: true, noGloss: true, r });
        const hh = Math.max(48, Math.min(96, h * 0.14));
        if (t.header) {
          ctx.save(); shape(ctx, t, x, y, w, h, r); ctx.clip();
          const inset = t.panel.edgeW || 0;
          ctx.fillStyle = grad(ctx, t.header.fill, y, hh); ctx.fillRect(x + inset, y + inset, w - inset * 2, hh - inset);
          ctx.fillStyle = t.outline ? t.outline.color : t.panel.edge || 'rgba(0,0,0,.2)';
          ctx.fillRect(x, y + hh - (t.outline ? 2 : 1), w, t.outline ? 4 : 2);
          ctx.restore();
          if (t.panel.edge && t.panel.edgeW) {
            shape(ctx, t, x + t.panel.edgeW / 2, y + t.panel.edgeW / 2, w - t.panel.edgeW, h - t.panel.edgeW, r - t.panel.edgeW / 2);
            ctx.lineWidth = t.panel.edgeW; ctx.strokeStyle = t.panel.edge; ctx.stroke();
          }
          if (!blank) text(ctx, t, el.text, x + w / 2, y + hh / 2, w - hh * 2, hh * (t.pixel ? 0.36 : 0.46), { color: t.header.text, stroke: t.textStroke && !t.glow ? t.textStroke : null, strokeW: t.textStrokeW, glow: t.glow ? 'rgba(63,224,255,.8)' : null });
        } else {
          if (!blank) text(ctx, t, el.text, x + 32, y + hh / 2 + 6, w - 64, hh * 0.42, { color: t.text, align: 'left', weight: 750 });
          ctx.fillStyle = 'rgba(20,25,40,.08)'; ctx.fillRect(x + 24, y + hh + 6, w - 48, 1.5);
        }
        break;
      }
      case 'button': {
        const c = colorsOf(t, el);
        const iconOnly = el.icon && !el.text;
        const r = iconOnly && Math.abs(w - h) < h * 0.3 && t.corner === 'round' ? Math.min(w, h) / 2 : t.radius;
        const f = frame(ctx, t, x, y, w, h, { fill: c.fill, edge: c.edge ?? null, inner: c.inner }, state, { r });
        if (!blank) content(ctx, t, el, x, f.faceY, w, f.faceH, btnStyle(t, c), c.text, !!t.textStroke && c.text === '#ffffff');
        break;
      }
      case 'label': {
        if (blank) break;
        const align = el.align || 'center';
        const ax = align === 'left' ? x : align === 'right' ? x + w : x + w / 2;
        if (el.icon) {
          const s = h * 0.9;
          drawIcon(ctx, t, el.icon, x + s / 2, y + h / 2, s, t.hud, true);
          text(ctx, t, el.text, align === 'left' ? x + s * 1.15 : ax + (align === 'center' ? s * 0.55 : 0), y + h / 2, w - s * 1.2, h * 0.78, { ...hudStyle(t), align });
        } else {
          text(ctx, t, el.text, ax, y + h / 2, w, h * 0.8, { ...hudStyle(t), align });
        }
        break;
      }
      case 'title': {
        if (blank) break;
        const size = h * 0.72;
        const cx = x + w / 2, cy = y + h / 2;
        if (t.font === 'Cinzel') {
          const g = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
          g.addColorStop(0, '#fff3c2'); g.addColorStop(0.5, '#f0c050'); g.addColorStop(1, '#b07818');
          text(ctx, t, el.text, cx, cy, w, size, { color: '#f0c050', fill: g, stroke: '#2a1206', strokeW: 0.08, shadow: 'rgba(0,0,0,.6)' });
        } else if (t.glow) {
          text(ctx, t, el.text, cx, cy, w, size, { color: '#eaffff', glow: '#3fe0ff', stroke: 'rgba(63,224,255,.35)', strokeW: 0.04 });
        } else if (t.outline) {
          ctx.save(); ctx.translate(0, size * 0.09);
          text(ctx, t, el.text, cx, cy, w, size, { color: t.outline.color, stroke: t.outline.color, strokeW: 0.14 });
          ctx.restore();
          const g = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
          const c = BAR[el.variant] || '#ffd84a';
          g.addColorStop(0, lighten(t.pixel ? c : '#ffe76a', 0.1)); g.addColorStop(1, t.pixel ? c : '#ffaa1e');
          text(ctx, t, el.text, cx, cy, w, size, { color: '#ffd84a', fill: g, stroke: t.outline.color, strokeW: 0.14 });
        } else {
          text(ctx, t, el.text, cx, cy, w, size, { color: t.hud, shadow: t.hudShadow, weight: 800 });
        }
        break;
      }
      case 'bar': {
        const hasIcon = !!el.icon;
        const bx = hasIcon ? x + h * 0.55 : x;
        const bw = w - (bx - x);
        const r = Math.min(t.radius, h / 2);
        const fillColor = BAR[el.variant] || BAR.primary;
        if (part === 'all' || part === 'track' || blank) {
          frame(ctx, t, bx, y, bw, h, { fill: [t.track, lighten(t.track, 0.08)], edge: t.panel.edge ? (t.glow ? alpha(fillColor, 0.7) : t.panel.edge) : null, edgeW: t.glow ? 2 : Math.min(4, t.panel.edgeW || 0) }, 'normal', { flat: true, noGloss: true, noOrnament: true, r, noShadow: !!t.glow });
        }
        if (part === 'all' || part === 'fill') {
          const inset = Math.max(3, Math.round(h * 0.12));
          const v = part === 'fill' ? 1 : Math.max(0, Math.min(1, value));
          const fw = (bw - inset * 2) * v;
          if (fw > 1) {
            ctx.save();
            shape(ctx, t, bx + inset, y + inset, bw - inset * 2, h - inset * 2, Math.max(0, r - inset)); ctx.clip();
            const g = ctx.createLinearGradient(0, y, 0, y + h);
            g.addColorStop(0, lighten(fillColor, 0.25)); g.addColorStop(1, darken(fillColor, 0.12));
            if (t.glow) { ctx.shadowColor = fillColor; ctx.shadowBlur = 14; }
            ctx.fillStyle = t.pixel ? fillColor : g;
            ctx.fillRect(bx + inset, y + inset, fw, h - inset * 2);
            if (!t.glow) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(bx + inset, y + inset, fw, (h - inset * 2) * 0.38); }
            if (t.glow) {
              ctx.fillStyle = 'rgba(0,0,0,.25)';
              for (let sx = bx + inset + 14; sx < bx + inset + fw; sx += 14) ctx.fillRect(sx, y + inset, 3, h);
            }
            ctx.restore();
          }
        }
        if (part === 'all' && el.text) text(ctx, t, el.text, bx + bw / 2, y + h / 2, bw - 24, h * 0.56, hudStyle(t));
        if ((part === 'all' || part === 'track' || blank) && hasIcon) {
          const s = h * 1.35;
          drawIcon(ctx, t, el.icon, x + s / 2 - h * 0.05, y + h / 2, s, fillColor, true);
        }
        break;
      }
      case 'slider': {
        const lw = el.text ? Math.min(w * 0.32, 260) : 0;
        if (part === 'all' && el.text) text(ctx, t, el.text, x, y + h / 2, lw - 16, h * 0.42, { ...hudStyle(t), align: 'left' });
        const kr = h * 0.42;
        const tx = x + lw + kr, tw = w - lw - kr * 2;
        const th = Math.max(8, h * 0.28);
        const ty = y + (h - th) / 2;
        const fillColor = BAR[el.variant] || BAR.primary;
        const v = Math.max(0, Math.min(1, value));
        if (part === 'all' || part === 'track' || blank) frame(ctx, t, tx - kr * 0.4, ty, tw + kr * 0.8, th, { fill: [t.track, lighten(t.track, 0.1)], edge: t.glow ? alpha(fillColor, 0.6) : null, edgeW: 2 }, 'normal', { flat: true, noGloss: true, noOrnament: true, r: th / 2, noShadow: true });
        if (part === 'all' || part === 'fill') {
          ctx.save(); shape(ctx, t, tx - kr * 0.4, ty, tw + kr * 0.8, th, th / 2); ctx.clip();
          ctx.fillStyle = fillColor; ctx.fillRect(tx - kr * 0.4, ty, kr * 0.4 + tw * (part === 'fill' ? 1 : v), th);
          ctx.restore();
        }
        if (part === 'all' || part === 'knob') {
          const kx = part === 'knob' ? x + w / 2 : tx + tw * v;
          const c = colorsOf(t, { variant: el.variant === 'plain' ? 'plain' : 'plain' });
          const k = { ...t, depth: Math.min(t.depth, 4) };
          frame(ctx, k, kx - kr, y + h / 2 - kr, kr * 2, kr * 2, { fill: t.glow ? ['#eaffff', '#9fefff'] : c.fill, edge: t.glow ? fillColor : c.edge ?? null, inner: null }, state === 'pressed' ? 'pressed' : state, { r: t.corner === 'round' ? kr : t.radius * 0.6, noOrnament: true });
        }
        break;
      }
      case 'toggle':
      case 'checkbox': {
        const on = part === 'on' ? true : part === 'off' ? false : value > 0.5;
        const box = el.type === 'toggle' ? { w: Math.min(w, h * 1.9), h } : { w: h * 0.86, h: h * 0.86 };
        const bx = el.text ? x : x + (w - box.w) / 2;
        const by = y + (h - box.h) / 2;
        const c = on ? colorsOf(t, el.variant === 'plain' ? { variant: 'success' } : el) : { fill: [t.track, lighten(t.track, 0.1)], edge: t.glow ? 'rgba(140,220,255,.4)' : null };
        if (el.type === 'toggle') {
          frame(ctx, t, bx, by, box.w, box.h, { fill: c.fill, edge: c.edge ?? null }, 'normal', { flat: true, noGloss: true, noOrnament: true, r: t.corner === 'round' ? box.h / 2 : t.radius * 0.7, noShadow: !t.outline });
          const kr = box.h * 0.36;
          const kx = on ? bx + box.w - box.h / 2 : bx + box.h / 2;
          const k = { ...t, depth: 0 };
          frame(ctx, k, kx - kr, by + box.h / 2 - kr, kr * 2, kr * 2, { fill: ['#ffffff', '#e6e9f2'], edge: t.glow ? '#3fe0ff' : null }, 'normal', { r: t.corner === 'round' ? kr : t.radius * 0.5, noOrnament: true, noGloss: true });
        } else {
          frame(ctx, t, bx, by, box.w, box.h, { fill: c.fill, edge: c.edge ?? (t.panel.edge || null), edgeW: Math.min(3, t.edgeW || 2) }, 'normal', { flat: true, noGloss: true, noOrnament: true, r: Math.min(t.radius, box.w * 0.25), noShadow: !t.outline });
          if (on) drawIcon(ctx, t, 'check', bx + box.w / 2, by + box.h / 2, box.w * 0.72, c.text || '#ffffff', !!t.textStroke);
        }
        if (part === 'all' && el.text) text(ctx, t, el.text, bx + box.w + h * 0.3, y + h / 2, w - box.w - h * 0.3, h * 0.5, { ...hudStyle(t), align: 'left' });
        break;
      }
      case 'input': {
        frame(ctx, t, x, y, w, h, { fill: t.inset.fill, edge: t.panel.edge ? (t.glow ? 'rgba(63,224,255,.6)' : t.panel.edge) : 'rgba(20,25,40,.15)', edgeW: Math.min(3, t.edgeW || 2), inner: null }, state, { flat: true, noGloss: true, noOrnament: true, r: Math.min(t.radius, h / 2), noShadow: true });
        if (t.outline) { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x + t.radius * 0.5, y + 3, w - t.radius, 4); }
        if (!blank) {
          let tx = x + h * 0.36;
          if (el.icon) { drawIcon(ctx, t, el.icon, tx + h * 0.2, y + h / 2, h * 0.42, t.muted); tx += h * 0.55; }
          text(ctx, t, el.text, tx, y + h / 2, w - (tx - x) - h * 0.3, h * (t.pixel ? 0.3 : 0.4), { color: t.muted, align: 'left', weight: t.pixel ? 400 : 500 });
        }
        break;
      }
      case 'icon': {
        if (blank || !el.icon) break;
        const c = el.variant === 'plain' || el.variant === 'primary' ? t.hud : BAR[el.variant];
        drawIcon(ctx, t, el.icon, x + w / 2, y + h / 2, Math.min(w, h), c, true);
        break;
      }
      case 'image': {
        frame(ctx, t, x, y, w, h, panelSpec(t), 'normal', { flat: true, noGloss: true, noOrnament: true });
        const i = Math.max(10, (t.panel.edgeW || 0) + 8);
        if (w > i * 3 && h > i * 3) {
          shape(ctx, t, x + i, y + i, w - i * 2, h - i * 2, Math.max(0, t.radius - i / 2));
          ctx.fillStyle = t.inset.fill[0]; ctx.fill();
        }
        if (!blank) {
          const s = Math.min(w, h) * 0.3;
          drawIcon(ctx, t, el.icon || 'image', x + w / 2, y + h / 2 - (el.text ? s * 0.3 : 0), s, t.muted);
          if (el.text && h > 80) text(ctx, t, el.text, x + w / 2, y + h / 2 + s * 0.55, w - i * 3, Math.min(30, h * 0.1), { color: t.muted, weight: t.pixel ? 400 : 600 });
        }
        break;
      }
      case 'badge': {
        const c = t.colors.plain;
        const dark = { fill: t.glow ? t.panel.fill : [alpha(darken(t.track, 0.1), 0.86), alpha(t.track, 0.86)], edge: t.glow ? '#3fe0ff' : t.panel.edge ? '#e8c062' : null, edgeW: 2 };
        frame(ctx, t, x, y, w, h, t.font === 'Inter' ? { fill: ['rgba(15,18,30,.6)', 'rgba(15,18,30,.6)'] } : dark, 'normal', { flat: true, noGloss: true, noOrnament: true, r: t.corner === 'round' ? h / 2 : t.radius * 0.7, noShadow: t.font === 'Inter' });
        if (!blank) {
          const iconColor = BAR[el.variant === 'primary' ? 'secondary' : el.variant] || BAR.secondary;
          if (el.icon) {
            const s = h * 1.05;
            drawIcon(ctx, t, el.icon, x + h * 0.42, y + h / 2, s, iconColor, true);
            text(ctx, t, el.text, x + h * 0.95 + (w - h * 1.25) / 2, y + h / 2, w - h * 1.35, h * 0.52, { ...hudStyle(t), color: t.hud });
          } else {
            text(ctx, t, el.text, x + w / 2, y + h / 2, w - h * 0.6, h * 0.52, hudStyle(t));
          }
        }
        void c;
        break;
      }
      case 'tabs': {
        const names = (el.text || 'Tab').split('|').map((s) => s.trim()).filter(Boolean);
        const n = Math.max(1, names.length);
        const gap = t.outline ? 10 : 6;
        const tw = (w - gap * (n - 1)) / n;
        names.forEach((name, i) => {
          const sel = i === Math.round(value);
          const c = sel ? colorsOf(t, el.variant === 'plain' ? { variant: 'primary' } : el) : t.colors.plain;
          const tx = x + i * (tw + gap);
          const f = frame(ctx, t, tx, y + (sel ? 0 : 4), tw, h - (sel ? 0 : 4), { fill: sel ? c.fill : c.fill.map((cc) => darken(cc, 0.12)), edge: c.edge ?? null, inner: sel ? c.inner : null }, state === 'hover' && !sel ? 'hover' : 'normal', { noOrnament: true });
          if (!blank) text(ctx, t, name, tx + tw / 2, f.faceY + f.faceH / 2, tw - 20, f.faceH * (t.pixel ? 0.32 : 0.42), btnStyle(t, c));
        });
        break;
      }
      case 'list': {
        frame(ctx, t, x, y, w, h, panelSpec(t), 'normal', { flat: true, noGloss: true, noOrnament: true });
        if (blank) break;
        const rows = (el.text || '').split('|').map((s) => s.trim()).filter(Boolean);
        const i = (t.panel.edgeW || 0) + 14;
        const rh = Math.min(84, (h - i * 2) / Math.max(1, rows.length));
        rows.forEach((row, k) => {
          const ry = y + i + k * rh;
          if (ry + rh > y + h - i + 1) return;
          if (k % 2 === 1) { shape(ctx, t, x + i, ry, w - i * 2, rh, Math.min(10, t.radius / 2)); ctx.fillStyle = alpha(t.text, 0.06); ctx.fill(); }
          text(ctx, t, row, x + i + 16, ry + rh / 2, w - i * 2 - 32, rh * 0.42, { color: t.text, align: 'left', weight: t.pixel ? 400 : 600 });
        });
        break;
      }
      case 'divider': {
        const cy = y + h / 2;
        const lw = Math.max(2, Math.min(6, h * 0.3));
        const color = t.panel.edge && !t.glow ? (t.font === 'Cinzel' ? '#c99a3e' : t.panel.edge) : t.glow ? '#3fe0ff' : t.outline ? t.outline.color : 'rgba(20,25,40,.2)';
        ctx.fillStyle = color;
        if (t.pixel) { for (let dx = x; dx < x + w; dx += 16) ctx.fillRect(dx, cy - 3, 8, 6); }
        else {
          if (t.glow) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
          ctx.beginPath(); ctx.roundRect(x, cy - lw / 2, w, lw, lw / 2); ctx.fill();
          if (t.font === 'Cinzel') { const d = Math.min(14, h * 0.6); ctx.beginPath(); ctx.moveTo(x + w / 2, cy - d); ctx.lineTo(x + w / 2 + d, cy); ctx.lineTo(x + w / 2, cy + d); ctx.lineTo(x + w / 2 - d, cy); ctx.closePath(); ctx.fill(); }
        }
        break;
      }
      case 'joystick': {
        const r = Math.min(w, h) / 2;
        const cx = x + w / 2, cy = y + h / 2;
        if (part === 'all' || part === 'base') {
          ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
          ctx.lineWidth = t.outline ? 6 : 3; ctx.strokeStyle = t.glow ? '#3fe0ff' : 'rgba(255,255,255,.55)'; ctx.stroke();
        }
        if (part === 'all' || part === 'knob') {
          const kr = r * 0.42;
          const c = colorsOf(t, el);
          const k = { ...t, depth: Math.min(t.depth, 5) };
          frame(ctx, k, cx - kr, cy - kr, kr * 2, kr * 2, { fill: c.fill, edge: c.edge ?? null }, state, { r: t.corner === 'round' ? kr : t.radius * 0.6, noOrnament: true });
        }
        break;
      }
    }
    ctx.restore();
  }

  function drawBackground(ctx, t, w, h, background) {
    if (background === 'theme') t.background(ctx, w, h);
    else if (background === 'dim') { ctx.fillStyle = 'rgba(5,6,12,.55)'; ctx.fillRect(0, 0, w, h); }
  }

  // The parts Export writes for each type, besides the full picture.
  function exportParts(el) {
    switch (el.type) {
      case 'button': return ['blank', 'hover', 'pressed', 'disabled'];
      case 'panel': case 'window': case 'input': case 'image': case 'badge': case 'list': case 'tabs': return ['blank'];
      case 'bar': return ['track', 'fill'];
      case 'slider': return ['track', 'fill', 'knob'];
      case 'toggle': case 'checkbox': return ['on', 'off'];
      case 'joystick': return ['base', 'knob'];
      default: return [];
    }
  }

  window.DrawyThemes = { THEMES, drawElement, drawBackground, exportParts, iconsReady, onIconLoad: (fn) => { onIconLoad = fn; }, mix, lighten, darken, alpha };
})();
