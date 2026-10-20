// The sketch: strokes drawn with one pen, grouped into numbered marks the user describes.
//
// How strokes become marks (automatic, unless the user groups them by hand):
// 1. Strokes that touch are one shape (a box drawn in four lines is one shape).
// 2. Small shapes sitting side by side join up into words ("P" "L" "A" "Y").
// 3. A shape is "closed" when it surrounds its own middle (boxes, circles). Closed shapes
//    are marks of their own, so a button drawn inside a panel stays a separate mark.
// 4. Open shapes (writing, ticks, squiggles) inside a closed shape belong to it, so the
//    word PLAY written inside a box is part of that button.
(function () {
  const INK = '#1b1d24';
  const TOUCH = 12;
  const MARK_COLORS = ['#ff5c7a', '#2f9bff', '#1fbf75', '#ff9f1c', '#9b5cff', '#00b8c4', '#e0479e', '#7a8a00'];
  const markColor = (id) => MARK_COLORS[(id - 1) % MARK_COLORS.length];

  function bounds(points) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of points) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const union = (a, b) => {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  };
  const near = (a, b, m) => a.x - m <= b.x + b.w && b.x - m <= a.x + a.w && a.y - m <= b.y + b.h && b.y - m <= a.y + a.h;
  const inside = (inner, outer) => {
    const cx = inner.x + inner.w / 2, cy = inner.y + inner.h / 2;
    return cx > outer.x && cx < outer.x + outer.w && cy > outer.y && cy < outer.y + outer.h && inner.w * inner.h < outer.w * outer.h;
  };

  // Points every few pixels along a stroke, so gaps between samples never hide a touch.
  function dense(stroke) {
    const out = [];
    const p = stroke.pts;
    for (let i = 0; i < p.length; i++) {
      if (i === 0) { out.push(p[0]); continue; }
      const [ax, ay] = p[i - 1], [bx, by] = p[i];
      const d = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.ceil(d / 4));
      for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
    }
    return out;
  }

  class Grid {
    constructor(cell) { this.cell = cell; this.map = new Map(); }
    key(x, y) { return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`; }
    add(x, y, v) { const k = this.key(x, y); let s = this.map.get(k); if (!s) this.map.set(k, (s = new Set())); s.add(v); }
    around(x, y) {
      const out = new Set();
      const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const s = this.map.get(`${cx + dx},${cy + dy}`);
        if (s) s.forEach((v) => out.add(v));
      }
      return out;
    }
  }

  // Is this shape an outline (a box, a circle) with an empty middle? Cast 8 rays from the
  // centre of its box: an outline stops nearly all of them, and only near its edge. Writing
  // and scribbles stop rays too, but close to the middle.
  function isClosed(shape, pointsOf) {
    const b = shape.box;
    if (b.w < 36 || b.h < 24) return false;
    const grid = new Grid(8);
    for (const id of shape.strokes) for (const [x, y] of pointsOf(id)) grid.add(x, y, 1);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const firstHits = [];
    for (let a = 0; a < 8; a++) {
      const dx = Math.cos(a * Math.PI / 4), dy = Math.sin(a * Math.PI / 4);
      // Walk out from the centre to just past the box edge, in the box's own proportions.
      for (let t = 0.05; t <= 1.5; t += 0.025) {
        const x = cx + dx * t * b.w / 2, y = cy + dy * t * b.h / 2;
        if (grid.map.has(grid.key(x, y))) { firstHits.push(t); break; }
      }
    }
    if (firstHits.length < 7) return false;
    firstHits.sort((p, q) => p - q);
    return firstHits[Math.floor(firstHits.length / 2)] >= 0.6;
  }

  function autoGroups(strokes) {
    if (!strokes.length) return [];
    const pts = new Map(strokes.map((s) => [s.id, dense(s)]));
    const boxes = new Map(strokes.map((s) => [s.id, bounds(pts.get(s.id))]));
    // 1. touching strokes
    const parent = new Map(strokes.map((s) => [s.id, s.id]));
    const find = (a) => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
    const join = (a, b) => parent.set(find(a), find(b));
    const grid = new Grid(TOUCH);
    for (const s of strokes) for (const [x, y] of pts.get(s.id)) grid.add(x, y, s.id);
    for (const s of strokes) {
      const seen = new Set();
      for (const [x, y] of pts.get(s.id)) {
        for (const other of grid.around(x, y)) {
          if (other === s.id || seen.has(other)) continue;
          seen.add(other);
          if (find(other) !== find(s.id)) join(other, s.id);
        }
      }
    }
    let shapes = new Map();
    for (const s of strokes) {
      const r = find(s.id);
      const sh = shapes.get(r) || { strokes: [], box: null };
      sh.strokes.push(s.id);
      sh.box = sh.box ? union(sh.box, boxes.get(s.id)) : boxes.get(s.id);
      shapes.set(r, sh);
    }
    shapes = [...shapes.values()];
    const pointsOf = (id) => pts.get(id);
    shapes.forEach((sh) => { sh.closed = isClosed(sh, pointsOf); });

    // 2. small open shapes side by side become one word (closed letters like O join too).
    const small = (sh) => sh.box.h < 150 && (!sh.closed || (sh.box.w < 90 && sh.box.h < 110));
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < shapes.length && !merged; i++) {
        for (let j = i + 1; j < shapes.length && !merged; j++) {
          const a = shapes[i], b = shapes[j];
          if (!small(a) || !small(b)) continue;
          if (a.closed && b.closed) continue;
          const h = Math.max(a.box.h, b.box.h, 24);
          const gapX = Math.max(a.box.x, b.box.x) - Math.min(a.box.x + a.box.w, b.box.x + b.box.w);
          const overlapY = Math.min(a.box.y + a.box.h, b.box.y + b.box.h) - Math.max(a.box.y, b.box.y);
          if (gapX < h * 0.9 && overlapY > Math.min(a.box.h, b.box.h) * 0.3) {
            shapes.splice(j, 1);
            shapes[i] = { strokes: [...a.strokes, ...b.strokes], box: union(a.box, b.box), closed: false, word: true };
            merged = true;
          }
        }
      }
    }
    shapes.forEach((sh) => { if (sh.word) sh.closed = false; });

    // 3 + 4. open shapes join the smallest closed shape they sit in.
    const closed = shapes.filter((s) => s.closed).sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h);
    const groups = closed.map((c) => ({ strokes: [...c.strokes] }));
    for (const sh of shapes) {
      if (sh.closed) continue;
      const host = closed.findIndex((c) => inside(sh.box, c.box));
      if (host >= 0) groups[host].strokes.push(...sh.strokes);
      else groups.push({ strokes: [...sh.strokes] });
    }
    return groups;
  }

  // Recompute the marks after the strokes changed, keeping each mark's number and
  // description when it still holds most of the same strokes.
  function regroup(sketch) {
    const ids = new Set(sketch.strokes.map((s) => s.id));
    const manual = sketch.marks.filter((m) => m.manual)
      .map((m) => ({ ...m, strokes: m.strokes.filter((id) => ids.has(id)) }))
      .filter((m) => m.strokes.length);
    const claimed = new Set(manual.flatMap((m) => m.strokes));
    const groups = autoGroups(sketch.strokes.filter((s) => !claimed.has(s.id)));
    const old = sketch.marks.filter((m) => !m.manual);
    const used = new Set(manual.map((m) => m.id));
    const scored = [];
    groups.forEach((g, gi) => {
      const set = new Set(g.strokes);
      old.forEach((m) => {
        const shared = m.strokes.filter((id) => set.has(id)).length;
        if (shared) scored.push({ gi, m, shared });
      });
    });
    scored.sort((a, b) => b.shared - a.shared);
    const assigned = new Map();
    for (const s of scored) {
      if (assigned.has(s.gi) || used.has(s.m.id)) continue;
      assigned.set(s.gi, s.m);
      used.add(s.m.id);
    }
    const marks = [...manual];
    groups.forEach((g, gi) => {
      const m = assigned.get(gi);
      marks.push(m ? { id: m.id, strokes: g.strokes, note: m.note } : { id: sketch.nextMark++, strokes: g.strokes, note: '' });
    });
    sketch.marks = marks.sort((a, b) => a.id - b.id);
    return sketch;
  }

  // Group every stroke whose middle lies inside a dragged box into one mark, by hand.
  function groupInBox(sketch, box) {
    const pick = sketch.strokes.filter((s) => {
      const b = bounds(s.pts);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      return cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h;
    }).map((s) => s.id);
    if (!pick.length) return false;
    const set = new Set(pick);
    let best = null, bestShared = 0;
    for (const m of sketch.marks) {
      const shared = m.strokes.filter((id) => set.has(id)).length;
      if (shared > bestShared) { best = m; bestShared = shared; }
    }
    sketch.marks = sketch.marks.map((m) => ({ ...m, strokes: m.strokes.filter((id) => !set.has(id)) })).filter((m) => m.strokes.length || m === best);
    const note = best ? best.note : '';
    sketch.marks = sketch.marks.filter((m) => m !== best);
    sketch.marks.push({ id: best ? best.id : sketch.nextMark++, strokes: pick, note, manual: true });
    return regroup(sketch);
  }

  function markBox(sketch, mark) {
    const byId = new Map(sketch.strokes.map((s) => [s.id, s]));
    let box = null;
    for (const id of mark.strokes) {
      const s = byId.get(id);
      if (!s) continue;
      const b = bounds(s.pts);
      box = box ? union(box, b) : b;
    }
    if (!box) return null;
    const pad = 6;
    return { x: Math.round(box.x - pad), y: Math.round(box.y - pad), w: Math.round(box.w + pad * 2), h: Math.round(box.h + pad * 2) };
  }

  function drawStroke(ctx, s, color = INK) {
    const p = s.pts;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.w / 2, 0, Math.PI * 2); ctx.fill(); return; }
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
      ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
    }
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    ctx.stroke();
  }

  // opts: { ink, marks (show boxes and numbers), scale (of the tag size), highlight (mark id) }
  function drawSketch(ctx, sketch, opts = {}) {
    for (const s of sketch.strokes) drawStroke(ctx, s, opts.ink || INK);
    if (!opts.marks) return;
    for (const m of sketch.marks) {
      const b = markBox(sketch, m);
      if (!b) continue;
      const c = markColor(m.id);
      const hl = opts.highlight === m.id;
      ctx.save();
      ctx.lineWidth = (hl ? 4 : 2) * (opts.scale || 1);
      ctx.strokeStyle = c;
      ctx.setLineDash(hl ? [] : [10 * (opts.scale || 1), 7 * (opts.scale || 1)]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([]);
      const r = 17 * (opts.scale || 1);
      const tx = b.x, ty = b.y;
      ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 3 * (opts.scale || 1); ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${r * 1.15}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(m.id), tx, ty + 1);
      if (m.note && opts.notes) {
        ctx.font = `600 ${15 * (opts.scale || 1)}px -apple-system, system-ui, sans-serif`;
        const label = m.note.length > 40 ? m.note.slice(0, 39) + '…' : m.note;
        const tw = ctx.measureText(label).width + 16 * (opts.scale || 1);
        const lh = 26 * (opts.scale || 1);
        const lx = tx + r + 4, ly = ty - lh / 2;
        ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(lx, ly, tw, lh, lh / 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(label, lx + 8 * (opts.scale || 1), ly + lh / 2 + 1);
      }
      ctx.restore();
    }
  }

  // The picture Claude reads: white paper, black ink, coloured numbered boxes.
  function sketchImage(sketch, size, maxSide = 1400) {
    const k = Math.min(1, maxSide / Math.max(size.w, size.h));
    const c = document.createElement('canvas');
    c.width = Math.round(size.w * k); c.height = Math.round(size.h * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(k, k);
    drawSketch(ctx, sketch, { marks: true, scale: 1 / k * 0.8 });
    return c.toDataURL('image/png').split(',')[1];
  }

  // Strokes the eraser path touches.
  function strokesHit(sketch, x, y, r) {
    return sketch.strokes.filter((s) => {
      const b = bounds(s.pts);
      if (x < b.x - r - s.w || x > b.x + b.w + r + s.w || y < b.y - r - s.w || y > b.y + b.h + r + s.w) return false;
      return dense(s).some(([px, py]) => Math.hypot(px - x, py - y) < r + s.w / 2);
    }).map((s) => s.id);
  }

  // Drop points closer than 2 px and round to whole pixels, to keep files small.
  function simplify(pts) {
    const out = [];
    for (const p of pts) {
      const q = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
      const last = out[out.length - 1];
      if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= 2) out.push(q);
    }
    if (out.length > 1 || !pts.length) return out;
    return [pts[0]];
  }

  window.DrawySketch = { INK, regroup, groupInBox, markBox, markColor, drawSketch, drawStroke, sketchImage, strokesHit, simplify, bounds };
})();
