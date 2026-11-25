// Pixel Quest — le moteur partagé par le joueur, Robo (l'IA) et l'éditeur : niveaux en grille,
// physique à pas fixe (60 pas par seconde, donc rejouable à l'identique), génération des niveaux
// de la campagne et solveur de Robo (recherche en faisceau sur ses décisions).

import { createRng } from '../../shared/js/core/rng.js';

export const H = 14; // hauteur d'un niveau, en tuiles
export const DT = 1 / 60;
// Tuiles : vide, sol, plate-forme (traversable par en dessous), pics, pièce, ressort, ennemi, départ, arrivée
export const TILES = ['.', '#', '=', '^', 'o', 'B', 'E', 'S', 'F'];
const SOLID = new Set(['#', 'B']);
const PW = 0.7; // boîte du héros
const PH = 0.9;
const PHYS = { g: 62, jump: 19.5, run: 9, accG: 80, accA: 45, fric: 70, maxFall: 22, spring: 27, stomp: 14 };

// ---------- Niveau ----------
export function parse(rows) {
  const W = rows[0].length;
  const grid = rows.map((r) => r.split(''));
  const L = { W, grid, start: { x: 2, y: 9 }, flag: W - 3, coins: [], enemies: [] };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = grid[y][x];
      if (c === 'S') {
        L.start = { x: x + (1 - PW) / 2, y: y + 1 - PH };
        grid[y][x] = '.';
      } else if (c === 'F') {
        L.flag = x;
        L.flagY = y;
        grid[y][x] = '.';
      } else if (c === 'o') {
        L.coins.push({ x, y });
        grid[y][x] = '.';
      } else if (c === 'E') {
        L.enemies.push({ x: x + 0.1, y: y + 0.2 });
        grid[y][x] = '.';
      }
    }
  }
  L.tracks = L.enemies.map((e) => track(L, e));
  return L;
}
export const tile = (L, x, y) => (y < 0 ? '.' : y >= H || x < 0 || x >= L.W ? (x < 0 || x >= L.W ? '#' : '.') : L.grid[y][x]);
const solid = (L, x, y) => SOLID.has(tile(L, x, y));

// Les ennemis marchent seuls (demi-tour contre un mur ou au bord du vide) : leur trajet ne
// dépend que du niveau, on le calcule une fois pour toutes
const TRACK_FRAMES = 60 * 150;
function track(L, e) {
  const xs = new Float32Array(TRACK_FRAMES);
  let x = e.x;
  let dir = -1;
  const row = Math.floor(e.y); // la rangée où il marche ; le sol est juste en dessous
  for (let f = 0; f < TRACK_FRAMES; f++) {
    xs[f] = x;
    const nx = x + dir * 2 * DT;
    const c = Math.floor(dir > 0 ? nx + 0.8 : nx);
    const wall = solid(L, c, row);
    const floor = solid(L, c, row + 1) || tile(L, c, row + 1) === '=';
    if (wall || !floor) dir = -dir;
    else x = nx;
  }
  return xs;
}
export const enemyX = (L, i, f) => L.tracks[i][Math.min(f, TRACK_FRAMES - 1)];

// ---------- Physique (un pas = 1/60 s) ----------
export function spawn(L) {
  return { x: L.start.x, y: L.start.y, vx: 0, vy: 0, ground: false, coy: 0, buf: 0, jumping: false, f: 0, killed: 0, dead: false, won: false, stomped: -1 };
}

