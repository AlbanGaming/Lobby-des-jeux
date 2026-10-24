// Bubble Pop — rendu du lagon de nuit et des bulles (sprites mis en cache).

import { createRng } from '../../shared/js/core/rng.js';
import { TAU } from '../../shared/js/core/math.js';
import { COLORS } from './config.js';

// ---------- Décor ----------
export function createLagoon(seed = 4) {
  const rng = createRng(seed);
  return {
    weeds: Array.from({ length: 9 }, (_, i) => ({ x: (i + rng.range(0.1, 0.9)) / 9, h: rng.range(70, 170), w: rng.range(10, 18), phase: rng.range(0, TAU), tone: rng.int(0, 1) })),
    plankton: Array.from({ length: 50 }, () => ({ x: rng.next(), y: rng.next(), s: rng.range(1, 2.6), v: rng.range(4, 14), tw: rng.range(0, TAU) })),
    rays: Array.from({ length: 4 }, (_, i) => ({ x: 0.15 + i * 0.24 + rng.range(-0.05, 0.05), w: rng.range(60, 120), phase: rng.range(0, TAU) })),
    fish: Array.from({ length: 3 }, () => ({ y: rng.range(0.25, 0.7), speed: rng.range(14, 26), offset: rng.range(0, 1), s: rng.range(0.6, 1.1), dir: rng.sign() })),
  };
}

export function drawLagoon(ctx, view, time, lag, frenzy) {
  const w = view.width;
  const h = view.height;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, frenzy ? '#16365a' : '#123a5c');
  g.addColorStop(0.55, '#0d2a45');
  g.addColorStop(1, '#081726');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Rayons de lune qui ondulent
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const r of lag.rays) {
    const sway = Math.sin(time * 0.4 + r.phase) * 30;
    const x = r.x * w + sway;
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.85);
    grad.addColorStop(0, 'rgba(120,200,255,0.10)');
    grad.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - r.w * 0.3, 0);
    ctx.lineTo(x + r.w * 0.3, 0);
    ctx.lineTo(x + r.w + sway * 0.6, h * 0.85);
    ctx.lineTo(x - r.w + sway * 0.6, h * 0.85);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Poissons lointains
  ctx.fillStyle = 'rgba(8,23,38,0.55)';
  for (const f of lag.fish) {
    const span = w + 200;
    const p = ((time * f.speed) / span + f.offset) % 1;
    const x = f.dir > 0 ? -100 + p * span : w + 100 - p * span;
    const y = f.y * h + Math.sin(time + f.offset * 9) * 8;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f.s * f.dir, f.s);
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 10, 0, 0, TAU);
    ctx.moveTo(-22, 0);
    ctx.lineTo(-40, -10);
    ctx.lineTo(-40, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Plancton luminescent
  ctx.fillStyle = '#9ddcff';
  for (const pl of lag.plankton) {
    const y = ((pl.y * h - time * pl.v) % h + h) % h;
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 2 + pl.tw);
    ctx.fillRect(pl.x * w + Math.sin(time + pl.tw) * 6, y, pl.s, pl.s);
  }
  ctx.globalAlpha = 1;

  // Algues qui ondulent
  for (const wd of lag.weeds) {
    const x = wd.x * w;
    ctx.strokeStyle = wd.tone ? '#0f4a4a' : '#0b3a3d';
    ctx.lineWidth = wd.w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, h + 10);
    const sway = Math.sin(time * 1.1 + wd.phase) * 18;
    ctx.bezierCurveTo(x + sway, h - wd.h * 0.35, x - sway, h - wd.h * 0.7, x + sway * 1.3, h - wd.h);
    ctx.stroke();
  }
  // Sable
  ctx.fillStyle = '#0a1f2e';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 40; x += 40) ctx.quadraticCurveTo(x + 20, h - 16 - Math.sin(x * 0.03) * 6, x + 40, h - 8);
  ctx.lineTo(w + 40, h);
  ctx.closePath();
  ctx.fill();
}

