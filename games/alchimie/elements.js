// Alchimie — les éléments, leurs symboles (dessinés pour le jeu) et les recettes.
// Symboles : viewBox 0 0 48 48, tracés clairs sur la pastille de couleur de l'élément.

const W = 'fill="#fff8ec"';
const K = 'fill="#1b1626"';
const S = 'fill="none" stroke="#fff8ec" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"';
const SK = 'fill="none" stroke="#1b1626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const cloud = (y = 0, attrs = W) => `<path ${attrs} d="M14 ${30 + y}a7 7 0 0 1 1-14 9 9 0 0 1 17-2 7 7 0 0 1 3 16z"/>`;

export const ELEMENTS = {
  eau: { name: 'Eau', color: '#3a86d4', glyph: `<path ${W} d="M24 8c7 10 12 16 12 22a12 12 0 0 1-24 0c0-6 5-12 12-22z"/>` },
  feu: { name: 'Feu', color: '#e8573f', glyph: `<path ${W} d="M24 6c2 8 11 11 11 21a11 11 0 0 1-22 0c0-5 3-8 5-11 1 4 3 6 5 6-1-6 0-11 1-16z"/>` },
  terre: { name: 'Terre', color: '#8a5a3b', glyph: `<path ${W} d="M7 35c4-11 10-15 17-15s13 4 17 15z"/><path ${S} d="M24 20v-7M24 15c3-4 6-4 8-3-1 3-4 4-8 3z"/>` },
  air: { name: 'Air', color: '#8fb4c9', glyph: `<path ${S} d="M9 19h19a5 5 0 1 0-5-5M9 27h26a5 5 0 1 1-5 5"/>` },
  vapeur: { name: 'Vapeur', color: '#9aa5b1', glyph: `<path ${S} d="M16 36c-4-5 4-8 0-14s4-8 0-12M24 36c-4-5 4-8 0-14s4-8 0-12M32 36c-4-5 4-8 0-14s4-8 0-12"/>` },
  boue: { name: 'Boue', color: '#6e4b2e', glyph: `<ellipse ${W} cx="24" cy="31" rx="15" ry="7"/><circle ${W} cx="18" cy="20" r="3"/><circle ${W} cx="28" cy="16" r="2"/>` },
  pluie: { name: 'Pluie', color: '#4a6fa5', glyph: `${cloud(-6)}<path ${S} d="M16 32l-2 5M24 32l-2 5M32 32l-2 5"/>` },
  lave: { name: 'Lave', color: '#c2410c', glyph: `<path fill="#ffc93c" d="M8 34c3-8 8-12 16-12s13 4 16 12z"/><path ${S} d="M16 34l4-6 4 3 5-7"/><circle fill="#ffc93c" cx="22" cy="14" r="3"/>` },
  energie: { name: 'Énergie', color: '#f2b705', glyph: `<path ${K} d="M27 5L12 27h10l-3 16 17-24H26z"/>` },
  poussiere: { name: 'Poussière', color: '#b5a48c', glyph: `${[[14, 20], [24, 14], [33, 22], [18, 31], [29, 32], [24, 24], [12, 30], [36, 30]].map(([x, y], i) => `<circle ${W} cx="${x}" cy="${y}" r="${i % 3 ? 2 : 3}"/>`).join('')}` },
  mer: { name: 'Mer', color: '#1f6f9c', glyph: `<path ${S} d="M7 20c4-4 7-4 10 0s7 4 10 0 7-4 10 0M7 29c4-4 7-4 10 0s7 4 10 0 7-4 10 0"/>` },
  soleil: { name: 'Soleil', color: '#f59e0b', glyph: `<circle ${W} cx="24" cy="24" r="8"/><path ${S} d="M24 6v5M24 37v5M6 24h5M37 24h5M11 11l4 4M33 33l4 4M37 11l-4 4M11 37l4-4"/>` },
  montagne: { name: 'Montagne', color: '#6b7a8c', glyph: `<path ${W} d="M5 38l13-22 7 11 5-6 13 17z"/><path fill="#1b1626" opacity=".35" d="M18 16l4 7-4-1-4 2z"/>` },
  vent: { name: 'Vent', color: '#7fb3c9', glyph: `<path ${S} d="M7 16h22a4 4 0 1 0-4-4M7 24h30M7 32h20a4 4 0 1 1-4 4"/>` },
  nuage: { name: 'Nuage', color: '#8faad1', glyph: cloud(2) },
  pierre: { name: 'Pierre', color: '#7c7f86', glyph: `<path ${W} d="M10 30l4-12 11-5 11 6 3 11-8 7H17z"/><path ${SK} d="M20 20l5 6 8-2"/>` },
  brique: { name: 'Brique', color: '#b8432f', glyph: `<path ${W} d="M8 14h15v8H8zM25 14h15v8H25zM8 26h8v8H8zM18 26h15v8H18zM35 26h5v8h-5z"/>` },
  arc: { name: 'Arc-en-ciel', color: '#5b8def', glyph: `<path fill="none" stroke="#ff5a4e" stroke-width="4" d="M8 34a16 16 0 0 1 32 0"/><path fill="none" stroke="#ffc93c" stroke-width="4" d="M12 34a12 12 0 0 1 24 0"/><path fill="none" stroke="#3ee6a8" stroke-width="4" d="M16 34a8 8 0 0 1 16 0"/>` },
  orage: { name: 'Orage', color: '#3d4a6b', glyph: `${cloud(-6)}<path fill="#ffc93c" d="M25 26l-6 9h5l-2 8 8-11h-5l2-6z"/>` },
  metal: { name: 'Métal', color: '#8d93b3', glyph: `<path ${W} d="M10 32l5-14h18l5 14z"/><path ${SK} d="M16 22h16"/>` },
  vague: { name: 'Vague', color: '#2a7fb8', glyph: `<path ${W} d="M6 36c4-14 14-22 24-18 6 2 8 8 5 12-2-4-6-5-9-3 4 2 5 6 3 9z"/>` },
  sable: { name: 'Sable', color: '#d4a85a', glyph: `<path ${W} d="M5 34c8-8 14-8 20-2s12 6 18-2v8H5z"/>${[[16, 20], [26, 16], [34, 22]].map(([x, y]) => `<circle ${W} cx="${x}" cy="${y}" r="1.8"/>`).join('')}` },
  verre: { name: 'Verre', color: '#6fb6c9', glyph: `<path ${S} d="M15 8h18l-2 14a7 7 0 0 1-14 0zM24 29v9M17 40h14"/>` },
  plante: { name: 'Plante', color: '#4f9a55', glyph: `<path ${S} d="M24 40V22"/><path ${W} d="M24 24c-8 0-12-6-12-12 8 0 12 5 12 12zM24 28c7-1 11-6 12-12-8 1-12 6-12 12z"/>` },
  arbre: { name: 'Arbre', color: '#3d7a45', glyph: `<path ${W} d="M21 30h6v10h-6z"/><circle ${W} cx="24" cy="20" r="12"/>` },
  foret: { name: 'Forêt', color: '#2f5f3a', glyph: `${[[13, 0.8], [24, 1], [35, 0.8]].map(([x, s]) => `<path ${W} d="M${x} ${10 + (1 - s) * 10}l${9 * s} ${16 * s}h-${18 * s}z"/><path ${W} d="M${x} ${18 + (1 - s) * 10}l${10 * s} ${16 * s}h-${20 * s}z"/>`).join('')}` },
  neige: { name: 'Neige', color: '#9cc3e0', glyph: `<path ${S} d="M24 7v34M9 15l30 18M39 15L9 33M24 7l-4 4M24 7l4 4M24 41l-4-4M24 41l4-4"/>` },
  glace: { name: 'Glace', color: '#7fc8e8', glyph: `<path ${W} d="M12 16l12-6 12 6v16l-12 6-12-6z"/><path fill="#1b1626" opacity=".2" d="M24 22l12-6v16l-12 6z"/><path ${SK} d="M18 18l4 2"/>` },
  outil: { name: 'Outil', color: '#7a6a5a', glyph: `<path ${S} d="M16 40l14-22"/><path ${W} d="M22 10l14 6-4 7-14-6z"/>` },
  bois: { name: 'Bois', color: '#9c6b3c', glyph: `<circle ${W} cx="24" cy="24" r="14"/><circle ${SK} cx="24" cy="24" r="9"/><circle ${SK} cx="24" cy="24" r="4"/>` },
  maison: { name: 'Maison', color: '#c56a4a', glyph: `<path ${W} d="M8 24L24 10l16 14v16H8z"/><path fill="#1b1626" opacity=".5" d="M20 40V30h8v10z"/>` },
  ville: { name: 'Ville', color: '#56607a', glyph: `<path ${W} d="M6 40V24h8v16zM16 40V12h10v28zM28 40V20h7v20zM37 40V28h5v12z"/><path fill="#ffc93c" d="M19 16h4v4h-4zM19 24h4v4h-4zM30 24h3v3h-3z"/>` },
  vie: { name: 'Vie', color: '#e05a8a', glyph: `<path ${W} d="M24 38c-10-7-15-12-15-19a7 7 0 0 1 15-3 7 7 0 0 1 15 3c0 7-5 12-15 19z"/>` },
  oiseau: { name: 'Oiseau', color: '#d9773d', glyph: `<path ${W} d="M8 24c6-6 12-6 16-2 4-6 10-9 16-8-4 3-6 8-6 12 0 6-6 10-12 10-6 0-10-4-14-12z"/><circle ${K} cx="31" cy="20" r="1.8"/>` },
  poisson: { name: 'Poisson', color: '#2d9cdb', glyph: `<path ${W} d="M10 24c4-7 12-10 20-6l8-5v22l-8-5c-8 4-16 1-20-6z"/><circle ${K} cx="17" cy="22" r="1.8"/>` },
  humain: { name: 'Humain', color: '#d48b5a', glyph: `<circle ${W} cx="24" cy="13" r="6"/><path ${W} d="M13 40c0-10 5-16 11-16s11 6 11 16z"/>` },
  electricite: { name: 'Électricité', color: '#5a4fcf', glyph: `<circle fill="none" stroke="#ffc93c" stroke-width="3" cx="24" cy="24" r="16"/><path fill="#ffc93c" d="M26 10L15 27h8l-2 11 12-17h-8z"/>` },
  ampoule: { name: 'Ampoule', color: '#e0a000', glyph: `<path ${W} d="M24 6a12 12 0 0 1 7 22v5H17v-5A12 12 0 0 1 24 6z"/><path ${W} d="M18 36h12v4H18z"/>` },
  volcan: { name: 'Volcan', color: '#7a3b2e', glyph: `<path ${W} d="M5 40l13-20h12l13 20z"/><path fill="#ff5a4e" d="M18 20h12l-3 6h-6z"/><circle fill="#d9d4cc" cx="22" cy="11" r="4"/><circle fill="#d9d4cc" cx="29" cy="8" r="3"/>` },
  ile: { name: 'Île', color: '#2f8fb8', glyph: `<path fill="#f2d08a" d="M8 36c6-6 26-6 32 0z"/><path ${S} d="M24 34c0-10 2-16 4-20"/><path ${W} d="M28 14c-6-4-12-2-14 2M28 14c4-6 10-6 12-3M28 14c6 0 9 4 9 8"/>` },
  desert: { name: 'Désert', color: '#c98a3c', glyph: `<circle ${W} cx="33" cy="14" r="5"/><path ${W} d="M5 38c6-10 14-12 20-6 5-5 12-4 18 6z"/>` },
  cactus: { name: 'Cactus', color: '#3f8f4f', glyph: `<path ${W} d="M20 40V12a4 4 0 0 1 8 0v28zM28 24h4v-6a3 3 0 0 1 6 0v6a6 6 0 0 1-6 6h-4zM20 28h-4a6 6 0 0 1-6-6v-4a3 3 0 0 1 6 0v4h4z"/>` },
  charbon: { name: 'Charbon', color: '#2b2d42', glyph: `<path fill="#4a4e69" d="M10 30l5-13 12-4 10 8 1 11-9 6H17z"/><path fill="#ff8a5b" d="M22 22l4 4-3 3z"/>` },
  diamant: { name: 'Diamant', color: '#3fb6d9', glyph: `<path ${W} d="M14 12h20l7 9-17 19L7 21z"/><path ${SK} d="M7 21h34M19 12l-4 9 9 19 9-19-4-9"/>` },
  sablier: { name: 'Sablier', color: '#a0703c', glyph: `<path ${S} d="M14 8h20M14 40h20M16 8c0 10 16 12 16 16s-16 6-16 16M32 8c0 10-16 12-16 16s16 6 16 16"/><path fill="#ffc93c" d="M19 37c2-4 8-4 10 0z"/>` },
  etoile: { name: 'Étoile', color: '#2b3a6b', glyph: `<path fill="#ffc93c" d="M24 6l5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z"/>` },
  or: { name: 'Or', color: '#b8860b', glyph: `<path fill="#ffe08a" d="M8 34l5-12h22l5 12z"/><path fill="#ffc93c" d="M14 22l4-10h12l4 10z"/>` },
  philosophale: { name: 'Pierre philosophale', color: '#8b1e3f', glyph: `<path fill="#ff5a4e" d="M24 6l14 10-5 20H15l-5-20z"/><path fill="#fff8ec" opacity=".6" d="M24 6l6 12-6 18-6-18z"/><circle fill="none" stroke="#ffc93c" stroke-width="2" cx="24" cy="24" r="21" stroke-dasharray="3 4"/>` },
  robot: { name: 'Robot', color: '#5a6b8c', glyph: `<rect ${W} x="11" y="14" width="26" height="20" rx="4"/><circle ${K} cx="19" cy="24" r="3"/><circle ${K} cx="29" cy="24" r="3"/><path ${S} d="M24 14V8M18 40h12"/><circle fill="#ff5a4e" cx="24" cy="7" r="2.5"/>` },
  moteur: { name: 'Moteur', color: '#6c5a8c', glyph: `<path ${W} d="M24 8l4 4 6-1 1 6 5 3-3 5 3 5-5 3-1 6-6-1-4 4-4-4-6 1-1-6-5-3 3-5-3-5 5-3 1-6 6 1z"/><circle fill="#6c5a8c" cx="24" cy="24" r="6"/>` },
  fusee: { name: 'Fusée', color: '#d9463c', glyph: `<path ${W} d="M24 5c7 6 9 15 7 25H17c-2-10 0-19 7-25z"/><circle fill="#4cc3ff" cx="24" cy="17" r="3.5"/><path fill="#ffc93c" d="M18 30h12l-6 12z"/><path ${W} d="M17 24l-6 8h7zM31 24l6 8h-7z"/>` },
  cosmos: { name: 'Cosmos', color: '#1b1640', glyph: `<circle fill="#a68bff" cx="24" cy="24" r="9"/><ellipse fill="none" stroke="#ffc93c" stroke-width="3" cx="24" cy="24" rx="18" ry="6" transform="rotate(-20 24 24)"/><circle ${W} cx="9" cy="10" r="1.5"/><circle ${W} cx="39" cy="38" r="1.5"/><circle ${W} cx="38" cy="9" r="1"/>` },
  plage: { name: 'Plage', color: '#2fa8c9', glyph: `<path fill="#f2d08a" d="M4 40c10-8 30-8 40 0z"/><path ${S} d="M22 36l6-22"/><path fill="#ff5a4e" d="M14 16a14 10 0 0 1 28 4z"/>` },
  tornade: { name: 'Tornade', color: '#6b7f8f', glyph: `<path ${S} d="M8 10h32M12 17h24M16 24h16M19 31h10M22 38h4"/>` },
};

