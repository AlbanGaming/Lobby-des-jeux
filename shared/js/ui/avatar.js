// Avatars générés : un petit robot d'arcade dessiné en SVG à partir d'une seed.
// La seed choisit les yeux, la bouche et le sommet de la tête ; la palette, la couleur.

import { createRng } from '../core/rng.js';
import { esc } from './toast.js';

// cost = prix en crédits (0 = gratuit)
export const PALETTES = [
  { id: 0, name: 'Jeton', main: '#ffc93c', deep: '#c98f00', eye: '#3ee6a8', bg: '#2a2208', cost: 0 },
  { id: 1, name: 'Tomate', main: '#ff5a4e', deep: '#b8281f', eye: '#ffc93c', bg: '#2b1012', cost: 0 },
  { id: 2, name: 'Menthe', main: '#3ee6a8', deep: '#13996a', eye: '#4cc3ff', bg: '#0f2a22', cost: 0 },
  { id: 3, name: 'Ciel', main: '#4cc3ff', deep: '#1a7fb8', eye: '#ffc93c', bg: '#0d2033', cost: 0 },
  { id: 4, name: 'Raisin', main: '#a68bff', deep: '#6a4fd1', eye: '#3ee6a8', bg: '#1a1433', cost: 0 },
  { id: 5, name: 'Crème', main: '#f4efe4', deep: '#b9b2a2', eye: '#ff5a4e', bg: '#252a40', cost: 0 },
  { id: 6, name: 'Corail', main: '#ff8a5b', deep: '#c4532a', eye: '#f4efe4', bg: '#2a1a14', cost: 60 },
  { id: 7, name: 'Citron vert', main: '#c6f24e', deep: '#7fa51c', eye: '#ff5a4e', bg: '#1c2410', cost: 120 },
  { id: 8, name: 'Bonbon', main: '#ff7ac6', deep: '#c23f8c', eye: '#4cc3ff', bg: '#2a1024', cost: 200 },
  { id: 9, name: 'Minuit', main: '#353b58', deep: '#1a1d2e', eye: '#ffc93c', bg: '#0b0c14', cost: 350 },
  { id: 10, name: 'Or massif', main: '#e8b04a', deep: '#9a6a12', eye: '#fff6d8', bg: '#1f1606', cost: 600, shine: true },
];

export const getPalette = (id) => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

function parts(seed) {
  const r = createRng(`avatar:${seed}`);
  return { eyes: r.int(0, 5), mouth: r.int(0, 3), top: r.int(0, 4), cheeks: r.chance(0.45) };
}

const EYES = [
  (c) => `<circle cx="26" cy="31" r="3.4" fill="${c}"/><circle cx="38" cy="31" r="3.4" fill="${c}"/>`,
  (c) => `<rect x="23.5" y="26.5" width="5" height="9" rx="2.5" fill="${c}"/><rect x="35.5" y="26.5" width="5" height="9" rx="2.5" fill="${c}"/>`,
  (c) => `<path d="M22.5 32.5q3.5-5 7 0M34.5 32.5q3.5-5 7 0" fill="none" stroke="${c}" stroke-width="2.8" stroke-linecap="round"/>`,
  (c) => `<rect x="21.5" y="28" width="21" height="6" rx="3" fill="${c}"/><rect x="24" y="29.5" width="5" height="3" rx="1.5" fill="#fff" opacity=".7"/>`,
  (c) => `<circle cx="32" cy="31" r="6" fill="${c}"/><circle cx="33.6" cy="29.4" r="2" fill="#fff" opacity=".8"/>`,
  (c) => `<path d="M23 28.5l5 5M28 28.5l-5 5" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><circle cx="38" cy="31" r="3.4" fill="${c}"/>`,
];

const MOUTHS = [
  () => '',
  (c) => `<path d="M28.5 37.5q3.5 3 7 0" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`,
  (c) => `<path d="M28.5 38h7" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`,
  (c) => `<circle cx="32" cy="38.3" r="1.9" fill="${c}"/>`,
];

