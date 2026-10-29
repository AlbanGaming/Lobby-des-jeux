// Conquête — la simulation, sans DOM : la carte (bases et flottes), la production, les combats à
// l'arrivée, les éliminations et les IA. Tout est en coordonnées « monde » 1200 × 750 (paysage).

import { createRng, hashString } from '../../shared/js/core/rng.js';

export const WORLD = { w: 1200, h: 750 };
export const SPEED = 95; // unités de monde par seconde
export const SIZES = [
  { r: 22, prod: 0.65, cap: 40, name: 'Avant-poste' },
  { r: 30, prod: 1.0, cap: 70, name: 'Fort' },
  { r: 38, prod: 1.4, cap: 110, name: 'Citadelle' },
];
export const FACTIONS = [
  { id: 0, name: 'Neutre', color: '#8d99ae', dark: '#3b4252' },
  { id: 1, name: 'Toi', color: '#4cc3ff', dark: '#14425e' },
  { id: 2, name: 'Rouge', color: '#ff5d5d', dark: '#5e1a20' },
  { id: 3, name: 'Ambre', color: '#ffb02e', dark: '#5e3d08' },
  { id: 4, name: 'Jade', color: '#3ee6a8', dark: '#0d4a36' },
];
export const PLAYER = 1;

// Niveaux d'IA : temps de réflexion, marge de sécurité, erreurs, coordination, défense
export const SKILLS = [
  { id: 0, name: 'Recrue', think: 2.8, margin: 1.6, mistake: 0.3, coordinate: false, defend: false, moves: 1, keep: 0.35, grace: 30 },
  { id: 1, name: 'Soldat', think: 2.0, margin: 1.35, mistake: 0.12, coordinate: false, defend: true, moves: 1, keep: 0.25, grace: 24 },
  { id: 2, name: 'Général', think: 1.4, margin: 1.2, mistake: 0.04, coordinate: true, defend: true, moves: 2, keep: 0.2, grace: 18 },
  { id: 3, name: 'Stratège', think: 0.9, margin: 1.1, mistake: 0, coordinate: true, defend: true, moves: 2, keep: 0.12, grace: 12 },
];

// Campagne : adversaires (niveaux d'IA), nombre de bases, temps de référence pour la 2e étoile
export const LEVELS = [
  { ais: [0], bases: 9, par: 90 },
  { ais: [0], bases: 11, par: 100 },
  { ais: [1], bases: 11, par: 110 },
  { ais: [0, 0], bases: 13, par: 120 },
  { ais: [2], bases: 12, par: 120 },
  { ais: [1, 1], bases: 14, par: 130 },
  { ais: [3], bases: 13, par: 130 },
  { ais: [1, 0, 1], bases: 16, par: 150 },
  { ais: [2, 2], bases: 15, par: 150 },
  { ais: [1, 2, 1], bases: 17, par: 160 },
  { ais: [3, 3], bases: 16, par: 160 },
  { ais: [3, 3, 3], bases: 18, par: 180 },
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- Génération ----------
export function generate(seed0, { ais = [1], bases = 12 } = {}) {
  const seed = typeof seed0 === 'string' ? hashString(seed0) : seed0;
  const rng = createRng(seed);
  const { w, h } = WORLD;
  const cx = w / 2;
  const cy = h / 2;
  const players = [PLAYER, ...ais.map((_, k) => k + 2)];
  const angles = { 2: [Math.PI, 0], 3: [Math.PI, Math.PI / 3, -Math.PI / 3], 4: [Math.PI, Math.PI / 2, 0, -Math.PI / 2] }[players.length];
  const list = [];
  const add = (x, y, size, owner, troops) => list.push({ id: list.length, x, y, size, r: SIZES[size].r, owner, troops, flash: 0, pulse: 0 });
  players.forEach((owner, k) => add(cx + Math.cos(angles[k]) * w * 0.4, cy - Math.sin(angles[k]) * h * 0.37, 2, owner, 30));
  // Duel : carte symétrique par rapport au centre, pour un départ équitable
  const mirror = players.length === 2;
  const total = bases;
  const free = (x, y, r) => list.every((b) => Math.hypot(b.x - x, b.y - y) > b.r + r + (b.owner ? 120 : 70)) && x > r + 40 && x < w - r - 40 && y > r + 40 && y < h - r - 40;
  const roll = () => {
    const size = rng.weighted([{ s: 0, weight: 5 }, { s: 1, weight: 3.5 }, { s: 2, weight: 1.5 }]).s;
    return { size, r: SIZES[size].r, troops: [rng.int(5, 12), rng.int(10, 20), rng.int(18, 30)][size] };
  };
  if (mirror && (total - list.length) % 2 === 1) {
    const c = roll();
    add(cx, cy, Math.max(1, c.size), 0, c.troops + 6);
  }
  for (let tries = 0; list.length < total && tries < 6000; tries++) {
    const c = roll();
    const x = rng.range(40, w - 40);
    const y = rng.range(40, h - 40);
    if (!free(x, y, c.r)) continue;
    if (mirror) {
      if (total - list.length < 2 || Math.hypot(w - 2 * x, h - 2 * y) < 2 * c.r + 70 || !free(w - x, h - y, c.r)) continue;
      add(x, y, c.size, 0, c.troops);
      add(w - x, h - y, c.size, 0, c.troops);
    } else add(x, y, c.size, 0, c.troops);
  }
  // Rival de chaque IA : la faction voisine suivante (la dernière vise le joueur)
  const rival = (k) => players[(k + 2) % players.length];
  return {
    bases: list,
    fleets: [],
    players,
    ais: Object.fromEntries(ais.map((s, k) => [k + 2, { skill: SKILLS[s], timer: 1.2 + k * 0.4, rng: createRng(seed * 7 + k + 1), rival: rival(k) }])),
    alive: new Set(players),
    time: 0,
    nextFleet: 1,
  };
}

// ---------- Ordres ----------
export function send(world, from, to, { pct = 0.5, n } = {}) {
  if (from === to || from.troops < 1) return null;
  const count = Math.floor(Math.min(from.troops, n ?? from.troops * pct));
  if (count < 1) return null;
  from.troops -= count;
  const d = dist(from, to);
  const f = { id: world.nextFleet++, owner: from.owner, from: from.id, to: to.id, n: count, t: 0, len: d, seed: Math.random() * 1000 };
  world.fleets.push(f);
  return f;
}

export const fleetPos = (world, f) => {
  const a = world.bases[f.from];
  const b = world.bases[f.to];
  const k = (a.r + (b.r - a.r) * f.t) / f.len;
  const t = k + f.t * (1 - 2 * k);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: (b.x - a.x) / f.len, dy: (b.y - a.y) / f.len };
};

