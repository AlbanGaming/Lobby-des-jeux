// Plume — réglages, chapitres du livre pop-up, papiers et modes.

// Monde : 600 unités de haut, sol à 560. L'oiseau vole à x = BIRD_X depuis le bord gauche.
export const WORLD_H = 600;
export const GROUND = 556;
export const BIRD_X = 150;
export const BIRD_R = 14;

export const PHYS = {
  gravity: 1550,
  flapV: 470,
  maxFall: 720,
};

export const GATE = {
  width: 74,
  gapStart: 200,
  gapMin: 150,
  spacingStart: 320,
  spacingMin: 265,
  perChapter: 12, // falaises par chapitre
  perfectBand: 0.26, // fraction de la demi-ouverture comptée comme « parfait »
  nearMiss: 11,
};

export const SCORE = { gate: 10, perfect: 10, nearMiss: 10, star: 15, maxMult: 5, chainPerLevel: 3 };

// Chaque chapitre a sa palette et son danger
export const CHAPTERS = [
  {
    id: 'aube', name: 'L’aube', n: 1,
    sky: ['#ffe9cf', '#ffc59c'], sun: '#fff6e8',
    hills: ['#ffb48a', '#f59a74'], cliff: ['#e2693f', '#c4532a', '#ff8a5b'], shadow: '#8a3420',
    ground: ['#c4532a', '#e2693f'], ink: '#2a1a14', cloud: '#fff6e8',
  },
  {
    id: 'foret', name: 'La forêt', n: 2, moving: true,
    sky: ['#eef6d8', '#c9e6b4'], sun: '#fffbe8',
    hills: ['#a9d79a', '#86c483'], cliff: ['#3f8f5a', '#2b6b42', '#5fb37a'], shadow: '#1b4a2c',
    ground: ['#2b6b42', '#3f8f5a'], ink: '#14281a', cloud: '#fbfff2',
  },
  {
    id: 'nuit', name: 'La nuit', n: 3, dark: true,
    sky: ['#1b2a4a', '#2f4a7a'], sun: '#f4efe4',
    hills: ['#26406b', '#1d3357'], cliff: ['#3d5e96', '#2b4675', '#5476b4'], shadow: '#0f1a33',
    ground: ['#1d3357', '#2b4675'], ink: '#0b1324', cloud: '#3d5e96',
  },
  {
    id: 'tempete', name: 'La tempête', n: 4, wind: true,
    sky: ['#9aa7b4', '#6b7987'], sun: '#dfe5ea',
    hills: ['#5f6d7b', '#4f5c69'], cliff: ['#59656f', '#434d56', '#76838f'], shadow: '#262d33',
    ground: ['#434d56', '#59656f'], ink: '#1a1f24', cloud: '#c9d2da',
  },
];

export const MODES = {
  normal: { id: 'normal', label: 'Normal', chapter: 0, scoreMul: 1, unlock: 0 },
  tempete: { id: 'tempete', label: 'Tempête', chapter: 3, scoreMul: 1.5, unlock: 2000 },
};

// Papiers de Plume, débloqués par le record
export const SKINS = [
  { id: 'creme', name: 'Crème', body: '#fff6e8', wing: '#e8d6b8', line: '#2a1a14', unlock: 0 },
  { id: 'corail', name: 'Corail', body: '#ffd0bc', wing: '#ff8a5b', line: '#2a1a14', unlock: 500 },
  { id: 'menthe', name: 'Menthe', body: '#d6f7e8', wing: '#3ee6a8', line: '#032a1c', unlock: 1500 },
  { id: 'journal', name: 'Journal', body: '#f1eee6', wing: '#d9d4c7', line: '#2a2a2a', unlock: 3000, print: true },
  { id: 'etoile', name: 'Nuit étoilée', body: '#2f4a7a', wing: '#1b2a4a', line: '#ffc93c', unlock: 6000, stars: true },
  { id: 'or', name: 'Feuille d’or', body: '#ffe7a3', wing: '#e8b04a', line: '#6a4a08', unlock: 10000, shine: true },
];

export const MUSIC = {
  bpm: 104,
  tracks: [
    { type: 'triangle', volume: 0.2, length: 1.6, notes: ['D3', null, null, null, 'A2', null, null, null, 'B2', null, null, null, 'G2', null, null, null] },
    { type: 'sine', volume: 0.1, length: 0.7, notes: ['F#4', 'A4', 'D5', 'A4', 'E4', 'A4', 'C#5', 'A4', 'F#4', 'B4', 'D5', 'B4', 'D4', 'G4', 'B4', 'G4'] },
    { drum: 'hat', volume: 0.12, pattern: '..x...x...x...x.' },
    { drum: 'kick', volume: 0.18, pattern: 'x.......x.......' },
  ],
};
