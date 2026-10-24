// Plume — rendu « papier découpé » : ciel, collines, nuages, falaises, oiseau origami.

import { createRng } from '../../shared/js/core/rng.js';
import { TAU } from '../../shared/js/core/math.js';
import { GROUND } from './config.js';

// ---------- Texture de papier (générée une fois) ----------
let grain = null;
function paperGrain(ctx) {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  const rng = createRng(3);
  for (let i = 0; i < 520; i++) {
    g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
    g.fillRect(rng.int(0, 95), rng.int(0, 95), 1, 1);
  }
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    const x = rng.range(0, 96);
    const y = rng.range(0, 96);
    g.moveTo(x, y);
    g.lineTo(x + rng.range(-10, 10), y + rng.range(4, 14));
    g.stroke();
  }
  grain = ctx.createPattern(c, 'repeat');
  return grain;
}

function withGrain(ctx, alpha = 0.09) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = paperGrain(ctx);
  ctx.fill();
  ctx.restore();
}

// ---------- Décor ----------
export function createScenery(seed = 5) {
  const rng = createRng(seed);
  const clouds = Array.from({ length: 7 }, () => ({ x: rng.range(0, 1600), y: rng.range(40, 300), s: rng.range(0.7, 1.4), depth: rng.range(0.08, 0.2) }));
  const hillA = Array.from({ length: 12 }, () => rng.range(40, 120));
  const hillB = Array.from({ length: 12 }, () => rng.range(30, 90));
  const flecks = Array.from({ length: 40 }, () => ({ x: rng.next(), y: rng.next(), s: rng.range(1, 2.4), tw: rng.range(0, TAU) }));
  return { clouds, hillA, hillB, flecks };
}

function hillPath(ctx, heights, offset, baseY, period, viewW) {
  const n = heights.length;
  const seg = period / n;
  const start = -(((offset % period) + period) % period);
  ctx.beginPath();
  ctx.moveTo(start - seg, baseY + 400);
  for (let x = start - seg, i = -1; x < viewW + seg * 2; x += seg, i++) {
    const h = heights[((i % n) + n) % n];
    ctx.quadraticCurveTo(x + seg / 2, baseY - h * 1.4, x + seg, baseY - heights[(((i + 1) % n) + n) % n] * 0.6);
  }
  ctx.lineTo(viewW + seg * 3, baseY + 400);
  ctx.closePath();
}

