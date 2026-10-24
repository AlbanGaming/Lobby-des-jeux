// Volt Rush — réglages, couleurs, modes et déblocages.

// Monde : bande jouable de 360 unités de haut, y vers le bas. 20 unités = 1 mètre.
export const WORLD_H = 360;
export const UNITS_PER_M = 20;
export const PLAYER_X = 120; // position du joueur depuis le bord gauche de l'écran

export const PHYS = {
  gravity: 2700,
  jumpV: 860, // hauteur max ≈ v² / 2g ≈ 137
  doubleJumpV: 760,
  jumpCut: 0.45, // relâcher tôt = saut plus court
  fastFallV: 1100,
  coyote: 0.09,
  buffer: 0.13,
  slideTime: 0.55,
};

export const PLAYER = { w: 34, h: 38, slideH: 20, hitInset: 6 };

export const MODES = {
  normal: { id: 'normal', label: 'Normal', startSpeed: 330, maxSpeed: 760, scoreMul: 1, unlock: 0 },
  turbo: { id: 'turbo', label: 'Turbo', startSpeed: 500, maxSpeed: 860, scoreMul: 1.5, unlock: 2500 },
};

// Couleurs de Volt, débloquées par le meilleur score
export const SKINS = [
  { id: 'jeton', name: 'Jeton', body: '#ffc93c', deep: '#c98f00', eye: '#3ee6a8', unlock: 0 },
  { id: 'menthe', name: 'Menthe', body: '#3ee6a8', deep: '#13996a', eye: '#ffc93c', unlock: 1000 },
  { id: 'tomate', name: 'Tomate', body: '#ff5a4e', deep: '#b8281f', eye: '#ffc93c', unlock: 2500 },
  { id: 'ciel', name: 'Ciel', body: '#4cc3ff', deep: '#1a7fb8', eye: '#ff5a4e', unlock: 5000 },
  { id: 'minuit', name: 'Minuit', body: '#3b4266', deep: '#1a1d2e', eye: '#ff5a4e', unlock: 8000, glow: '#4cc3ff' },
  { id: 'or', name: 'Or massif', body: '#e8b04a', deep: '#9a6a12', eye: '#fff6d8', unlock: 12000, shine: true },
];

export const SCORE = {
  perMeter: 1,
  bolt: 5,
  battery: 25,
  nearMiss: 25,
  smash: 50,
  maxMult: 5,
  chainTime: 2.6, // secondes pour enchaîner avant que le multiplicateur retombe
  chainPerLevel: 8, // points de chaîne pour gagner un cran de multiplicateur
};

export const SURGE = {
  perBolt: 0.05,
  perBattery: 0.34,
  perNearMiss: 0.1,
  duration: 5,
  speedBoost: 1.22,
  magnet: 150,
};

// Palette de la ville : crépuscule → nuit au fil de la course
// Perspective atmosphérique : plus c'est loin, plus c'est clair et proche du ciel ;
// les toits jouables sont les plus sombres et les plus contrastés.
export const SKY = [
  { at: 0, top: '#1d1436', mid: '#4a2242', low: '#e0643e', far: '#7a3a58', near: '#4a2650', star: 0.25 },
  { at: 900, top: '#130f2c', mid: '#352046', low: '#9a3d4c', far: '#4e2a54', near: '#33204a', star: 0.6 },
  { at: 1900, top: '#070912', mid: '#111a33', low: '#2a3d66', far: '#25355a', near: '#1a2442', star: 1 },
];

export const MUSIC = {
  bpm: 132,
  tracks: [
    { type: 'triangle', volume: 0.22, length: 0.9, notes: ['A2', null, 'A2', null, 'C3', null, 'A2', null, 'G2', null, 'G2', null, 'E2', null, 'G2', null] },
    { type: 'square', volume: 0.06, length: 0.5, filter: 2400, notes: ['A4', 'C5', 'E5', 'C5', 'A4', 'C5', 'E5', 'C5', 'G4', 'B4', 'D5', 'B4', 'G4', 'B4', 'E5', 'B4'] },
    { drum: 'kick', volume: 0.32, pattern: 'x...x...x...x...' },
    { drum: 'hat', volume: 0.22, pattern: '..x...x...x...xx' },
    { drum: 'snare', volume: 0.2, pattern: '....x.......x...' },
  ],
};
