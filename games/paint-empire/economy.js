// Paint Empire — économie : assistants, matériel, mouvements, raretés, exposition (prestige),
// mécènes et gains hors ligne. Fonctions pures, testables sans interface.

export const COST_GROWTH = 1.15;

// Assistants : production passive (€/s)
export const ASSISTANTS = [
  { id: 'apprenti', name: 'Apprenti', desc: 'Prépare les toiles et nettoie les pinceaux.', base: 15, rate: 0.5 },
  { id: 'eleve', name: 'Élève des Beaux-Arts', desc: 'Copie les grands maîtres, et plutôt bien.', base: 110, rate: 4 },
  { id: 'rue', name: 'Peintre de rue', desc: 'Vend des croquis aux passants.', base: 1200, rate: 24 },
  { id: 'portraitiste', name: 'Portraitiste', desc: 'Les commandes de portraits affluent.', base: 13000, rate: 140 },
  { id: 'atelier', name: 'Atelier partagé', desc: 'Dix chevalets qui tournent jour et nuit.', base: 140000, rate: 800 },
  { id: 'galerie', name: 'Galerie', desc: 'Une vitrine en centre-ville.', base: 1.6e6, rate: 4600 },
  { id: 'fondation', name: 'Fondation', desc: 'Des mécènes financent tes séries.', base: 2.2e7, rate: 27000 },
  { id: 'musee', name: 'Musée', desc: 'Ton nom sur la façade.', base: 3.5e8, rate: 160000 },
];
// Paliers : chaque palier atteint double la production de l'assistant
export const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400];

// Matériel : améliore le travail à la main (niveaux)
export const TOOLS = [
  { id: 'pinceaux', name: 'Pinceaux', desc: '+1 coup de pinceau par clic.', base: 40, growth: 3.2, max: 25 },
  { id: 'pigments', name: 'Pigments rares', desc: '+50 % de valeur pour chaque toile.', base: 120, growth: 3.6, max: 30 },
  { id: 'toiles', name: 'Toiles de maître', desc: 'Les toiles rares deviennent plus fréquentes.', base: 900, growth: 4.5, max: 12 },
  { id: 'chevalet', name: 'Chevalet automatique', desc: 'Peint tout seul : +1 coup par seconde.', base: 2500, growth: 3.4, max: 20 },
];

// Mouvements picturaux : débloqués par la fortune cumulée de l'exposition en cours
export const STYLES = [
  { id: 'taches', name: 'Taches', unlock: 0, mult: 1 },
  { id: 'rayures', name: 'Rayures', unlock: 1000, mult: 1.5 },
  { id: 'points', name: 'Pointillisme', unlock: 25000, mult: 2 },
  { id: 'collines', name: 'Collines', unlock: 5e5, mult: 3 },
  { id: 'couchant', name: 'Couchant', unlock: 1e7, mult: 4 },
  { id: 'vagues', name: 'Vagues', unlock: 2.5e8, mult: 6 },
  { id: 'etoiles', name: 'Constellations', unlock: 5e9, mult: 9 },
  { id: 'vitrail', name: 'Vitrail', unlock: 1e11, mult: 14 },
];

export const RARITIES = [
  { id: 'commune', name: 'Commune', mult: 1, color: '#c9bfa8' },
  { id: 'belle', name: 'Belle toile', mult: 2, color: '#4cc3ff' },
  { id: 'remarquable', name: 'Remarquable', mult: 5, color: '#a68bff' },
  { id: 'chef', name: 'Chef-d’œuvre', mult: 25, color: '#ffc93c' },
];

// Mécènes : améliorations permanentes achetées avec des jetons d'exposition
export const PATRONS = [
  { id: 'heritage', name: 'Héritage', desc: 'Chaque exposition repart avec 1 000 € × niveau².', cost: 2, max: 10 },
  { id: 'reseau', name: 'Réseau', desc: 'Gains hors ligne : +10 % par niveau (50 % au départ).', cost: 2, max: 5 },
  { id: 'patience', name: 'Patience', desc: 'Plafond hors ligne : +4 h par niveau (8 h au départ).', cost: 3, max: 4 },
  { id: 'oeil', name: 'L’œil', desc: 'Chefs-d’œuvre : +1 % de chance par niveau.', cost: 4, max: 5 },
  { id: 'carnet', name: 'Carnet d’adresses', desc: 'Le collectionneur passe 15 % plus souvent par niveau.', cost: 3, max: 4 },
];