export function drawBackground(ctx, view, pal, time, cameraX, top, sc) {
  const w = view.width;
  const h = view.height;
  const g = ctx.createLinearGradient(0, 0, 0, top + GROUND);
  g.addColorStop(0, pal.sky[0]);
  g.addColorStop(1, pal.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Paillettes / étoiles (visibles surtout la nuit)
  const starA = pal.starAlpha ?? 0;
  if (starA > 0.02) {
    ctx.fillStyle = '#f4efe4';
    for (const f of sc.flecks) {
      ctx.globalAlpha = starA * (0.5 + 0.5 * Math.sin(time * 2 + f.tw));
      ctx.fillRect(f.x * w, f.y * (top + GROUND * 0.6), f.s, f.s);
    }
    ctx.globalAlpha = 1;
  }

  // Soleil / lune de papier avec son ombre
  const sx = w * 0.74;
  const sy = top + 150;
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.arc(sx + 5, sy + 6, 46, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 46, 0, TAU);
  ctx.fill();
  withGrain(ctx, 0.08);

  // Nuages de papier
  for (const c of sc.clouds) {
    const span = 1700;
    const x = ((((c.x - cameraX * c.depth - time * 6) % span) + span) % span) - 200;
    if (x > w + 100) continue;
    drawCloud(ctx, x, top + c.y, c.s, pal.cloud);
  }

  // Collines en deux plans
  const baseY = top + GROUND;
  ctx.fillStyle = pal.hills[0];
  hillPath(ctx, sc.hillA, cameraX * 0.18, baseY - 60, 1300, w);
  ctx.fill();
  withGrain(ctx, 0.07);
  ctx.fillStyle = pal.hills[1];
  hillPath(ctx, sc.hillB, cameraX * 0.35, baseY - 10, 1100, w);
  ctx.fill();
  withGrain(ctx, 0.07);
}

function drawCloud(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(22, -4, 18, Math.PI, 0);
    ctx.arc(52, -12, 22, Math.PI, 0);
    ctx.arc(82, -2, 16, Math.PI, 0);
    ctx.lineTo(100, 8);
    ctx.lineTo(0, 8);
    ctx.closePath();
  };
  ctx.translate(4, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  shape();
  ctx.fill();
  ctx.translate(-4, -5);
  ctx.fillStyle = color;
  shape();
  ctx.fill();
  withGrain(ctx, 0.06);
  ctx.restore();
}

// ---------- Falaises ----------
function jagged(seed, x0, x1, step = 12, amp = 6) {
  let s = seed;
  const next = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const pts = [];
  for (let x = x0; x <= x1 + 0.1; x += step) pts.push([Math.min(x, x1), (next() - 0.5) * 2 * amp]);
  pts[0][1] = 0;
  pts[pts.length - 1][1] = 0;
  return pts;
}

// Silhouette de falaise en papier découpé : bords ondulés (pas de « tuyau » droit),
// bord dentelé côté ouverture. `grow` élargit la forme pour les couches arrière.
function cliffShape(ctx, gate, edge, fromTop, grow, farY) {
  let s = gate.seed + (fromTop ? 11 : 29);
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const dir = fromTop ? -1 : 1; // sens de l'ouverture vers le fond
  const len = Math.abs(farY - edge);
  const steps = Math.max(2, Math.ceil(len / 46));
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // La falaise s'élargit en s'éloignant de l'ouverture, comme un pan de papier plié
    const widen = Math.min(1, t * 3) * 10;
    left.push([gate.x - grow - widen - rnd() * 7, edge + dir * t * len]);
    right.push([gate.x + gate.w + grow + widen + rnd() * 7, edge + dir * t * len]);
  }
  const pts = jagged(gate.seed + (fromTop ? 1 : 7), gate.x - grow, gate.x + gate.w + grow, 10, 6);
  ctx.beginPath();
  ctx.moveTo(left[steps][0], left[steps][1]);
  for (let i = steps; i >= 0; i--) ctx.lineTo(left[i][0], left[i][1]);
  // Les dents rentrent dans la falaise : leurs pointes s'arrêtent sur la ligne de collision
  for (const [x, dy] of pts) ctx.lineTo(x, edge + dir * Math.abs(dy));
  for (let i = 0; i <= steps; i++) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
}