// inp : { l, r, jp (appui), jh (maintenu) } ; k : vitesse maximale (Robo court un peu moins vite)
export function step(s, inp, L, k = 1) {
  const P = PHYS;
  const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  const run = P.run * k;
  if (dir) s.vx = Math.max(-run, Math.min(run, s.vx + dir * (s.ground ? P.accG : P.accA) * DT));
  else {
    const d = (s.ground ? P.fric : P.accA * 0.5) * DT;
    s.vx = Math.abs(s.vx) <= d ? 0 : s.vx - Math.sign(s.vx) * d;
  }
  if (inp.jp) s.buf = 6;
  else if (s.buf > 0) s.buf--;
  if (s.ground) s.coy = 6;
  else if (s.coy > 0) s.coy--;
  s.jumped = false;
  if (s.buf > 0 && s.coy > 0) {
    s.vy = -P.jump;
    s.buf = 0;
    s.coy = 0;
    s.ground = false;
    s.jumping = true;
    s.jumped = true;
  }
  if (!inp.jh && s.jumping && s.vy < 0) {
    s.vy *= 0.5;
    s.jumping = false;
  }
  s.vy = Math.min(P.maxFall, s.vy + P.g * DT);
  // Horizontal
  s.x += s.vx * DT;
  const y0 = Math.floor(s.y + 0.01);
  const y1 = Math.floor(s.y + PH - 0.01);
  if (s.vx > 0) {
    const cx = Math.floor(s.x + PW);
    for (let y = y0; y <= y1; y++) if (solid(L, cx, y)) {
      s.x = cx - PW - 0.001;
      s.vx = 0;
      break;
    }
  } else if (s.vx < 0) {
    const cx = Math.floor(s.x);
    for (let y = y0; y <= y1; y++) if (solid(L, cx, y)) {
      s.x = cx + 1.001;
      s.vx = 0;
      break;
    }
  }
  // Vertical
  const prevBottom = s.y + PH;
  s.y += s.vy * DT;
  s.ground = false;
  s.sprung = false;
  const x0 = Math.floor(s.x + 0.01);
  const x1 = Math.floor(s.x + PW - 0.01);
  if (s.vy > 0) {
    const cy = Math.floor(s.y + PH);
    for (let x = x0; x <= x1; x++) {
      const t = tile(L, x, cy);
      if (SOLID.has(t) || (t === '=' && prevBottom <= cy + 0.02)) {
        s.y = cy - PH;
        s.vy = 0;
        s.ground = true;
        s.jumping = false;
        if (t === 'B') {
          s.vy = -P.spring;
          s.ground = false;
          s.sprung = true;
        }
        break;
      }
    }
  } else if (s.vy < 0) {
    const cy = Math.floor(s.y);
    for (let x = x0; x <= x1; x++) if (solid(L, x, cy)) {
      s.y = cy + 1;
      s.vy = 0;
      break;
    }
  }
  s.f++;
  // Dangers
  if (s.y > H + 1) s.dead = 'vide';
  const px0 = Math.floor(s.x);
  const px1 = Math.floor(s.x + PW);
  const py0 = Math.floor(s.y);
  const py1 = Math.floor(s.y + PH);
  for (let y = py0; y <= py1 && !s.dead; y++) {
    for (let x = px0; x <= px1; x++) {
      if (tile(L, x, y) !== '^') continue;
      if (s.x + PW > x + 0.15 && s.x < x + 0.85 && s.y + PH > y + 0.45 && s.y < y + 1) s.dead = 'pics';
    }
  }
  s.stomped = -1;
  for (let i = 0; i < L.enemies.length && !s.dead; i++) {
    if (s.killed & (1 << i)) continue;
    const ex = enemyX(L, i, s.f);
    const ey = L.enemies[i].y;
    if (s.x + PW > ex && s.x < ex + 0.8 && s.y + PH > ey && s.y < ey + 0.8) {
      if (s.vy > 0 && s.y + PH - ey < 0.5) {
        s.killed |= 1 << i;
        s.vy = -P.stomp;
        s.jumping = false;
        s.stomped = i;
      } else s.dead = 'ennemi';
    }
  }
  if (!s.dead && s.x + PW >= L.flag + 0.3) s.won = true;
  return s;
}

// ---------- Robo : le solveur ----------
// Robo décide toutes les `k` images parmi quelques gestes : courir, sauter (maintenu), petit
// saut, attendre, reculer. La recherche garde les meilleures positions à chaque décision.
export const ROBO = { name: 'Robo', every: 8, acts: 'RJN', speed: 0.88, beam: 90 };
export const ROBO_BOSS = { name: 'Robo-Boss', every: 6, acts: 'RJSN', speed: 0.95, beam: 140 };
const ACT = {
  R: (i) => ({ r: true, jp: false, jh: false }),
  J: (i) => ({ r: true, jp: i === 0, jh: true }),
  S: (i) => ({ r: true, jp: i === 0, jh: i < 4 }),
  N: () => ({ jp: false, jh: false }),
  L: () => ({ l: true, jp: false, jh: false }),
};
const clone = (s) => ({ ...s });

export function solve(L, bot = ROBO, maxSeconds = 120) {
  let beam = [{ s: spawn(L), path: '' }];
  const maxDecisions = Math.ceil((maxSeconds * 60) / bot.every);
  for (let d = 0; d < maxDecisions; d++) {
    const next = new Map();
    for (const node of beam) {
      for (const a of bot.acts) {
        const s = clone(node.s);
        // Garder la touche de saut d'une décision à l'autre : un saut maintenu va plus haut
        const hold = a === 'J' && node.path.endsWith('J');
        for (let i = 0; i < bot.every; i++) {
          const inp = ACT[a](hold ? 1 : i);
          step(s, inp, L, bot.speed);
          if (s.dead || s.won) break;
        }
        if (s.dead) continue;
        const path = node.path + a;
        if (s.won) return { path, frames: s.f, bot };
        const key = `${Math.round(s.x * 3)},${Math.round(s.y * 3)},${Math.round(s.vy / 3)},${s.killed},${s.ground ? 1 : 0}`;
        const score = s.x * 10 - s.f * 0.01 + (s.ground ? 0.5 : 0);
        const old = next.get(key);
        if (!old || old.score < score) next.set(key, { s, path, score });
      }
    }
    if (!next.size) return null;
    beam = [...next.values()].sort((a, b) => b.score - a.score).slice(0, bot.beam);
  }
  return null;
}

