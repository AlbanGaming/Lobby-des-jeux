// Gratte-Ciel — dessin : ciel qui change avec l'altitude, ville en contrebas, façades par époque,
// nuages, oiseaux, avion, étoiles, lune, satellite.

import { TAU, clamp, lerp } from '../../shared/js/core/math.js';
import { hexToRgb, rgbStr } from '../../shared/js/core/color.js';

// Mélange de deux couleurs, en hexadécimal ou en rgb(…)
const toRgb = (c) => (c.startsWith('#') ? hexToRgb(c) : c.match(/\d+/g).slice(0, 3).map(Number));
const mixHex = (a, b, t) => {
  const A = toRgb(a);
  const B = toRgb(b);
  const k = clamp(t);
  return rgbStr([lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)]);
};

export const FLOOR_H = 34;

// Époques de la tour (à partir de l'étage indiqué)
export const EPOCHS = [
  { at: 0, name: 'Brique', body: '#c0634a', deep: '#8e3b2f', trim: '#e9b08f', win: '#ffe9a8', dark: '#2b3350' },
  { at: 15, name: 'Art déco', body: '#e3cfa1', deep: '#b8975a', trim: '#c98f00', win: '#ffe9a8', dark: '#3a506b' },
  { at: 30, name: 'Âge du verre', body: '#4cc3ff', deep: '#1f6f9c', trim: '#d6f0ff', win: '#e8f8ff', dark: '#1d4f73' },
  { at: 50, name: 'Néon', body: '#2b2d42', deep: '#15162a', trim: '#ff4fd8', win: '#3ee6a8', dark: '#3a3c5c' },
  { at: 80, name: 'Orbitale', body: '#e8ecf8', deep: '#a9b3d6', trim: '#4cc3ff', win: '#4cc3ff', dark: '#c9d1e0' },
];
export const epochOf = (floor) => EPOCHS.reduce((k, e, i) => (floor >= e.at ? i : k), 0);

// Ciel : couleurs du haut et de l'horizon selon l'étage
const SKY = [
  { at: 0, top: '#62b6f0', low: '#d9f1ff' },
  { at: 20, top: '#f39c5b', low: '#ffe0ae' },
  { at: 40, top: '#5b3f8c', low: '#ff8a5b' },
  { at: 60, top: '#0f1633', low: '#2b3a6b' },
  { at: 95, top: '#03040a', low: '#0b0f24' },
];
function skyAt(level) {
  let i = 0;
  while (i < SKY.length - 2 && level >= SKY[i + 1].at) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const k = clamp((level - a.at) / (b.at - a.at));
  return { top: mixHex(a.top, b.top, k), low: mixHex(a.low, b.low, k) };
}

// Villes de départ (décor au sol)
export const CITIES = [
  { id: 'ville', name: 'Ville', unlock: 0, ground: '#5b6b7f', far: '#8a9bb0', tint: null },
  { id: 'desert', name: 'Désert', unlock: 20, ground: '#c98a54', far: '#e0b07a', tint: '#ffcf8a' },
  { id: 'neige', name: 'Neige', unlock: 40, ground: '#8fa8c2', far: '#d9e6f2', tint: '#eaf4ff' },
  { id: 'neon', name: 'Néon', unlock: 70, ground: '#241b3d', far: '#3d2c66', tint: '#ff4fd8' },
];

export function createScenery(rng) {
  // Bâtiments du fond et du premier plan, nuages, étoiles : fixés une fois pour la partie
  const far = Array.from({ length: 26 }, (_, i) => ({ x: -1300 + i * 100 + rng.range(-20, 20), w: rng.range(50, 90), h: rng.range(60, 180) }));
  const near = Array.from({ length: 18 }, (_, i) => ({ x: -1350 + i * 150 + rng.range(-30, 30), w: rng.range(70, 120), h: rng.range(40, 120), lit: rng.next() }));
  const clouds = Array.from({ length: 14 }, () => ({ x: rng.range(-900, 900), floor: rng.range(8, 55), s: rng.range(0.7, 1.5) }));
  const stars = Array.from({ length: 120 }, () => ({ x: rng.range(-1, 1), y: rng.range(0, 1), r: rng.range(0.6, 2) }));
  const birds = Array.from({ length: 6 }, () => ({ x: rng.range(-600, 600), floor: rng.range(6, 26), ph: rng.range(0, TAU) }));
  return { far, near, clouds, stars, birds };
}