const TOPS = [
  (p) => `<path d="M32 16V9" stroke="${p.deep}" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="8" r="3.4" fill="${p.eye}"/>`,
  (p) => `<path d="M17 21l3-9 7 5z" fill="${p.deep}"/><path d="M47 21l-3-9-7 5z" fill="${p.deep}"/>`,
  () => '',
  (p) => `<path d="M33.5 6l-6 9h5l-2 7 7-10h-5z" fill="${p.eye}"/>`,
  (p) => `<rect x="24" y="10" width="16" height="7" rx="3.5" fill="${p.deep}"/><rect x="14" y="8" width="36" height="4" rx="2" fill="${p.main}"/>`,
];

// ---------- Boutique : cadres, accessoires et personnages ----------
// frame = { id, color, color2, glow, dashed, leaves, flames, rainbow } ; hat = id ; character = id
const HAT_SVG = {
  fete: '<path d="M24 18L33 0l8 18z" fill="#ff5fa2"/><path d="M27 12l10-2M29 7l7-1.5" stroke="#ffc93c" stroke-width="2.4"/><circle cx="33" cy="1.5" r="3" fill="#ffc93c"/>',
  antennes: '<path d="M24 17L17 5M40 17l7-12" stroke="#a9b3c4" stroke-width="2.6" stroke-linecap="round"/><circle cx="16.5" cy="4.5" r="3.6" fill="#ff5a4e"/><circle cx="47.5" cy="4.5" r="3.6" fill="#3ee6a8"/>',
  lunettes: '<rect x="18" y="25.5" width="13" height="10" rx="4" fill="#05060b"/><rect x="33" y="25.5" width="13" height="10" rx="4" fill="#05060b"/><path d="M31 29h2" stroke="#05060b" stroke-width="2"/><path d="M20.5 28l3-1.5M35.5 28l3-1.5" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/>',
  casque: '<path d="M9 34a23 22 0 0 1 46 0" fill="none" stroke="#2b2d42" stroke-width="4.5"/><rect x="4.5" y="28" width="10" height="17" rx="4" fill="#ff5a4e" stroke="#2b2d42" stroke-width="2"/><rect x="49.5" y="28" width="10" height="17" rx="4" fill="#ff5a4e" stroke="#2b2d42" stroke-width="2"/>',
  couronne: '<path d="M19 18V6l7 6 6-9 6 9 7-6v12z" fill="#ffc93c" stroke="#c98f00" stroke-width="1.6" stroke-linejoin="round"/><circle cx="32" cy="13" r="2.2" fill="#ff5a4e"/><circle cx="24" cy="15" r="1.6" fill="#4cc3ff"/><circle cx="40" cy="15" r="1.6" fill="#3ee6a8"/>',
  aureole: '<ellipse cx="32" cy="8" rx="15" ry="4.2" fill="none" stroke="#fff3c4" stroke-width="5" opacity=".35"/><ellipse cx="32" cy="8" rx="15" ry="4.2" fill="none" stroke="#ffd15c" stroke-width="2.6"/>',
  // Exclusivités des coffres
  magicien: '<path d="M18 19q14 4 28 0L35 1q-2-1-3 1z" fill="#5b3cc4" stroke="#2a1a5e" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 19q18 5 36 0" stroke="#2a1a5e" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M29 9l1 2.4 2.6.4-1.9 1.8.5 2.6-2.2-1.3-2.3 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#ffd15c"/><circle cx="37" cy="14" r="1.3" fill="#fff3c4"/>',
  licorne: '<path d="M28 18L33 0l5 18z" fill="#fff3c4" stroke="#c49aff" stroke-width="1.4" stroke-linejoin="round"/><path d="M29.5 14l7-2.5M30.6 9.5l5.2-1.8M31.6 5.2l3.2-1.1" stroke="#c49aff" stroke-width="1.6" stroke-linecap="round"/><circle cx="20" cy="13" r="2" fill="#ff9ec7"/><circle cx="45" cy="11" r="1.6" fill="#9fe8ff"/>',
  diademe: '<path d="M17 18V7l7.5 5.5L32 2l7.5 10.5L47 7v11z" fill="#bfe9ff" stroke="#1a7fb8" stroke-width="1.6" stroke-linejoin="round"/><path d="M32 6l3 4-3 4-3-4z" fill="#4cc3ff" stroke="#fff" stroke-width=".8"/><path d="M23 12l2 2.5-2 2.5-2-2.5zM41 12l2 2.5-2 2.5-2-2.5z" fill="#ff9ec7" stroke="#fff" stroke-width=".7"/><path d="M27 4.5l.8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8z" fill="#fff"/>',
};

