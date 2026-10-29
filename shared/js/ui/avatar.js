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

// ---------- Boutique : cadres et accessoires ----------
// frame = { id, color, color2, glow, dashed, leaves } ; hat = id
const HAT_SVG = {
  fete: '<path d="M24 18L33 0l8 18z" fill="#ff5fa2"/><path d="M27 12l10-2M29 7l7-1.5" stroke="#ffc93c" stroke-width="2.4"/><circle cx="33" cy="1.5" r="3" fill="#ffc93c"/>',
  antennes: '<path d="M24 17L17 5M40 17l7-12" stroke="#a9b3c4" stroke-width="2.6" stroke-linecap="round"/><circle cx="16.5" cy="4.5" r="3.6" fill="#ff5a4e"/><circle cx="47.5" cy="4.5" r="3.6" fill="#3ee6a8"/>',
  lunettes: '<rect x="18" y="25.5" width="13" height="10" rx="4" fill="#05060b"/><rect x="33" y="25.5" width="13" height="10" rx="4" fill="#05060b"/><path d="M31 29h2" stroke="#05060b" stroke-width="2"/><path d="M20.5 28l3-1.5M35.5 28l3-1.5" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/>',
  casque: '<path d="M9 34a23 22 0 0 1 46 0" fill="none" stroke="#2b2d42" stroke-width="4.5"/><rect x="4.5" y="28" width="10" height="17" rx="4" fill="#ff5a4e" stroke="#2b2d42" stroke-width="2"/><rect x="49.5" y="28" width="10" height="17" rx="4" fill="#ff5a4e" stroke="#2b2d42" stroke-width="2"/>',
  couronne: '<path d="M19 18V6l7 6 6-9 6 9 7-6v12z" fill="#ffc93c" stroke="#c98f00" stroke-width="1.6" stroke-linejoin="round"/><circle cx="32" cy="13" r="2.2" fill="#ff5a4e"/><circle cx="24" cy="15" r="1.6" fill="#4cc3ff"/><circle cx="40" cy="15" r="1.6" fill="#3ee6a8"/>',
  aureole: '<ellipse cx="32" cy="8" rx="15" ry="4.2" fill="none" stroke="#fff3c4" stroke-width="5" opacity=".35"/><ellipse cx="32" cy="8" rx="15" ry="4.2" fill="none" stroke="#ffd15c" stroke-width="2.6"/>',
};
let uid = 0;
function frameSVG(fr) {
  if (!fr || fr.id === 'none') return '';
  const id = `avf${++uid}`;
  const glow = fr.glow ? `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter><rect x="2.5" y="2.5" width="59" height="59" rx="15" fill="none" stroke="${fr.color}" stroke-width="5" filter="url(#${id})" opacity=".8"/>` : '';
  const leaves = fr.leaves ? [8, 18, 28, 38, 48].map((y) => `<ellipse cx="4.5" cy="${y + 6}" rx="2.6" ry="5" fill="${fr.color}" transform="rotate(-25 4.5 ${y + 6})"/><ellipse cx="59.5" cy="${y + 6}" rx="2.6" ry="5" fill="${fr.color}" transform="rotate(25 59.5 ${y + 6})"/>`).join('') + `<circle cx="32" cy="61" r="2.6" fill="${fr.color2}"/>` : '';
  return `${glow}<rect x="2.5" y="2.5" width="59" height="59" rx="15" fill="none" stroke="${fr.color2}" stroke-width="5"/><rect x="2.5" y="2.5" width="59" height="59" rx="15" fill="none" stroke="${fr.color}" stroke-width="3" ${fr.dashed ? 'stroke-dasharray="5 3"' : ''}/>${leaves}`;
}

/**
 * Renvoie le SVG d'un avatar. avatar = { kind: 'gen', seed, palette } | { kind: 'image', data }
 * look = { frame: objet cadre, hat: id d'accessoire } (boutique)
 */
export function avatarSVG(avatar, { size = 64, label = '', look = null } = {}) {
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  const hat = look?.hat && look.hat !== 'none' ? HAT_SVG[look.hat] ?? '' : '';
  const frame = frameSVG(look?.frame);
  if (avatar?.kind === 'image' && typeof avatar.data === 'string' && avatar.data.startsWith('data:image/')) {
    if (!hat && !frame) return `<img class="avatar-img" src="${esc(avatar.data)}" width="${size}" height="${size}" alt="${esc(label)}" ${label ? '' : 'aria-hidden="true"'}>`;
    const clip = `avc${++uid}`;
    return `<svg class="avatar-svg" viewBox="0 0 64 64" width="${size}" height="${size}" ${a11y}><clipPath id="${clip}"><rect width="64" height="64" rx="16"/></clipPath><image href="${esc(avatar.data)}" width="64" height="64" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/>${frame}${hat}</svg>`;
  }
  const p = getPalette(avatar?.palette ?? 0);
  const f = parts(avatar?.seed ?? 'gameverse');
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
