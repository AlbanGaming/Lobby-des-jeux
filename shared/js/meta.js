// Méta-progression GameVerse, partagée entre le lobby et tous les jeux :
// profil, XP et niveau, crédits, succès, statistiques par jeu, série de jours,
// défi du jour et réglages. Stocké sous `gv:meta`.

import { createStore, writeRaw } from './storage.js';
import { dayKey, daysBetween, createRng, dailySeed } from './core/rng.js';
import { GAMES, getGame } from '../../games/registry.js';
import { migrateLegacy, syncLegacyBests } from './migrate-legacy.js';
import { motion } from './motion.js';

const DEFAULTS = {
  profile: {
    name: 'JOUEUR',
    // { kind: 'gen', seed, palette } (avatar généré) ou { kind: 'image', data } (image importée)
    avatar: null,
    createdAt: 0,
  },
  xp: 0,
  credits: 0,
  games: {},
  favorites: [],
  achievements: {},
  records: 0,
  streak: { count: 0, best: 0, last: '' },
  daily: { day: '', done: false },
  dailyWins: 0,
  stats: { runs: 0, timeMs: 0, days: 0, firstDay: '' },
  owned: [],
  settings: { sound: true, music: false, volume: 0.8, motion: 'system' },
  migratedLegacy: false,
};

const GAME_DEFAULTS = { plays: 0, timeMs: 0, best: null, lastPlayed: 0, xp: 0 };

// ---------- Succès globaux ----------
export const GLOBAL_ACHIEVEMENTS = [
  { id: 'premiers-pas', title: 'Premiers pas', desc: 'Termine ta première partie.', xp: 50 },
  { id: 'curieux', title: 'Curieux', desc: 'Essaie 5 jeux différents.', xp: 120 },
  { id: 'explorateur', title: 'Explorateur', desc: 'Essaie tous les jeux de GameVerse.', xp: 400 },
  { id: 'habitue', title: 'Habitué', desc: 'Joue 50 parties.', xp: 150 },
  { id: 'accro', title: 'Inarrêtable', desc: 'Joue 250 parties.', xp: 500 },
  { id: 'serie-3', title: 'Trois jours de suite', desc: 'Joue 3 jours d’affilée.', xp: 100 },
  { id: 'serie-7', title: 'Semaine parfaite', desc: 'Joue 7 jours d’affilée.', xp: 300 },
  { id: 'serie-30', title: 'Fidèle au poste', desc: 'Joue 30 jours d’affilée.', xp: 1200 },
  { id: 'niveau-5', title: 'Niveau 5', desc: 'Atteins le niveau 5.', xp: 0 },
  { id: 'niveau-10', title: 'Niveau 10', desc: 'Atteins le niveau 10.', xp: 0 },
  { id: 'niveau-25', title: 'Niveau 25', desc: 'Atteins le niveau 25.', xp: 0 },
  { id: 'defi-1', title: 'Défi relevé', desc: 'Réussis un défi du jour.', xp: 100 },
  { id: 'defi-10', title: 'Habitué des défis', desc: 'Réussis 10 défis du jour.', xp: 400 },
  { id: 'records-10', title: 'Chasseur de records', desc: 'Bats 10 fois un record personnel.', xp: 200 },
  { id: 'collection-25', title: 'Collectionneur', desc: 'Débloque 25 succès.', xp: 300 },
];

export function allAchievements() {
  const list = GLOBAL_ACHIEVEMENTS.map((a) => ({ ...a, scope: 'global', key: `global:${a.id}` }));
  for (const g of GAMES) {
    for (const a of g.achievements ?? []) list.push({ ...a, scope: g.id, key: `${g.id}:${a.id}` });
  }
  return list;
}

// ---------- Niveaux ----------
export const xpForNext = (level) => Math.round(100 * Math.pow(level, 1.35));

export function levelInfo(xp) {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= xpForNext(level)) {
    rest -= xpForNext(level);
    level++;
  }
  const needed = xpForNext(level);
  return { level, into: rest, needed, progress: rest / needed };
}

// ---------- Évènements ----------
export const events = new EventTarget();
const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));

// ---------- Chargement ----------
const store = createStore('meta', {
  version: 1,
  defaults: DEFAULTS,
  migrate: (data) => data ?? {},
});

if (!store.data.migratedLegacy) {
  migrateLegacy(store.data);
  store.data.migratedLegacy = true;
  store.save();
} else if (syncLegacyBests(store.data)) {
  // Les anciennes pages encore en ligne écrivent toujours leurs records dans les vieilles clés
  store.save();
}
if (!store.data.profile.createdAt) {
  store.data.profile.createdAt = Date.now();
  store.save();
}
if (!store.data.profile.avatar) {
  store.data.profile.avatar = { kind: 'gen', seed: Math.random().toString(36).slice(2, 10), palette: 0 };
  store.save();
}