// Les commandes d'une course, image par image (tests : le héros rejoue une solution)
export function inputsOf(sol) {
  const out = [];
  let prev = '';
  for (const a of sol.path) {
    const hold = a === 'J' && prev === 'J';
    for (let i = 0; i < sol.bot.every; i++) out.push(ACT[a](hold ? 1 : i));
    prev = a;
  }
  return out;
}

// Rejoue la course de Robo image par image : positions pour le fantôme
export function replay(L, sol) {
  const s = spawn(L);
  const xs = [];
  const ys = [];
  let prev = '';
  for (const a of sol.path) {
    const hold = a === 'J' && prev === 'J';
    for (let i = 0; i < sol.bot.every; i++) {
      step(s, ACT[a](hold ? 1 : i), L, sol.bot.speed);
      xs.push(s.x);
      ys.push(s.y);
      if (s.won || s.dead) break;
    }
    prev = a;
    if (s.won || s.dead) break;
  }
  return { xs, ys, frames: s.f, won: s.won };
}

// ---------- Génération de la campagne ----------
export const WORLDS = [
  { id: 1, name: 'Les plaines', sky: ['#7fd0ff', '#d9f2ff'], ground: '#5a3a22', top: '#3ee6a8', deco: 'hill' },
  { id: 2, name: 'Les grottes', sky: ['#1d1533', '#3a2a5a'], ground: '#3a3050', top: '#a68bff', deco: 'crystal', ceiling: true },
  { id: 3, name: 'Les cieux', sky: ['#ff9ec7', '#ffd8a8'], ground: '#f4efe4', top: '#ffffff', deco: 'cloud', sky3: true },
];

function build(w, n, r) {
  const world = WORLDS[w - 1];
  const W = 52 + n * 4 + (w - 1) * 8;
  const g = Array.from({ length: H }, () => new Array(W).fill('.'));
  const diff = (w - 1) * 10 + n;
  let gh = 11;
  const minGh = world.ceiling ? 8 : 6;
  const col = (x, top = gh) => {
    const deep = world.sky3 ? Math.min(H, top + 2) : H;
    for (let y = top; y < deep; y++) g[y][x] = '#';
  };
  let x = 0;
  for (; x < 6; x++) col(x);
  g[gh - 1][2] = 'S';
  const weights = w === 1 ? { flat: 3, gap: 3, spikes: 2, step: 2, pillar: 2, enemy: 2, plats: 1, spring: 1 } : w === 2 ? { flat: 2, gap: 2, spikes: 3, step: 2, pillar: 2, enemy: 3, plats: 1, spring: 1 } : { flat: 1, gap: 4, spikes: 2, step: 2, pillar: 1, enemy: 2, plats: 3, spring: 2 };
  const kinds = Object.keys(weights);
  while (x < W - 10) {
    const k = r.weighted(kinds, (t) => weights[t]);
    if (k === 'flat') {
      const cw = r.int(3, 6);
      for (let i = 0; i < cw; i++, x++) {
        col(x);
        if (r.chance(0.25)) g[gh - 2][x] = 'o';
      }
    } else if (k === 'gap') {
      const gw = r.int(2, Math.min(5, 2 + Math.floor(diff / 7)));
      for (let i = 0; i < gw; i++, x++) if (i > 0 && i < gw - 1 || gw === 2) g[gh - 3][x] = r.chance(0.6) ? 'o' : '.';
      for (let i = 0; i < 2; i++, x++) col(x);
    } else if (k === 'spikes') {
      for (let i = 0; i < 2; i++, x++) col(x);
      const sw = r.int(1, Math.min(3, 1 + Math.floor(diff / 9)));
      for (let i = 0; i < sw; i++, x++) {
        col(x);
        g[gh - 1][x] = '^';
        g[gh - 4][x] = r.chance(0.5) ? 'o' : '.';
      }
      for (let i = 0; i < 2; i++, x++) col(x);
    } else if (k === 'step') {
      gh = Math.max(minGh, Math.min(11, gh + (r.chance(0.5) ? -1 : 1) * r.int(1, 2)));
      for (let i = 0; i < 3; i++, x++) col(x);
    } else if (k === 'pillar') {
      for (let i = 0; i < 2; i++, x++) col(x);
      const ph = r.int(1, Math.min(3, 1 + Math.floor(diff / 6)));
      const pw = r.int(1, 2);
      for (let i = 0; i < pw; i++, x++) {
        col(x, gh - ph);
        g[gh - ph - 2][x] = 'o';
      }
      for (let i = 0; i < 2; i++, x++) col(x);
    } else if (k === 'enemy') {
      const cw = r.int(6, 8);
      for (let i = 0; i < cw; i++, x++) col(x);
      g[gh - 1][x - Math.floor(cw / 2)] = 'E';
      if (diff > 12 && r.chance(0.4)) g[gh - 1][x - 2] = 'E';
    } else if (k === 'plats') {
      const gw = r.int(4, Math.min(8, 5 + Math.floor(diff / 8)));
      const py = Math.max(minGh - 2, gh - 3);
      for (let i = 0; i < gw; i++, x++) {
        if (i >= 1 && i <= gw - 2 && (i % 3 !== 0 || gw < 6)) g[py][x] = '=';
        if (i === Math.floor(gw / 2)) g[py - 2][x] = 'o';
      }
      for (let i = 0; i < 2; i++, x++) col(x);
    } else if (k === 'spring') {
      for (let i = 0; i < 2; i++, x++) col(x);
      col(x);
      g[gh - 1][x] = 'B';
      x++;
      col(x++);
      const wh = Math.min(gh - (world.ceiling ? 4 : 2), 4 + (r.chance(0.5) ? 1 : 0));
      for (let i = 0; i < 2; i++, x++) {
        col(x, gh - wh);
        g[gh - wh - 2][x] = 'o';
      }
      for (let i = 0; i < 2; i++, x++) col(x);
    }
  }
  for (; x < W; x++) col(x);
  g[gh - 1][W - 4] = 'F';
  if (world.ceiling) for (let cx = 0; cx < W; cx++) for (let y = 0; y < 2; y++) g[y][cx] = '#';
  return g.map((row) => row.join(''));
}

