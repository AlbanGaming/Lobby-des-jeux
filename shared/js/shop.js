// Boutique GameVerse : le catalogue (thèmes, looks d'avatar, titres, célébrations, sons, objets,
// coffre surprise) et l'application des objets équipés. Les achats passent par meta.buy().

import * as meta from './meta.js';
import { audio } from './engine/audio.js';
import { GAMES } from '../../games/registry.js';

// rareté : déduite du prix pour le coffre
export const rarityOf = (cost) => (cost >= 400 ? { id: 'legendaire', name: 'Légendaire', color: '#ffc93c' } : cost >= 250 ? { id: 'epique', name: 'Épique', color: '#a68bff' } : cost >= 130 ? { id: 'rare', name: 'Rare', color: '#4cc3ff' } : { id: 'commun', name: 'Commun', color: '#3ee6a8' });

export const THEMES = [
  { id: 'nuit', name: 'Nuit d’arcade', cost: 0, colors: ['#0b0c14', '#1a1d2e', '#ffc93c'], desc: 'Le thème d’origine.' },
  { id: 'ocean', name: 'Océan', cost: 80, colors: ['#04131f', '#0e2a40', '#4cc3ff'], desc: 'Bleus profonds, reflets d’écume.' },
  { id: 'foret', name: 'Forêt', cost: 120, colors: ['#08140d', '#143021', '#3ee6a8'], desc: 'Mousse, fougère et lucioles.' },
  { id: 'aube', name: 'Aube', cost: 150, colors: ['#1a0f1c', '#35203a', '#ff8a5b'], desc: 'Violet du matin et soleil orangé.' },
  { id: 'papier', name: 'Papier', cost: 200, colors: ['#f4efe4', '#e6dcc8', '#c4532a'], desc: 'Un thème clair, comme un carnet.' },
  { id: 'neon', name: 'Néon', cost: 300, colors: ['#0d0618', '#22113b', '#ff5fa2'], desc: 'Rose électrique et cyan.' },
  { id: 'retro', name: 'Écran cathodique', cost: 400, colors: ['#030a04', '#0c2210', '#3eff7a'], desc: 'Phosphore vert et lignes de balayage.' },
  { id: 'or', name: 'Or massif', cost: 500, colors: ['#0f0b02', '#241a05', '#ffd15c'], desc: 'Noir laqué et dorures.' },
];

export const FRAMES = [
  { id: 'none', name: 'Sans cadre', cost: 0 },
  { id: 'bois', name: 'Bois', cost: 60, color: '#c8955a', color2: '#8a5a2e' },
  { id: 'neon', name: 'Néon', cost: 140, color: '#ff5fa2', color2: '#4cc3ff', glow: true },
  { id: 'pixel', name: 'Pixel', cost: 180, color: '#3ee6a8', color2: '#13996a', dashed: true },
  { id: 'laurier', name: 'Laurier', cost: 260, color: '#7fbf5a', color2: '#ffc93c', leaves: true },
  { id: 'or', name: 'Or', cost: 450, color: '#ffd15c', color2: '#c98f00', glow: true },
];

export const HATS = [
  { id: 'none', name: 'Rien', cost: 0 },
  { id: 'fete', name: 'Chapeau de fête', cost: 60 },
  { id: 'antennes', name: 'Antennes', cost: 80 },
  { id: 'lunettes', name: 'Lunettes noires', cost: 100 },
  { id: 'casque', name: 'Casque audio', cost: 120 },
  { id: 'couronne', name: 'Couronne', cost: 300 },
  { id: 'aureole', name: 'Auréole', cost: 420 },
];

// Titres : achetés, ou offerts par un succès (`ach`)
export const TITLES = [
  { id: 'none', name: 'Aucun titre', cost: 0 },
  { id: 'noctambule', name: 'Noctambule', cost: 100 },
  { id: 'as-du-pixel', name: 'As du pixel', cost: 150 },
  { id: 'petit-genie', name: 'Petit génie', cost: 200 },
  { id: 'main-chaude', name: 'Main chaude', cost: 250 },
  { id: 'legende', name: 'Légende vivante', cost: 600 },
  { id: 'fidele', name: 'Fidèle au poste', ach: 'global:serie-7', how: 'Joue 7 jours d’affilée' },
  { id: 'chasseur', name: 'Chasseur de records', ach: 'global:records-10', how: 'Bats 10 records' },
  { id: 'globe', name: 'Grand explorateur', ach: 'global:explorateur', how: 'Essaie tous les jeux' },
  { id: 'collection', name: 'Collectionneur', ach: 'global:collection-25', how: 'Débloque 25 succès' },
];

export const CELEBRATIONS = [
  { id: 'confettis', name: 'Confettis', cost: 0, desc: 'La pluie de papier classique.' },
  { id: 'feu', name: 'Feu d’artifice', cost: 150, desc: 'Des bouquets qui éclatent partout.' },
  { id: 'pieces', name: 'Pluie de pièces', cost: 200, desc: 'Le jackpot tombe du ciel.' },
  { id: 'etoiles', name: 'Étoiles filantes', cost: 250, desc: 'Une nuée d’étoiles qui traverse l’écran.' },
  { id: 'pixels', name: 'Explosion de pixels', cost: 320, desc: 'L’écran part en morceaux de pixels.' },
];