export const STROKES_PER_PAINTING = 12;
export const RENOWN_BONUS = 0.05;

// ---------- Coûts ----------
export const assistantCost = (a, owned) => Math.ceil(a.base * COST_GROWTH ** owned);
/** Coût de n assistants à partir de `owned` (série géométrique). */
export function bulkCost(a, owned, n) {
  if (n <= 0) return 0;
  const r = COST_GROWTH;
  return Math.ceil((a.base * r ** owned * (r ** n - 1)) / (r - 1));
}
/** Combien d'assistants on peut acheter avec `money`. */
export function maxAffordable(a, owned, money) {
  const r = COST_GROWTH;
  const first = a.base * r ** owned;
  if (money < first) return 0;
  return Math.floor(Math.log((money * (r - 1)) / first + 1) / Math.log(r));
}
export const toolCost = (t, level) => Math.ceil(t.base * t.growth ** level);

// ---------- Production ----------
export const milestoneMult = (owned) => 2 ** MILESTONES.filter((m) => owned >= m).length;
export const nextMilestone = (owned) => MILESTONES.find((m) => m > owned) ?? null;
export const renownMult = (renown) => 1 + renown * RENOWN_BONUS;

export function assistantRate(a, owned, renown) {
  return a.rate * owned * milestoneMult(owned) * renownMult(renown);
}
/**
 * Bonus de la ville : +10 % par atelier en plus du garage, +2 % par trophée de galerie,
 * +10 % par contrat de galerie en cours.
 */
export function cityMult(s) {
  const ateliers = ATELIERS.filter((b) => b.id !== 'garage' && s.buildings?.[b.id]).length;
  return 1 + 0.1 * ateliers + 0.02 * (s.trophies ?? 0) + 0.1 * (s.contracts?.length ?? 0);
}

/** Revenu passif total (€/s) hors bonus temporaires. */
export function incomePerSecond(s) {
  return ASSISTANTS.reduce((sum, a) => sum + assistantRate(a, s.assistants[a.id] ?? 0, s.renown), 0) * cityMult(s);
}

export const styleIndex = (runEarned) => STYLES.reduce((k, st, i) => (runEarned >= st.unlock ? i : k), 0);

/** Valeur d'une toile terminée : suit le revenu passif pour rester intéressante à tout moment. */
export function paintingValue(s, rarity, styleIdx, formatId = 'moyen') {
  const base = 12 + incomePerSecond(s) * 4;
  const pigments = 1 + 0.5 * (s.tools.pigments ?? 0);
  return base * pigments * STYLES[styleIdx].mult * rarity.mult * formatOf(formatId).mult * renownMult(s.renown);
}

// ---------- Formats de toile ----------
export const FORMATS = [
  { id: 'petit', name: 'Petit', strokes: 8, mult: 0.6 },
  { id: 'moyen', name: 'Moyen', strokes: 12, mult: 1 },
  { id: 'grand', name: 'Grand', strokes: 22, mult: 2.2 },
];
export const formatOf = (id) => FORMATS.find((f) => f.id === id) ?? FORMATS[1];

// ---------- Couleurs dominantes (une par palette, voir art.js) ----------
export const FAMILIES = [
  { id: 'bleu', name: 'Bleu', swatch: '#457b9d' },
  { id: 'ocre', name: 'Ocre', swatch: '#e9c46a' },
  { id: 'rouge', name: 'Rouge', swatch: '#e63946' },
  { id: 'vert', name: 'Vert', swatch: '#40916c' },
  { id: 'violet', name: 'Violet', swatch: '#7b2cbf' },
  { id: 'terre', name: 'Terre', swatch: '#936639' },
  { id: 'nuit', name: 'Nuit', swatch: '#1c2541' },
  { id: 'brume', name: 'Brume', swatch: '#c9ada7' },
];
export const familyOf = (id) => FAMILIES.find((f) => f.id === id) ?? null;

