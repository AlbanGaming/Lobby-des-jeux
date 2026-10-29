// Le Potager — les règles, sans DOM : cultures et saisons, arrosage, panier et marché,
// commandes, parcelles, poules et améliorations, progression du jardinier, absence.

export const SEASON_LEN = 240; // secondes de jeu par saison
export const SEASONS = [
  { id: 'printemps', name: 'Printemps', ground: '#7a5a3a', grass: '#8ccf6a', sky: '#bfe9ff' },
  { id: 'ete', name: 'Été', ground: '#8a6440', grass: '#a6d65a', sky: '#9fdcff' },
  { id: 'automne', name: 'Automne', ground: '#6e4e32', grass: '#c9a24a', sky: '#f0d8b0' },
  { id: 'hiver', name: 'Hiver', ground: '#6a5a50', grass: '#dfe9ee', sky: '#d6e2ec' },
];

// grow : secondes pour mûrir en saison ; seasons : saisons où elle pousse bien
export const CROPS = {
  radis: { name: 'Radis', seed: 2, price: 5, grow: 20, xp: 1, level: 1, seasons: ['printemps', 'automne'], color: '#ff5d8f' },
  carotte: { name: 'Carotte', seed: 5, price: 13, grow: 45, xp: 2, level: 1, seasons: ['printemps', 'ete', 'automne'], color: '#ff8a2b' },
  salade: { name: 'Salade', seed: 4, price: 10, grow: 30, xp: 2, level: 2, seasons: ['printemps', 'automne'], color: '#7fd35a' },
  tomate: { name: 'Tomate', seed: 12, price: 32, grow: 90, xp: 4, level: 3, seasons: ['ete'], color: '#e63946' },
  courgette: { name: 'Courgette', seed: 10, price: 26, grow: 70, xp: 3, level: 4, seasons: ['ete'], color: '#3f8a3a' },
  fraise: { name: 'Fraise', seed: 15, price: 40, grow: 60, xp: 4, level: 5, seasons: ['printemps'], color: '#ff3b5c' },
  mais: { name: 'Maïs', seed: 14, price: 38, grow: 100, xp: 5, level: 6, seasons: ['ete', 'automne'], color: '#ffc93c' },
  poireau: { name: 'Poireau', seed: 18, price: 48, grow: 120, xp: 6, level: 7, seasons: ['automne', 'hiver'], color: '#b8e0a0' },
  chou: { name: 'Chou', seed: 20, price: 56, grow: 150, xp: 7, level: 8, seasons: ['hiver'], color: '#a6d8a0' },
  potiron: { name: 'Potiron', seed: 30, price: 92, grow: 240, xp: 10, level: 9, seasons: ['automne'], color: '#f4a261' },
};
export const EGG_PRICE = 6;

export const UPGRADES = {
  arroseur: { name: 'Arroseur', desc: 'Toutes les parcelles restent arrosées.', cost: 300, level: 3, max: 1 },
  etal: { name: 'Étal au marché', desc: 'Vend le panier tout seul, toutes les 30 s, à 85 % du prix.', cost: 1500, level: 5, max: 1 },
  poule: { name: 'Poule', desc: 'Pond un œuf toutes les 30 s, même quand tu n’es pas là.', cost: 500, level: 4, max: 8, grow: 1.6 },
  serre: { name: 'Serre', desc: 'Les cultures hors saison poussent à pleine vitesse.', cost: 4000, level: 6, max: 1 },
  aide: { name: 'Aide jardinier', desc: 'Récolte et ressème seul ce qui est mûr.', cost: 12000, level: 8, max: 1 },
};
export const upgradeCost = (s, id) => Math.round(UPGRADES[id].cost * (UPGRADES[id].grow ?? 1) ** (s.up[id] ?? 0));

export const START_PLOTS = 9;
export const MAX_PLOTS = 25;
export const plotCost = (s) => Math.round(60 * 1.38 ** (s.plots.length - START_PLOTS));

const WATER_TIME = 45;
const WATER_BOOST = 1.6;
const OFF_SEASON = 0.4;
const OFF_PRICE = 1.5;
export const OFFLINE_CAP = 6 * 3600;
// Sans toi, le potager tourne au ralenti : moitié moins vite
export const OFFLINE_RATE = 0.5;
const XP_FOR = (lvl) => Math.round(30 * lvl ** 1.8);

