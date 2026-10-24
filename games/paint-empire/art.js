// Paint Empire — toiles génératives. Une toile = { style, seed } : on peut toujours la redessiner,
// la galerie n'enregistre que ces deux valeurs.

import { createRng } from '../../shared/js/core/rng.js';
import { TAU } from '../../shared/js/core/math.js';

const PALETTES = [
  ['#1d3557', '#457b9d', '#a8dadc', '#f1faee', '#e63946'],
  ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
  ['#2b2d42', '#8d99ae', '#edf2f4', '#ef233c', '#d90429'],
  ['#3d405b', '#81b29a', '#f2cc8f', '#e07a5f', '#f4f1de'],
  ['#0b132b', '#1c2541', '#3a506b', '#5bc0be', '#ffd166'],
  ['#582f0e', '#7f4f24', '#936639', '#b6ad90', '#e9d8a6'],
  ['#10002b', '#3c096c', '#7b2cbf', '#e0aaff', '#ffd60a'],
  ['#003049', '#d62828', '#f77f00', '#fcbf49', '#eae2b7'],
  ['#2d6a4f', '#40916c', '#95d5b2', '#d8f3dc', '#ffb4a2'],
  ['#22223b', '#4a4e69', '#9a8c98', '#c9ada7', '#f2e9e4'],
];

const NOUNS = ['Silence', 'Matin', 'Jardin', 'Lumière', 'Écho', 'Marée', 'Promenade', 'Vertige', 'Souvenir', 'Rivage', 'Fenêtre', 'Rumeur', 'Envol', 'Refuge', 'Horizon', 'Murmure'];
const TAILS = ['du soir', 'd’automne', 'en bleu', 'sous la pluie', 'd’été', 'en mineur', 'au loin', 'de minuit', 'à deux voix', 'sans titre', 'de printemps', 'en sourdine', 'au grand jour', 'de passage'];

export function paintingTitle(seed) {
  const rng = createRng(seed ^ 0x9e3779b9);
  return `${rng.pick(NOUNS)} ${rng.pick(TAILS)}`;
}

