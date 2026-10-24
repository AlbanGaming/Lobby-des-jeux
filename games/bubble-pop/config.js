// Bubble Pop — réglages, couleurs, bulles spéciales, styles et modes.

export const WORLD_H = 640;

export const ROUND = 60; // secondes en mode Chrono
export const FRENZY = 10; // dernières secondes : points ×2

// Cinq couleurs, chacune avec un motif pour rester lisible sans distinguer les couleurs
export const COLORS = [
  { id: 'jaune', fill: '#ffc93c', deep: '#c98f00', glyph: 'dot' },
  { id: 'rouge', fill: '#ff5a4e', deep: '#b8281f', glyph: 'tri' },
  { id: 'vert', fill: '#3ee6a8', deep: '#13996a', glyph: 'square' },
  { id: 'bleu', fill: '#4cc3ff', deep: '#1a7fb8', glyph: 'ring' },
  { id: 'violet', fill: '#a68bff', deep: '#6a4fd1', glyph: 'diamond' },
];

export const SPECIALS = {
  bomb: { weight: 3, r: 24 },
  clock: { weight: 3, r: 22 },
  prism: { weight: 2, r: 24 },
  urchin: { weight: 4, r: 22 },
};

export const SCORE = {
  base: 10, // par bulle
  chainBonus: 0.5, // chaque bulle de plus dans la grappe vaut +50 %
  justInTime: 30,
  comboWindow: 1.1, // secondes pour enchaîner
  maxCombo: 8,
  escapePenalty: 2, // secondes perdues par bulle échappée (Chrono)
  urchinPenalty: 5,
  clockBonus: 3,
};

export const MODES = {
  chrono: { id: 'chrono', label: 'Chrono', unlock: 0 },
  zen: { id: 'zen', label: 'Zen', unlock: 3000, lives: 5 },
};

// Styles de bulles, débloqués par le record
export const STYLES = [
  { id: 'lagon', name: 'Lagon', unlock: 0 },
  { id: 'savon', name: 'Savon', unlock: 2500, sheen: true },
  { id: 'bonbon', name: 'Bonbon', unlock: 6000, stripes: true },
  { id: 'neon', name: 'Néon', unlock: 10000, neon: true },
];

export const MUSIC = {
  bpm: 112,
  tracks: [
    { type: 'triangle', volume: 0.2, length: 0.9, notes: ['E2', null, 'E3', null, 'B2', null, 'E3', null, 'C3', null, 'G3', null, 'D3', null, 'A3', null] },
    { type: 'sine', volume: 0.09, length: 0.5, notes: ['B4', 'E5', 'G5', 'E5', 'B4', 'E5', 'G5', 'B5', 'C5', 'E5', 'G5', 'E5', 'D5', 'F#5', 'A5', 'F#5'] },
    { drum: 'kick', volume: 0.24, pattern: 'x.....x...x.....' },
    { drum: 'hat', volume: 0.14, pattern: '..x...x...x...x.' },
  ],
};