export function createState() {
  return {
    coins: 30,
    total: 0,
    xp: 0,
    level: 1,
    time: 0, // secondes de jeu (saisons)
    plots: Array.from({ length: START_PLOTS }, () => ({ crop: null, p: 0, wet: 0 })),
    basket: {},
    eggs: 0,
    eggT: 0,
    up: { arroseur: 0, etal: 0, poule: 0, serre: 0, aide: 0 },
    orders: [],
    orderT: 5,
    etalT: 30,
    seasonsSeen: 0,
    stats: { harvests: 0, orders: 0, sold: 0, planted: 0 },
    lastSeen: Date.now(),
  };
}

export const seasonIndex = (s) => Math.floor(s.time / SEASON_LEN) % 4;
export const season = (s) => SEASONS[seasonIndex(s)];
export const seasonLeft = (s) => SEASON_LEN - (s.time % SEASON_LEN);
export const inSeason = (crop, s) => CROPS[crop].seasons.includes(season(s).id);
export const priceOf = (crop, s) => Math.round(CROPS[crop].price * (inSeason(crop, s) ? 1 : OFF_PRICE));
export const xpNeeded = (s) => XP_FOR(s.level);
export const unlockedCrops = (s) => Object.keys(CROPS).filter((c) => CROPS[c].level <= s.level);
export const growMult = (s, plot) => (inSeason(plot.crop, s) || s.up.serre ? 1 : OFF_SEASON) * (plot.wet > 0 || s.up.arroseur ? WATER_BOOST : 1);
export const basketValue = (s) => Object.entries(s.basket).reduce((t, [c, n]) => t + priceOf(c, s) * n, 0);

function earn(s, v) {
  s.coins += v;
  s.total += v;
}
function gainXp(s, n, events) {
  s.xp += n;
  while (s.xp >= xpNeeded(s)) {
    s.xp -= xpNeeded(s);
    s.level++;
    events.push({ type: 'level', level: s.level });
  }
}

// ---------- Actions ----------
export function plant(s, i, crop) {
  const pl = s.plots[i];
  const C = CROPS[crop];
  if (!pl || pl.crop || !C || C.level > s.level || s.coins < C.seed) return false;
  s.coins -= C.seed;
  Object.assign(pl, { crop, p: 0, wet: s.up.arroseur ? 0 : pl.wet });
  s.stats.planted++;
  return true;
}
export function water(s, i) {
  const pl = s.plots[i];
  if (!pl?.crop || pl.p >= 1) return false;
  pl.wet = WATER_TIME;
  return true;
}
export function harvest(s, i, events = []) {
  const pl = s.plots[i];
  if (!pl?.crop || pl.p < 1) return null;
  const crop = pl.crop;
  s.basket[crop] = (s.basket[crop] ?? 0) + 1;
  s.stats.harvests++;
  gainXp(s, CROPS[crop].xp, events);
  Object.assign(pl, { crop: null, p: 0 });
  return crop;
}
export function sellAll(s, rate = 1) {
  let v = 0;
  for (const [c, n] of Object.entries(s.basket)) v += priceOf(c, s) * n;
  v = Math.round(v * rate + s.eggs * EGG_PRICE * rate);
  const count = Object.values(s.basket).reduce((a, b) => a + b, 0) + s.eggs;
  s.basket = {};
  s.eggs = 0;
  earn(s, v);
  s.stats.sold += count;
  return { v, count };
}
export function sellOne(s, crop) {
  if (!s.basket[crop]) return 0;
  const v = priceOf(crop, s) * s.basket[crop];
  s.stats.sold += s.basket[crop];
  delete s.basket[crop];
  earn(s, v);
  return v;
}
export const canDeliver = (s, o) => Object.entries(o.items).every(([c, n]) => (s.basket[c] ?? 0) >= n);
export function deliver(s, k, events = []) {
  const o = s.orders[k];
  if (!o || !canDeliver(s, o)) return false;
  for (const [c, n] of Object.entries(o.items)) {
    s.basket[c] -= n;
    if (!s.basket[c]) delete s.basket[c];
  }
  earn(s, o.reward);
  gainXp(s, o.xp, events);
  s.orders.splice(k, 1);
  s.stats.orders++;
  return true;
}
export function buyPlot(s) {
  if (s.plots.length >= MAX_PLOTS || s.coins < plotCost(s)) return false;
  s.coins -= plotCost(s);
  s.plots.push({ crop: null, p: 0, wet: 0 });
  return true;
}
export function buyUpgrade(s, id) {
  const U = UPGRADES[id];
  const cost = upgradeCost(s, id);
  if (!U || (s.up[id] ?? 0) >= U.max || U.level > s.level || s.coins < cost) return false;
  s.coins -= cost;
  s.up[id] = (s.up[id] ?? 0) + 1;
  return true;
}

