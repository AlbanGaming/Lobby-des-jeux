// Motif — dictionnaires (chargés à la demande), notation, mot du jour.

import { createRng, dayKey, daysBetween } from '../../shared/js/core/rng.js';

export const MAX_GUESSES = 6;
const cache = new Map();

/** Dictionnaire des mots valides d'une longueur (Set), chargé une seule fois. */
export function loadDictionary(n) {
  if (!cache.has(n)) {
    cache.set(
      n,
      fetch(`data/valid-${n}.json`).then((r) => {
        if (!r.ok) throw new Error(`Dictionnaire ${n} lettres introuvable`);
        return r.json().then((list) => new Set(list));
      }),
    );
  }
  return cache.get(n);
}

let targetsPromise = null;
export function loadTargets() {
  targetsPromise ??= fetch('data/targets.json').then((r) => r.json());
  return targetsPromise;
}

/** « Été » → « ETE » : le clavier n'a pas d'accents, le dictionnaire non plus. */
export const normalize = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z]/g, '');

/** Notation avec doublons : d'abord les bien placées, puis les présentes dans la limite des restantes. */
export function grade(target, guess) {
  const res = Array(target.length).fill('absent');
  const left = {};
  for (let i = 0; i < target.length; i++) {
    if (guess[i] === target[i]) res[i] = 'correct';
    else left[target[i]] = (left[target[i]] ?? 0) + 1;
  }
  for (let i = 0; i < target.length; i++) {
    if (res[i] === 'correct') continue;
    if (left[guess[i]] > 0) {
      res[i] = 'present';
      left[guess[i]]--;
    }
  }
  return res;
}

const RANK = { absent: 1, present: 2, correct: 3 };
/** État des touches du clavier : on garde la meilleure information connue. */
export function keyStates(rows) {
  const out = {};
  for (const { guess, result } of rows) {
    for (let i = 0; i < guess.length; i++) {
      const prev = out[guess[i]];
      if (!prev || RANK[result[i]] > RANK[prev]) out[guess[i]] = result[i];
    }
  }
  return out;
}

/** Mot du jour : chaque mot de 5 lettres revient une fois par cycle, dans un ordre mélangé fixe. */
export const EPOCH = '2026-01-01';
export function dailyIndex(date = new Date()) {
  return daysBetween(EPOCH, dayKey(date)) + 1;
}
export function dailyWord(targets5, date = new Date()) {
  const order = createRng('motif-ordre-v1').shuffle(targets5);
  const i = ((dailyIndex(date) - 1) % order.length + order.length) % order.length;
  return order[i];
}

/** Texte à partager (sans révéler le mot). */
export function shareText(rows, won, index) {
  const sq = { correct: '🟩', present: '🟨', absent: '⬛' };
  const grid = rows.map((r) => r.result.map((c) => sq[c]).join('')).join('\n');
  return `Motif n°${index} · ${won ? rows.length : 'X'}/${MAX_GUESSES}\n${grid}\nalbangaming.github.io/Lobby-des-jeux`;
}

/** Points d'un mot trouvé en `tries` essais, selon sa longueur. */
export const wordPoints = (tries, len) => Math.round((MAX_GUESSES + 1 - tries) * 60 * (len / 5));
