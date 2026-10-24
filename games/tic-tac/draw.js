// Tic Tac — dessin : atelier d'horloger (engrenages), cadran, zones, aiguilles, fêlures.

import { TAU, clamp } from '../../shared/js/core/math.js';
import { Ease } from '../../shared/js/core/tween.js';

const FONT = '"Big Shoulders Display", "Arial Narrow", sans-serif';
const PIXEL = '"Silkscreen", monospace';
// Angle d'horloge (0 = midi, sens horaire) → angle canvas (0 = 3 h)
const ca = (a) => a - Math.PI / 2;

// ---------- Atelier ----------
export function createWorkshop() {
  // Positions en fractions de l'écran, rayon en fraction de la plus petite dimension
  return [
    { x: 0.08, y: 0.2, r: 0.2, teeth: 14, speed: 0.08 },
    { x: 0.2, y: 0.78, r: 0.13, teeth: 10, speed: -0.13 },
    { x: 0.92, y: 0.3, r: 0.16, teeth: 12, speed: -0.1 },
    { x: 0.86, y: 0.86, r: 0.24, teeth: 18, speed: 0.06 },
    { x: 0.5, y: 1.05, r: 0.18, teeth: 14, speed: 0.09 },
  ].map((g) => ({ ...g, path: gearPath(g.teeth) }));
}

// Engrenage de rayon 1, centré
function gearPath(teeth) {
  const p = new Path2D();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const r = i % 4 < 2 ? 1 : 0.84;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  p.moveTo(0.34, 0);
  p.arc(0, 0, 0.34, 0, TAU, true);
  return p;
}

export function drawWorkshop(ctx, view, time, gears, glow = 0) {
  const w = view.width;
  const h = view.height;
  const bg = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  bg.addColorStop(0, '#173a30');
  bg.addColorStop(0.55, '#0e231d');
  bg.addColorStop(1, '#081411');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const m = Math.min(w, h);
  ctx.save();
  ctx.fillStyle = '#c9a04a';
  for (const g of gears) {
    ctx.save();
    ctx.translate(g.x * w, g.y * h);
    ctx.rotate(time * g.speed * (1 + glow * 2));
    const r = g.r * m;
    ctx.scale(r, r);
    ctx.globalAlpha = 0.07 + glow * 0.05;
    ctx.fill(g.path, 'evenodd');
    ctx.restore();
  }
  ctx.restore();
  // Établi : une ligne de lumière basse
  const floor = ctx.createLinearGradient(0, h * 0.75, 0, h);
  floor.addColorStop(0, 'rgba(0,0,0,0)');
  floor.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.75, w, h * 0.25);
}

// ---------- Cadran ----------
/**
 * s : { dial, hand, dir, hourAngle, targets, time, hits, mult, hourText, cracks, squash, shield, fever,
 *       danger, chrono: { left, total } | null, trail: [angles] }
 */
