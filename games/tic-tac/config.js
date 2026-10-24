// Tic Tac — réglages : difficulté, points, modes, cadrans et musique.

export const DIFF = {
  speed0: 1.7, // rad/s au départ (un tour en ~3,7 s)
  speedPerHit: 0.045,
  speedMax: 5.2,
  half0: 0.42, // demi-largeur de la zone (rad)
  halfPerHit: 0.006,
  halfMin: 0.16,
  perfectRatio: 0.28, // part centrale « pile »
  perfectMin: 0.045,
  grace: 0.035, // tolérance « limite » au bord de la zone
  spawnMin: 0.9, // distance d'apparition devant l'aiguille (rad)
  spawnMax: 2.4,
  hitsPerHour: 8,
};

export const SCORE = { hit: 10, perfect: 25, limit: 6, bell: 40, key: 15, hourBonus: 50, comboStep: 6, multMax: 5 };

export const CHRONO = { time: 60, penalty: 3 };

// Nouveautés introduites au fil des heures
export const FEATURES = [
  { hour: 2, id: 'key', text: 'Remontoir : il te sauve une fois' },
  { hour: 3, id: 'bell', text: 'Cloches en prime' },
  { hour: 4, id: 'drift', text: 'Les zones se déplacent' },
  { hour: 6, id: 'wobble', text: 'L’aiguille s’emballe' },
  { hour: 8, id: 'blink', text: 'Zones fantômes' },
];

export const MODES = {
  classique: { id: 'classique', label: 'Classique', hint: 'Une erreur et c’est fini', unlock: 0 },
  chrono: { id: 'chrono', label: 'Chrono', hint: '60 s · une erreur coûte 3 s', unlock: 1500 },
  jour: { id: 'jour', label: 'Cadran du jour', hint: 'Les mêmes zones pour tous', unlock: 0 },
};

// Cadrans, débloqués par le record
export const DIALS = [
  { id: 'atelier', name: 'Atelier', unlock: 0, bezel: '#13996a', deep: '#0b5a40', face: '#f4efe4', ink: '#11131f', hand: '#ff5a4e', zone: '#3ee6a8', zoneDeep: '#13996a' },
  { id: 'gousset', name: 'Gousset', unlock: 800, bezel: '#e0b04a', deep: '#8a6418', face: '#fff6dd', ink: '#2a1d00', hand: '#11131f', zone: '#3ee6a8', zoneDeep: '#13996a' },
  { id: 'coucou', name: 'Coucou', unlock: 2000, bezel: '#a8673a', deep: '#5e3519', face: '#f2e2c4', ink: '#2a160a', hand: '#c0392b', zone: '#7bd389', zoneDeep: '#3d8a4b' },
  { id: 'neon', name: 'Néon', unlock: 4000, bezel: '#4cc3ff', deep: '#123a5c', face: '#0d1424', ink: '#cfe8ff', hand: '#ff4fd8', zone: '#3ee6a8', zoneDeep: '#0b8a63' },
  { id: 'marbre', name: 'Marbre', unlock: 7000, bezel: '#d9d4cc', deep: '#8a847a', face: '#fbfaf7', ink: '#2b2b33', hand: '#2d6cdf', zone: '#3ee6a8', zoneDeep: '#13996a' },
];

export const MUSIC = {
  bpm: 120,
  tracks: [
    { type: 'triangle', volume: 0.15, length: 0.7, notes: ['A2', null, null, null, 'E3', null, null, null, 'F2', null, null, null, 'G2', null, 'B2', null] },
    { type: 'sine', volume: 0.07, length: 0.35, notes: ['E5', null, 'A5', null, 'C6', null, 'A5', null, 'D5', null, 'F5', null, 'B5', null, 'G5', null] },
    { drum: 'hat', volume: 0.12, pattern: 'x.x.x.x.x.x.x.x.' },
    { drum: 'kick', volume: 0.16, pattern: 'x.......x.......' },
  ],
};
