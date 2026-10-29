// Rempart — la simulation, sans DOM : cartes et chemins, vagues, tours (tir, éclaboussure,
// ralentissement, chaîne), ennemis, or et vies. Coordonnées en cases (16 × 10).

import { createRng } from '../../shared/js/core/rng.js';

export const COLS = 16;
export const ROWS = 10;
export const WAVES = 15;

export const TOWERS = {
  arbalete: { id: 'arbalete', name: 'Arbalète', cost: 50, dmg: 12, range: 2.6, rate: 2.4, speed: 20, color: '#c8955a', unlock: 0, desc: 'Tir rapide, une cible' },
  canon: { id: 'canon', name: 'Canon', cost: 80, dmg: 28, range: 2.3, rate: 1.05, speed: 12, splash: 0.95, color: '#6b6f80', unlock: 0, desc: 'Lent, touche un groupe' },
  givre: { id: 'givre', name: 'Givre', cost: 70, dmg: 5, range: 2.2, rate: 1.9, speed: 15, splash: 0.7, slow: 0.45, color: '#7fd0f5', unlock: 1, desc: 'Ralentit les ennemis' },
  eclair: { id: 'eclair', name: 'Éclair', cost: 120, dmg: 20, range: 2.5, rate: 1.5, chain: 3, color: '#ffc93c', unlock: 2, desc: 'Foudroie trois cibles' },
};
export const UPGRADE = [0, 0.7, 1.1]; // coût des niveaux 2 et 3, en part du prix de base
export const SELL = 0.6;
export const towerStats = (t) => {
  const b = TOWERS[t.type];
  const k = t.level - 1;
  return { ...b, dmg: b.dmg * (1 + 0.5 * k), range: b.range * (1 + 0.1 * k), rate: b.rate * (1 + 0.12 * k), slow: b.slow ? Math.min(0.65, b.slow + 0.08 * k) : 0, chain: b.chain ? b.chain + k : 0 };
};
export const upgradeCost = (t) => (t.level >= 3 ? null : Math.round(TOWERS[t.type].cost * UPGRADE[t.level]));
export const sellValue = (t) => Math.round(t.spent * SELL);

export const ENEMIES = {
  gobelin: { id: 'gobelin', name: 'Gobelin', hp: 40, speed: 2.2, reward: 5, armor: 0, leak: 1, size: 0.26, color: '#6ab04c' },
  loup: { id: 'loup', name: 'Loup', hp: 28, speed: 3.4, reward: 6, armor: 0, leak: 1, size: 0.24, color: '#a9b3c4' },
  bouclier: { id: 'bouclier', name: 'Bouclier', hp: 90, speed: 1.8, reward: 10, armor: 6, leak: 1, size: 0.3, color: '#c49a5a' },
  ogre: { id: 'ogre', name: 'Ogre', hp: 220, speed: 1.2, reward: 18, armor: 2, leak: 2, size: 0.38, color: '#8e6bbf' },
  boss: { id: 'boss', name: 'Seigneur de guerre', hp: 1400, speed: 1.0, reward: 120, armor: 8, leak: 5, size: 0.48, color: '#e63946' },
};

// Cartes : chemins en coordonnées de cases (entrée et sortie hors de la grille)
export const MAPS = [
  { id: 'prairie', name: 'Prairie', ground: ['#7cb860', '#6fa955'], path: [[-1, 2], [4, 2], [4, 7], [10, 7], [10, 3], [16, 3]], decor: 'tree', hp: 1 },
  { id: 'canyon', name: 'Canyon', ground: ['#d9a066', '#c98f57'], path: [[-1, 7], [3, 7], [3, 2], [8, 2], [8, 7], [12, 7], [12, 3], [16, 3]], decor: 'rock', hp: 1.3 },
  { id: 'marais', name: 'Marais', ground: ['#5f8a6a', '#557d5f'], path: [[-1, 5], [2, 5], [2, 2], [6, 2], [6, 7], [9, 7], [9, 4], [13, 4], [13, 6], [16, 6]], decor: 'reed', hp: 1.6 },
  { id: 'volcan', name: 'Volcan', ground: ['#5a4a4a', '#4d3f3f'], path: [[-1, 8], [5, 8], [5, 2], [10, 2], [10, 6], [16, 6]], decor: 'lava', hp: 1.8 },
];

export function pathCells(path) {
  const set = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, y0] = path[i];
    const [x1, y1] = path[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = x0 + Math.sign(x1 - x0) * k;
      const y = y0 + Math.sign(y1 - y0) * k;
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS) set.add(y * COLS + x);
    }
  }
  return set;
}