/** Surface de l'eau en haut : la ligne que les bulles ne doivent pas atteindre. */
export function drawSurface(ctx, view, time, zone, danger) {
  const w = view.width;
  ctx.fillStyle = `rgba(255,90,78,${0.05 + danger * 0.12})`;
  ctx.fillRect(0, 0, w, zone);
  ctx.strokeStyle = 'rgba(157,220,255,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 12) {
    const y = 6 + Math.sin(x * 0.04 + time * 2.4) * 3;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = 'rgba(255,90,78,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, zone);
  ctx.lineTo(w, zone);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ---------- Sprites de bulles ----------
const SPRITE = 72; // diamètre de référence du sprite (unités logiques)
const cache = new Map();

function glyph(g, kind, c, r) {
  g.fillStyle = c;
  g.strokeStyle = c;
  g.lineWidth = r * 0.14;
  const s = r * 0.3;
  g.beginPath();
  switch (kind) {
    case 'dot':
      g.arc(0, 0, s * 0.8, 0, TAU);
      g.fill();
      break;
    case 'tri':
      g.moveTo(0, -s);
      g.lineTo(s * 0.95, s * 0.75);
      g.lineTo(-s * 0.95, s * 0.75);
      g.closePath();
      g.fill();
      break;
    case 'square':
      g.roundRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6, s * 0.3);
      g.fill();
      break;
    case 'ring':
      g.arc(0, 0, s * 0.8, 0, TAU);
      g.stroke();
      break;
    default:
      g.moveTo(0, -s);
      g.lineTo(s, 0);
      g.lineTo(0, s);
      g.lineTo(-s, 0);
      g.closePath();
      g.fill();
  }
}

function makeSprite(key, draw) {
  if (cache.has(key)) return cache.get(key);
  const dpr = 2;
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE * dpr + 8;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(SPRITE / 2 + 2, SPRITE / 2 + 2);
  draw(g, SPRITE / 2 - 2);
  cache.set(key, c);
  return c;
}

function colorSprite(ci, style) {
  return makeSprite(`c${ci}:${style.id}`, (g, r) => {
    const col = COLORS[ci];
    if (style.neon) {
      g.fillStyle = 'rgba(8,23,38,0.85)';
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      g.strokeStyle = col.fill;
      g.lineWidth = r * 0.16;
      g.shadowColor = col.fill;
      g.shadowBlur = 10;
      g.beginPath();
      g.arc(0, 0, r * 0.88, 0, TAU);
      g.stroke();
      g.shadowBlur = 0;
      glyph(g, col.glyph, col.fill, r);
      return;
    }
    const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, col.fill);
    grad.addColorStop(1, col.deep);
    g.fillStyle = grad;
    g.globalAlpha = 0.92;
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    if (style.stripes) {
      g.save();
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      g.lineWidth = r * 0.22;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(-r, i * r * 0.55 - r * 0.5);
        g.lineTo(r, i * r * 0.55 + r * 0.5);
        g.stroke();
      }
      g.restore();
    }
    if (style.sheen) {
      const sh = g.createLinearGradient(-r, -r, r, r);
      for (const [o, c] of [[0, '#ff5a4e'], [0.25, '#ffc93c'], [0.5, '#3ee6a8'], [0.75, '#4cc3ff'], [1, '#a68bff']]) sh.addColorStop(o, c);
      g.strokeStyle = sh;
      g.globalAlpha = 0.7;
      g.lineWidth = r * 0.12;
      g.beginPath();
      g.arc(0, 0, r * 0.82, Math.PI * 0.1, Math.PI * 1.1);
      g.stroke();
      g.globalAlpha = 1;
    }
    g.strokeStyle = col.deep;
    g.lineWidth = r * 0.07;
    g.beginPath();
    g.arc(0, 0, r - r * 0.035, 0, TAU);
    g.stroke();
    glyph(g, col.glyph, 'rgba(5,6,11,0.32)', r);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.ellipse(-r * 0.38, -r * 0.42, r * 0.24, r * 0.14, -0.6, 0, TAU);
    g.fill();
  });
}

