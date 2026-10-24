// Courbes d'accélération, tweens et ressorts pour le « juice ».

import { clamp, lerp } from './math.js';

const c1 = 1.70158;
const c3 = c1 + 1;

export const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuart: (t) => 1 - (1 - t) ** 4,
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  outBack: (t) => 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2,
  inBack: (t) => c3 * t * t * t - c1 * t * t,
  outElastic: (t) =>
    t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outBounce(t) {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// Gestionnaire de tweens piloté par la boucle de jeu (pas de setTimeout).
export class Tweens {
  constructor() {
    this.list = [];
  }

  // tweens.to(obj, { x: 10, scale: 1 }, 0.3, { ease: Ease.outBack, delay: 0, onDone })
  to(target, props, duration, { ease = Ease.outCubic, delay = 0, onUpdate, onDone } = {}) {
    const from = {};
    for (const k in props) from[k] = target[k];
    const tw = { target, from, props, duration: Math.max(0.0001, duration), t: -delay, ease, onUpdate, onDone };
    this.list.push(tw);
    return tw;
  }

  // Appelle `fn` après `delay` secondes de temps de jeu.
  wait(delay, fn) {
    return this.to({}, {}, delay, { onDone: fn });
  }

  cancel(target) {
    this.list = this.list.filter((tw) => tw.target !== target);
  }

  clear() {
    this.list.length = 0;
  }

  update(dt) {
    if (!this.list.length) return;
    const done = [];
    for (const tw of this.list) {
      tw.t += dt;
      if (tw.t < 0) continue;
      const p = clamp(tw.t / tw.duration);
      const e = tw.ease(p);
      for (const k in tw.props) tw.target[k] = lerp(tw.from[k], tw.props[k], e);
      tw.onUpdate?.(p);
      if (p >= 1) done.push(tw);
    }
    if (done.length) {
      this.list = this.list.filter((tw) => !done.includes(tw));
      for (const tw of done) tw.onDone?.();
    }
  }
}

// Ressort amorti : idéal pour le squash & stretch et les rebonds d'UI.
export class Spring {
  constructor(value = 1, { stiffness = 260, damping = 14 } = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  kick(impulse) {
    this.velocity += impulse;
  }

  set(value) {
    this.value = value;
    this.velocity = 0;
  }

  update(dt) {
    // Sous-pas pour rester stable même si dt grimpe
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const force = (this.target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += force * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}