export const SOUNDS = [
  { id: 'classique', name: 'Classique', cost: 0, desc: 'Les sons d’origine.' },
  { id: 'coton', name: 'Coton', cost: 100, desc: 'Doux et feutré.' },
  { id: 'retro', name: '8 bits', cost: 120, desc: 'Comme une vieille console.' },
  { id: 'xylo', name: 'Xylophone', cost: 150, desc: 'Des lames de bois qui tintent.' },
  { id: 'cosmos', name: 'Cosmos', cost: 200, desc: 'Ondulants et spatiaux.' },
];

export const ITEMS = [
  { id: 'gel', name: 'Gel de série', cost: 120, max: 2, icon: 'flame', desc: 'Sauve ta série si tu rates un jour. Utilisé tout seul, deux au maximum.' },
  { id: 'relance', name: 'Nouveau défi du jour', cost: 40, icon: 'dice', desc: 'Tire un autre défi du jour (trois fois par jour au plus, tant qu’il n’est pas réussi).' },
  { id: 'boost', name: 'Boost d’XP', cost: 150, icon: 'bolt', desc: 'XP doublée en fin de partie pendant 30 minutes.' },
];
export const BOOST_MS = 30 * 60e3;
export const RELANCES_PER_DAY = 3;
export const CHEST_COST = 150;

// Catégories d'objets cosmétiques : clé d'équipement, liste
export const KINDS = {
  theme: { list: THEMES, slot: 'theme', label: 'Thème' },
  frame: { list: FRAMES, slot: 'frame', label: 'Cadre' },
  hat: { list: HATS, slot: 'hat', label: 'Accessoire' },
  title: { list: TITLES, slot: 'title', label: 'Titre' },
  celebration: { list: CELEBRATIONS, slot: 'celebration', label: 'Célébration' },
  sound: { list: SOUNDS, slot: 'sound', label: 'Sons' },
};

export const secretGames = () => GAMES.filter((g) => g.secret);
export const itemKey = (kind, id) => `${kind}:${id}`;

/** Possédé ? (gratuit, acheté, ou titre gagné par un succès) */
export function owned(kind, item) {
  if (!item) return false;
  if (item.ach) return !!meta.getData().achievements[item.ach];
  return !item.cost || meta.owns(itemKey(kind, item.id));
}

export const look = () => meta.getData().look;
export const equipped = (kind) => KINDS[kind].list.find((x) => x.id === look()[KINDS[kind].slot]) ?? KINDS[kind].list[0];

export function equip(kind, id) {
  const item = KINDS[kind].list.find((x) => x.id === id);
  if (!item || !owned(kind, item)) return false;
  meta.getData().look[KINDS[kind].slot] = id;
  meta.save();
  applyLook();
  return true;
}

/** Achat d'un cosmétique ; l'équipe aussitôt */
export function purchase(kind, id) {
  const item = KINDS[kind].list.find((x) => x.id === id);
  if (!item || item.ach) return false;
  if (!owned(kind, item) && !meta.buy(itemKey(kind, id), item.cost)) return false;
  meta.noteShopping();
  equip(kind, id);
  return true;
}

export function purchaseGame(id) {
  const g = GAMES.find((x) => x.id === id && x.secret);
  if (!g) return false;
  if (!meta.owns(itemKey('game', id)) && !meta.buy(itemKey('game', id), g.secret.cost)) return false;
  meta.noteShopping();
  return true;
}

// ---------- Coffre surprise ----------
export function chestPool() {
  const out = [];
  for (const [kind, k] of Object.entries(KINDS)) for (const item of k.list) if (item.cost && !item.ach && !owned(kind, item)) out.push({ kind, item });
  return out;
}
/** Ouvre le coffre : un cosmétique jamais possédé, plus souvent un commun. Renvoie null si rien à gagner. */
export function openChest(rng = Math.random) {
  const pool = chestPool();
  if (!pool.length || meta.getData().credits < CHEST_COST) return null;
  // Poids : les objets chers sortent plus rarement
  const weights = pool.map(({ item }) => 1 / Math.sqrt(item.cost));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  let pick = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      pick = pool[i];
      break;
    }
  }
  if (!meta.spendCredits(CHEST_COST)) return null;
  meta.grant(itemKey(pick.kind, pick.item.id));
  meta.noteShopping({ chest: true });
  return { ...pick, rarity: rarityOf(pick.item.cost) };
}

// ---------- Application (thème, sons) ----------
export function applyLook() {
  const l = look();
  const root = document.documentElement;
  if (l.theme && l.theme !== 'nuit') root.dataset.gvTheme = l.theme;
  else delete root.dataset.gvTheme;
  audio.pack = l.sound ?? 'classique';
}
