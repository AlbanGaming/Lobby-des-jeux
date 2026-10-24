// Règles du Juste Prix : catalogue, prix « ronds », fourchettes de départ, barèmes, duels, objets du jour.

import { createRng, dailySeed, daysBetween, dayKey } from '../../shared/js/core/rng.js';
import { formatInt } from '../../shared/js/core/math.js';

export const RAYONS = [
  { id: 'quotidien', name: 'Courses & quotidien', unlock: 0 },
  { id: 'maison', name: 'Maison & cuisine', unlock: 0 },
  { id: 'loisirs', name: 'Sport & loisirs', unlock: 0 },
  { id: 'tech', name: 'High-tech', unlock: 1500 },
  { id: 'mode', name: 'Mode & accessoires', unlock: 3000 },
  { id: 'luxe', name: 'Luxe & insolite', unlock: 5000 },
];
export const rayonName = (id) => RAYONS.find((r) => r.id === id)?.name ?? '';

let catalog = null;
export async function loadCatalog() {
  if (catalog) return catalog;
  const res = await fetch(new URL('./data/items.json', import.meta.url));
  if (!res.ok) throw new Error(`Catalogue introuvable (${res.status})`);
  catalog = await res.json();
  return catalog;
}

/** Pas d'arrondi des prix : chaque prix du catalogue en est un multiple, et le joueur le sait. */
export const priceStep = (p) => (p < 20 ? 1 : p < 100 ? 5 : p < 1000 ? 10 : p < 5000 ? 50 : p < 20000 ? 500 : 1000);
export const stepLabel = (p) => (priceStep(p) === 1 ? 'à l’euro près' : `multiple de ${formatInt(priceStep(p))} €`);
export const formatPrice = (n) => `${formatInt(n)} €`;

/** Fourchette de départ « ronde » qui encadre le prix, sans le centrer. */
export function startRange(price, rng) {
  const unit = price < 20 ? 1 : priceStep(price) * 5;
  let lo = Math.floor((price * rng.range(0.3, 0.65)) / unit) * unit;
  let hi = Math.ceil((price * rng.range(1.5, 2.3)) / unit) * unit;
  if (lo >= price) lo = Math.max(0, price - unit);
  if (hi <= price) hi = price + unit;
  return { lo: Math.max(0, lo), hi };
}

/** Plus ou moins : points d'un prix trouvé. */
export const classicPoints = ({ secondsLeft, tries, mult }) => Math.round((300 + secondsLeft * 15 + Math.max(0, 8 - tries) * 25) * mult);
export const classicMult = (streak) => Math.min(3, 1 + streak * 0.5);

/** Au plus juste : précision d'une offre unique. */
export function estimate(guess, price) {
  const err = Math.abs(guess - price) / price;
  const tier = err <= 0.02 ? 'pile' : err <= 0.1 ? 'chaud' : err <= 0.25 ? 'tiede' : 'froid';
  let pts = Math.round(1000 * Math.pow(Math.max(0, 1 - err * 2), 1.6));
  if (tier === 'pile') pts = Math.round(pts * 1.5);
  return { err, tier, pts };
}
export const TIERS = {
  pile: { label: 'Pile !', color: '#3ee6a8', square: '🟩' },
  chaud: { label: 'Brûlant', color: '#ffc93c', square: '🟨' },
  tiede: { label: 'Tiède', color: '#ff8a5b', square: '🟧' },
  froid: { label: 'À côté', color: '#8b8fa3', square: '⬛' },
};
export const estimateMult = (streak) => Math.min(2.5, 1 + streak * 0.25);

/** Le plus cher : deux objets d'écart de prix de plus en plus serré avec le niveau. */
export function pickDuel(rng, items, level, avoid = new Set()) {
  const minRatio = Math.max(1.12, 2.4 - level * 0.09);
  const maxRatio = Math.max(1.7, 9 - level * 0.5);
  const pool = items.filter((i) => !avoid.has(i.id));
  const src = pool.length >= 2 ? pool : items;
  for (let n = 0; n < 400; n++) {
    const a = rng.pick(src);
    const b = rng.pick(src);
    if (a === b || a.price === b.price) continue;
    const r = Math.max(a.price, b.price) / Math.min(a.price, b.price);
    if (r >= minRatio && r <= maxRatio) return { a, b, ratio: r };
  }
  // Repli : deux objets de prix différents
  const [a, b] = rng.shuffle([...src]).filter((x, i, arr) => arr.findIndex((y) => y.price === x.price) === i);
  return { a, b, ratio: Math.max(a.price, b.price) / Math.min(a.price, b.price) };
}
export const duelPoints = (mult, speed) => Math.round((50 + 50 * speed) * mult);
export const duelMult = (streak) => Math.min(5, 1 + Math.floor(streak / 4));
export const duelTime = (level) => Math.max(4, 8 - level * 0.2);

/** Les 5 du jour : la même sélection pour tout le monde, tous rayons confondus. */
export const DAILY_COUNT = 5;
const EPOCH = '2026-01-01';
export const dailyIndex = (date = new Date()) => daysBetween(EPOCH, dayKey(date)) + 1;
export function dailyItems(items, date = new Date()) {
  const rng = createRng(dailySeed('juste-prix', date));
  const picks = [];
  const pool = rng.shuffle([...items]);
  // Une sélection variée : jamais deux objets du même rayon d'affilée
  for (const it of pool) {
    if (picks.length >= DAILY_COUNT) break;
    if (picks.length && picks[picks.length - 1].rayon === it.rayon) continue;
    picks.push(it);
  }
  return picks;
}
export function shareText(results, total, index) {
  const squares = results.map((r) => TIERS[r.tier].square).join('');
  return `Le Juste Prix du jour n°${index} · ${formatInt(total)} pts\n${squares}\nalbangaming.github.io/Lobby-des-jeux`;
}

// ---------- Reprise de l'ancien Juste Prix (clé « playerData ») ----------
const LEGACY_RAYONS = {
  'Électronique de base': 'tech',
  Gaming: 'tech',
  'Audio Premium': 'tech',
  'Montres connectées': 'tech',
  Ordinateurs: 'tech',
  'Photo & Vidéo': 'tech',
  'Maison connectée': 'tech',
  'Mode & Sneakers': 'mode',
  'Luxury Fashion': 'mode',
  Premium: 'luxe',
  'Objets Rétro & Vintage': 'luxe',
  'Figurines & Collectibles': 'luxe',
  'Produits Insolites': 'luxe',
};
export function fromLegacy(legacy) {
  if (!legacy || typeof legacy !== 'object') return null;
  const cats = Array.isArray(legacy.unlockedCategories) ? legacy.unlockedCategories : [];
  const bonusRayons = [...new Set(cats.map((c) => LEGACY_RAYONS[c]).filter(Boolean))];
  const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
  return { found: n(legacy.wins), bonusRayons, legacy: { level: n(legacy.level), wins: n(legacy.wins), money: n(legacy.money) } };
}
