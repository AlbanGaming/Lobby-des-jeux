// Orbite — dessins : vaisseaux, planètes, fond étoilé des galaxies.

import { TAU } from '../../shared/js/core/math.js';

export const SKINS = [
  { id: 'fusee', name: 'Fusée', unlock: 0, body: '#f4efe4', accent: '#ff5d5d', trail: '#ffb02e', shape: 'rocket' },
  { id: 'soucoupe', name: 'Soucoupe', unlock: 150, body: '#a9b3c4', accent: '#3ee6a8', trail: '#3ee6a8', shape: 'saucer' },
  { id: 'comete', name: 'Comète', unlock: 400, body: '#4cc3ff', accent: '#ffffff', trail: '#4cc3ff', shape: 'comet' },
  { id: 'navette', name: 'Navette', unlock: 900, body: '#ffffff', accent: '#2b2d42', trail: '#ff8fab', shape: 'shuttle' },
  { id: 'etoile', name: 'Étoile filante', unlock: 1800, body: '#ffc93c', accent: '#fff3c4', trail: '#ffc93c', shape: 'star' },
];

export const GALAXIES = [
  { id: 'voie', name: 'Voie lactée', unlock: 0, at: 0, zone: '', sky: ['#0b1026', '#1a1446'], nebula: '#5b3cc4' },
  { id: 'nebuleuse', name: 'Nébuleuse', unlock: 15, at: 15, zone: 'Nébuleuse rose', sky: ['#1a0b26', '#3a1446'], nebula: '#ff5fa2' },
  { id: 'aurore', name: 'Aurore', unlock: 35, at: 35, zone: 'Ceinture d’aurores', sky: ['#04201f', '#0b3a3a'], nebula: '#3ee6a8' },
  { id: 'abysse', name: 'Abysse', unlock: 60, at: 60, zone: 'L’abysse', sky: ['#05060b', '#141a33'], nebula: '#ff8a5b' },
];

// Couleurs des planètes : [clair, sombre]
export const PLANET_COLORS = [
  ['#ff8a5b', '#b4432a'],
  ['#4cc3ff', '#1d5f99'],
  ['#3ee6a8', '#16795a'],
  ['#ffc93c', '#b07a12'],
  ['#ff8fab', '#a8435f'],
  ['#c49aff', '#5b3cc4'],
  ['#e9d8a6', '#8a6a3a'],
];

export function makeStars(rng) {
  return [0.15, 0.35, 0.6].map((par, layer) => ({
    par,
    pts: Array.from({ length: 70 - layer * 15 }, () => ({ x: rng.next(), y: rng.next(), s: rng.range(0.6, 1.6) + layer * 0.5, tw: rng.range(0, TAU) })),
  }));
}