function specialSprite(kind) {
  return makeSprite(`s:${kind}`, (g, r) => {
    if (kind === 'bomb') {
      g.fillStyle = '#05060b';
      g.beginPath();
      g.arc(0, r * 0.08, r * 0.92, 0, TAU);
      g.fill();
      const grad = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
      grad.addColorStop(0, '#6b7194');
      grad.addColorStop(1, '#1a1d2e');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r * 0.88, 0, TAU);
      g.fill();
      g.fillStyle = '#353b58';
      g.fillRect(-r * 0.22, -r * 1.02, r * 0.44, r * 0.26);
      g.strokeStyle = '#c4c7dc';
      g.lineWidth = r * 0.08;
      g.beginPath();
      g.moveTo(0, -r * 1.0);
      g.quadraticCurveTo(r * 0.3, -r * 1.25, r * 0.5, -r * 1.05);
      g.stroke();
      g.fillStyle = '#ff5a4e';
      g.font = `900 ${r * 0.8}px "Big Shoulders Display", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('!', 0, r * 0.08);
    } else if (kind === 'clock') {
      g.fillStyle = '#13996a';
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      g.fillStyle = '#d6f7e8';
      g.beginPath();
      g.arc(0, 0, r * 0.78, 0, TAU);
      g.fill();
      g.strokeStyle = '#032a1c';
      g.lineWidth = r * 0.12;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -r * 0.5);
      g.moveTo(0, 0);
      g.lineTo(r * 0.36, r * 0.18);
      g.stroke();
      g.fillStyle = '#032a1c';
      g.font = `900 ${r * 0.5}px "Big Shoulders Display", sans-serif`;
      g.textAlign = 'center';
      g.fillText('+3', 0, r * 0.62);
    } else if (kind === 'prism') {
      const sh = g.createConicGradient ? g.createConicGradient(0, 0, 0) : null;
      if (sh) {
        for (const [o, c] of [[0, '#ff5a4e'], [0.2, '#ffc93c'], [0.4, '#3ee6a8'], [0.6, '#4cc3ff'], [0.8, '#a68bff'], [1, '#ff5a4e']]) sh.addColorStop(o, c);
        g.fillStyle = sh;
      } else g.fillStyle = '#f4efe4';
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU - Math.PI / 2;
        g.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      }
      g.closePath();
      g.fill();
    } else {
      // Oursin : à ne pas toucher
      g.fillStyle = '#b8281f';
      g.beginPath();
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU;
        const rr = i % 2 ? r * 0.7 : r * 1.02;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      g.fillStyle = '#ff5a4e';
      g.beginPath();
      g.arc(0, 0, r * 0.66, 0, TAU);
      g.fill();
      g.fillStyle = '#2b1012';
      g.beginPath();
      g.moveTo(-r * 0.42, -r * 0.28);
      g.lineTo(-r * 0.12, -r * 0.12);
      g.lineTo(-r * 0.42, -r * 0.02);
      g.closePath();
      g.moveTo(r * 0.42, -r * 0.28);
      g.lineTo(r * 0.12, -r * 0.12);
      g.lineTo(r * 0.42, -r * 0.02);
      g.closePath();
      g.fill();
      g.strokeStyle = '#2b1012';
      g.lineWidth = r * 0.09;
      g.beginPath();
      g.arc(0, r * 0.38, r * 0.22, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
  });
}

/** b = bulle de la simulation ; style = STYLES[i]. */
export function drawBubble(ctx, b, style, time, pulse = 0) {
  const sprite = b.kind === 'color' ? colorSprite(b.color, style) : specialSprite(b.kind);
  const wob = 1 + Math.sin(time * 4 + b.phase) * 0.025;
  const s = (b.r * 2 * b.grow * (1 + pulse)) / (SPRITE - 4);
  const size = (SPRITE + 4) * s;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.kind === 'bomb') ctx.rotate(Math.sin(time * 6 + b.phase) * 0.08);
  ctx.scale(wob, 2 - wob);
  ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
  if (b.kind === 'bomb') {
    // Étincelle de la mèche
    ctx.fillStyle = Math.sin(time * 30) > 0 ? '#ffc93c' : '#ff8a5b';
    ctx.beginPath();
    ctx.arc(b.r * 0.5, -b.r * 1.08, 3 + Math.sin(time * 40) * 1.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Liens visibles entre bulles d'une même grappe : on voit ce qui va sauter ensemble. */
export function drawLinks(ctx, links, style) {
  ctx.lineCap = 'round';
  for (const [a, b] of links) {
    const col = COLORS[a.color];
    ctx.strokeStyle = style.neon ? col.fill : col.deep;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.min(a.r, b.r) * 0.55;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Indices de grappe dessinés par-dessus les bulles : une jointure au point de contact
 * et un badge « ×n » au-dessus des grappes de 3 bulles et plus.
 */
export function drawClusterHints(ctx, links, groups, time) {
  for (const [a, b] of links) {
    const col = COLORS[a.color];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t = a.r / (a.r + b.r);
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = col.deep;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 3.4 + Math.sin(time * 6 + d) * 0.6, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.font = '900 16px "Big Shoulders Display", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const g of groups.values()) {
    if (g.length < 3) continue;
    let top = g[0];
    let cx = 0;
    for (const b of g) {
      cx += b.x;
      if (b.y - b.r < top.y - top.r) top = b;
    }
    cx /= g.length;
    const y = top.y - top.r - 14;
    const col = COLORS[top.color];
    ctx.fillStyle = 'rgba(8,23,38,0.85)';
    ctx.beginPath();
    ctx.roundRect(cx - 18, y - 11, 36, 22, 11);
    ctx.fill();
    ctx.strokeStyle = col.fill;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = col.fill;
    ctx.fillText(`×${g.length}`, cx, y + 1);
  }
}

export function clearSpriteCache() {
  cache.clear();
}
