// Rempart — dessins en unités de case : tours, ennemis, décor, porte du rempart.

import { TAU } from '../../shared/js/core/math.js';
import { ENEMIES } from './logic.js';

export function drawTower(ctx, t, time) {
  const { x, y } = t;
  // Socle de pierre
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 0.3, 0.36, 0.12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#9aa0ae';
  ctx.strokeStyle = '#5a6070';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.roundRect(x - 0.32, y - 0.12, 0.64, 0.42, 0.08);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b8bdc8';
  ctx.fillRect(x - 0.32, y - 0.12, 0.64, 0.1);
  if (t.flash) {
    ctx.fillStyle = `rgba(255,201,60,${t.flash * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(x, y - 0.16);
  if (t.type === 'arbalete') {
    ctx.rotate(t.angle);
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.arc(0.08, 0, 0.24, -1.2, 1.2);
    ctx.stroke();
    ctx.fillStyle = '#c8955a';
    ctx.fillRect(-0.22, -0.05, 0.42, 0.1);
    ctx.strokeStyle = '#f4efe4';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(0.17, -0.22);
    ctx.lineTo(-0.1, 0);
    ctx.lineTo(0.17, 0.22);
    ctx.stroke();
  } else if (t.type === 'canon') {
    ctx.fillStyle = '#3a3d4a';
    ctx.beginPath();
    ctx.arc(0, 0, 0.2, 0, TAU);
    ctx.fill();
    ctx.rotate(t.angle);
    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(0, -0.09, 0.34, 0.18);
    ctx.fillStyle = '#6b6f80';
    ctx.fillRect(0.28, -0.11, 0.08, 0.22);
  } else if (t.type === 'givre') {
    const bob = Math.sin(time * 3 + x) * 0.04;
    ctx.translate(0, bob);
    ctx.fillStyle = '#bfe9ff';
    ctx.strokeStyle = '#4cc3ff';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(0, -0.34);
    ctx.lineTo(0.16, -0.06);
    ctx.lineTo(0, 0.12);
    ctx.lineTo(-0.16, -0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(-0.05, -0.2);
    ctx.lineTo(0.02, -0.28);
    ctx.lineTo(0.03, -0.1);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#c8961e';
    ctx.lineWidth = 0.05;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(0, 0.02 - k * 0.09, 0.14 - k * 0.02, 0.04, 0, 0, TAU);
      ctx.stroke();
    }
    const glow = 0.12 + Math.sin(time * 10 + x) * 0.02;
    ctx.fillStyle = 'rgba(255,236,150,0.35)';
    ctx.beginPath();
    ctx.arc(0, -0.3, glow * 1.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.arc(0, -0.3, glow, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // Niveau : petits crans dorés
  for (let k = 0; k < t.level - 1; k++) {
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.arc(x - 0.08 + k * 0.16, y + 0.2, 0.05, 0, TAU);
    ctx.fill();
  }
}

export function drawEnemy(ctx, e, x, y, time) {
  const E = ENEMIES[e.type];
  const s = E.size;
  const bob = Math.abs(Math.sin(time * (8 + E.speed * 2) + e.wob)) * 0.06;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.8, s * 0.9, s * 0.3, 0, 0, TAU);
  ctx.fill();
  const yy = y - bob;
  ctx.fillStyle = e.hit ? '#ffffff' : e.slow ? mix(E.color, '#9fdcff') : E.color;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  if (e.type === 'loup') ctx.ellipse(x, yy, s * 1.25, s * 0.8, 0, 0, TAU);
  else ctx.arc(x, yy, s, 0, TAU);
  ctx.fill();
  ctx.stroke();
  if (e.type === 'bouclier' || e.type === 'boss') {
    ctx.fillStyle = '#8a95a8';
    ctx.beginPath();
    ctx.roundRect(x + s * 0.2, yy - s * 0.4, s * 0.7, s * 0.9, s * 0.2);
    ctx.fill();
    ctx.stroke();
  }
  if (e.type === 'loup') {
    ctx.fillStyle = E.color;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, yy - s * 0.5);
    ctx.lineTo(x - s * 0.35, yy - s * 1.1);
    ctx.lineTo(x - s * 0.1, yy - s * 0.6);
    ctx.fill();
  }
  // Yeux
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - s * 0.3, yy - s * 0.2, s * 0.22, 0, TAU);
  ctx.arc(x + s * 0.15, yy - s * 0.2, s * 0.22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1b1626';
  ctx.beginPath();
  ctx.arc(x - s * 0.24, yy - s * 0.18, s * 0.1, 0, TAU);
  ctx.arc(x + s * 0.21, yy - s * 0.18, s * 0.1, 0, TAU);
  ctx.fill();
  if (e.type === 'boss') {
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, yy - s * 0.7);
    ctx.lineTo(x - s * 0.5, yy - s * 1.15);
    ctx.lineTo(x - s * 0.25, yy - s * 0.9);
    ctx.lineTo(x, yy - s * 1.25);
    ctx.lineTo(x + s * 0.25, yy - s * 0.9);
    ctx.lineTo(x + s * 0.5, yy - s * 1.15);
    ctx.lineTo(x + s * 0.5, yy - s * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  // Barre de vie
  if (e.hp < e.max) {
    const w = Math.max(0.5, s * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - w / 2, yy - s - 0.16, w, 0.07);
    ctx.fillStyle = e.hp / e.max > 0.5 ? '#3ee6a8' : e.hp / e.max > 0.25 ? '#ffc93c' : '#ff5d5d';
    ctx.fillRect(x - w / 2, yy - s - 0.16, w * Math.max(0, e.hp / e.max), 0.07);
  }
}

export function drawDecor(ctx, kind, X, Y, time, seed) {
  const cx = X + 0.5;
  const cy = Y + 0.5;
  const v = (seed * 37) % 10 / 10;
  if (kind === 'tree') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.32, 0.3, 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(cx - 0.05, cy + 0.05, 0.1, 0.28);
    ctx.fillStyle = v > 0.5 ? '#3f7a3a' : '#4d8a42';
    ctx.beginPath();
    ctx.arc(cx, cy - 0.05, 0.3, 0, TAU);
    ctx.arc(cx - 0.15, cy + 0.08, 0.2, 0, TAU);
    ctx.arc(cx + 0.16, cy + 0.06, 0.2, 0, TAU);
    ctx.fill();
  } else if (kind === 'rock') {
    ctx.fillStyle = '#a0704a';
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(cx - 0.34, cy + 0.3);
    ctx.lineTo(cx - 0.2, cy - 0.2);
    ctx.lineTo(cx + 0.1, cy - 0.32);
    ctx.lineTo(cx + 0.34, cy + 0.05);
    ctx.lineTo(cx + 0.3, cy + 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'reed') {
    ctx.fillStyle = '#3a6a8a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.1, 0.38, 0.26, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8aa65a';
    ctx.lineWidth = 0.04;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(cx + k * 0.08, cy + 0.15);
      ctx.quadraticCurveTo(cx + k * 0.1 + Math.sin(time * 2 + k) * 0.04, cy - 0.1, cx + k * 0.12, cy - 0.32);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#2e2424';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.08, 0.38, 0.28, 0, 0, TAU);
    ctx.fill();
    const glow = 0.5 + Math.sin(time * 2 + seed) * 0.2;
    ctx.fillStyle = `rgba(255,107,40,${glow})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.08, 0.24, 0.16, 0, 0, TAU);
    ctx.fill();
  }
}

