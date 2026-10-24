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

/** Renvoie le SVG d'un avatar. avatar = { kind: 'gen', seed, palette } | { kind: 'image', data } */
export function avatarSVG(avatar, { size = 64, label = '' } = {}) {
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  if (avatar?.kind === 'image' && typeof avatar.data === 'string' && avatar.data.startsWith('data:image/')) {
    return `<img class="avatar-img" src="${esc(avatar.data)}" width="${size}" height="${size}" alt="${esc(label)}" ${label ? '' : 'aria-hidden="true"'}>`;
  }
  const p = getPalette(avatar?.palette ?? 0);
  const f = parts(avatar?.seed ?? 'gameverse');
  const screen = '#11131f';
  return `<svg class="avatar-svg" viewBox="0 0 64 64" width="${size}" height="${size}" ${a11y}>
    <rect width="64" height="64" rx="16" fill="${p.bg}"/>
    ${TOPS[f.top](p)}
    <rect x="12" y="19" width="40" height="34" rx="11" fill="${p.deep}"/>
    <rect x="12" y="16" width="40" height="34" rx="11" fill="${p.main}"/>
    ${p.shine ? '<path d="M17 21a7 7 0 0 1 6-3" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" fill="none" stroke-linecap="round"/>' : ''}
    <rect x="17" y="22" width="30" height="22" rx="7" fill="${screen}"/>
    ${EYES[f.eyes](p.eye)}
    ${MOUTHS[f.mouth](p.eye)}
    ${f.cheeks ? `<circle cx="15.5" cy="39" r="2.4" fill="${p.deep}" opacity=".9"/><circle cx="48.5" cy="39" r="2.4" fill="${p.deep}" opacity=".9"/>` : ''}
    <rect x="22" y="53" width="20" height="5" rx="2.5" fill="${p.deep}"/>
  </svg>`;
}

export const randomSeed = () => Math.random().toString(36).slice(2, 10);
