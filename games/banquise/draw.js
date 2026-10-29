// Banquise — dessins en unités de case (1 = une case) : eau, glace, rochers, neige, igloo, pingouin.

import { TAU } from '../../shared/js/core/math.js';

export const SKINS = [
  { id: 'classique', name: 'Classique', unlock: 0, extra: null },
  { id: 'echarpe', name: 'Écharpe rouge', unlock: 10, extra: 'scarf' },
  { id: 'bonnet', name: 'Bonnet à pompon', unlock: 25, extra: 'hat' },
  { id: 'lunettes', name: 'Lunettes de ski', unlock: 45, extra: 'goggles' },
  { id: 'couronne', name: 'Couronne', unlock: 70, extra: 'crown' },
];

export function drawWater(ctx, w, h, time) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b4f7a');
  g.addColorStop(1, '#06304f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let y = 20; y < h; y += 34) {
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + time * 1.4 + y) * 4);
    ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawTile(ctx, c, x, y, { broken, fish, time, igloo }) {
  if (broken) {
    // Trou dans la glace : l'eau et des éclats
    ctx.fillStyle = '#0a3f63';
    roundRect(ctx, x + 0.04, y + 0.04, 0.92, 0.92, 0.12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.5, 0.22 + Math.sin(time * 3 + x) * 0.04, 0, TAU);
    ctx.stroke();
    return;
  }
  // Glace
  const ice = c === 'o' ? '#f7fbff' : '#cdeefc';
  ctx.fillStyle = ice;
  ctx.fillRect(x, y, 1.01, 1.01);
  if (c !== 'o') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(x + 0.12, y + 0.28);
    ctx.lineTo(x + 0.28, y + 0.12);
    ctx.lineTo(x + 0.36, y + 0.12);
    ctx.lineTo(x + 0.12, y + 0.36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,140,190,0.18)';
    ctx.lineWidth = 0.02;
    ctx.strokeRect(x, y, 1, 1);
  }
  if (c === 'o') {
    // Neige : petites bosses
    ctx.fillStyle = '#e3eef7';
    for (const [dx, dy, r] of [[0.3, 0.62, 0.2], [0.6, 0.55, 0.24], [0.48, 0.72, 0.18]]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 0.55, y + 0.48, 0.14, 0, TAU);
    ctx.fill();
  }
  if (c === 'x') {
    ctx.strokeStyle = '#5a9cc4';
    ctx.lineWidth = 0.045;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 0.15, y + 0.3);
    ctx.lineTo(x + 0.45, y + 0.5);
    ctx.lineTo(x + 0.4, y + 0.85);
    ctx.moveTo(x + 0.45, y + 0.5);
    ctx.lineTo(x + 0.85, y + 0.4);
    ctx.moveTo(x + 0.62, y + 0.45);
    ctx.lineTo(x + 0.7, y + 0.15);
    ctx.stroke();
  }
  if ('<>^v'.includes(c) && c) {
    const a = { '>': 0, v: Math.PI / 2, '<': Math.PI, '^': -Math.PI / 2 }[c];
    ctx.fillStyle = '#7fd0f5';
    roundRect(ctx, x + 0.08, y + 0.08, 0.84, 0.84, 0.2);
    ctx.fill();
    ctx.save();
    ctx.translate(x + 0.5, y + 0.5);
    ctx.rotate(a);
    const shift = ((time * 1.2) % 1) * 0.3 - 0.15;
    ctx.fillStyle = '#1d6fa3';
    for (const o of [-0.18, 0.12]) {
      ctx.beginPath();
      ctx.moveTo(o + shift + 0.14, 0);
      ctx.lineTo(o + shift - 0.08, -0.2);
      ctx.lineTo(o + shift - 0.08, 0.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  if (c === '#') {
    ctx.fillStyle = 'rgba(0,40,70,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 0.52, y + 0.78, 0.4, 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7d8597';
    ctx.strokeStyle = '#4a5160';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(x + 0.14, y + 0.76);
    ctx.lineTo(x + 0.2, y + 0.36);
    ctx.lineTo(x + 0.44, y + 0.16);
    ctx.lineTo(x + 0.74, y + 0.24);
    ctx.lineTo(x + 0.88, y + 0.56);
    ctx.lineTo(x + 0.82, y + 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4fbff';
    ctx.beginPath();
    ctx.moveTo(x + 0.24, y + 0.34);
    ctx.lineTo(x + 0.44, y + 0.18);
    ctx.lineTo(x + 0.72, y + 0.26);
    ctx.lineTo(x + 0.6, y + 0.34);
    ctx.lineTo(x + 0.44, y + 0.3);
    ctx.closePath();
    ctx.fill();
  }
  if (igloo) {
    ctx.fillStyle = 'rgba(0,40,70,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 0.5, y + 0.86, 0.46, 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#9cc7e0';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.84, 0.42, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 0.12, y + 0.66);
    ctx.lineTo(x + 0.88, y + 0.66);
    ctx.moveTo(x + 0.22, y + 0.52);
    ctx.lineTo(x + 0.78, y + 0.52);
    ctx.moveTo(x + 0.5, y + 0.42);
    ctx.lineTo(x + 0.5, y + 0.52);
    ctx.stroke();
    ctx.fillStyle = '#16324a';
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.84, 0.15, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    // Petit drapeau
    ctx.strokeStyle = '#6b4a2b';
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + 0.42);
    ctx.lineTo(x + 0.5, y + 0.14);
    ctx.stroke();
    ctx.fillStyle = '#ff5d5d';
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + 0.14);
    ctx.lineTo(x + 0.5 + 0.2 + Math.sin(time * 6) * 0.03, y + 0.2);
    ctx.lineTo(x + 0.5, y + 0.27);
    ctx.fill();
  }
  if (fish) {
    const bob = Math.sin(time * 4 + x * 1.7 + y) * 0.05;
    ctx.save();
    ctx.translate(x + 0.5, y + 0.52 + bob);
    ctx.fillStyle = '#ff8a5b';
    ctx.strokeStyle = '#b4432a';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.ellipse(-0.04, 0, 0.22, 0.13, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.14, 0);
    ctx.lineTo(0.3, -0.13);
    ctx.lineTo(0.3, 0.13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1b1626';
    ctx.beginPath();
    ctx.arc(-0.14, -0.03, 0.03, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

export function drawPenguin(ctx, skin, x, y, dir, { squash = 1, sink = 0, sliding = false, time = 0, hidden = false }) {
  if (hidden) return;
  ctx.save();
  ctx.translate(x + 0.5, y + 0.9);
  const sx = 1 / Math.sqrt(squash);
  ctx.scale(sx * (1 - sink * 0.5), squash * (1 - sink * 0.7));
  ctx.globalAlpha = 1 - sink * 0.6;
  // Ombre
  ctx.fillStyle = 'rgba(0,40,70,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, -0.02, 0.3, 0.08, 0, 0, TAU);
  ctx.fill();
  const lean = sliding ? (dir === 'left' ? -0.18 : dir === 'right' ? 0.18 : 0) : Math.sin(time * 2) * 0.03;
  ctx.rotate(lean);
  const side = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const back = dir === 'up';
  // Pieds
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.ellipse(-0.12, -0.03, 0.1, 0.05, 0, 0, TAU);
  ctx.ellipse(0.12, -0.03, 0.1, 0.05, 0, 0, TAU);
  ctx.fill();
  // Corps
  ctx.fillStyle = '#1f2433';
  ctx.beginPath();
  ctx.ellipse(0, -0.36, 0.28, 0.36, 0, 0, TAU);
  ctx.fill();
  // Ailerons
  ctx.beginPath();
  ctx.ellipse(-0.27, -0.34, 0.07, 0.2, sliding ? 0.9 : 0.25, 0, TAU);
  ctx.ellipse(0.27, -0.34, 0.07, 0.2, sliding ? -0.9 : -0.25, 0, TAU);
  ctx.fill();
  if (!back) {
    // Ventre et visage
    ctx.fillStyle = '#f7f3ea';
    ctx.beginPath();
    ctx.ellipse(side * 0.06, -0.3, 0.19, 0.27, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(side * 0.08, -0.56, 0.17, 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1f2433';
    for (const ex of side ? [side * 0.12] : [-0.07, 0.07]) {
      ctx.beginPath();
      ctx.arc(ex, -0.58, 0.035, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath();
    ctx.moveTo(side * 0.16 - 0.05, -0.51);
    ctx.lineTo(side * 0.16 + 0.05, -0.51);
    ctx.lineTo(side * 0.16 + side * 0.1, -0.47);
    ctx.closePath();
    ctx.fill();
  }
  // Accessoire
  if (skin.extra === 'scarf') {
    ctx.fillStyle = '#e63946';
    ctx.fillRect(-0.22, -0.46, 0.44, 0.07);
    ctx.fillRect(0.06, -0.42, 0.07, 0.18);
  } else if (skin.extra === 'hat') {
    ctx.fillStyle = '#3ee6a8';
    ctx.beginPath();
    ctx.arc(0, -0.66, 0.2, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-0.21, -0.69, 0.42, 0.06);
    ctx.beginPath();
    ctx.arc(0, -0.88, 0.07, 0, TAU);
    ctx.fill();
  } else if (skin.extra === 'goggles') {
    ctx.fillStyle = '#ff8fab';
    ctx.fillRect(-0.26, -0.63, 0.52, 0.05);
    ctx.fillStyle = '#4cc3ff';
    ctx.beginPath();
    ctx.ellipse(-0.08, -0.6, 0.08, 0.06, 0, 0, TAU);
    ctx.ellipse(0.08, -0.6, 0.08, 0.06, 0, 0, TAU);
    ctx.fill();
  } else if (skin.extra === 'crown') {
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.moveTo(-0.16, -0.68);
    ctx.lineTo(-0.16, -0.86);
    ctx.lineTo(-0.08, -0.76);
    ctx.lineTo(0, -0.9);
    ctx.lineTo(0.08, -0.76);
    ctx.lineTo(0.16, -0.86);
    ctx.lineTo(0.16, -0.68);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