export function drawGate(ctx, x, y, portrait, lives) {
  ctx.save();
  ctx.translate(x, y);
  if (portrait) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#8a8f9c';
  ctx.strokeStyle = '#4a5160';
  ctx.lineWidth = 0.05;
  ctx.fillRect(0.1, -0.8, 0.5, 1.6);
  ctx.strokeRect(0.1, -0.8, 0.5, 1.6);
  for (const dy of [-0.8, -0.4, 0, 0.4]) ctx.fillRect(0.1, dy - 0.14, 0.18, 0.14);
  ctx.fillStyle = '#3a2414';
  ctx.beginPath();
  ctx.moveTo(0.1, 0.34);
  ctx.lineTo(0.1, -0.2);
  ctx.quadraticCurveTo(0.1, -0.36, 0.28, -0.36);
  ctx.lineTo(0.28, 0.34);
  ctx.fill();
  // Drapeau : il pâlit quand les vies baissent
  ctx.strokeStyle = '#5a3a1a';
  ctx.beginPath();
  ctx.moveTo(0.35, -0.8);
  ctx.lineTo(0.35, -1.2);
  ctx.stroke();
  ctx.fillStyle = lives > 10 ? '#4cc3ff' : lives > 5 ? '#ffc93c' : '#ff5d5d';
  ctx.beginPath();
  ctx.moveTo(0.35, -1.2);
  ctx.lineTo(0.65, -1.1);
  ctx.lineTo(0.35, -1);
  ctx.fill();
  ctx.restore();
}

function mix(a, b) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round((((pa >> s) & 255) + ((pb >> s) & 255)) / 2);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