export function drawClock(ctx, geo, s) {
  const { cx, cy, R } = geo;
  const d = s.dial;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s.squash, 2 - s.squash);

  // Chrono : anneau extérieur
  if (s.chrono) {
    const k = clamp(s.chrono.left / s.chrono.total);
    ctx.lineCap = 'round';
    ctx.lineWidth = R * 0.035;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.24, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = s.chrono.left <= 10 && Math.sin(s.time * 10) > 0 ? '#ff5a4e' : '#ffc93c';
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.24, ca(0), ca(TAU * k));
    ctx.stroke();
  }

  // Ombre dure + lunette
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.arc(0, R * 0.07, R * 1.13, 0, TAU);
  ctx.fill();
  if (s.fever > 0) {
    ctx.strokeStyle = `rgba(255,201,60,${0.25 + 0.2 * Math.sin(s.time * 8)})`;
    ctx.lineWidth = R * 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.17, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = d.deep;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = d.bezel;
  ctx.beginPath();
  ctx.arc(0, -R * 0.02, R * 1.08, 0, TAU);
  ctx.fill();
  // Couronne (remontoir) à midi
  ctx.fillStyle = d.deep;
  ctx.beginPath();
  ctx.roundRect(-R * 0.09, -R * 1.25, R * 0.18, R * 0.16, R * 0.03);
  ctx.fill();
  ctx.fillStyle = d.bezel;
  ctx.beginPath();
  ctx.roundRect(-R * 0.07, -R * 1.24, R * 0.14, R * 0.12, R * 0.025);
  ctx.fill();

  // Cadran
  ctx.fillStyle = d.face;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  if (s.danger > 0) {
    ctx.fillStyle = `rgba(255,90,78,${0.18 * s.danger})`;
    ctx.fill();
  }

  // Graduations
  ctx.strokeStyle = d.ink;
  ctx.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    const a = ca((i / 60) * TAU);
    const r0 = big ? R * 0.86 : R * 0.91;
    ctx.globalAlpha = big ? 0.85 : 0.35;
    ctx.lineWidth = big ? R * 0.022 : R * 0.01;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * R * 0.96, Math.sin(a) * R * 0.96);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = d.ink;
  ctx.font = `800 ${Math.round(R * 0.15)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.7;
  for (const [n, a] of [['12', 0], ['3', TAU / 4], ['6', TAU / 2], ['9', (3 * TAU) / 4]]) {
    ctx.fillText(n, Math.cos(ca(a)) * R * 0.72, Math.sin(ca(a)) * R * 0.72 + R * 0.01);
  }
  ctx.globalAlpha = 1;

  // Cibles
  for (const t of s.targets) drawTarget(ctx, R, t, s, d);

  // Compteur au centre
  ctx.fillStyle = d.ink;
  ctx.globalAlpha = 0.9;
  ctx.font = `900 ${Math.round(R * 0.3)}px ${FONT}`;
  ctx.fillText(String(s.hits), 0, -R * 0.34);
  ctx.globalAlpha = 0.55;
  ctx.font = `800 ${Math.round(R * 0.11)}px ${FONT}`;
  ctx.fillText(s.hourText, 0, R * 0.3);
  ctx.globalAlpha = 1;
  if (s.mult > 1) {
    ctx.fillStyle = s.fever > 0 ? '#e0a000' : d.hand;
    ctx.font = `900 ${Math.round(R * 0.16)}px ${FONT}`;
    ctx.fillText(`×${s.mult}`, 0, R * 0.46);
  }

  // Aiguille des heures (le niveau)
  drawHand(ctx, s.hourAngle, R * 0.42, R * 0.06, R * 0.08, d.ink, 0.9);

  // Traînée de l'aiguille
  for (let i = 0; i < s.trail.length; i++) {
    const a = ca(s.trail[i]);
    ctx.globalAlpha = (0.16 * (i + 1)) / s.trail.length;
    ctx.strokeStyle = d.hand;
    ctx.lineWidth = R * 0.035;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2);
    ctx.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawHand(ctx, s.hand, R * 0.9, R * 0.045, R * 0.2, s.handColor ?? d.hand, 1, true);

  // Axe
  ctx.fillStyle = d.ink;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.075, 0, TAU);
  ctx.fill();
  ctx.fillStyle = d.hand;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.032, 0, TAU);
  ctx.fill();

  // Remontoir en réserve
  if (s.shield) {
    ctx.save();
    ctx.translate(0, R * 0.68);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(s.time * 5);
    drawKey(ctx, R * 0.09, '#4cc3ff', d.ink);
    ctx.restore();
  }

  // Fêlures du verre
  if (s.cracks.length) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1.5, R * 0.008);
    ctx.lineJoin = 'round';
    for (const c of s.cracks) {
      ctx.beginPath();
      c.forEach(([x, y], i) => (i ? ctx.lineTo(x * R, y * R) : ctx.moveTo(x * R, y * R)));
      ctx.stroke();
    }
  }

  // Reflet du verre
  const glare = ctx.createLinearGradient(-R, -R, R * 0.2, R * 0.4);
  glare.addColorStop(0, 'rgba(255,255,255,0.16)');
  glare.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawHand(ctx, angle, len, width, tail, color, alpha, shadow = false) {
  const a = ca(angle);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  ctx.lineCap = 'round';
  if (shadow) {
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = width * 1.4;
    ctx.beginPath();
    ctx.moveTo(-ux * tail, -uy * tail + width * 1.6);
    ctx.lineTo(ux * len, uy * len + width * 1.6);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(-ux * tail, -uy * tail);
  ctx.lineTo(ux * len, uy * len);
  ctx.stroke();
  if (shadow) {
    // Contrepoids
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-ux * tail, -uy * tail, width * 1.3, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTarget(ctx, R, t, s, d) {
  const age = s.time - t.born;
  const appear = Ease.outBack(clamp(age / 0.22));
  let alpha = 1;
  let grow = 0;
  if (t.dead) {
    const k = clamp((s.time - t.deadAt) / 0.28);
    alpha = 1 - k;
    grow = k * R * 0.12;
    if (k >= 1) return;
  } else if (t.blink) {
    // Zone fantôme : visible seulement quand l'aiguille approche
    const near = clamp(1 - (Math.abs(t.d) - t.half) / 1.1);
    alpha = 0.12 + near * 0.88;
  }
  const r = R * 0.79 + grow * 0.5;
  const band = R * 0.2 * appear + grow;
  const a0 = ca(t.center - t.half);
  const a1 = ca(t.center + t.half);
  const inside = !t.dead && Math.abs(t.d) <= t.half;
  const col = t.kind === 'bell' ? '#ffc93c' : t.kind === 'key' ? '#4cc3ff' : d.zone;
  const deep = t.kind === 'bell' ? '#b8860b' : t.kind === 'key' ? '#1f6f9c' : d.zoneDeep;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'butt';
  // Bord foncé (épaisseur) puis zone
  ctx.strokeStyle = deep;
  ctx.lineWidth = band + R * 0.03;
  ctx.beginPath();
  ctx.arc(0, R * 0.012, r, a0 - 0.01, a1 + 0.01);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = band;
  ctx.beginPath();
  ctx.arc(0, 0, r, a0, a1);
  ctx.stroke();
  if (inside) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a1);
    ctx.stroke();
  }
  if (t.kind === 'main') {
    // Cœur « pile »
    ctx.strokeStyle = '#ffc93c';
    ctx.lineWidth = band * 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, ca(t.center - t.perfect), ca(t.center + t.perfect));
    ctx.stroke();
  } else {
    const a = ca(t.center);
    ctx.save();
    ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
    if (t.kind === 'bell') drawBell(ctx, R * 0.07, d.ink);
    else drawKey(ctx, R * 0.06, '#ffffff', d.ink);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawBell(ctx, k, ink) {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(-k, k * 0.6);
  ctx.quadraticCurveTo(-k * 0.9, -k, 0, -k);
  ctx.quadraticCurveTo(k * 0.9, -k, k, k * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, k * 0.8, k * 0.3, 0, TAU);
  ctx.fill();
}

function drawKey(ctx, k, color, ink) {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(-k * 0.7, 0, k * 0.75, 0, TAU);
  ctx.fill();
  ctx.fillRect(-k * 0.2, -k * 0.25, k * 1.6, k * 0.5);
  ctx.fillRect(k * 0.9, 0, k * 0.3, k * 0.6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-k * 0.7, 0, k * 0.32, 0, TAU);
  ctx.fill();
}

/** Fêlures en étoile depuis un point du cadran (coordonnées en rayons). */
export function makeCracks(rng, x, y) {
  const lines = [];
  const n = 6 + Math.floor(rng.next() * 3);
  for (let i = 0; i < n; i++) {
    let a = (i / n) * TAU + rng.range(-0.3, 0.3);
    let px = x;
    let py = y;
    const pts = [[px, py]];
    const len = rng.range(0.3, 0.7);
    for (let s = 0; s < 4; s++) {
      a += rng.range(-0.4, 0.4);
      px += Math.cos(a) * (len / 4);
      py += Math.sin(a) * (len / 4);
      if (Math.hypot(px, py) > 0.98) break;
      pts.push([px, py]);
    }
    lines.push(pts);
  }
  return lines;
}