// Herbes (bas) ou franges (haut) de papier sur le bord de l'ouverture
function edgeTrim(ctx, gate, edge, fromTop, color) {
  let s = gate.seed + (fromTop ? 3 : 5);
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  ctx.fillStyle = color;
  const dir = fromTop ? 1 : -1;
  for (let x = gate.x + 4; x < gate.x + gate.w - 6; x += 9 + rnd() * 6) {
    const h = 4 + rnd() * 6;
    ctx.beginPath();
    ctx.moveTo(x, edge);
    ctx.lineTo(x + 3 + rnd() * 2, edge + dir * h);
    ctx.lineTo(x + 7, edge);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawGate(ctx, gate, gapY, pal, top, lantern, time) {
  const half = gate.h / 2;
  const topEdge = gapY - half;
  const botEdge = gapY + half;
  const skyTop = -top - 20;
  for (const [fromTop, edge, far] of [
    [true, topEdge, skyTop],
    [false, botEdge, GROUND + 40],
  ]) {
    // Ombre portée sur la page
    ctx.save();
    ctx.translate(8, 7);
    ctx.fillStyle = pal.shadow;
    ctx.globalAlpha = 0.4;
    cliffShape(ctx, gate, edge, fromTop, 4, far);
    ctx.fill();
    ctx.restore();
    // Couche arrière (relief), puis face avant
    ctx.fillStyle = pal.cliff[1];
    cliffShape(ctx, gate, edge, fromTop, 5, far);
    ctx.fill();
    ctx.fillStyle = pal.cliff[0];
    cliffShape(ctx, gate, edge, fromTop, -2, far);
    ctx.fill();
    withGrain(ctx, 0.1);
    // Liseré clair côté lumière et pli de papier
    ctx.strokeStyle = pal.cliff[2];
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(gate.x + 6, edge + (fromTop ? -8 : 8));
    ctx.lineTo(gate.x + 2, far);
    ctx.stroke();
    ctx.strokeStyle = pal.shadow;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const fy = fromTop ? edge - 46 : edge + 46;
    ctx.moveTo(gate.x + 12, fy);
    ctx.lineTo(gate.x + gate.w - 14, fy + (fromTop ? -18 : 18));
    ctx.stroke();
    ctx.globalAlpha = 1;
    edgeTrim(ctx, gate, edge, fromTop, pal.cliff[2]);
  }
  if (lantern) {
    for (const [y, dir] of [
      [topEdge, 1],
      [botEdge, -1],
    ]) {
      const lx = gate.x + gate.w / 2;
      const ly = y + dir * 14;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(lx, ly - dir * 5);
      ctx.stroke();
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath();
      ctx.roundRect(lx - 6, ly - 7, 12, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#ff8a5b';
      ctx.fillRect(lx - 6, ly - 1, 12, 2);
    }
  }
}

export function drawLanternGlow(ctx, gate, gapY, time) {
  const half = gate.h / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [y, dir] of [
    [gapY - half, 1],
    [gapY + half, -1],
  ]) {
    const lx = gate.x + gate.w / 2;
    const ly = y + dir * 14;
    const r = 46 + Math.sin(time * 6 + gate.idx) * 4;
    const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, r);
    g.addColorStop(0, 'rgba(255,201,60,0.55)');
    g.addColorStop(1, 'rgba(255,201,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
  }
  ctx.restore();
}

export function drawGround(ctx, pal, cameraX, view, top) {
  const y = GROUND;
  const x0 = cameraX - 40;
  const x1 = cameraX + view.width + 40;
  const step = 28;
  const start = Math.floor(x0 / step) * step;
  for (const [color, dy, scale] of [
    [pal.shadow, 6, 1],
    [pal.ground[0], 0, 1],
    [pal.ground[1], 14, 0.7],
  ]) {
    ctx.fillStyle = color;
    if (color === pal.shadow) ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(start, view.height - top + 10);
    for (let x = start; x <= x1 + step; x += step) {
      ctx.lineTo(x, y + dy);
      ctx.quadraticCurveTo(x + step / 2, y + dy - 9 * scale, x + step, y + dy);
    }
    ctx.lineTo(x1 + step, view.height - top + 10);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.rect(x0, y, x1 - x0, view.height - top - y + 10);
  withGrain(ctx, 0.12);
}

// ---------- Objets ----------
export function drawStar(ctx, s, time) {
  const spin = Math.cos(time * 3 + s.phase);
  const bob = Math.sin(time * 2.4 + s.phase) * 3;
  ctx.save();
  ctx.translate(s.x, s.y + bob);
  ctx.rotate(Math.sin(time + s.phase) * 0.2);
  ctx.scale(Math.max(0.55, Math.abs(spin)), 1);
  const star = (r1, r2) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? r2 : r1;
      const a = -Math.PI / 2 + (i / 10) * TAU;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.translate(2, 3);
  star(15, 7);
  ctx.fill();
  ctx.translate(-2, -3);
  ctx.fillStyle = spin > 0 ? '#ffc93c' : '#ffdf7a';
  star(15, 7);
  ctx.fill();
  ctx.strokeStyle = '#c98f00';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Plis
  ctx.strokeStyle = 'rgba(122,80,0,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * TAU;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawShieldBubble(ctx, s, time, worn = false) {
  const r = worn ? 24 : 16 + Math.sin(time * 4) * 1.5;
  ctx.save();
  ctx.translate(s.x, s.y + (worn ? 0 : Math.sin(time * 2) * 4));
  ctx.strokeStyle = '#4cc3ff';
  ctx.fillStyle = 'rgba(76,195,255,0.16)';
  ctx.lineWidth = worn ? 2.5 : 3;
  ctx.globalAlpha = worn ? 0.7 + Math.sin(time * 8) * 0.2 : 1;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r - 5, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
  if (!worn) {
    // Spirale de vent
    ctx.strokeStyle = '#1a7fb8';
    ctx.beginPath();
    for (let a = 0; a < TAU * 1.5; a += 0.3) {
      const rr = 2 + a * 1.8;
      ctx.lineTo(Math.cos(a + time * 3) * rr, Math.sin(a + time * 3) * rr);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWind(ctx, z, time, top) {
  const up = z.force < 0;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const cols = Math.max(2, Math.floor((z.x1 - z.x0) / 36));
  for (let i = 0; i < cols; i++) {
    const x = z.x0 + ((i + 0.5) * (z.x1 - z.x0)) / cols;
    for (let k = 0; k < 4; k++) {
      const p = ((time * 0.9 + k / 4 + i * 0.13) % 1 + 1) % 1;
      const y = up ? GROUND - p * GROUND : p * GROUND;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(time * 4 + k) * 4, y + (up ? 26 : -26));
      ctx.stroke();
    }
  }
  // Chevrons d'annonce en haut de la zone
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  const cx = (z.x0 + z.x1) / 2;
  const cy = up ? 70 : 70;
  for (let i = 0; i < 2; i++) {
    const yy = cy + i * 12 + (up ? 0 : 0);
    ctx.beginPath();
    ctx.moveTo(cx - 10, yy + (up ? 6 : -6));
    ctx.lineTo(cx, yy + (up ? -2 : 2));
    ctx.lineTo(cx + 10, yy + (up ? 6 : -6));
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Oiseau origami ----------
// Points d'origine (vignette) recentrés ; échelle 0.72
const S = 0.86;
const P = (pts) => pts.map(([x, y]) => [x * S, y * S]);
const BODY = P([[-27, 0], [9, -12], [27, 0], [3, 12]]);
const HEAD = P([[9, -12], [27, 0], [13, 2]]);
const TAIL = P([[-27, 0], [-37, -10], [-21, -4]]);
const WING = P([[-13, -4], [3, -30], [9, -10]]);
const BEAK = P([[27, 0], [36, 2], [27, 5]]);

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** b = { x, y, rot, flap (0..1, 1 = aile haute), sx, sy, dead, blink } */
export function drawBird(ctx, b, skin, time) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.scale(b.sx, b.sy);
  ctx.lineJoin = 'round';
  const line = skin.line;

  // Ombre
  ctx.save();
  ctx.translate(3, 4);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  poly(ctx, BODY);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = line;
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.4;
  // Queue, corps, tête
  ctx.fillStyle = skin.wing;
  poly(ctx, TAIL);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = skin.wing;
  poly(ctx, BODY);
  ctx.fill();
  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.moveTo(BODY[0][0], BODY[0][1]);
  ctx.lineTo(BODY[1][0], BODY[1][1]);
  ctx.lineTo(BODY[2][0], BODY[2][1]);
  ctx.closePath();
  ctx.fill();
  if (skin.print) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-14 + i * 3, 2 + i * 0.3);
      ctx.lineTo(10 + i * 2, -4 + i * 0.3);
      ctx.stroke();
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.4;
  }
  if (skin.stars) {
    ctx.fillStyle = '#ffc93c';
    for (const [x, y] of [[-8, 2], [2, -3], [10, 4], [-2, 6]]) ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.globalAlpha = 0.55;
  poly(ctx, BODY);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = skin.body;
  poly(ctx, HEAD);
  ctx.fill();
  ctx.fillStyle = '#ff5a4e';
  poly(ctx, BEAK);
  ctx.fill();
  // Œil
  ctx.fillStyle = line;
  if (b.dead) {
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(11, -6);
    ctx.lineTo(15, -2);
    ctx.moveTo(15, -6);
    ctx.lineTo(11, -2);
    ctx.stroke();
  } else if (b.blink > 0) {
    ctx.fillRect(11.5, -4, 3.5, 1.2);
  } else {
    ctx.beginPath();
    ctx.arc(13.2, -3.6, 1.9, 0, TAU);
    ctx.fill();
  }

  // Aile : pivote autour de sa base, s'aplatit en battant
  ctx.save();
  const wf = -0.55 + b.flap * 1.45; // -0.55 = basse, 0.9 = haute
  ctx.translate(-2, -7 * S);
  ctx.scale(1, wf);
  ctx.translate(2, 7 * S);
  ctx.fillStyle = skin.body;
  poly(ctx, WING);
  ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.4 / Math.max(0.2, Math.abs(wf));
  ctx.stroke();
  ctx.restore();
  if (skin.shine) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(2, -7);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Tourne-page entre deux chapitres ----------
export function drawPageTurn(ctx, view, p, paper = '#fff6e8') {
  if (p <= 0 || p >= 1) return;
  const w = view.width;
  const h = view.height;
  // Le bord de la page balaie l'écran de droite à gauche, légèrement incliné
  const edge = w * 1.15 - p * (w * 1.45);
  const slant = h * 0.18;
  const band = 90;
  ctx.save();
  const g = ctx.createLinearGradient(edge - band, 0, edge + band, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.25)');
  g.addColorStop(0.5, paper);
  g.addColorStop(0.85, paper);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(edge - band - slant, 0);
  ctx.lineTo(edge + band - slant, 0);
  ctx.lineTo(edge + band + slant, h);
  ctx.lineTo(edge - band + slant, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