export function drawBackground(ctx, view, camTop, stars, g, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, view.height);
  grad.addColorStop(0, g.sky[0]);
  grad.addColorStop(1, g.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.width, view.height);
  // Nébuleuse qui défile lentement
  const ny = ((-camTop * 0.08) % (view.height * 2)) - view.height * 0.4;
  const neb = ctx.createRadialGradient(view.width * 0.3, ny, 0, view.width * 0.3, ny, view.height * 0.7);
  neb.addColorStop(0, hexA(g.nebula, 0.28));
  neb.addColorStop(1, hexA(g.nebula, 0));
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, view.width, view.height);
  const neb2y = ((-camTop * 0.05 + view.height) % (view.height * 2)) - view.height * 0.2;
  const n2 = ctx.createRadialGradient(view.width * 0.8, neb2y, 0, view.width * 0.8, neb2y, view.height * 0.5);
  n2.addColorStop(0, hexA(g.nebula, 0.16));
  n2.addColorStop(1, hexA(g.nebula, 0));
  ctx.fillStyle = n2;
  ctx.fillRect(0, 0, view.width, view.height);
  for (const layer of stars) {
    ctx.fillStyle = '#ffffff';
    for (const s of layer.pts) {
      const y = (((s.y * view.height - camTop * layer.par) % view.height) + view.height) % view.height;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 2 + s.tw) * layer.par + layer.par * 0.4;
      ctx.fillRect(s.x * view.width, y, s.s, s.s);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawPlanet(ctx, p, time) {
  const [c1, c2] = p.color;
  // Halo
  const halo = ctx.createRadialGradient(p.x, p.y, p.r * 0.8, p.x, p.y, p.r * 1.8);
  halo.addColorStop(0, hexA(c1, 0.3));
  halo.addColorStop(1, hexA(c1, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * 1.8, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, TAU);
  ctx.clip();
  const g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r * 1.1);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  // Bandes ou cratères, qui tournent
  const off = (time * p.spin * p.r) % (p.r * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  if (p.bands) {
    for (let k = -2; k <= 2; k++) ctx.fillRect(p.x - p.r, p.y + k * p.r * 0.42 - p.r * 0.08, p.r * 2, p.r * (0.1 + (k % 2 ? 0.06 : 0)));
  } else {
    for (const [dx, dy, s] of [[-0.3, 0.1, 0.22], [0.35, -0.25, 0.16], [0.1, 0.45, 0.13], [-0.55, -0.4, 0.1]]) {
      ctx.beginPath();
      ctx.arc(p.x + ((dx * p.r + off + p.r * 3) % (p.r * 2.4)) - p.r * 1.2, p.y + dy * p.r, s * p.r, 0, TAU);
      ctx.fill();
    }
  }
  // Ombre du terminateur
  const sh = ctx.createLinearGradient(p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r);
  sh.addColorStop(0.55, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = sh;
  ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  ctx.restore();
}

export function drawShip(ctx, s, x, y, heading, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading + Math.PI / 2);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2;
  const flame = 0.8 + Math.sin(time * 40) * 0.2;
  if (s.shape === 'rocket' || s.shape === 'shuttle') {
    ctx.fillStyle = s.trail;
    ctx.beginPath();
    ctx.moveTo(-4, 9);
    ctx.lineTo(0, 9 + 9 * flame);
    ctx.lineTo(4, 9);
    ctx.fill();
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(-10, 11);
    ctx.lineTo(-4, 9);
    ctx.moveTo(6, 4);
    ctx.lineTo(10, 11);
    ctx.lineTo(4, 9);
    ctx.fill();
    ctx.fillStyle = s.body;
    ctx.beginPath();
    if (s.shape === 'rocket') {
      ctx.moveTo(0, -13);
      ctx.quadraticCurveTo(7, -4, 6, 9);
      ctx.lineTo(-6, 9);
      ctx.quadraticCurveTo(-7, -4, 0, -13);
    } else {
      ctx.moveTo(0, -12);
      ctx.lineTo(5, -4);
      ctx.lineTo(5, 9);
      ctx.lineTo(-5, 9);
      ctx.lineTo(-5, -4);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = s.shape === 'rocket' ? '#4cc3ff' : s.accent;
    ctx.beginPath();
    ctx.arc(0, -3, 2.6, 0, TAU);
    ctx.fill();
  } else if (s.shape === 'saucer') {
    ctx.fillStyle = hexA(s.accent, 0.6);
    ctx.beginPath();
    ctx.arc(0, -3, 6, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = s.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = s.accent;
    for (const dx of [-7, 0, 7]) {
      ctx.beginPath();
      ctx.arc(dx, 1, 1.5, 0, TAU);
      ctx.fill();
    }
  } else if (s.shape === 'comet') {
    ctx.fillStyle = hexA(s.body, 0.5);
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(0, 20 * flame);
    ctx.lineTo(6, 0);
    ctx.fill();
    ctx.fillStyle = s.body;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.arc(-2, -2, 3, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = hexA(s.trail, 0.4);
    ctx.beginPath();
    ctx.moveTo(-5, 4);
    ctx.lineTo(0, 22 * flame);
    ctx.lineTo(5, 4);
    ctx.fill();
    ctx.rotate(time * 3);
    ctx.fillStyle = s.body;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 4.5 : 11;
      const a = (k / 10) * TAU - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
