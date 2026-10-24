// Couleurs : mélange de teintes hexadécimales pour les transitions de palette.

import { lerp } from './math.js';

export const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export const rgbStr = ([r, g, b], a = 1) => (a < 1 ? `rgba(${r | 0},${g | 0},${b | 0},${a})` : `rgb(${r | 0},${g | 0},${b | 0})`);

/** Mélange deux couleurs #rrggbb (t = 0 → a, t = 1 → b). */
export function mixHex(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbStr([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
}

/** Mélange récursif de deux objets de palette (chaînes hex, tableaux de chaînes). */
export function mixPalette(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) {
    const va = a[k];
    const vb = b[k];
    if (typeof va === 'string' && va.startsWith('#') && typeof vb === 'string') out[k] = mixHex(va, vb, t);
    else if (Array.isArray(va) && Array.isArray(vb)) out[k] = va.map((c, i) => (typeof c === 'string' ? mixHex(c, vb[i] ?? c, t) : c));
    else if (typeof va === 'number' && typeof vb === 'number') out[k] = lerp(va, vb, t);
    else out[k] = t < 0.5 ? va : vb;
  }
  return out;
}