const cache = new Map();
// Un niveau de la campagne : toujours le même pour un monde et un numéro, et toujours faisable
export function campaignLevel(w, n) {
  const key = `${w}-${n}`;
  if (cache.has(key)) return cache.get(key);
  const bot = n === 10 ? ROBO_BOSS : ROBO;
  for (let v = 0; v < 40; v++) {
    const rows = build(w, n, createRng(w * 7919 + n * 104729 + v * 15485863));
    const L = parse(rows);
    // Faisable par le Robo normal (donc par un joueur), puis la course du robo de ce niveau
    const check = solve(L, ROBO);
    if (!check) continue;
    const sol = bot === ROBO ? check : solve(L, bot) ?? check;
    const out = { rows, sol, bot: sol.bot };
    cache.set(key, out);
    return out;
  }
  throw new Error(`niveau ${key} introuvable`);
}

// ---------- Codes de niveau (éditeur) ----------
// Les tuiles en suite (longueur, type) puis base64url ; « PQ1. » devant
export function encodeLevel(rows) {
  const flat = rows.join('');
  const out = [rows[0].length];
  for (let i = 0; i < flat.length; ) {
    let j = i;
    while (j < flat.length && flat[j] === flat[i] && j - i < 255) j++;
    out.push(j - i, TILES.indexOf(flat[i]));
    i = j;
  }
  let bin = '';
  for (const b of out) bin += String.fromCharCode(b);
  return 'PQ1.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeLevel(code) {
  const m = /^PQ1\.([A-Za-z0-9_-]+)$/.exec(String(code).trim().replace(/\s+/g, ''));
  if (!m) throw new Error('Ce n’est pas un code de niveau Pixel Quest.');
  let bin;
  try {
    bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    throw new Error('Code abîmé : recopie-le en entier.');
  }
  const W = bin.charCodeAt(0);
  let flat = '';
  for (let i = 1; i + 1 < bin.length; i += 2) flat += (TILES[bin.charCodeAt(i + 1)] ?? '.').repeat(bin.charCodeAt(i));
  if (W < 20 || flat.length !== W * H) throw new Error('Code abîmé : recopie-le en entier.');
  const rows = [];
  for (let y = 0; y < H; y++) rows.push(flat.slice(y * W, (y + 1) * W));
  if (!flat.includes('S') || !flat.includes('F')) throw new Error('Ce niveau n’a pas de départ ou d’arrivée.');
  return rows;
}
