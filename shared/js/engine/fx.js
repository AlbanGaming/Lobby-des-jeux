// Effets de « game feel » : screen shake, flash, textes qui s'envolent, couche FX pour jeux DOM.

import { clamp } from '../core/math.js';
import { Ease } from '../core/tween.js';
import { motion } from '../motion.js';
import { Particles } from './particles.js';
import { createCanvas } from './canvas.js';

// ---------- Screen shake (modèle « trauma » : intensité² pour un rendu naturel) ----------
export class Shake {
  constructor({ maxOffset = 14, maxAngle = 0.03, decay = 1.6, frequency = 28 } = {}) {
    Object.assign(this, { maxOffset, maxAngle, decay, frequency });
    this.trauma = 0;
    this.t = 0;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
  }

  add(amount) {
    this.trauma = clamp(this.trauma + amount * motion.shakeScale, 0, 1);
  }

  update(dt) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
    const s = this.trauma * this.trauma;
    const f = this.t * this.frequency;
    // Somme de sinus déphasés : bruit lisse sans dépendance
    this.x = this.maxOffset * s * (Math.sin(f * 1.1) * 0.6 + Math.sin(f * 2.3 + 1.7) * 0.4);
    this.y = this.maxOffset * s * (Math.sin(f * 1.3 + 3.1) * 0.6 + Math.sin(f * 2.9 + 0.4) * 0.4);
    this.angle = this.maxAngle * s * Math.sin(f * 0.9 + 2.2);
  }

  apply(ctx, cx = 0, cy = 0) {
    if (!this.trauma) return;
    ctx.translate(cx + this.x, cy + this.y);
    ctx.rotate(this.angle);
    ctx.translate(-cx, -cy);
  }
}

// ---------- Flash plein écran ----------
export class Flash {
  constructor() {
    this.alpha = 0;
    this.color = '#ffffff';
    this.decay = 4;
  }
  trigger(color = '#ffffff', alpha = 0.6, decay = 4) {
    if (motion.reduced) alpha *= 0.25;
    this.color = color;
    this.alpha = Math.max(this.alpha, alpha);
    this.decay = decay;
  }
  update(dt) {
    this.alpha = Math.max(0, this.alpha - this.decay * dt);
  }
  draw(ctx, w, h) {
    if (this.alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(-50, -50, w + 100, h + 100);
    ctx.restore();
  }
}

// ---------- Textes flottants (+10, COMBO x3, PRESQUE !) ----------
export class Popups {
  constructor(max = 40) {
    this.pool = Array.from({ length: max }, () => ({ alive: false }));
  }

  /** popups.add(x, y, '+10', { color, size: 22, life: 0.8, rise: 60, font }) */
  add(x, y, text, { color = '#f4efe4', size = 22, life = 0.85, rise = 70, font = 'Big Shoulders Display', weight = 900, outline = '#05060b', drift = 0 } = {}) {
    let p = this.pool.find((q) => !q.alive);
    if (!p) p = this.pool.reduce((a, b) => (a.life < b.life ? a : b));
    Object.assign(p, { alive: true, x, y, text: String(text), color, size, life, maxLife: life, rise, font, weight, outline, drift });
    return p;
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of this.pool) {
      if (!p.alive) continue;
      const age = 1 - p.life / p.maxLife;
      const pop = age < 0.18 ? Ease.outBack(age / 0.18) : 1;
      const y = p.y - Ease.outCubic(age) * p.rise;
      const x = p.x + p.drift * age;
      ctx.globalAlpha = age > 0.7 ? 1 - (age - 0.7) / 0.3 : 1;
      ctx.font = `${p.weight} ${Math.round(p.size * pop)}px "${p.font}", sans-serif`;
      ctx.lineWidth = Math.max(3, p.size * 0.22);
      ctx.strokeStyle = p.outline;
      ctx.strokeText(p.text, x, y + p.size * 0.08);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, y);
    }
    ctx.restore();
  }

  clear() {
    for (const p of this.pool) p.alive = false;
  }
}

// ---------- Couche FX pour les jeux en DOM ----------
// Un canvas transparent par-dessus la scène, avec ses propres particules et popups,
// et un shake appliqué à un élément DOM via transform.
export function createFxLayer(stage, { shakeTarget } = {}) {
  const layer = document.createElement('div');
  layer.className = 'gv-fx-layer';
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;';
  stage.appendChild(layer);
  const view = createCanvas(layer, { mode: 'fill', alpha: true });
  view.canvas.style.touchAction = 'auto';
  const particles = new Particles(500);
  const popups = new Popups();
  const shake = new Shake({ maxOffset: 10, maxAngle: 0.012 });
  let raf = 0;
  let last = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    particles.update(dt);
    popups.update(dt);
    shake.update(dt);
    const ctx = view.begin();
    particles.draw(ctx);
    popups.draw(ctx);
    if (shakeTarget) {
      shakeTarget.style.transform = shake.trauma
        ? `translate(${shake.x.toFixed(2)}px, ${shake.y.toFixed(2)}px) rotate(${shake.angle.toFixed(4)}rad)`
        : '';
    }
    const busy = particles.count > 0 || popups.pool.some((p) => p.alive) || shake.trauma > 0;
    raf = busy ? requestAnimationFrame(frame) : 0;
  }
  function wake() {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  // Position d'un élément DOM dans le repère de la couche
  function centerOf(el) {
    const r = el.getBoundingClientRect();
    const s = layer.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
  }

  return {
    particles,
    popups,
    shake,
    centerOf,
    burst(x, y, opts) {
      particles.emit(x, y, opts);
      wake();
    },
    burstAt(el, opts) {
      const c = centerOf(el);
      particles.emit(c.x, c.y, opts);
      wake();
    },
    ring(x, y, opts) {
      particles.ring(x, y, opts);
      wake();
    },
    popup(x, y, text, opts) {
      popups.add(x, y, text, opts);
      wake();
    },
    popupAt(el, text, opts) {
      const c = centerOf(el);
      popups.add(c.x, c.y, text, opts);
      wake();
    },
    addShake(amount) {
      shake.add(amount);
      wake();
    },
    destroy() {
      cancelAnimationFrame(raf);
      view.destroy();
      layer.remove();
    },
  };
}

// Petit rebond CSS (squash & stretch) sur un élément DOM, via Web Animations.
export function squash(el, { scaleX = 1.15, scaleY = 0.85, duration = 260 } = {}) {
  if (motion.reduced || !el?.animate) return;
  el.animate(
    [
      { transform: 'scale(1, 1)' },
      { transform: `scale(${scaleX}, ${scaleY})`, offset: 0.3 },
      { transform: `scale(${2 - scaleX}, ${2 - scaleY})`, offset: 0.65 },
      { transform: 'scale(1, 1)' },
    ],
    { duration, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
}

export function wiggle(el, { amount = 8, duration = 360 } = {}) {
  if (!el?.animate) return;
  const a = motion.reduced ? amount * 0.3 : amount;
  el.animate(
    [0, -a, a, -a * 0.6, a * 0.6, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration, easing: 'ease-out' },
  );
}