/**
 * Décor de fond. cam = { y (monde, en haut de l'écran), zoom }, level = étage visible en haut.
 */
export function drawSky(ctx, view, cam, level, sc, city, time) {
  const w = view.width;
  const h = view.height;
  const sky = skyAt(level);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sky.top);
  g.addColorStop(1, city.tint && level < 25 ? mixHex(sky.low, city.tint, 0.35 * (1 - level / 25)) : sky.low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Étoiles, dès que la nuit tombe
  const night = clamp((level - 45) / 25);
  if (night > 0) {
    ctx.fillStyle = '#ffffff';
    for (const st of sc.stars) {
      const tw = 0.6 + 0.4 * Math.sin(time * 2 + st.x * 40);
      ctx.globalAlpha = night * tw;
      ctx.fillRect(w / 2 + st.x * w * 0.6, st.y * h, st.r, st.r);
    }
    ctx.globalAlpha = 1;
  }
  // Lune, puis planète lointaine
  if (level > 55) {
    const k = clamp((level - 55) / 20);
    ctx.globalAlpha = k;
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.2, 34, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mixHex(skyAt(level).top, '#000000', 0.1);
    ctx.beginPath();
    ctx.arc(w * 0.8 + 12, h * 0.2 - 6, 30, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (level > 100) {
    const k = clamp((level - 100) / 20);
    ctx.globalAlpha = k;
    ctx.fillStyle = '#a68bff';
    ctx.beginPath();
    ctx.arc(w * 0.18, h * 0.3, 60, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffc93c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(w * 0.18, h * 0.3, 96, 20, -0.3, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Ville au sol, nuages, oiseaux, avion, satellite : dessinés dans le repère du monde. */
export function drawWorldDecor(ctx, sc, city, time, camFloor) {
  // Fond de ville
  ctx.fillStyle = city.far;
  for (const b of sc.far) ctx.fillRect(b.x, -b.h - 6, b.w, b.h + 6);
  ctx.fillStyle = city.ground;
  for (const b of sc.near) {
    ctx.fillRect(b.x, -b.h, b.w, b.h);
    ctx.fillStyle = 'rgba(255, 233, 168, 0.7)';
    for (let y = -b.h + 10; y < -10; y += 18) for (let x = b.x + 8; x < b.x + b.w - 10; x += 16) if ((x * 7 + y * 3 + b.lit * 100) % 5 < 2) ctx.fillRect(x, y, 6, 8);
    ctx.fillStyle = city.ground;
  }
  // Sol : trottoir, route et son marquage
  ctx.fillStyle = mixHex(city.ground, '#ffffff', 0.25);
  ctx.fillRect(-2000, 0, 4000, 14);
  ctx.fillStyle = mixHex(city.ground, '#000000', 0.35);
  ctx.fillRect(-2000, 14, 4000, 400);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let x = -2000; x < 2000; x += 70) ctx.fillRect(x + ((time * 30) % 70), 58, 36, 5);

  // Nuages
  for (const c of sc.clouds) {
    const y = -c.floor * FLOOR_H;
    const x = c.x + Math.sin(time * 0.1 + c.floor) * 30;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y, 60 * c.s, 18 * c.s, 0, 0, TAU);
    ctx.ellipse(x - 34 * c.s, y + 4, 34 * c.s, 14 * c.s, 0, 0, TAU);
    ctx.ellipse(x + 36 * c.s, y + 4, 38 * c.s, 15 * c.s, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Oiseaux
  ctx.strokeStyle = '#2a1a14';
  ctx.lineWidth = 2.5;
  for (const b of sc.birds) {
    const x = ((b.x + time * 40 + 1200) % 2400) - 1200;
    const y = -b.floor * FLOOR_H + Math.sin(time * 2 + b.ph) * 8;
    const f = Math.sin(time * 9 + b.ph) * 5;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - f);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 9, y - f);
    ctx.stroke();
  }
  // Avion vers le 40e étage
  if (camFloor > 25 && camFloor < 70) {
    const x = ((time * 90) % 2400) - 1200;
    const y = -42 * FLOOR_H;
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    ctx.ellipse(x, y, 34, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(x - 6, y - 16, 10, 30);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(x - 32, y - 10, 6, 10);
  }
  // Satellite en orbite
  if (camFloor > 85) {
    const x = Math.cos(time * 0.4) * 260;
    const y = -98 * FLOOR_H + Math.sin(time * 0.4) * 40;
    ctx.fillStyle = '#c9d1e0';
    ctx.fillRect(x - 8, y - 8, 16, 16);
    ctx.fillStyle = '#4cc3ff';
    ctx.fillRect(x - 40, y - 5, 28, 10);
    ctx.fillRect(x + 12, y - 5, 28, 10);
  }
}

/** Une dalle d'étage : façade de l'époque, fenêtres, corniche. */
export function drawFloor(ctx, f, i, lit, time) {
  const e = EPOCHS[f.epoch];
  const x = f.x;
  const y = -(i + 1) * FLOOR_H;
  const w = f.w;
  const h = FLOOR_H;
  const sx = f.squash ?? 1;
  ctx.save();
  ctx.translate(x + w / 2, y + h);
  ctx.scale(1 + (sx - 1) * 0.6, 2 - sx);
  ctx.translate(-w / 2, -h);
  ctx.fillStyle = e.body;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = e.deep;
  ctx.fillRect(0, h - 5, w, 5);
  ctx.fillStyle = e.trim;
  ctx.fillRect(0, 0, w, 3);
  // Fenêtres
  const n = Math.max(1, Math.floor((w - 10) / 18));
  const gap = (w - n * 10) / (n + 1);
  for (let k = 0; k < n; k++) {
    const on = lit && (k * 7 + i * 13) % 5 < 3;
    ctx.fillStyle = f.epoch === 3 ? (on ? e.win : e.dark) : on ? e.win : e.dark;
    ctx.fillRect(gap + k * (10 + gap), 9, 10, 15);
  }
  if (f.epoch === 3) {
    // Bandeau de néon
    ctx.fillStyle = e.trim;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4 + i);
    ctx.fillRect(0, h - 8, w, 2);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.restore();
}

/** La dalle en mouvement, avec le câble de la grue. */
export function drawSlab(ctx, s, floor, time) {
  const y = -(floor + 1) * FLOOR_H;
  ctx.strokeStyle = '#2a1a14';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s.x + s.w / 2, y - 240);
  ctx.lineTo(s.x + s.w / 2, y);
  ctx.stroke();
  drawFloor(ctx, { x: s.x, w: s.w, epoch: s.epoch }, floor, false, time);
  ctx.fillStyle = '#ffc93c';
  ctx.fillRect(s.x + s.w / 2 - 6, y - 8, 12, 8);
}

/** Repère d'altitude à gauche de l'écran (camTop = monde en haut de l'écran). */
export function drawRuler(ctx, view, camTop, zoom) {
  ctx.save();
  ctx.font = '700 12px "Silkscreen", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  const bottom = camTop + view.height / zoom;
  const first = Math.max(10, Math.ceil(-bottom / FLOOR_H / 10) * 10);
  for (let f = first; -f * FLOOR_H >= camTop; f += 10) {
    const sy = (-f * FLOOR_H - camTop) * zoom;
    ctx.fillRect(0, sy, 14, 2);
    ctx.fillText(`${f * 3} m`, 18, sy);
  }
  ctx.restore();
}

export { lerp };
