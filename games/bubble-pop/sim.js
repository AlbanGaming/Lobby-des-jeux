// Bubble Pop — simulation des bulles : montée, oscillation, répulsion entre couleurs
// différentes et attraction entre bulles de même couleur (elles forment des grappes).

import { COLORS, SPECIALS } from './config.js';

let nextId = 1;

export function createSim(rng) {
  const sim = { bubbles: [], time: 0 };

  /** Une petite grappe de `n` bulles de même couleur, côte à côte. */
  let lastPodColor = -1;
  sim.spawnPod = (W, H, { n = 3, rise = 1, y } = {}) => {
    let color = rng.int(0, COLORS.length - 1);
    if (color === lastPodColor) color = (color + rng.int(1, COLORS.length - 1)) % COLORS.length;
    lastPodColor = color;
    const r = rng.range(21, 27);
    const x0 = rng.range(r * n + 10, W - r * n - 10);
    const yy = y ?? H + r + 10;
    const speed = rng.range(52, 80) * rise;
    for (let i = 0; i < n; i++) {
      sim.bubbles.push({
        id: nextId++, kind: 'color', color,
        x: x0 + (i - (n - 1) / 2) * r * 1.9 + rng.range(-3, 3),
        y: yy + (i % 2) * r * 0.9,
        r, vx: 0, vy: 0, rise: speed, phase: rng.range(0, 6.28), grow: 0, alive: true, popping: false, cluster: 0,
      });
    }
  };

  sim.spawn = (W, H, { rise = 1, specialChance = 0.1 } = {}) => {
    let kind = 'color';
    if (rng.chance(specialChance)) kind = rng.weighted(Object.entries(SPECIALS).map(([k, v]) => ({ k, weight: v.weight }))).k;
    const r = kind === 'color' ? rng.range(20, 31) : SPECIALS[kind].r;
    // Les couleurs voisines se ressemblent souvent : ça favorise les grappes
    let color = rng.int(0, COLORS.length - 1);
    const near = sim.bubbles.filter((b) => b.kind === 'color' && b.y > H - 140);
    if (near.length && rng.chance(0.3)) color = rng.pick(near).color;
    sim.bubbles.push({
      id: nextId++,
      kind,
      color: kind === 'color' ? color : -1,
      x: rng.range(r + 6, W - r - 6),
      y: H + r + rng.range(0, 30),
      r,
      vx: rng.range(-12, 12),
      vy: 0,
      rise: rng.range(52, 86) * rise,
      phase: rng.range(0, 6.28),
      grow: 0,
      alive: true,
      popping: false,
      cluster: 0,
    });
  };

  sim.step = (dt, W) => {
    sim.time += dt;
    const bs = sim.bubbles;
    for (const b of bs) {
      if (!b.alive || b.popping) continue;
      b.grow = Math.min(1, b.grow + dt * 4);
      // Montée vers sa vitesse propre + légère oscillation
      b.vy += (-b.rise - b.vy) * Math.min(1, dt * 2.2);
      b.vx += Math.sin(sim.time * 1.7 + b.phase) * 14 * dt;
      b.vx *= Math.pow(0.4, dt);
    }
    // Interactions deux à deux
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      if (!a.alive || a.popping) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (!b.alive || b.popping) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > (rr + 90) * (rr + 90)) continue;
        const d = Math.sqrt(d2) || 0.01;
        const nx = dx / d;
        const ny = dy / d;
        const same = a.kind === 'color' && b.kind === 'color' && a.color === b.color;
        if (d < rr) {
          // Séparation douce
          const push = (rr - d) * 0.5;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
        if (same) {
          // Attraction : les bulles d'une même couleur se collent et montent ensemble
          if (d > rr - 2) {
            // Forte au contact, douce à distance : les bulles d'une couleur finissent par se trouver
            const f = Math.min(60, (d - rr + 2) * (d < rr + 26 ? 9 : 2.4)) * dt;
            a.vx += nx * f;
            a.vy += ny * f;
            b.vx -= nx * f;
            b.vy -= ny * f;
          }
          if (d > rr + 26) continue;
          const avx = (a.vx + b.vx) / 2;
          const avy = (a.vy + b.vy) / 2;
          const k = Math.min(1, dt * 3);
          a.vx += (avx - a.vx) * k;
          a.vy += (avy - a.vy) * k;
          b.vx += (avx - b.vx) * k;
          b.vy += (avy - b.vy) * k;
        } else if (d < rr + 4) {
          a.vx -= nx * 30 * dt;
          b.vx += nx * 30 * dt;
        }
      }
    }
    for (const b of bs) {
      if (!b.alive || b.popping) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < b.r) {
        b.x = b.r;
        b.vx = Math.abs(b.vx) * 0.5;
      } else if (b.x > W - b.r) {
        b.x = W - b.r;
        b.vx = -Math.abs(b.vx) * 0.5;
      }
    }
  };

  /** Grappes : composantes connexes de bulles de même couleur qui se touchent. */
  sim.clusters = () => {
    const bs = sim.bubbles.filter((b) => b.alive && !b.popping && b.kind === 'color');
    const parent = new Map(bs.map((b) => [b.id, b.id]));
    const find = (x) => {
      while (parent.get(x) !== x) {
        parent.set(x, parent.get(parent.get(x)));
        x = parent.get(x);
      }
      return x;
    };
    const links = [];
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i];
        const b = bs[j];
        if (a.color !== b.color) continue;
        const rr = a.r + b.r + 4;
        if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < rr * rr) {
          parent.set(find(a.id), find(b.id));
          links.push([a, b]);
        }
      }
    }
    const groups = new Map();
    for (const b of bs) {
      const root = find(b.id);
      b.cluster = root;
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(b);
    }
    return { groups, links };
  };

  sim.at = (x, y, tolerance = 8) => {
    let best = null;
    let bestD = Infinity;
    for (const b of sim.bubbles) {
      if (!b.alive || b.popping) continue;
      const d = Math.hypot(b.x - x, b.y - y) - b.r;
      if (d < tolerance && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  };

  sim.remove = () => {
    sim.bubbles = sim.bubbles.filter((b) => b.alive);
  };

  return sim;
}