// Personnages : un corps complet à la place du robot (yeux vers y = 31 pour les accessoires)
const CHARACTERS = {
  chat: { bg: '#2a1a2e', svg: '<path d="M14 30L16 9l13 11zM50 30L48 9 35 20z" fill="#f4a261" stroke="#b4632a" stroke-width="2" stroke-linejoin="round"/><path d="M18 22l1-8 6 6zM46 22l-1-8-6 6z" fill="#ff9ec7"/><ellipse cx="32" cy="36" rx="20" ry="17" fill="#f4a261"/><path d="M32 22v6M26 21l2 6M38 21l-2 6" stroke="#b4632a" stroke-width="2" stroke-linecap="round"/><ellipse cx="25" cy="33" rx="3.2" ry="4.2" fill="#1b1626"/><ellipse cx="39" cy="33" rx="3.2" ry="4.2" fill="#1b1626"/><circle cx="26" cy="31.6" r="1.1" fill="#fff"/><circle cx="40" cy="31.6" r="1.1" fill="#fff"/><path d="M30 39h4l-2 2.4z" fill="#ff7aa8"/><path d="M32 41.5q-2 3-5 1.5M32 41.5q2 3 5 1.5" stroke="#5a3a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M8 38l12 1M8 43l12-1M56 38l-12 1M56 43l-12-1" stroke="#fff3c4" stroke-width="1.2" stroke-linecap="round"/>' },
  renard: { bg: '#1c2618', svg: '<path d="M12 28L14 6l14 14zM52 28L50 6 36 20z" fill="#ff8a2b" stroke="#a8461a" stroke-width="2" stroke-linejoin="round"/><path d="M16 22l1-10 7 7zM48 22l-1-10-7 7z" fill="#2b1a10"/><path d="M10 28q22-16 44 0L32 56z" fill="#ff8a2b" stroke="#a8461a" stroke-width="2" stroke-linejoin="round"/><path d="M10 28q10 3 16 12L32 56zM54 28q-10 3-16 12L32 56z" fill="#fff3e6"/><path d="M22 31q3-3 6 0" stroke="#1b1626" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M36 31q3-3 6 0" stroke="#1b1626" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="32" cy="52" rx="3.4" ry="2.6" fill="#1b1626"/>' },
  fantome: { bg: '#14102b', svg: '<circle cx="32" cy="34" r="26" fill="#c49aff" opacity=".12"/><path d="M14 52V30a18 18 0 0 1 36 0v22l-4.5-4-4.5 4-4.5-4-4.5 4-4.5-4-4.5 4-4.5-4z" fill="#f4efe4" stroke="#b8b0d6" stroke-width="2" stroke-linejoin="round"/><ellipse cx="25" cy="31" rx="3.6" ry="5" fill="#1b1626"/><ellipse cx="39" cy="31" rx="3.6" ry="5" fill="#1b1626"/><ellipse cx="32" cy="41" rx="3.2" ry="4" fill="#1b1626"/><circle cx="20" cy="38" r="2.6" fill="#ff9ec7" opacity=".7"/><circle cx="44" cy="38" r="2.6" fill="#ff9ec7" opacity=".7"/>' },
  alien: { bg: '#0d1f14', svg: '<path d="M24 14L18 4M40 14l6-10" stroke="#7bdc6a" stroke-width="2.6" stroke-linecap="round"/><circle cx="17.5" cy="3.5" r="3.4" fill="#ffd15c"/><circle cx="46.5" cy="3.5" r="3.4" fill="#ffd15c"/><path d="M32 12c14 0 21 9 21 20 0 13-11 22-21 22S11 45 11 32c0-11 7-20 21-20z" fill="#7bdc6a" stroke="#2f8a3a" stroke-width="2"/><path d="M15 29q6-6 14 2-1 7-8 6-7-2-6-8zM49 29q-6-6-14 2 1 7 8 6 7-2 6-8z" fill="#0b1a10"/><ellipse cx="21" cy="31" rx="2" ry="1.3" fill="#fff" opacity=".85"/><ellipse cx="43" cy="31" rx="2" ry="1.3" fill="#fff" opacity=".85"/><path d="M28 46q4 2.6 8 0" stroke="#2f8a3a" stroke-width="2" fill="none" stroke-linecap="round"/>' },
  astronaute: { bg: '#0b1026', svg: '<circle cx="12" cy="12" r="1.2" fill="#fff"/><circle cx="52" cy="9" r="1" fill="#fff"/><circle cx="55" cy="40" r="1.2" fill="#fff"/><rect x="18" y="48" width="28" height="12" rx="6" fill="#e9eef5" stroke="#9aa5b8" stroke-width="2"/><circle cx="32" cy="32" r="22" fill="#f4f6fa" stroke="#9aa5b8" stroke-width="2.4"/><path d="M47 14l4-6" stroke="#9aa5b8" stroke-width="2.4" stroke-linecap="round"/><circle cx="51.5" cy="7.5" r="2.4" fill="#ff5a4e"/><rect x="15" y="21" width="34" height="22" rx="11" fill="#1a3a6a" stroke="#0d1f3a" stroke-width="2"/><path d="M20 27q4-4 10-4" stroke="#9fe8ff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/><circle cx="41" cy="36" r="2" fill="#9fe8ff" opacity=".6"/><circle cx="26" cy="32" r="2.2" fill="#fff"/><circle cx="38" cy="32" r="2.2" fill="#fff"/>' },
  dragon: { bg: '#2a0e0e', svg: '<path d="M18 22L10 6l14 9zM46 22l8-16-14 9z" fill="#ffd15c" stroke="#a8770a" stroke-width="1.8" stroke-linejoin="round"/><path d="M32 12c13 0 20 8 20 19 0 6-2 10-5 13H17c-3-3-5-7-5-13 0-11 7-19 20-19z" fill="#e63946" stroke="#8a1a22" stroke-width="2"/><path d="M26 15l2-4 2 4M34 15l2-4 2 4" fill="#ff8a5b"/><ellipse cx="32" cy="46" rx="14" ry="9" fill="#ff6b6b" stroke="#8a1a22" stroke-width="2"/><circle cx="27" cy="45" r="1.6" fill="#5a0e14"/><circle cx="37" cy="45" r="1.6" fill="#5a0e14"/><ellipse cx="24" cy="30" rx="4.4" ry="4" fill="#ffd15c"/><ellipse cx="40" cy="30" rx="4.4" ry="4" fill="#ffd15c"/><rect x="23" y="27" width="2" height="6" rx="1" fill="#1b1626"/><rect x="39" y="27" width="2" height="6" rx="1" fill="#1b1626"/><path d="M50 54q4-3 2-8 5 3 3 9z" fill="#ffb02e"/>' },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS);