// ---------- Simulation ----------
export function step(world, dt, events = []) {
  world.time += dt;
  for (const b of world.bases) {
    b.flash = Math.max(0, b.flash - dt * 2.5);
    if (!b.owner) continue;
    const s = SIZES[b.size];
    if (b.troops < s.cap) b.troops = Math.min(s.cap, b.troops + s.prod * dt);
    else b.troops = Math.max(s.cap, b.troops - dt * 2); // au-delà du plafond, la garnison fond
  }
  for (let i = world.fleets.length - 1; i >= 0; i--) {
    const f = world.fleets[i];
    f.t += (SPEED * dt) / f.len;
    if (f.t < 1) continue;
    world.fleets.splice(i, 1);
    arrive(world, f, events);
  }
  for (const [owner, ai] of Object.entries(world.ais)) {
    const o = Number(owner);
    if (!world.alive.has(o)) continue;
    ai.timer -= dt;
    if (ai.timer > 0) continue;
    ai.timer = ai.skill.think * (0.8 + ai.rng.next() * 0.4);
    aiThink(world, o, ai, events);
  }
  for (const p of world.players) {
    if (!world.alive.has(p)) continue;
    if (!world.bases.some((b) => b.owner === p) && !world.fleets.some((f) => f.owner === p)) {
      world.alive.delete(p);
      events.push({ type: 'eliminated', owner: p });
    }
  }
  return events;
}

function arrive(world, f, events) {
  const b = world.bases[f.to];
  if (b.owner === f.owner) {
    b.troops += f.n;
    events.push({ type: 'reinforce', base: b, owner: f.owner, n: f.n });
    return;
  }
  b.troops -= f.n;
  b.flash = 1;
  if (b.troops < 0) {
    const prev = b.owner;
    b.owner = f.owner;
    b.troops = -b.troops;
    b.pulse = 1;
    events.push({ type: 'capture', base: b, owner: f.owner, prev });
  } else {
    events.push({ type: 'hit', base: b, owner: f.owner, n: f.n });
  }
}

// ---------- Mesures ----------
export function power(world) {
  const out = Object.fromEntries(world.players.map((p) => [p, 0]));
  for (const b of world.bases) if (b.owner) out[b.owner] += b.troops;
  for (const f of world.fleets) out[f.owner] += f.n;
  return out;
}
export const owned = (world, p) => world.bases.filter((b) => b.owner === p);
export function incoming(world, base, owner) {
  let mine = 0;
  let hostile = 0;
  for (const f of world.fleets) {
    if (f.to !== base.id) continue;
    if (f.owner === owner) mine += f.n;
    else hostile += f.n;
  }
  return { mine, hostile };
}
export function winner(world) {
  if (!world.alive.has(PLAYER)) return 'lose';
  if (world.alive.size === 1) return 'win';
  return null;
}

