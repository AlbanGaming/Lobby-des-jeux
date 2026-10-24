// Petits utilitaires numériques partagés par tous les jeux.

export const TAU = Math.PI * 2;

export const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
export const remap = (v, a1, b1, a2, b2) => lerp(a2, b2, invLerp(a1, b1, v));
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

// Lissage indépendant du framerate : `rate` = fraction restante après 1 seconde.
export const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.pow(rate, dt));

// Avance `current` vers `target` d'au plus `step`.
export const approach = (current, target, step) =>
  current < target ? Math.min(current + step, target) : Math.max(current - step, target);

export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

export const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const circleRect = (cx, cy, r, rect) => {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
};

// Formatage français : 12 345 · 1,2 k · 3,4 M
const nf = new Intl.NumberFormat('fr-FR');
export const formatInt = (n) => nf.format(Math.floor(n));

const UNITS = ['', ' k', ' M', ' Md', ' Bn', ' Bd', ' Tn'];
export function formatShort(n) {
  if (!Number.isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs < 10000) return formatInt(n);
  const tier = Math.min(UNITS.length - 1, Math.floor(Math.log10(abs) / 3));
  const scaled = n / 10 ** (tier * 3);
  const digits = Math.abs(scaled) < 10 ? 2 : Math.abs(scaled) < 100 ? 1 : 0;
  return scaled.toLocaleString('fr-FR', { maximumFractionDigits: digits }) + UNITS[tier];
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}
