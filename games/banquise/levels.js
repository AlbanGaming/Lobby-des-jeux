// Banquise — règles de la glisse, solveur (plus court chemin en coups) et générateur de niveaux.
// Cases : « . » glace, « # » rocher, « o » neige (on s'y arrête), « x » glace fragile (elle cède
// quand on la quitte), « > < ^ v » courant (change la direction), « f » poisson, « I » igloo,
// « P » départ. Le bord de la grille, c'est l'eau : glisser au-delà, c'est « Plouf ».

import { createRng } from '../../shared/js/core/rng.js';

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const ARROWS = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], v: [0, 1] };

export function parse(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const cells = [];
  let start = 0;
  let igloo = 0;
  const cracks = [];
  const fish = [];
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const i = y * w + x;
      if (c === 'P') start = i;
      if (c === 'I') igloo = i;
      if (c === 'x') cracks.push(i);
      if (c === 'f') fish.push(i);
      cells.push(c === 'P' || c === 'f' ? '.' : c);
    }),
  );
  return { w, h, cells, start, igloo, cracks, fish };
}

/**
 * Une glissade depuis `pos` dans la direction `dir`.
 * broken : Set des cases fragiles déjà cédées. Renvoie { path, end, result: 'stop'|'win'|'fall'|'none', broken }
 */
export function slide(lv, pos, dir, broken) {
  let [dx, dy] = DIRS[dir] ?? dir;
  let x = pos % lv.w;
  let y = (pos / lv.w) | 0;
  const path = [pos];
  const nb = new Set(broken);
  for (let guard = 0; guard < lv.w * lv.h * 4; guard++) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h) return { path, end: null, result: 'fall', broken: leave(lv, nb, y * lv.w + x), out: [nx, ny] };
    const ni = ny * lv.w + nx;
    const c = lv.cells[ni];
    if (c === '#') break;
    // On quitte la case : la glace fragile cède derrière nous
    leave(lv, nb, y * lv.w + x);
    if (nb.has(ni)) {
      path.push(ni);
      return { path, end: null, result: 'fall', broken: nb };
    }
    x = nx;
    y = ny;
    path.push(ni);
    if (c === 'I') return { path, end: ni, result: 'win', broken: nb };
    if (c === 'o') break;
    if (ARROWS[c]) [dx, dy] = ARROWS[c];
  }
  if (path.length === 1) return { path, end: pos, result: 'none', broken };
  return { path, end: y * lv.w + x, result: 'stop', broken: nb };
}
function leave(lv, set, i) {
  if (lv.cells[i] === 'x') set.add(i);
  return set;
}

/** Plus court nombre de coups pour rentrer à l'igloo (null si impossible) */
export function solve(lv, { from = lv.start, broken = new Set(), limit = 40 } = {}) {
  const key = (p, b) => `${p}|${[...b].sort((a, c) => a - c).join(',')}`;
  const seen = new Set([key(from, broken)]);
  let frontier = [{ p: from, b: broken, path: [] }];
  const visited = new Set();
  for (let depth = 1; depth <= limit && frontier.length; depth++) {
    const next = [];
    for (const s of frontier) {
      for (const d of Object.keys(DIRS)) {
        const r = slide(lv, s.p, d, s.b);
        if (r.result !== 'fall') r.path.forEach((c) => visited.add(c));
        if (r.result === 'win') return { moves: depth, path: [...s.path, d], visited };
        if (r.result !== 'stop') continue;
        const k = key(r.end, r.broken);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ p: r.end, b: r.broken, path: [...s.path, d] });
      }
    }
    frontier = next;
  }
  return null;
}

// ---------- Générateur ----------
export const WORLDS = [
  { id: 'banquise', name: 'La banquise', unlock: 0, size: [7, 9], rocks: 0.14, snow: 0, cracks: 0, arrows: 0, par: [3, 8] },
  { id: 'neige', name: 'Plaine de neige', unlock: 8, size: [8, 10], rocks: 0.12, snow: 0.06, cracks: 0, arrows: 0, par: [4, 9] },
  { id: 'fragile', name: 'Glace fragile', unlock: 20, size: [8, 10], rocks: 0.12, snow: 0.03, cracks: 5, arrows: 0, par: [5, 10] },
  { id: 'courants', name: 'Les courants', unlock: 34, size: [9, 11], rocks: 0.11, snow: 0.03, cracks: 3, arrows: 3, par: [5, 11] },
];

export function generate(seed, world, targetPar) {
  const rng = createRng(seed);
  const [w, h] = world.size;
  for (let attempt = 0; attempt < 3000; attempt++) {
    const g = Array.from({ length: w * h }, () => '.');
    const free = () => {
      for (let k = 0; k < 200; k++) {
        const i = rng.int(0, w * h - 1);
        if (g[i] === '.') return i;
      }
      return -1;
    };
    const n = w * h;
    for (let k = 0; k < Math.round(n * world.rocks); k++) g[free()] = '#';
    for (let k = 0; k < Math.round(n * world.snow); k++) g[free()] = 'o';
    for (let k = 0; k < world.cracks; k++) g[free()] = 'x';
    for (let k = 0; k < world.arrows; k++) g[free()] = rng.pick(['>', '<', '^', 'v']);
    const ig = free();
    g[ig] = 'I';
    // L'igloo est adossé : sinon on le traverserait trop facilement depuis loin
    const st = free();
    if (st < 0 || ig < 0) continue;
    g[st] = 'P';
    const rows = Array.from({ length: h }, (_, y) => g.slice(y * w, y * w + w).join(''));
    const lv = parse(rows);
    const sol = solve(lv, { limit: targetPar + 2 });
    if (!sol || sol.moves !== targetPar) continue;
    // Poissons : sur des cases que l'on peut atteindre, hors du chemin le plus court
    const onPath = new Set();
    let pos = lv.start;
    let br = new Set();
    for (const d of sol.path) {
      const r = slide(lv, pos, d, br);
      r.path.forEach((c) => onPath.add(c));
      pos = r.end ?? pos;
      br = r.broken;
    }
    const spots = [...sol.visited].filter((c) => g[c] === '.' && !onPath.has(c));
    const fish = rng.shuffle(spots).slice(0, Math.min(2, spots.length));
    if (!fish.length) continue;
    fish.forEach((c) => (g[c] = 'f'));
    return { rows: Array.from({ length: h }, (_, y) => g.slice(y * w, y * w + w).join('')), par: sol.moves };
  }
  return null;
}
