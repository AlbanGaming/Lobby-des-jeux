// Donjon de cartes — le contenu : héros, cartes, ennemis, rencontres et reliques.
// Une carte décrit ses effets ; son texte est écrit à partir d'eux (voir describe dans main.js).
//   dmg (× times, all = tous), block, blockDmg (dégâts = armure), vuln, weak, poison (à la
//   cible ou à tous si all), doublePoison, str, thorns, draw, energy, exhaust.
//   Pouvoirs (type 'pow') : strTurn, blockTurn, poisonTurn, energyTurn, drawTurn.
//   up : ce qui change quand la carte est améliorée au feu de camp.

export const HEROES = [
  { id: 'lame', name: 'La Lame', color: '#ff8a5b', hp: 80, relic: 'fiole', desc: 'Frappe fort et gagne de la Force.', how: 'Disponible', starter: 'fendoir' },
  { id: 'ombre', name: 'L’Ombre', color: '#3ee6a8', hp: 70, relic: 'toxine', desc: 'Empoisonne et pioche beaucoup.', how: 'Bats le Golem (1er boss)', starter: 'lame-poison' },
  { id: 'arcane', name: 'L’Arcaniste', color: '#4cc3ff', hp: 72, relic: 'sablier', desc: 'Sorts de zone et énergie en plus.', how: 'Bats l’Hydre (2e boss)', starter: 'etincelle' },
];