export const BASICS = ['eau', 'feu', 'terre', 'air'];

// Recettes : [ingrédient, ingrédient, résultat]
export const RECIPES = [
  ['eau', 'feu', 'vapeur'], ['eau', 'terre', 'boue'], ['air', 'eau', 'pluie'], ['feu', 'terre', 'lave'], ['air', 'feu', 'energie'], ['air', 'terre', 'poussiere'],
  ['eau', 'eau', 'mer'], ['feu', 'feu', 'soleil'], ['terre', 'terre', 'montagne'], ['air', 'air', 'vent'],
  ['air', 'vapeur', 'nuage'], ['eau', 'nuage', 'pluie'], ['eau', 'lave', 'pierre'], ['air', 'lave', 'pierre'], ['boue', 'feu', 'brique'], ['eau', 'poussiere', 'boue'],
  ['pluie', 'soleil', 'arc'], ['energie', 'nuage', 'orage'], ['feu', 'pierre', 'metal'], ['mer', 'vent', 'vague'], ['pierre', 'vent', 'sable'], ['feu', 'sable', 'verre'],
  ['pluie', 'terre', 'plante'], ['plante', 'terre', 'arbre'], ['arbre', 'arbre', 'foret'], ['montagne', 'nuage', 'neige'], ['eau', 'neige', 'glace'],
  ['metal', 'pierre', 'outil'], ['arbre', 'outil', 'bois'], ['bois', 'brique', 'maison'], ['maison', 'maison', 'ville'],
  ['energie', 'mer', 'vie'], ['air', 'vie', 'oiseau'], ['mer', 'vie', 'poisson'], ['boue', 'vie', 'humain'],
  ['metal', 'orage', 'electricite'], ['electricite', 'verre', 'ampoule'], ['lave', 'montagne', 'volcan'], ['mer', 'volcan', 'ile'],
  ['sable', 'soleil', 'desert'], ['desert', 'plante', 'cactus'], ['arbre', 'feu', 'charbon'], ['charbon', 'montagne', 'diamant'], ['sable', 'verre', 'sablier'],
  ['energie', 'soleil', 'etoile'], ['metal', 'soleil', 'or'], ['diamant', 'or', 'philosophale'], ['humain', 'metal', 'robot'],
  ['energie', 'outil', 'moteur'], ['metal', 'moteur', 'fusee'], ['etoile', 'fusee', 'cosmos'], ['sable', 'vague', 'plage'], ['vent', 'vent', 'tornade'],
];

