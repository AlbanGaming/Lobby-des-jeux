// Migration des sauvegardes de l'ancien GameVerse vers le format `gv:meta`.
// Les anciennes clés ne sont jamais supprimées : chaque jeu refait relit la sienne
// (playerData, artEmpireSave…) au premier lancement via sa propre migration.

import { readJSON, readRaw } from './storage.js';
import { LEGACY_IDS, getGame } from '../../games/registry.js';

const newGame = () => ({ plays: 0, timeMs: 0, best: null, lastPlayed: 0, xp: 0 });

// Records des anciens jeux d'arcade (clé → id)
const LEGACY_BESTS = [
  ['volt-rush', 'dinoHighScore'],
  ['plume', 'flappyBestScore'],
];

export function migrateLegacy(data) {
  const old = readJSON('gameverse_user_data');
  if (old && typeof old === 'object') {
    const name = typeof old.username === 'string' ? old.username.trim() : '';
    if (name && name !== 'PLAYER_1') data.profile.name = name.slice(0, 16);

    // Seul l'avatar importé par le joueur est conservé (les emojis et le GIF sous droits disparaissent)
    if (typeof old.avatar === 'string' && old.avatar.startsWith('data:image/')) {
      data.profile.avatar = { kind: 'image', data: old.avatar };
    }

    if (Array.isArray(old.favorites)) {
      data.favorites = [...new Set(old.favorites.map((n) => LEGACY_IDS[n]).filter(Boolean))];
    }

    // Le temps de jeu de l'ancien lobby était tiré au hasard : on ne garde que le nombre de parties
    if (old.gamesStats && typeof old.gamesStats === 'object') {
      for (const [num, st] of Object.entries(old.gamesStats)) {
        const id = LEGACY_IDS[num];
        if (!id || !st) continue;
        const g = (data.games[id] ??= newGame());
        g.plays = Math.max(g.plays, Number(st.plays) || 0);
      }
    }

    const s = old.settings;
    if (s && typeof s === 'object') {
      if (s.soundEffects === false) data.settings.sound = false;
      if (s.bgMusic === true) data.settings.music = true;
      if (s.animations === false) data.settings.motion = 'reduced';
    }
  }
  syncLegacyBests(data, true);
}

/** Reprend le meilleur score des anciennes clés. Renvoie true si quelque chose a changé. */
export function syncLegacyBests(data, force = false) {
  let changed = false;
  for (const [id, key] of LEGACY_BESTS) {
    if (!force && getGame(id)?.ready) continue;
    const n = parseInt(readRaw(key), 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    const g = (data.games[id] ??= newGame());
    if (g.best === null || n > g.best) {
      g.best = n;
      changed = true;
    }
  }
  return changed;
}