export const CARDS = {
  // Communes à tous
  frappe: { name: 'Frappe', cost: 1, type: 'atk', dmg: 6, up: { dmg: 9 } },
  defense: { name: 'Défense', cost: 1, type: 'skl', block: 5, up: { block: 8 } },
  // La Lame
  fendoir: { hero: 'lame', name: 'Fendoir', cost: 2, type: 'atk', dmg: 8, vuln: 2, up: { dmg: 11, vuln: 3 } },
  taillade: { hero: 'lame', name: 'Taillade', cost: 1, type: 'atk', dmg: 4, times: 2, up: { dmg: 6 } },
  'coup-bouclier': { hero: 'lame', name: 'Coup de bouclier', cost: 1, type: 'atk', blockDmg: true, up: { cost: 0 } },
  tourbillon: { hero: 'lame', name: 'Tourbillon', cost: 1, type: 'atk', dmg: 5, all: true, up: { dmg: 8 } },
  'cri-guerre': { hero: 'lame', name: 'Cri de guerre', cost: 0, type: 'skl', str: 2, exhaust: true, up: { str: 3 } },
  rempart: { hero: 'lame', name: 'Rempart', cost: 2, type: 'skl', block: 14, up: { block: 19 } },
  charge: { hero: 'lame', name: 'Charge', cost: 2, type: 'atk', dmg: 14, up: { dmg: 19 } },
  'demon-interieur': { hero: 'lame', name: 'Démon intérieur', cost: 1, type: 'pow', strTurn: 1, up: { cost: 0 } },
  intimidation: { hero: 'lame', name: 'Intimidation', cost: 0, type: 'skl', weak: 1, all: true, exhaust: true, up: { weak: 2 } },
  riposte: { hero: 'lame', name: 'Riposte', cost: 1, type: 'skl', block: 5, thorns: 3, up: { block: 7, thorns: 4 } },
  frenesie: { hero: 'lame', name: 'Frénésie', cost: 1, type: 'atk', dmg: 3, times: 3, up: { dmg: 4 } },
  'second-souffle': { hero: 'lame', name: 'Second souffle', cost: 1, type: 'skl', block: 6, draw: 1, up: { block: 9 } },
  execution: { hero: 'lame', name: 'Exécution', cost: 3, type: 'atk', dmg: 28, up: { dmg: 36 } },
  // L'Ombre
  'lame-poison': { hero: 'ombre', name: 'Lame empoisonnée', cost: 1, type: 'atk', dmg: 3, poison: 3, up: { dmg: 4, poison: 5 } },
  dague: { hero: 'ombre', name: 'Dague', cost: 0, type: 'atk', dmg: 3, up: { dmg: 5 } },
  fiole: { hero: 'ombre', name: 'Fiole de venin', cost: 1, type: 'skl', poison: 5, up: { poison: 7 } },
  'nuage-toxique': { hero: 'ombre', name: 'Nuage toxique', cost: 2, type: 'skl', poison: 4, all: true, up: { poison: 6 } },
  catalyseur: { hero: 'ombre', name: 'Catalyseur', cost: 1, type: 'skl', doublePoison: true, exhaust: true, up: { cost: 0 } },
  esquive: { hero: 'ombre', name: 'Esquive', cost: 1, type: 'skl', block: 8, up: { block: 11 } },
  preparation: { hero: 'ombre', name: 'Préparation', cost: 0, type: 'skl', draw: 2, up: { draw: 3 } },
  'coup-sournois': { hero: 'ombre', name: 'Coup sournois', cost: 1, type: 'atk', dmg: 7, weak: 1, up: { dmg: 10, weak: 2 } },
  brume: { hero: 'ombre', name: 'Brume', cost: 2, type: 'pow', poisonTurn: 2, up: { poisonTurn: 3 } },
  adrenaline: { hero: 'ombre', name: 'Adrénaline', cost: 0, type: 'skl', energy: 1, draw: 1, exhaust: true, up: { draw: 2 } },
  'rafale-lames': { hero: 'ombre', name: 'Rafale de lames', cost: 1, type: 'atk', dmg: 2, times: 4, up: { dmg: 3 } },
  venin: { hero: 'ombre', name: 'Venin', cost: 1, type: 'atk', dmg: 4, poison: 2, weak: 1, up: { poison: 4 } },
  'ombre-portee': { hero: 'ombre', name: 'Ombre portée', cost: 2, type: 'skl', block: 12, draw: 1, up: { block: 16 } },
  // L'Arcaniste
  etincelle: { hero: 'arcane', name: 'Étincelle', cost: 0, type: 'atk', dmg: 4, up: { dmg: 7 } },
  'boule-feu': { hero: 'arcane', name: 'Boule de feu', cost: 2, type: 'atk', dmg: 9, all: true, up: { dmg: 13 } },
  'bouclier-arcane': { hero: 'arcane', name: 'Bouclier arcanique', cost: 1, type: 'skl', block: 7, draw: 1, up: { block: 10 } },
  concentration: { hero: 'arcane', name: 'Concentration', cost: 2, type: 'pow', energyTurn: 1, up: { cost: 1 } },
  'eclair-chaine': { hero: 'arcane', name: 'Éclair en chaîne', cost: 1, type: 'atk', dmg: 3, times: 2, all: true, up: { dmg: 5 } },
  meditation: { hero: 'arcane', name: 'Méditation', cost: 1, type: 'skl', draw: 3, up: { draw: 4 } },
  'mur-glace': { hero: 'arcane', name: 'Mur de glace', cost: 2, type: 'skl', block: 12, weak: 1, all: true, up: { block: 16 } },
  surcharge: { hero: 'arcane', name: 'Surcharge', cost: 0, type: 'skl', energy: 2, exhaust: true, up: { energy: 3 } },
  rayon: { hero: 'arcane', name: 'Rayon', cost: 3, type: 'atk', dmg: 24, vuln: 2, up: { dmg: 31 } },
  givre: { hero: 'arcane', name: 'Givre', cost: 1, type: 'atk', dmg: 6, weak: 1, up: { dmg: 9 } },
  barriere: { hero: 'arcane', name: 'Barrière', cost: 1, type: 'pow', blockTurn: 4, up: { blockTurn: 6 } },
  flux: { hero: 'arcane', name: 'Flux', cost: 0, type: 'skl', block: 3, draw: 1, up: { block: 5 } },
  meteore: { hero: 'arcane', name: 'Météore', cost: 2, type: 'atk', dmg: 18, up: { dmg: 24 } },
};

