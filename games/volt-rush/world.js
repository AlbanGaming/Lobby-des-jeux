// Volt Rush — génération procédurale des toits, obstacles et boulons.
// Tout est garanti franchissable : écarts et dénivelés sont bornés par la physique du saut.

import { createRng } from '../../shared/js/core/rng.js';
import { clamp } from '../../shared/js/core/math.js';
import { PHYS, WORLD_H } from './config.js';

const ROOF_MIN = 205;
const ROOF_MAX = 300;
const MAX_RISE = 46;

export function createWorld(seed = Date.now()) {
  const rng = createRng(seed);
  const w = {
    roofs: [], // { x, w, y, seed }
    solids: [], // caisses et relais : { x, y (haut), w, h, kind, alive, passed, clear }
    drones: [], // { x, y (haut), w, h, phase, alive, passed, clear }
    pickups: [], // { x, y, kind: 'bolt' | 'battery', alive, phase }
    decor: [], // éléments de toit sans collision : { x, y, kind, s }
    genX: 0,
    lastY: 280,
    lastBattery: 0,
  };

  // Trajectoire d'un saut depuis (x0, y0) à la vitesse donnée : sert à poser des boulons « guides »
  function arc(x0, y0, speed, ts) {
    return ts.map((t) => ({ x: x0 + speed * t, y: y0 - PHYS.jumpV * t + 0.5 * PHYS.gravity * t * t - 22 }));
  }

  function addPickup(x, y, kind = 'bolt') {
    w.pickups.push({ x, y, kind, alive: true, phase: rng.range(0, 6.28) });
  }

  function addBuilding(speed, d) {
    const first = w.roofs.length === 0;
    // Premier toit long et calme : on prend Volt en main avant le premier obstacle
    const width = first ? 1300 : rng.range(300, 620) * (1 + d * 0.25);
    let y = first ? 280 : clamp(w.lastY + rng.int(-MAX_RISE, 54), ROOF_MIN, ROOF_MAX);
    const rise = Math.max(0, w.lastY - y);
    // Écart max : ce qu'un saut simple couvre à cette vitesse, avec marge, réduit si on monte
    const air = (2 * PHYS.jumpV) / PHYS.gravity;
    const reach = speed * air * 0.62 - rise * 1.6;
    const gapMax = Math.max(40, Math.min(reach, 70 + d * 190));
    const gapMin = Math.min(gapMax * 0.75, 36 + d * 60);
    const gap = first ? 0 : rng.chance(0.12 + (1 - d) * 0.2) ? 0 : rng.range(gapMin, gapMax);
    if (gap === 0 && !first) y = clamp(w.lastY + rng.int(-30, 30), ROOF_MIN, ROOF_MAX); // toits mitoyens
    const x = w.genX + gap;

    // Boulons guides au-dessus de l'écart
    if (gap > 60) {
      const takeoff = w.genX - speed * 0.16;
      for (const p of arc(takeoff, w.lastY, speed, [0.12, 0.22, 0.32, 0.42, 0.52])) addPickup(p.x, p.y);
    }

    const roof = { x, w: width, y, seed: rng.int(0, 1e9), gapBefore: gap };
    w.roofs.push(roof);
    w.genX = x + width;
    w.lastY = y;
    populate(roof, speed, d, first);
  }

  function populate(roof, speed, d, first) {
    const start = roof.x + (first ? 820 : 110);
    const end = roof.x + roof.w - 70;
    let cursor = start + rng.range(0, 80);
    const minSpace = Math.max(170, speed * 0.62);

    // Décor de toit (antennes, bouches d'aération, réservoirs)
    const decorCount = Math.floor(roof.w / 160);
    for (let i = 0; i < decorCount; i++) {
      w.decor.push({ x: roof.x + rng.range(20, roof.w - 40), y: roof.y, kind: rng.pick(['vent', 'antenna', 'tank', 'vent', 'sign']), s: rng.range(0.8, 1.2) });
    }

    while (cursor < end - 40) {
      const r = rng.next();
      const sinceBattery = cursor - w.lastBattery;
      let kind;
      if (sinceBattery > 3200 && r < 0.08) kind = 'battery';
      else if (r < 0.26) kind = 'line';
      else if (r < 0.5) kind = 'crate';
      else if (r < 0.62 && d > 0.12) kind = 'stack';
      else if (r < 0.74 && d > 0.3) kind = 'relay';
      else if (r < 0.9 && d > 0.08) kind = 'drone';
      else kind = 'crate';

      if (kind === 'line') {
        const n = rng.int(4, 6);
        for (let i = 0; i < n; i++) addPickup(cursor + i * 32, roof.y - 22);
        cursor += n * 32 + minSpace * 0.6;
        continue;
      }
      if (kind === 'battery') {
        addPickup(cursor, roof.y - 70, 'battery');
        w.lastBattery = cursor;
        cursor += minSpace;
        continue;
      }
      if (kind === 'drone') {
        const h = 18;
        w.drones.push({ x: cursor, y: roof.y - 28 - h, w: 36, h, phase: rng.range(0, 6.28), alive: true, passed: false, clear: Infinity });
        // Récompense pour qui plonge dessous
        for (let i = 0; i < 3; i++) addPickup(cursor - 6 + i * 22, roof.y - 10);
        cursor += 36 + minSpace;
        continue;
      }
      const dims = { crate: [32, 28], stack: [32, 58], relay: [28, 76] }[kind];
      w.solids.push({ x: cursor, y: roof.y - dims[1], w: dims[0], h: dims[1], kind, alive: true, passed: false, clear: Infinity });
      // Parfois un arc de boulons au-dessus de l'obstacle
      if (rng.chance(0.45)) {
        const takeoff = cursor - speed * 0.2;
        for (const p of arc(takeoff, roof.y, speed, [0.14, 0.24, 0.34])) addPickup(p.x, p.y);
      }
      cursor += dims[0] + minSpace * rng.range(1, 1.5);
    }
  }

  w.generate = (untilX, speed, d) => {
    while (w.genX < untilX) addBuilding(speed, d);
  };

  w.prune = (minX) => {
    const keep = (o) => o.x + (o.w ?? 0) > minX;
    if (w.roofs.length > 2 && w.roofs[0].x + w.roofs[0].w < minX) w.roofs = w.roofs.filter(keep);
    w.solids = w.solids.filter(keep);
    w.drones = w.drones.filter(keep);
    w.pickups = w.pickups.filter((p) => p.x > minX && p.alive);
    w.decor = w.decor.filter((p) => p.x > minX - 60);
  };

  // Toit sous une abscisse (ou null au-dessus d'un vide)
  w.roofAt = (x) => w.roofs.find((r) => x >= r.x && x <= r.x + r.w) ?? null;

  return w;
}

export { WORLD_H };