let uid = 0;
function frameSVG(fr) {
  if (!fr || fr.id === 'none') return '';
  const id = `avf${++uid}`;
  // Arc-en-ciel : un dégradé sur le contour
  const grad = fr.rainbow ? `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a4e"/><stop offset=".25" stop-color="#ffc93c"/><stop offset=".5" stop-color="#3ee6a8"/><stop offset=".75" stop-color="#4cc3ff"/><stop offset="1" stop-color="#c49aff"/></linearGradient>` : '';
  const stroke = fr.rainbow ? `url(#${id}g)` : fr.color;
  const glow = fr.glow ? `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter><rect x="2.5" y="2.5" width="59" height="59" rx="15" fill="none" stroke="${stroke}" stroke-width="5" filter="url(#${id})" opacity=".8"/>` : '';
  const leaves = fr.leaves ? [8, 18, 28, 38, 48].map((y) => `<ellipse cx="4.5" cy="${y + 6}" rx="2.6" ry="5" fill="${fr.color}" transform="rotate(-25 4.5 ${y + 6})"/><ellipse cx="59.5" cy="${y + 6}" rx="2.6" ry="5" fill="${fr.color}" transform="rotate(25 59.5 ${y + 6})"/>`).join('') + `<circle cx="32" cy="61" r="2.6" fill="${fr.color2}"/>` : '';
  const flames = fr.flames ? [10, 22, 34, 46].map((x) => `<path d="M${x} 61q3-9 6-2 1-6 4 1 2 4-2 3z" fill="${fr.color}"/>`).join('') + [12, 28, 44].map((y) => `<path d="M2 ${y + 8}q-1-6 3-9-1 5 3 6z" fill="${fr.color2}"/><path d="M62 ${y + 8}q1-6-3-9 1 5-3 6z" fill="${fr.color2}"/>`).join('') : '';
  return `${grad}${glow}<rect x="2.5" y="2.5" width="59" height="59" rx="15" fill="none" stroke="${fr.color2}" stroke-width="5"/><rect x="2.5" y="2.5" width="59" height="59" rx="15" fill="none" stroke="${stroke}" stroke-width="3" ${fr.dashed ? 'stroke-dasharray="5 3"' : ''}/>${leaves}${flames}`;
}