// Intentions des ennemis : atk (dégâts × fois), def (armure), str (force), weak/vuln/poison (au joueur)
export const FOES = {
  gelee: { name: 'Gelée', hp: [22, 26], shape: 'blob', color: '#3ee6a8', moves: [{ atk: 6 }, { atk: 6 }, { atk: 3, weak: 1 }] },
  gobelin: { name: 'Gobelin', hp: [19, 23], shape: 'horn', color: '#ffc93c', moves: [{ atk: 8 }, { def: 6 }, { atk: 10 }] },
  champignon: { name: 'Champignon', hp: [24, 28], shape: 'cap', color: '#ff5fa2', moves: [{ poison: 3 }, { atk: 5 }, { atk: 5 }] },
  chevalier: { name: 'Chevalier noir', elite: true, hp: [58, 62], shape: 'helm', color: '#8d93b3', moves: [{ def: 10, str: 2 }, { atk: 12 }, { atk: 6, times: 2 }] },
  golem: { name: 'Golem', boss: true, hp: [110, 110], shape: 'golem', color: '#c9a36b', moves: [{ def: 15 }, { atk: 22 }, { atk: 8, times: 2 }, { str: 3, def: 6 }] },
  squelette: { name: 'Squelette', hp: [34, 38], shape: 'skull', color: '#e8e2d0', moves: [{ atk: 9 }, { atk: 5, times: 2 }] },
  loup: { name: 'Loup', hp: [28, 32], shape: 'horn', color: '#8d93b3', moves: [{ atk: 6, vuln: 2 }, { atk: 7, times: 2 }] },
  cultiste: { name: 'Cultiste', hp: [38, 42], shape: 'hood', color: '#a68bff', moves: [{ str: 3 }, { atk: 7 }, { atk: 7 }] },
  gargouille: { name: 'Gargouille', elite: true, hp: [88, 92], shape: 'golem', color: '#6b7a8c', moves: [{ def: 20 }, { atk: 18 }, { vuln: 2, weak: 2 }] },
  hydre: { name: 'Hydre', boss: true, hp: [180, 180], shape: 'hydra', color: '#13996a', moves: [{ atk: 6, times: 3 }, { str: 2, def: 12 }, { atk: 25 }, { poison: 4, atk: 8 }] },
  sentinelle: { name: 'Sentinelle', hp: [48, 52], shape: 'eye', color: '#4cc3ff', moves: [{ def: 12, atk: 10 }, { atk: 14 }] },
  spectre: { name: 'Spectre', hp: [42, 46], shape: 'hood', color: '#c4b0ff', moves: [{ weak: 2, vuln: 2 }, { atk: 12 }, { atk: 12 }] },
  bourreau: { name: 'Bourreau', elite: true, hp: [118, 122], shape: 'helm', color: '#ff3b5c', moves: [{ str: 4 }, { atk: 26 }, { atk: 10, times: 2 }] },
  architecte: { name: 'L’Architecte', boss: true, hp: [260, 260], shape: 'architect', color: '#ffc93c', moves: [] },
};

// Rencontres par acte
export const ENCOUNTERS = {
  1: { combat: [['gelee'], ['gobelin'], ['champignon'], ['gelee', 'gelee'], ['gobelin', 'champignon']], elite: [['chevalier']], boss: ['golem'] },
  2: { combat: [['squelette'], ['loup', 'loup'], ['cultiste', 'squelette'], ['loup', 'cultiste']], elite: [['gargouille']], boss: ['hydre'] },
  3: { combat: [['sentinelle', 'spectre'], ['spectre', 'spectre'], ['sentinelle', 'squelette'], ['cultiste', 'spectre']], elite: [['bourreau']], boss: ['architecte'] },
};

export const RELICS = {
  fiole: { name: 'Fiole écarlate', icon: 'heart', text: 'Soigne 6 PV après chaque combat.' },
  toxine: { name: 'Toxine', icon: 'flame', text: 'Chaque poison que tu poses compte 1 de plus.' },
  sablier: { name: 'Sablier', icon: 'hourglass', text: '+1 énergie au premier tour de chaque combat.' },
  ancre: { name: 'Ancre', icon: 'lock', text: 'Commence chaque combat avec 10 d’armure.' },
  gant: { name: 'Gant de fer', icon: 'trophy', text: 'Commence chaque combat avec 1 Force.' },
  plume: { name: 'Plume', icon: 'share', text: 'Pioche 2 cartes de plus au premier tour.' },
  crane: { name: 'Crâne', icon: 'target', text: 'Les ennemis commencent Vulnérables 1.' },
  epines: { name: 'Couronne d’épines', icon: 'crown', text: 'Commence chaque combat avec 3 Épines.' },
  bourse: { name: 'Bourse', icon: 'coin', text: '+25 % d’or gagné.' },
  braise: { name: 'Braise', icon: 'sparkle', text: 'Au début de ton tour, 3 dégâts à un ennemi au hasard.' },
  coeur: { name: 'Cœur de pierre', icon: 'heart', text: '+10 PV max (et soigne 10).' },
  lanterne: { name: 'Lanterne', icon: 'eye', text: 'Soigne 12 PV après chaque combat d’élite ou de boss.' },
};
export const RELIC_POOL = ['ancre', 'gant', 'plume', 'crane', 'epines', 'bourse', 'braise', 'coeur', 'lanterne'];