function pathLength(path) {
  let L = 0;
  for (let i = 0; i < path.length - 1; i++) L += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
  return L;
}
export function pointAt(path, d) {
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, y0] = path[i];
    const [x1, y1] = path[i + 1];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (d <= seg) return { x: x0 + ((x1 - x0) * d) / seg + 0.5, y: y0 + ((y1 - y0) * d) / seg + 0.5, dx: Math.sign(x1 - x0), dy: Math.sign(y1 - y0) };
    d -= seg;
  }
  const [x, y] = path[path.length - 1];
  return { x: x + 0.5, y: y + 0.5, dx: 1, dy: 0 };
}

// ---------- Partie ----------
export function createGame({ mapIndex = 0, seed = 1, endless = false, mix = null } = {}) {
  const map = MAPS[mapIndex];
  const rng = createRng(seed);
  const cells = pathCells(map.path);
  // Décor : quelques cases occupées, toujours les mêmes pour une carte
  const decoRng = createRng(1000 + mapIndex);
  const blocked = new Set();
  for (let k = 0; k < 14; k++) {
    const i = decoRng.int(0, COLS * ROWS - 1);
    if (!cells.has(i)) blocked.add(i);
  }
  return {
    map,
    mapIndex,
    rng,
    cells,
    blocked,
    length: pathLength(map.path),
    towers: [],
    enemies: [],
    shots: [],
    bolts: [],
    gold: 150,
    lives: 20,
    wave: 0,
    phase: 'build', // build | wave | won | lost
    countdown: 0, // 0 : on attend que le joueur lance la première vague
    queue: [],
    spawnT: 0,
    endless,
    mix,
    time: 0,
    stats: { kills: 0, built: 0, bosses: 0, leaked: 0, earned: 0 },
    nextId: 1,
  };
}

export function waveSpec(g, n) {
  const list = [];
  const count = Math.round(7 + n * 1.3);
  const r = createRng((g.mix ?? 0) * 7919 + n * 131 + g.mapIndex * 17);
  for (let k = 0; k < count; k++) {
    let type = 'gobelin';
    const x = r.next();
    if (n >= 3 && x < 0.25 + (g.mix ? 0.1 : 0)) type = 'loup';
    else if (n >= 5 && x < 0.45) type = 'bouclier';
    else if (n >= 7 && x < 0.55) type = 'ogre';
    list.push(type);
  }
  if (n === 10 || n === 15 || (n > 15 && n % 5 === 0)) list.push('boss');
  // Les groupes arrivent serrés : on trie un peu pour faire des paquets
  return list;
}

const hpScale = (n) => (1 + 0.16 * (n - 1)) * (n > 12 ? 1 + 0.06 * (n - 12) : 1) * (n > 20 ? 1 + 0.08 * (n - 20) : 1);

export function startWave(g) {
  if (g.phase !== 'build') return 0;
  const bonus = g.wave > 0 ? Math.ceil(g.countdown) * 2 : 0;
  g.gold += bonus;
  g.wave++;
  g.phase = 'wave';
  g.queue = waveSpec(g, g.wave);
  g.spawnT = 0.3;
  g.spawnEvery = Math.max(0.32, 0.6 - g.wave * 0.02);
  return bonus;
}

export function canBuild(g, c, r) {
  const i = r * COLS + c;
  return c >= 0 && r >= 0 && c < COLS && r < ROWS && !g.cells.has(i) && !g.blocked.has(i) && !g.towers.some((t) => t.c === c && t.r === r);
}

export function build(g, type, c, r) {
  const T = TOWERS[type];
  if (!T || g.gold < T.cost || !canBuild(g, c, r)) return null;
  g.gold -= T.cost;
  const t = { id: g.nextId++, type, c, r, x: c + 0.5, y: r + 0.5, level: 1, cd: 0, angle: 0, spent: T.cost, kills: 0, flash: 0 };
  g.towers.push(t);
  g.stats.built++;
  return t;
}
export function upgrade(g, t) {
  const cost = upgradeCost(t);
  if (cost === null || g.gold < cost) return false;
  g.gold -= cost;
  t.level++;
  t.spent += cost;
  t.flash = 1;
  return true;
}
export function sell(g, t) {
  g.gold += sellValue(t);
  g.towers = g.towers.filter((x) => x !== t);
}

function spawn(g, type) {
  const E = ENEMIES[type];
  // La difficulté propre à la carte monte sur les six premières vagues
  const mapHp = 1 + ((g.map.hp ?? 1) - 1) * Math.min(1, g.wave / 6);
  const hp = Math.round(E.hp * hpScale(g.wave) * mapHp * (g.mix ? 1.3 : 1));
  g.enemies.push({ id: g.nextId++, type, d: 0, hp, max: hp, slow: 0, slowT: 0, x: g.map.path[0][0] + 0.5, y: g.map.path[0][1] + 0.5, hit: 0, wob: g.rng.range(0, 6) });
}