// ---------- Production de toiles des assistants (pour les commandes et le stock) ----------
// Toiles par seconde et par assistant : leurs toiles alimentent les commandes et l'entrepôt.
export const ASSISTANT_PAINTINGS = { apprenti: 0.012, eleve: 0.03, rue: 0.07, portraitiste: 0.16, atelier: 0.4, galerie: 1, fondation: 2.4, musee: 6 };
export function assistantPaintingRate(s) {
  const base = ASSISTANTS.reduce((sum, a) => {
    const owned = s.assistants[a.id] ?? 0;
    return sum + (ASSISTANT_PAINTINGS[a.id] ?? 0) * owned * Math.sqrt(milestoneMult(owned));
  }, 0);
  const ateliers = ATELIERS.filter((b) => s.buildings?.[b.id] || b.id === 'garage').length;
  return base * (1 + 0.5 * (ateliers - 1));
}

// ---------- Ville : quartiers, bâtiments, clients ----------
// Les quartiers se débloquent avec la réputation, qui n'est jamais remise à zéro.
export const DISTRICTS = [
  { id: 'lilas', name: 'Rue des Lilas', rep: 0, phase: 'Le garage' },
  { id: 'centre', name: 'Centre-ville', rep: 30, phase: 'L’atelier en ville' },
  { id: 'arts', name: 'Quartier des arts', rep: 120, phase: 'Le loft d’artiste' },
  { id: 'colline', name: 'La Colline', rep: 400, phase: 'La manufacture' },
];
export const districtOpen = (s, id) => (s.rep ?? 0) >= (DISTRICTS.find((d) => d.id === id)?.rep ?? Infinity) || (s.districts ?? []).includes(id);

// Ateliers et entrepôt : achetés sur la carte, remis à zéro à chaque exposition (sauf le garage)
export const ATELIERS = [
  { id: 'garage', name: 'Ton garage', district: 'lilas', cost: 0, desc: 'Là où tout commence : un chevalet entre l’établi et le vélo.' },
  { id: 'atelier', name: 'Atelier du centre', district: 'centre', cost: 25000, desc: '+1 commande à la fois, +50 % de toiles d’assistants, +10 % de revenus.' },
  { id: 'loft', name: 'Loft des arts', district: 'arts', cost: 2.5e6, desc: '+1 commande à la fois, +50 % de toiles d’assistants, +10 % de revenus.' },
  { id: 'manufacture', name: 'Manufacture', district: 'colline', cost: 3e8, desc: '+1 commande à la fois, +50 % de toiles d’assistants, +10 % de revenus.' },
];
export const WAREHOUSE = { id: 'entrepot', name: 'Entrepôt', district: 'centre', cost: 60000, growth: 6, max: 5, desc: 'Stock de toiles : +40 places par niveau.' };
export const warehouseCost = (level) => Math.ceil(WAREHOUSE.cost * WAREHOUSE.growth ** level);
export const stockCapacity = (s) => 6 + 40 * (s.buildings?.entrepot ?? 0);
export const atelierCount = (s) => ATELIERS.filter((b) => b.id === 'garage' || s.buildings?.[b.id]).length;
/** Commandes en cours à la fois : une par atelier, +1 avec un contrat de galerie, +1 à 300 de réputation. */
export const orderSlots = (s) => atelierCount(s) + Math.min(1, s.contracts?.length ?? 0) + ((s.rep ?? 0) >= 300 ? 1 : 0);

