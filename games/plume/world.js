// Plume — génération des falaises, étoiles, bulles de vent et rafales.
// L'écart vertical entre deux ouvertures est borné pour rester toujours franchissable.

import { createRng } from '../../shared/js/core/rng.js';
import { clamp, lerp } from '../../shared/js/core/math.js';
import { GATE, GROUND, CHAPTERS } from './config.js';

export function createWorld(seed, startChapter = 0) {
  const rng = createRng(seed);
  const w = {
    gates: [], // { x, w, gap, h, chapter, moving, amp, freq, phase, idx, passed, clear }
    stars: [], // { x, y, alive, phase }
    shields: [], // { x, y, alive, phase }
    winds: [], // { x0, x1, force }
    nextX: 0,
    lastGap: GROUND / 2,
    count: 0,
  };

  w.chapterOf = (idx) => (startChapter + Math.floor(idx / GATE.perChapter)) % CHAPTERS.length;
  w.difficulty = (idx) => clamp((idx + startChapter * GATE.perChapter) / 60);

  function addGate() {
    const idx = w.count++;
    const chapter = w.chapterOf(idx);
    const ch = CHAPTERS[chapter];
    const d = w.difficulty(idx);
    const h = lerp(GATE.gapStart, GATE.gapMin, d) * (ch.dark ? 1.06 : 1);
    const spacing = lerp(GATE.spacingStart, GATE.spacingMin, d);
    const x = w.count === 1 ? w.nextX + 520 : w.nextX + spacing;
    const maxDelta = lerp(150, 210, d);
    const lo = h / 2 + 50;
    const hi = GROUND - h / 2 - 30;
    const gap = clamp(w.lastGap + rng.range(-maxDelta, maxDelta), lo, hi);
    const moving = !!ch.moving && idx % GATE.perChapter > 1 && rng.chance(0.75);
    const gate = {
      x,
      w: GATE.width,
      gap,
      h,
      chapter,
      moving,
      amp: moving ? Math.min(lerp(24, 46, d), (hi - lo) / 2) : 0,
      freq: rng.range(1.3, 2.1),
      phase: rng.range(0, 6.28),
      idx,
      passed: false,
      clear: Infinity,
      seed: rng.int(0, 1e9),
    };
    w.gates.push(gate);

    // Étoile : dans l'ouverture mais décalée (risque) ou en arc entre deux falaises
    if (rng.chance(0.55)) {
      const side = rng.sign();
      w.stars.push({ x: x + GATE.width / 2, y: gap + side * h * 0.3, alive: true, phase: rng.range(0, 6.28), gate });
    } else if (rng.chance(0.45)) {
      const mx = x + GATE.width + spacing / 2;
      for (let i = -1; i <= 1; i++) w.stars.push({ x: mx + i * 34, y: gap - 26 + Math.abs(i) * 14, alive: true, phase: rng.range(0, 6.28) });
    }
    // Bulle de vent (protège d'un choc), rare
    if (idx > 4 && rng.chance(0.05)) w.shields.push({ x: x + GATE.width + spacing * 0.5, y: gap, alive: true, phase: 0 });

    // Rafales de la tempête, annoncées par des traînées de vent
    if (ch.wind && idx % GATE.perChapter > 0 && rng.chance(0.7)) {
      w.winds.push({ x0: x + GATE.width + 40, x1: x + spacing - 40, force: rng.sign() * rng.range(520, 760) * (gap < GROUND / 2 ? 1 : 1) });
    }

    w.lastGap = gap;
    w.nextX = x;
  }

  w.generate = (untilX) => {
    while (w.nextX < untilX || w.gates.length === 0) addGate();
  };

  w.prune = (minX) => {
    w.gates = w.gates.filter((g) => g.x + g.w > minX);
    w.stars = w.stars.filter((s) => s.alive && s.x > minX);
    w.shields = w.shields.filter((s) => s.alive && s.x > minX);
    w.winds = w.winds.filter((z) => z.x1 > minX);
  };

  return w;
}

export const gapAt = (g, t) => g.gap + (g.moving ? Math.sin(t * g.freq + g.phase) * g.amp : 0);