// Commandes : deux ou trois cultures connues, payées 60 % au-dessus du marché
function newOrder(s, rng) {
  const pool = unlockedCrops(s);
  const kinds = Math.min(pool.length, 1 + Math.floor(rng() * Math.min(3, 1 + s.level / 3)));
  const picks = [...pool].sort(() => rng() - 0.5).slice(0, kinds);
  const items = {};
  let value = 0;
  for (const c of picks) {
    const n = 2 + Math.floor(rng() * (2 + s.level));
    items[c] = n;
    value += CROPS[c].price * n;
  }
  const who = ['La cantine', 'Le chef du bistrot', 'Mamie Jeanne', 'La crèche', 'Le marché bio', 'L’épicier', 'La fête du village'][Math.floor(rng() * 7)];
  return { who, items, reward: Math.round(value * 1.6), xp: Math.round(value / 8) };
}

// ---------- Temps ----------
export function tick(s, dt, rng = Math.random, events = []) {
  const prevSeason = seasonIndex(s);
  s.time += dt;
  if (seasonIndex(s) !== prevSeason) {
    s.seasonsSeen++;
    events.push({ type: 'season', season: season(s) });
  }
  for (let i = 0; i < s.plots.length; i++) {
    const pl = s.plots[i];
    if (!pl.crop) continue;
    pl.wet = Math.max(0, pl.wet - dt);
    if (pl.p < 1) {
      pl.p = Math.min(1, pl.p + (dt / CROPS[pl.crop].grow) * growMult(s, pl));
      if (pl.p >= 1) events.push({ type: 'ripe', i });
    }
    // Aide jardinier : récolte et ressème la même chose
    if (s.up.aide && pl.p >= 1) {
      const crop = harvest(s, i, events);
      events.push({ type: 'auto-harvest', i, crop });
      plant(s, i, crop);
    }
  }
  // Poules
  if (s.up.poule) {
    s.eggT += dt;
    while (s.eggT >= 30) {
      s.eggT -= 30;
      s.eggs = Math.min(s.eggs + s.up.poule, 40 * s.up.poule);
    }
  }
  // Étal
  if (s.up.etal) {
    s.etalT -= dt;
    if (s.etalT <= 0) {
      s.etalT = 30;
      if (Object.keys(s.basket).length || s.eggs) {
        const r = sellAll(s, 0.85);
        if (r.v) events.push({ type: 'etal', ...r });
      }
    }
  }
  // Commandes
  s.orderT -= dt;
  if (s.orderT <= 0) {
    s.orderT = 75;
    if (s.orders.length < 3) {
      s.orders.push(newOrder(s, rng));
      events.push({ type: 'order' });
    }
  }
  return events;
}

/** Absence : on rejoue le temps par pas de 10 s (plafonné), et on résume ce qui s'est passé */
export function offline(s, seconds, rng = Math.random) {
  const sec = Math.min(OFFLINE_CAP, Math.max(0, seconds));
  const before = { coins: s.coins, harvests: s.stats.harvests, eggs: s.eggs, ripe: s.plots.filter((p) => p.crop && p.p >= 1).length };
  const events = [];
  const run = sec * OFFLINE_RATE;
  for (let t = 0; t < run; t += 10) tick(s, Math.min(10, run - t), rng, events);
  return {
    seconds: sec,
    capped: seconds > OFFLINE_CAP,
    coins: s.coins - before.coins,
    harvests: s.stats.harvests - before.harvests,
    eggs: s.eggs - before.eggs,
    ripe: s.plots.filter((p) => p.crop && p.p >= 1).length,
    seasons: events.filter((e) => e.type === 'season').length,
    levels: events.filter((e) => e.type === 'level').length,
  };
}