/** Dessine la toile complète sur ctx (w × h). */
export function drawPainting(ctx, w, h, { style, seed }) {
  const rng = createRng(seed);
  const pal = rng.shuffle([...rng.pick(PALETTES)]);
  ctx.save();
  (PAINTERS[style] ?? PAINTERS.taches)(ctx, w, h, rng, pal);
  // Grain de toile
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#000';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

const PAINTERS = {
  taches(ctx, w, h, rng, pal) {
    ctx.fillStyle = pal[0];
    ctx.fillRect(0, 0, w, h);
    const n = rng.int(7, 13);
    for (let i = 0; i < n; i++) {
      blob(ctx, rng, rng.range(0, w), rng.range(0, h), rng.range(w * 0.08, w * 0.28), pal[1 + (i % 4)], rng.range(0.55, 0.95));
    }
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = rng.range(0.4, 0.9);
      ctx.fillStyle = rng.pick(pal);
      ctx.beginPath();
      ctx.arc(rng.range(0, w), rng.range(0, h), rng.range(1, w * 0.012), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  rayures(ctx, w, h, rng, pal) {
    ctx.fillStyle = pal[0];
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rng.range(-0.6, 0.6));
    const span = Math.hypot(w, h);
    let x = -span / 2;
    while (x < span / 2) {
      const bw = rng.range(span * 0.02, span * 0.12);
      ctx.fillStyle = rng.pick(pal.slice(1));
      ctx.globalAlpha = rng.range(0.7, 1);
      ctx.fillRect(x, -span / 2, bw, span);
      if (rng.chance(0.4)) {
        ctx.fillStyle = pal[0];
        ctx.fillRect(x + bw * 0.45, -span / 2, Math.max(1, bw * 0.06), span);
      }
      x += bw + rng.range(0, span * 0.03);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  },

  points(ctx, w, h, rng, pal) {
    // Paysage sous-jacent, puis repeint en points
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, pal[2]);
    sky.addColorStop(1, pal[3]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const horizon = h * rng.range(0.5, 0.7);
    const field = (x, y) => (y > horizon + Math.sin(x / w * 6 + 1) * h * 0.04 ? (y > h * 0.85 ? pal[0] : pal[1]) : y < h * 0.3 ? pal[2] : pal[3]);
    const n = Math.round((w * h) / 26);
    for (let i = 0; i < n; i++) {
      const x = rng.range(0, w);
      const y = rng.range(0, h);
      ctx.fillStyle = rng.chance(0.12) ? rng.pick(pal) : field(x, y);
      ctx.beginPath();
      ctx.arc(x, y, rng.range(w * 0.006, w * 0.014), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = pal[4];
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 60; i++) {
      const a = rng.range(0, TAU);
      const r = rng.range(0, w * 0.06);
      ctx.beginPath();
      ctx.arc(w * 0.72 + Math.cos(a) * r, h * 0.22 + Math.sin(a) * r, w * 0.012, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  collines(ctx, w, h, rng, pal) {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    sky.addColorStop(0, pal[3]);
    sky.addColorStop(1, pal[4]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = pal[2];
    ctx.beginPath();
    ctx.arc(w * rng.range(0.2, 0.8), h * rng.range(0.15, 0.3), w * 0.08, 0, TAU);
    ctx.fill();
    for (let layer = 0; layer < 4; layer++) {
      const base = h * (0.45 + layer * 0.14);
      const amp = h * rng.range(0.04, 0.1);
      const f = rng.range(1.5, 3.5);
      const ph = rng.range(0, TAU);
      ctx.fillStyle = pal[(layer + 0) % 4];
      ctx.globalAlpha = 0.85 + layer * 0.05;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, base - Math.sin((x / w) * TAU * f * 0.5 + ph) * amp - Math.sin((x / w) * TAU * 3.1 + ph * 2) * amp * 0.3);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  couchant(ctx, w, h, rng, pal) {
    const horizon = h * rng.range(0.55, 0.65);
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, pal[0]);
    sky.addColorStop(0.6, pal[1]);
    sky.addColorStop(1, pal[4]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);
    const sx = w * rng.range(0.35, 0.65);
    const sr = w * rng.range(0.12, 0.18);
    ctx.fillStyle = pal[3];
    ctx.beginPath();
    ctx.arc(sx, horizon, sr, Math.PI, TAU);
    ctx.fill();
    const sea = ctx.createLinearGradient(0, horizon, 0, h);
    sea.addColorStop(0, pal[2]);
    sea.addColorStop(1, pal[0]);
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, w, h - horizon);
    // Reflets
    ctx.fillStyle = pal[3];
    for (let y = horizon + 4; y < h; y += rng.range(5, 10)) {
      const k = (y - horizon) / (h - horizon);
      const len = sr * (1.6 - k) * rng.range(0.6, 1.2);
      ctx.globalAlpha = 0.8 * (1 - k * 0.7);
      ctx.fillRect(sx - len / 2 + rng.range(-6, 6), y, len, Math.max(1.5, h * 0.008));
    }
    ctx.globalAlpha = 1;
    // Nuages en bandes
    ctx.fillStyle = pal[4];
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(rng.range(-w * 0.2, w * 0.6), rng.range(h * 0.08, horizon - h * 0.12), rng.range(w * 0.2, w * 0.5), h * 0.018);
    }
    ctx.globalAlpha = 1;
  },

  vagues(ctx, w, h, rng, pal) {
    ctx.fillStyle = pal[4];
    ctx.fillRect(0, 0, w, h);
    const rows = rng.int(5, 8);
    for (let r = 0; r < rows; r++) {
      const y0 = h * (0.25 + (r / rows) * 0.8);
      const amp = h * 0.06;
      const len = w / rng.range(2, 3.5);
      ctx.fillStyle = pal[r % 3];
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const t = ((x + r * 37) % len) / len;
        const curl = Math.pow(Math.sin(t * Math.PI), 2) * amp * (1 + (t > 0.6 ? (t - 0.6) * 3 : 0));
        ctx.lineTo(x, y0 - curl);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      // Écume
      ctx.strokeStyle = pal[3];
      ctx.lineWidth = Math.max(1.5, w * 0.006);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const t = ((x + r * 37) % len) / len;
        const curl = Math.pow(Math.sin(t * Math.PI), 2) * amp * (1 + (t > 0.6 ? (t - 0.6) * 3 : 0));
        if (x === 0) ctx.moveTo(x, y0 - curl);
        else ctx.lineTo(x, y0 - curl);
      }
      ctx.stroke();
    }
    ctx.fillStyle = pal[3];
    ctx.beginPath();
    ctx.arc(w * rng.range(0.6, 0.85), h * 0.14, w * 0.07, 0, TAU);
    ctx.fill();
  },

  etoiles(ctx, w, h, rng, pal) {
    const sky = ctx.createRadialGradient(w * 0.5, h * 1.1, 0, w * 0.5, h * 1.1, h * 1.3);
    sky.addColorStop(0, pal[1]);
    sky.addColorStop(1, '#05060b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      ctx.globalAlpha = rng.range(0.3, 1);
      ctx.fillStyle = rng.chance(0.2) ? pal[4] : '#ffffff';
      ctx.fillRect(rng.range(0, w), rng.range(0, h), rng.range(1, 2.4), rng.range(1, 2.4));
    }
    ctx.globalAlpha = 1;
    // Constellations
    for (let c = 0; c < 3; c++) {
      const pts = Array.from({ length: rng.int(4, 7) }, () => [rng.range(0.1, 0.9) * w, rng.range(0.08, 0.6) * h]);
      pts.sort((a, b) => a[0] - b[0]);
      ctx.strokeStyle = pal[3];
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, w * 0.004);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      for (const [x, y] of pts) {
        ctx.beginPath();
        ctx.arc(x, y, w * 0.011, 0, TAU);
        ctx.fill();
      }
    }
    ctx.fillStyle = pal[4];
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.18, w * 0.07, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#05060b';
    ctx.beginPath();
    ctx.arc(w * 0.83, h * 0.16, w * 0.06, 0, TAU);
    ctx.fill();
    // Silhouette au sol
    ctx.fillStyle = '#05060b';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, h * 0.86 - Math.abs(Math.sin(x * 0.05 + seedish(rng))) * h * 0.06);
    ctx.lineTo(w, h);
    ctx.fill();
  },

  vitrail(ctx, w, h, rng, pal) {
    ctx.fillStyle = '#11131f';
    ctx.fillRect(0, 0, w, h);
    const cols = rng.int(5, 7);
    const rows = Math.round((cols * h) / w);
    const cw = w / cols;
    const ch = h / rows;
    const pts = [];
    for (let y = 0; y <= rows; y++) {
      pts.push([]);
      for (let x = 0; x <= cols; x++) {
        const edgeX = x === 0 || x === cols;
        const edgeY = y === 0 || y === rows;
        pts[y].push([x * cw + (edgeX ? 0 : rng.range(-cw, cw) * 0.35), y * ch + (edgeY ? 0 : rng.range(-ch, ch) * 0.35)]);
      }
    }
    ctx.lineJoin = 'round';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const quad = [pts[y][x], pts[y][x + 1], pts[y + 1][x + 1], pts[y + 1][x]];
        const tris = rng.chance(0.5) ? [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]] : [[quad[0], quad[1], quad[3]], [quad[1], quad[2], quad[3]]];
        for (const t of tris) {
          ctx.fillStyle = rng.pick(pal);
          ctx.globalAlpha = rng.range(0.75, 1);
          ctx.beginPath();
          t.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#11131f';
          ctx.lineWidth = Math.max(2, w * 0.012);
          ctx.stroke();
        }
      }
    }
    // Lumière qui traverse
    const glow = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, w * 0.8);
    glow.addColorStop(0, 'rgba(255,255,255,0.25)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  },
};

const seedish = (rng) => rng.range(0, 10);

function blob(ctx, rng, cx, cy, r, color, alpha) {
  const n = 9;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const rr = r * rng.range(0.7, 1.25);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(x0, y0, mx, my);
  }
  const [x0, y0] = pts[0];
  const [x1, y1] = pts[1];
  ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Coups de pinceau qui révèlent la toile progressivement : `count` formes en ordre aléatoire,
 * qui couvrent toute la surface une fois toutes posées.
 */
export function makeStrokes(rng, w, h, count) {
  const strokes = [];
  const cols = 6;
  const rows = Math.ceil(count / cols);
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([x, y]);
  for (const [x, y] of rng.shuffle(cells).slice(0, count)) {
    const cx = ((x + 0.5) / cols) * w;
    const cy = ((y + 0.5) / rows) * h;
    strokes.push({ cx, cy, rx: (w / cols) * rng.range(1.1, 1.6), ry: (h / rows) * rng.range(0.9, 1.4), a: rng.range(-0.8, 0.8) });
  }
  return strokes;
}