motion.setPreference(store.data.settings.motion);

// Synchronisation entre onglets (lobby ouvert pendant qu'on joue ailleurs)
window.addEventListener('storage', (e) => {
  if (e.key === store.key) {
    store.reload();
    motion.setPreference(store.data.settings.motion);
    emit('change', store.data);
    emit('settings', store.data.settings);
  }
});

export function getData() {
  return store.data;
}

export function save() {
  store.save();
  emit('change', store.data);
}

export function gameStats(id) {
  const g = (store.data.games[id] ??= { ...GAME_DEFAULTS });
  for (const k in GAME_DEFAULTS) if (g[k] === undefined) g[k] = GAME_DEFAULTS[k];
  return g;
}

// ---------- Réglages ----------
export function getSettings() {
  return store.data.settings;
}

export function setSetting(key, value) {
  store.data.settings[key] = value;
  if (key === 'motion') motion.setPreference(value);
  save();
  emit('settings', store.data.settings);
}

// ---------- Profil ----------
export function setProfile(patch) {
  Object.assign(store.data.profile, patch);
  save();
}

export function toggleFavorite(id) {
  const favs = store.data.favorites;
  const i = favs.indexOf(id);
  if (i >= 0) favs.splice(i, 1);
  else favs.unshift(id);
  save();
  return i < 0;
}

export const isFavorite = (id) => store.data.favorites.includes(id);

// ---------- Série de jours ----------
function touchDay() {
  const today = dayKey();
  const s = store.data.streak;
  if (s.last === today) return false;
  const gap = s.last ? daysBetween(s.last, today) : Infinity;
  s.count = gap === 1 ? s.count + 1 : 1;
  s.best = Math.max(s.best, s.count);
  s.last = today;
  store.data.stats.days++;
  if (!store.data.stats.firstDay) store.data.stats.firstDay = today;
  return true;
}

// La série est-elle toujours vivante (jouée hier ou aujourd'hui) ?
export function currentStreak() {
  const s = store.data.streak;
  if (!s.last) return 0;
  return daysBetween(s.last, dayKey()) <= 1 ? s.count : 0;
}

// ---------- Défi du jour ----------
export function dailyChallenge(date = new Date()) {
  const pool = [];
  for (const g of GAMES) {
    if (!g.ready) continue;
    for (const d of g.daily ?? []) pool.push({ ...d, gameId: g.id });
  }
  if (!pool.length) return null;
  const rng = createRng(dailySeed('defi', date));
  const pick = rng.pick(pool);
  const day = dayKey(date);
  return {
    ...pick,
    day,
    done: store.data.daily.day === day && store.data.daily.done,
    reward: { xp: 150, credits: 40 },
  };
}

// ---------- XP, crédits, succès ----------
export function addXP(amount) {
  if (!amount) return null;
  const before = levelInfo(store.data.xp).level;
  store.data.xp += Math.round(amount);
  const after = levelInfo(store.data.xp).level;
  if (after > before) {
    store.data.credits += 25 * (after - before);
    emit('levelup', { level: after, from: before });
    if (after >= 5) unlockAchievement('global', 'niveau-5', { silentSave: true });
    if (after >= 10) unlockAchievement('global', 'niveau-10', { silentSave: true });
    if (after >= 25) unlockAchievement('global', 'niveau-25', { silentSave: true });
  }
  return { before, after };
}

export function addCredits(n) {
  store.data.credits = Math.max(0, store.data.credits + Math.round(n));
  save();
}

export function spendCredits(n) {
  if (store.data.credits < n) return false;
  store.data.credits -= n;
  save();
  return true;
}

export const hasAchievement = (scope, id) => !!store.data.achievements[`${scope}:${id}`];

/** Débloque un succès (scope = 'global' ou id de jeu). Renvoie true s'il est nouveau. */
export function unlockAchievement(scope, id, { silentSave = false } = {}) {
  const key = `${scope}:${id}`;
  if (store.data.achievements[key]) return false;
  const def = scope === 'global' ? GLOBAL_ACHIEVEMENTS.find((a) => a.id === id) : getGame(scope)?.achievements?.find((a) => a.id === id);
  if (!def) {
    console.warn(`[gv] succès inconnu : ${key}`);
    return false;
  }
  store.data.achievements[key] = Date.now();
  store.data.credits += Math.round((def.xp ?? 0) / 4) + 10;
  emit('achievement', { ...def, scope, key });
  addXP(def.xp ?? 0);
  const count = Object.keys(store.data.achievements).length;
  if (count >= 25 && key !== 'global:collection-25') unlockAchievement('global', 'collection-25', { silentSave: true });
  if (!silentSave) save();
  return true;
}