function damage(g, e, amount, events) {
  const real = Math.max(amount * 0.25, amount - ENEMIES[e.type].armor);
  e.hp -= real;
  e.hit = 1;
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    const reward = ENEMIES[e.type].reward;
    g.gold += reward;
    g.stats.kills++;
    g.stats.earned += reward;
    if (e.type === 'boss') g.stats.bosses++;
    events.push({ type: 'kill', e, reward });
  }
}

export function step(g, dt, events = []) {
  g.time += dt;
  if (g.phase === 'won' || g.phase === 'lost') return events;
  if (g.phase === 'build' && g.wave > 0) {
    g.countdown -= dt;
    if (g.countdown <= 0) {
      g.countdown = 0;
      startWave(g);
      events.push({ type: 'wave', n: g.wave });
    }
  }
  // Apparitions
  if (g.phase === 'wave' && g.queue.length) {
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      spawn(g, g.queue.shift());
      g.spawnT = g.spawnEvery;
    }
  }
  // Déplacements
  for (const e of g.enemies) {
    if (e.dead) continue;
    const E = ENEMIES[e.type];
    e.slowT = Math.max(0, e.slowT - dt);
    if (!e.slowT) e.slow = 0;
    e.hit = Math.max(0, e.hit - dt * 6);
    e.d += E.speed * (1 - e.slow) * dt;
    const p = pointAt(g.map.path, e.d);
    e.x = p.x;
    e.y = p.y;
    e.dir = p.dx;
    if (e.d >= g.length) {
      e.dead = true;
      e.leaked = true;
      g.lives = Math.max(0, g.lives - E.leak);
      g.stats.leaked += E.leak;
      events.push({ type: 'leak', e, n: E.leak });
    }
  }
  // Tours
  for (const t of g.towers) {
    const s = towerStats(t);
    t.cd -= dt;
    t.flash = Math.max(0, t.flash - dt * 3);
    let target = null;
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - t.x, e.y - t.y) > s.range) continue;
      if (!target || e.d > target.d) target = e;
    }
    if (!target) continue;
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    if (t.cd > 0) continue;
    t.cd = 1 / s.rate;
    if (s.chain) {
      // Éclair : touche la cible puis saute aux voisins
      const hit = [target];
      let last = target;
      while (hit.length < s.chain) {
        let nb = null;
        for (const e of g.enemies) {
          if (e.dead || hit.includes(e)) continue;
          const d = Math.hypot(e.x - last.x, e.y - last.y);
          if (d < 1.6 && (!nb || d < nb.d)) nb = { e, d };
        }
        if (!nb) break;
        hit.push(nb.e);
        last = nb.e;
      }
      g.bolts.push({ pts: [[t.x, t.y - 0.3], ...hit.map((e) => [e.x, e.y])], life: 0.18 });
      hit.forEach((e, k) => damage(g, e, s.dmg * (k ? 0.75 : 1), events));
      events.push({ type: 'zap', t });
    } else {
      g.shots.push({ type: t.type, x: t.x, y: t.y, sx: t.x, sy: t.y, target, tx: target.x, ty: target.y, speed: s.speed, dmg: s.dmg, splash: s.splash ?? 0, slow: s.slow, t: 0 });
      events.push({ type: 'fire', t });
    }
  }
  // Projectiles
  for (const p of g.shots) {
    if (p.target && !p.target.dead) {
      p.tx = p.target.x;
      p.ty = p.target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const stepLen = p.speed * dt;
    p.t += dt;
    if (d <= stepLen) {
      p.done = true;
      if (p.splash) {
        for (const e of g.enemies) {
          if (e.dead || Math.hypot(e.x - p.tx, e.y - p.ty) > p.splash) continue;
          damage(g, e, p.dmg, events);
          if (p.slow) {
            e.slow = Math.max(e.slow, p.slow);
            e.slowT = 1.6;
          }
        }
        events.push({ type: 'boom', x: p.tx, y: p.ty, kind: p.type, r: p.splash });
      } else if (p.target && !p.target.dead) damage(g, p.target, p.dmg, events);
    } else {
      p.x += (dx / d) * stepLen;
      p.y += (dy / d) * stepLen;
    }
  }
  g.shots = g.shots.filter((p) => !p.done);
  for (const b of g.bolts) b.life -= dt;
  g.bolts = g.bolts.filter((b) => b.life > 0);
  g.enemies = g.enemies.filter((e) => !e.dead);

  if (g.lives <= 0) {
    g.phase = 'lost';
    events.push({ type: 'lost' });
  } else if (g.phase === 'wave' && !g.queue.length && !g.enemies.length) {
    if (!g.endless && g.wave >= WAVES) {
      g.phase = 'won';
      events.push({ type: 'won' });
    } else {
      g.phase = 'build';
      g.countdown = 6;
      g.gold += 10 + g.wave * 2;
      events.push({ type: 'cleared', n: g.wave });
    }
  }
  return events;
}