// Clients de la ville. kind : voisin, commerce, entreprise, hotel, musee, celebrite, galerie.
export const CLIENTS = [
  { id: 'roux', name: 'Mme Roux', title: 'ta voisine', district: 'lilas', kind: 'voisin', building: 'house', color: '#7fb3d5' },
  { id: 'bernard', name: 'Les Bernard', title: 'voisins du 12', district: 'lilas', kind: 'voisin', building: 'house', color: '#e59866' },
  { id: 'fournil', name: 'Le Fournil d’Élise', title: 'boulangerie', district: 'lilas', kind: 'commerce', building: 'shop', color: '#f5b041' },
  { id: 'arcades', name: 'Café des Arcades', title: 'café', district: 'centre', kind: 'commerce', building: 'shop', color: '#58d68d' },
  { id: 'nova', name: 'Agence Nova', title: 'bureaux', district: 'centre', kind: 'entreprise', building: 'office', color: '#5dade2' },
  { id: 'lys', name: 'Hôtel Le Grand Lys', title: 'hôtel', district: 'centre', kind: 'hotel', building: 'hotel', color: '#c39bd3' },
  { id: 'musee', name: 'Musée de la Ville', title: 'musée', district: 'arts', kind: 'musee', building: 'museum', color: '#f4efe4' },
  { id: 'blanche', name: 'Galerie Blanche', title: 'galerie', district: 'arts', kind: 'galerie', building: 'gallery', color: '#ecf0f1', styles: ['rayures', 'points', 'vitrail'] },
  { id: 'port', name: 'Galerie du Port', title: 'galerie', district: 'arts', kind: 'galerie', building: 'gallery', color: '#85c1e9', styles: ['vagues', 'couchant', 'collines'] },
  { id: 'vega', name: 'Inès Vega', title: 'chanteuse', district: 'colline', kind: 'celebrite', building: 'villa', color: '#f1948a' },
  { id: 'solal', name: 'Fondation Solal', title: 'fondation', district: 'colline', kind: 'entreprise', building: 'foundation', color: '#d4ac0d' },
  { id: 'aurore', name: 'Galerie Aurore', title: 'galerie', district: 'colline', kind: 'galerie', building: 'gallery', color: '#f8c471', styles: ['etoiles', 'vitrail', 'couchant'] },
];
export const clientOf = (id) => CLIENTS.find((c) => c.id === id) ?? null;

// ---------- Réputation ----------
export const REP_LEVELS = [
  { at: 0, name: 'Inconnu' },
  { at: 30, name: 'Prometteur' },
  { at: 120, name: 'Reconnu' },
  { at: 400, name: 'Célèbre' },
  { at: 1200, name: 'Légende' },
];
export const repLevel = (rep) => [...REP_LEVELS].reverse().find((l) => rep >= l.at) ?? REP_LEVELS[0];
/** Les commandes paient plus avec la réputation : +0,2 % par point, jusqu'à +100 %. */
export const repPayMult = (rep) => 1 + Math.min(1, rep * 0.002);

export const strokesPerClick = (s) => 1 + (s.tools.pinceaux ?? 0);
export const autoStrokes = (s) => s.tools.chevalet ?? 0;

/** Tirage de la rareté (r ∈ [0, 1[). */
export function rollRarity(s, r) {
  const t = s.tools.toiles ?? 0;
  const chef = 0.01 + 0.004 * t + 0.01 * (s.patrons.oeil ?? 0);
  const rem = 0.06 + 0.01 * t;
  const belle = 0.2 + 0.015 * t;
  if (r < chef) return RARITIES[3];
  if (r < chef + rem) return RARITIES[2];
  if (r < chef + rem + belle) return RARITIES[1];
  return RARITIES[0];
}

// ---------- Exposition (prestige) ----------
/** Renommée gagnée en exposant après avoir gagné `runEarned` € depuis la dernière exposition. */
export const renownFor = (runEarned) => Math.floor(Math.sqrt(runEarned / 1e6));
/** Fortune nécessaire pour atteindre la prochaine étoile de renommée. */
export const nextRenownAt = (runEarned) => (renownFor(runEarned) + 1) ** 2 * 1e6;
export const startMoney = (s) => 1000 * (s.patrons.heritage ?? 0) ** 2;
export const patronCost = (p, level) => p.cost * (level + 1);

// ---------- Hors ligne ----------
export const offlineRate = (s) => 0.5 + 0.1 * (s.patrons.reseau ?? 0);
export const offlineCapMs = (s) => (8 + 4 * (s.patrons.patience ?? 0)) * 3600e3;
/** Gains pendant une absence de `ms` millisecondes. */
export function offlineGain(s, ms) {
  const capped = Math.min(Math.max(0, ms), offlineCapMs(s));
  return { gain: incomePerSecond(s) * (capped / 1000) * offlineRate(s), ms: capped, capped: ms > offlineCapMs(s) };
}

// ---------- Collectionneur ----------
export const collectorDelay = (s, r) => (70 + r * 80) / (1 + 0.15 * (s.patrons.carnet ?? 0));