// ---------- IA ----------
function aiThink(world, me, ai, events) {
  const { skill, rng } = ai;
  const mine = owned(world, me);
  if (!mine.length) return;
  let moves = skill.moves;
  const reserve = new Map(mine.map((b) => [b.id, 0]));

  // Défense : renforcer une base menacée
  if (skill.defend) {
    for (const b of mine) {
      const { mine: help, hostile } = incoming(world, b, me);
      const short = hostile - (b.troops + help) + 2;
      if (short <= 0) continue;
      reserve.set(b.id, b.troops);
      const helpers = mine.filter((h) => h !== b && h.troops > 6).sort((p, q) => dist(p, b) - dist(q, b));
      let left = short;
      for (const h of helpers) {
        if (left <= 0 || moves <= 0) break;
        const give = Math.min(Math.floor(h.troops * 0.7), Math.ceil(left));
        if (give < 2) continue;
        send(world, h, b, { n: give });
        events.push({ type: 'ai-send', owner: me });
        left -= give;
        moves--;
      }
    }
  }
  if (moves <= 0) return;

  // Début de partie : chacun s'étend d'abord sur les bases neutres
  const early = world.time < skill.grace;
  const prey = (b) => b.owner !== me && (!early || !b.owner);

  // Erreur de débutant : une attaque au hasard
  if (rng.chance(skill.mistake)) {
    const src = rng.pick(mine);
    const tgt = rng.pick(world.bases.filter(prey));
    if (src && tgt && src.troops > 8) send(world, src, tgt, { pct: 0.5 });
    return;
  }

  // Attaque : la cible la plus rentable
  const avail = (b) => Math.max(0, b.troops * (1 - skill.keep) - reserve.get(b.id));
  const targets = world.bases.filter(prey);
  const plans = [];
  for (const t of targets) {
    const srcs = mine.filter((b) => avail(b) >= 3).sort((p, q) => dist(p, t) - dist(q, t));
    if (!srcs.length) continue;
    const eta = dist(srcs[0], t) / SPEED;
    const inc = incoming(world, t, me);
    const def = t.troops + (t.owner ? SIZES[t.size].prod * eta : 0) + (t.owner ? inc.hostile * 0.5 : 0) - inc.mine;
    if (def < -5) continue; // déjà pris en charge
    const need = (Math.max(0, def) + 2) * skill.margin;
    // En mêlée, chaque IA vise surtout son rival désigné : pas de meute contre le joueur
    const focus = !t.owner ? 1 : ai.rival === t.owner ? 1.3 : t.owner === PLAYER && world.players.length > 2 ? 0.8 : 1;
    const value = (t.size + 1.2) * (t.owner ? 1.35 : 1) * focus;
    const score = value / (need + eta * 4);
    plans.push({ t, srcs, need, score });
  }
  plans.sort((a, b) => b.score - a.score);
  for (const p of plans) {
    if (moves <= 0) break;
    const chosen = [];
    let total = 0;
    for (const s of skill.coordinate ? p.srcs : p.srcs.slice(0, 1)) {
      if (total >= p.need) break;
      const a = Math.floor(avail(s));
      if (a < 2) continue;
      chosen.push([s, a]);
      total += a;
      if (chosen.length >= 3) break;
    }
    if (total < p.need) continue;
    let left = Math.ceil(p.need);
    for (const [s, a] of chosen) {
      const n = Math.min(a, left);
      if (n < 1) break;
      send(world, s, p.t, { n });
      reserve.set(s.id, reserve.get(s.id) + n);
      left -= n;
    }
    events.push({ type: 'ai-send', owner: me });
    moves--;
  }

  // Rien à attaquer : les bases pleines ravitaillent celle qui est la plus proche de l'ennemi
  if (moves > 0 && skill.id >= 1) {
    const enemies = world.bases.filter((b) => b.owner && b.owner !== me);
    if (!enemies.length || mine.length < 2) return;
    const front = (b) => Math.min(...enemies.map((e) => dist(b, e)));
    const sorted = [...mine].sort((p, q) => front(p) - front(q));
    const head = sorted[0];
    for (const b of sorted.slice(1)) {
      if (b.troops >= SIZES[b.size].cap * 0.9) {
        send(world, b, head, { pct: 0.6 });
        break;
      }
    }
  }
}

/** IA jouée à la place du joueur (démo d'accueil, tests d'équilibrage) */
export function autopilot(world, skillId = 2, seed = 99) {
  world.ais[PLAYER] = { skill: SKILLS[skillId], timer: 0.5, rng: createRng(seed) };
}