const key = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);
export const RECIPE_OF = new Map(RECIPES.map(([a, b, out]) => [key(a, b), out]));
export const combine = (a, b) => RECIPE_OF.get(key(a, b)) ?? null;

// Rang d'un élément : 1 pour les éléments de base, puis 1 + le plus haut de ses ingrédients
// (selon sa première recette)
export const TIER = (() => {
  const t = Object.fromEntries(BASICS.map((b) => [b, 1]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b, out] of RECIPES) {
      if (t[a] && t[b] && !t[out]) {
        t[out] = 1 + Math.max(t[a], t[b]);
        changed = true;
      }
    }
  }
  return t;
})();

/** Les éléments qui n'entrent dans aucune recette : chefs-d'œuvre, à transmuter en points. */
export const FINAL = new Set(Object.keys(ELEMENTS).filter((id) => !RECIPES.some(([a, b]) => a === id || b === id)));

/** Recettes qui donnent un élément (pour le grimoire). */
export const recipesFor = (id) => RECIPES.filter(([, , out]) => out === id);

export function tokenSVG(id, { label = false, className = 'al-token' } = {}) {
  const e = ELEMENTS[id];
  return `<svg class="${className}" viewBox="0 0 48 48" ${label ? `role="img" aria-label="${e.name}"` : 'aria-hidden="true"'}><circle cx="24" cy="24" r="23" fill="${e.color}"/><circle cx="24" cy="24" r="23" fill="none" stroke="#1b1626" stroke-width="2" opacity=".35"/>${e.glyph}</svg>`;
}