// ---------- Parties ----------
/** À appeler au lancement de chaque partie. */
export function startRun(id) {
  const g = gameStats(id);
  g.plays++;
  g.lastPlayed = Date.now();
  store.data.stats.runs++;
  touchDay();
  const streak = store.data.streak.count;
  if (streak >= 3) unlockAchievement('global', 'serie-3', { silentSave: true });
  if (streak >= 7) unlockAchievement('global', 'serie-7', { silentSave: true });
  if (streak >= 30) unlockAchievement('global', 'serie-30', { silentSave: true });
  save();
}

/** Temps de jeu actif (hors pause et onglet caché). */
export function addPlayTime(id, ms) {
  if (ms <= 0) return;
  gameStats(id).timeMs += ms;
  store.data.stats.timeMs += ms;
  store.saveSoon(800);
}

/**
 * Fin de partie : met à jour le record, calcule l'XP et les crédits, vérifie le défi du jour.
 * result = { score, stats: { ... }, xp? }
 */
export function reportRun(id, result) {
  const game = getGame(id);
  const g = gameStats(id);
  const higher = game?.score?.higherIsBetter !== false;
  const score = Number(result.score) || 0;
  const prevBest = g.best;
  const isRecord = prevBest === null ? score > 0 : higher ? score > prevBest : score < prevBest;
  if (isRecord) {
    g.best = score;
    if (prevBest !== null) store.data.records++;
  }

  const levelBefore = levelInfo(store.data.xp);
  let xp = result.xp ?? (game?.xp ? game.xp({ score, stats: result.stats ?? {} }) : 10);
  if (isRecord && prevBest !== null) xp = Math.round(xp * 1.25);
  g.xp += xp;
  addXP(xp);
  const credits = Math.max(1, Math.round(xp / 6)) + (isRecord && prevBest !== null ? 5 : 0);
  store.data.credits += credits;

  // Défi du jour
  let daily = null;
  const ch = dailyChallenge();
  if (ch && ch.gameId === id && !ch.done) {
    const value = ch.stat ? result.stats?.[ch.stat] : score;
    if (Number(value) >= ch.min) {
      store.data.daily = { day: ch.day, done: true };
      store.data.dailyWins++;
      store.data.credits += ch.reward.credits;
      addXP(ch.reward.xp);
      daily = ch;
      emit('daily', ch);
      unlockAchievement('global', 'defi-1', { silentSave: true });
      if (store.data.dailyWins >= 10) unlockAchievement('global', 'defi-10', { silentSave: true });
    }
  }

  // Succès globaux
  unlockAchievement('global', 'premiers-pas', { silentSave: true });
  const tried = GAMES.filter((x) => (store.data.games[x.id]?.plays ?? 0) > 0).length;
  if (tried >= 5) unlockAchievement('global', 'curieux', { silentSave: true });
  if (tried >= GAMES.length) unlockAchievement('global', 'explorateur', { silentSave: true });
  if (store.data.stats.runs >= 50) unlockAchievement('global', 'habitue', { silentSave: true });
  if (store.data.stats.runs >= 250) unlockAchievement('global', 'accro', { silentSave: true });
  if (store.data.records >= 10) unlockAchievement('global', 'records-10', { silentSave: true });

  save();
  return {
    score,
    best: g.best,
    prevBest,
    isRecord,
    xp,
    credits,
    daily,
    levelBefore,
    levelAfter: levelInfo(store.data.xp),
  };
}

// Pour les jeux sans « partie » (idle, gestion) : enregistre un nouveau meilleur score.
export function submitBest(id, score) {
  const g = gameStats(id);
  const higher = getGame(id)?.score?.higherIsBetter !== false;
  if (g.best === null || (higher ? score > g.best : score < g.best)) {
    g.best = score;
    store.saveSoon();
    return true;
  }
  return false;
}

// ---------- Données : export / import / réinitialisation ----------
export function exportAll() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('gv:')) out[k] = localStorage.getItem(k);
    }
  } catch {
    out[store.key] = JSON.stringify({ v: store.version, data: store.data });
  }
  return { app: 'gameverse', version: 1, exportedAt: new Date().toISOString(), data: out };
}

export function importAll(payload) {
  if (!payload || payload.app !== 'gameverse' || typeof payload.data !== 'object') {
    throw new Error('Fichier de sauvegarde GameVerse invalide.');
  }
  for (const [k, v] of Object.entries(payload.data)) {
    if (k.startsWith('gv:') && typeof v === 'string') writeRaw(k, v);
  }
  store.reload();
  motion.setPreference(store.data.settings.motion);
  emit('change', store.data);
}

export function resetAll() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('gv:')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* stockage indisponible : on réinitialise la mémoire seulement */
  }
  store.reset();
  store.data.migratedLegacy = true; // ne pas réimporter les anciennes données
  store.data.profile.createdAt = Date.now();
  store.save();
  motion.setPreference(store.data.settings.motion);
  emit('change', store.data);
}
