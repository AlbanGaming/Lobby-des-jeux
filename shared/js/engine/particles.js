// Système de particules avec pool (aucune allocation pendant le jeu).

import { TAU } from '../core/math.js';
import { motion } from '../motion.js';

const rnd = (v) => (Array.isArray(v) ? v[0] + Math.random() * (v[1] - v[0]) : v);

export class Particles {
  constructor(max = 700) {
    this.pool = Array.from({ length: max }, () => ({ alive: false }));
    this.count = 0;
  }

  /**
   * particles.emit(x, y, {
   *   count: 14, colors: ['#ffc93c', '#fff'], speed: [80, 260], angle: -Math.PI / 2, spread: TAU,
   *   life: [0.35, 0.8], size: [2, 5], gravity: 700, drag: 0.08, shape: 'square'|'circle'|'spark'|'ring'|'star',
   *   spin: [-8, 8], fade: true, shrink: true, glow: false
   * })
   */
  emit(x, y, opts = {}) {
    const {
      count = 12,
      color = '#ffffff',
      colors,
      speed = [60, 220],
      angle = 0,
      spread = TAU,
      life = [0.35, 0.8],
      size = [2, 5],
      gravity = 600,
      drag = 0.1,
      shape = 'square',
      spin = [-6, 6],
      fade = true,
      shrink = true,
      vx = 0,
      vy = 0,
      ringGrowth = 220,
      lineWidth = 3,
    } = opts;
    const n = Math.max(1, Math.round(count * motion.particleScale));
    let spawned = 0;
    for (const p of this.pool) {
      if (spawned >= n) break;
      if (p.alive) continue;
      const a = angle + (Math.random() - 0.5) * spread;
      const s = rnd(speed);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s + vx;
      p.vy = Math.sin(a) * s + vy;
      p.life = p.maxLife = rnd(life);
      p.size = rnd(size);
      p.color = colors ? colors[(Math.random() * colors.length) | 0] : color;
      p.gravity = gravity;
      p.drag = drag;
      p.shape = shape;
      p.rot = Math.random() * TAU;
      p.spin = rnd(spin);
      p.fade = fade;
      p.shrink = shrink;
      p.ringGrowth = ringGrowth;
      p.lineWidth = lineWidth;
      spawned++;
    }
  }

  // Anneau d'onde de choc unique
  ring(x, y, { color = '#ffffff', size = 6, growth = 260, life = 0.35, lineWidth = 4 } = {}) {
    this.emit(x, y, { count: 1, color, speed: 0, life, size, gravity: 0, shape: 'ring', ringGrowth: growth, lineWidth, shrink: false });
  }

  update(dt) {
    let alive = 0;
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      const k = Math.pow(p.drag, dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.shape === 'ring') p.size += p.ringGrowth * dt;
      alive++;
    }
    this.count = alive;
  }

  draw(ctx) {
    if (!this.count) return;
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.life / p.maxLife;
      const s = p.shrink ? p.size * (0.3 + 0.7 * t) : p.size;
      ctx.globalAlpha = p.fade ? Math.min(1, t * 1.6) : 1;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(p.x, p.y, s, 0, TAU);
          ctx.fill();
          break;
        case 'ring':
          ctx.lineWidth = p.lineWidth * t;
          ctx.beginPath();
          ctx.arc(p.x, p.y, s, 0, TAU);
          ctx.stroke();
          break;
        case 'spark': {
          const len = Math.hypot(p.vx, p.vy) * 0.045 + s;
          const a = Math.atan2(p.vy, p.vx);
          ctx.lineWidth = Math.max(1, s * 0.6);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
          ctx.stroke();
          break;
        }
        case 'star': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const r = i % 2 ? s * 0.42 : s;
            const a = (i / 8) * TAU;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        default:
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    for (const p of this.pool) p.alive = false;
    this.count = 0;
  }
}
