// Célébrations de record (boutique) : un calque plein écran qui joue l'effet choisi ~2,5 s,
// puis disparaît. Confettis, feu d'artifice, pluie de pièces, étoiles filantes, pixels.

import { motion } from '../motion.js';

const COLORS = ['#ffc93c', '#ff5a4e', '#3ee6a8', '#4cc3ff', '#a68bff', '#ff8fab', '#f4efe4'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function celebrate(kind = 'confettis', { duration = 2600 } = {}) {
  if (typeof document === 'undefined') return;
  document.querySelector('.gv-celebrate')?.remove();
  const c = document.createElement('canvas');
  c.className = 'gv-celebrate';
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:150';
  document.body.append(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = innerWidth;
  const H = innerHeight;
  c.width = W * dpr;
  c.height = H * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const scale = motion.reduced ? 0.3 : 1;
  const dur = motion.reduced ? Math.min(duration, 1200) : duration;
  const parts = [];
  const add = (p) => parts.push({ life: 1, rot: rand(0, 6), vr: rand(-6, 6), ...p });
  let bursts = [];

  if (kind === 'confettis') {
    for (let i = 0; i < 160 * scale; i++) add({ shape: 'rect', x: rand(0, W), y: rand(-H * 0.6, -10), vx: rand(-60, 60), vy: rand(120, 320), g: 120, w: rand(6, 11), h: rand(3, 6), color: pick(COLORS), decay: 0 });
  } else if (kind === 'feu') {
    // Les bouquets partent les uns après les autres
    bursts = Array.from({ length: Math.round(7 * scale) || 2 }, (_, k) => ({ t: k * 260, x: rand(W * 0.15, W * 0.85), y: rand(H * 0.15, H * 0.5), color: pick(COLORS) }));
  } else if (kind === 'pieces') {
    for (let i = 0; i < 90 * scale; i++) add({ shape: 'coin', x: rand(0, W), y: rand(-H, -20), vx: rand(-20, 20), vy: rand(200, 420), g: 300, r: rand(7, 12), color: '#ffc93c', spin: rand(4, 10), decay: 0 });
  } else if (kind === 'etoiles') {
    for (let i = 0; i < 40 * scale; i++) {
      const a = rand(0.35, 0.6);
      const sp = rand(600, 1100);
      add({ shape: 'star', x: rand(-W * 0.3, W * 0.7), y: rand(-H * 0.4, H * 0.3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, r: rand(4, 8), color: pick(['#fff3c4', '#ffc93c', '#4cc3ff', '#ffffff']), decay: 0, delay: rand(0, 900), trail: true });
    }
  } else if (kind === 'pixels') {
    const cx = W / 2;
    const cy = H * 0.4;
    for (let i = 0; i < 220 * scale; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(120, 680);
      add({ shape: 'pixel', x: cx + rand(-30, 30), y: cy + rand(-30, 30), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 500, w: rand(5, 11), color: pick(COLORS), decay: 0.35 });
    }
  }

  const t0 = performance.now();
  let last = t0;
  const frame = (now) => {
    const t = now - t0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Bouquets du feu d'artifice
    bursts = bursts.filter((b) => {
      if (t < b.t) return true;
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2;
        const sp = rand(140, 300);
        add({ shape: 'spark', x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 160, r: 2.4, color: Math.random() < 0.25 ? '#ffffff' : b.color, decay: 0.75 });
      }
      return false;
    });
    ctx.clearRect(0, 0, W, H);
    const fade = t > dur - 500 ? Math.max(0, (dur - t) / 500) : 1;
    for (const p of parts) {
      if (p.delay && t < p.delay) continue;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life)) * fade;
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.rot * 2));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      } else if (p.shape === 'coin') {
        const sx = Math.abs(Math.cos(t / 1000 * p.spin));
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * Math.max(0.15, sx), p.r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c98f00';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (p.shape === 'spark') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'pixel') {
        ctx.fillRect(Math.round(p.x / 4) * 4, Math.round(p.y / 4) * 4, p.w, p.w);
      } else if (p.shape === 'star') {
        if (p.trail) {
          const grad = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 0.12, p.y - p.vy * 0.12);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = p.r * 0.8;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.12, p.y - p.vy * 0.12);
          ctx.stroke();
        }
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 ? p.r * 0.45 : p.r;
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2 + p.rot;
          ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (t < dur) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}