/**
 * Renvoie le SVG d'un avatar. avatar = { kind: 'gen', seed, palette }
 * look = { frame: objet cadre, hat: id d'accessoire, character: id de personnage } (boutique)
 */
export function avatarSVG(avatar, { size = 64, label = '', look = null } = {}) {
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  const hat = look?.hat && look.hat !== 'none' ? HAT_SVG[look.hat] ?? '' : '';
  const frame = frameSVG(look?.frame);
  const ch = CHARACTERS[look?.character];
  if (ch) {
    return `<svg class="avatar-svg" viewBox="0 0 64 64" width="${size}" height="${size}" ${a11y}><rect width="64" height="64" rx="16" fill="${ch.bg}"/>${ch.svg}${frame}${hat}</svg>`;
  }
  // Ancienne image importée (plus permise) : on dessine le robot par défaut
  const gen = avatar?.kind === 'gen' ? avatar : { seed: 'gameverse', palette: 0 };
  const p = getPalette(gen.palette ?? 0);
  const f = parts(gen.seed ?? 'gameverse');
  const screen = '#11131f';
  return `<svg class="avatar-svg" viewBox="0 0 64 64" width="${size}" height="${size}" ${a11y}>
    <rect width="64" height="64" rx="16" fill="${p.bg}"/>
    ${hat && look.hat !== 'lunettes' ? '' : TOPS[f.top](p)}
    <rect x="12" y="19" width="40" height="34" rx="11" fill="${p.deep}"/>
    <rect x="12" y="16" width="40" height="34" rx="11" fill="${p.main}"/>
    ${p.shine ? '<path d="M17 21a7 7 0 0 1 6-3" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" fill="none" stroke-linecap="round"/>' : ''}
    <rect x="17" y="22" width="30" height="22" rx="7" fill="${screen}"/>
    ${EYES[f.eyes](p.eye)}
    ${MOUTHS[f.mouth](p.eye)}
    ${f.cheeks ? `<circle cx="15.5" cy="39" r="2.4" fill="${p.deep}" opacity=".9"/><circle cx="48.5" cy="39" r="2.4" fill="${p.deep}" opacity=".9"/>` : ''}
    <rect x="22" y="53" width="20" height="5" rx="2.5" fill="${p.deep}"/>
    ${frame}${hat}
  </svg>`;
}

export const randomSeed = () => Math.random().toString(36).slice(2, 10);
