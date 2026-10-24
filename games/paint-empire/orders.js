// Paint Empire — commandes de clients et contrats de galeries. Fonctions pures : la génération
// s'appuie sur la capacité de production du moment, pour que chaque commande reste faisable
// mais tendue.

import { clamp } from '../../shared/js/core/math.js';
import * as E from './economy.js';

// ---------- Toiles ----------
// Une toile : { style (index), rarity (id), format (id), family (id) }
const RANK = { commune: 0, belle: 1, remarquable: 2, chef: 3 };
export const rarityRank = (id) => RANK[id] ?? 0;

/** La toile convient-elle aux contraintes ? */
export function matches(p, c = {}) {
  if (c.style !== undefined && c.style !== null && p.style !== c.style) return false;
  if (c.format && p.format !== c.format) return false;
  if (c.family && p.family !== c.family) return false;
  if (c.rarity && rarityRank(p.rarity) < rarityRank(c.rarity)) return false;
  return true;
}

/** Probabilités de rareté (mêmes règles que E.rollRarity). */
export function rarityOdds(s) {
  const t = s.tools?.toiles ?? 0;
  const chef = 0.01 + 0.004 * t + 0.01 * (s.patrons?.oeil ?? 0);
  const rem = 0.06 + 0.01 * t;
  const belle = 0.2 + 0.015 * t;
  return { chef, remarquable: chef + rem, belle: chef + rem + belle, commune: 1 };
}
export const pAtLeast = (s, rarity) => (rarity ? rarityOdds(s)[rarity] : 1);

// ---------- Capacité de production ----------
// Rythme de clic raisonnable (le joueur ne clique pas en continu)
const CLICKS_PER_SECOND = 2;
const HAND_SHARE = 0.6;

/** Toiles par seconde qui conviennent à ces contraintes (main + chevalet + assistants). */
export function matchingRate(s, c = {}, currentStyle = 0) {
  const fmt = E.formatOf(c.format ?? 'moyen');
  const hand = ((CLICKS_PER_SECOND * E.strokesPerClick(s) + E.autoStrokes(s)) / fmt.strokes) * HAND_SHARE;
  const pr = pAtLeast(s, c.rarity);
  // Les assistants peignent le style du moment, en format moyen, couleur au hasard
  const styleOk = c.style === undefined || c.style === null || c.style === currentStyle;
  const formatOk = !c.format || c.format === 'moyen';
  const famP = c.family ? (c.family === 'rouge' || c.family === 'brume' ? 0.2 : 0.1) : 1;
  const assist = styleOk && formatOk ? E.assistantPaintingRate(s) * famP : 0;
  return hand * pr + assist * pr;
}

// ---------- Types de commandes ----------
export const ORDER_TYPES = {
  express: { name: 'Express', target: 45, slack: 1.25, pay: 2.6, window: 35, min: [20, 90] },
  normale: { name: 'Commande', target: 120, slack: 1.6, pay: 2, window: 60, min: [45, 420] },
  geante: { name: 'Géante', target: 600, slack: 1.8, pay: 2.4, window: 90, min: [240, 1500] },
  chaine: { name: 'En chaîne', target: 90, slack: 1.5, pay: 1.7, window: 75, min: [45, 300] },
  surprise: { name: 'Surprise', target: 40, slack: 1.3, pay: 3, window: 30, min: [20, 90] },
};

// Ce que chaque type de client commande, et ses habitudes
const KINDS = {
  voisin: { types: { normale: 0.65, express: 0.35 }, count: [1, 3], fmt: 0.5, fmtPick: ['petit', 'moyen'], fam: 0.3, style: 0, rarity: 0 },
  commerce: { types: { normale: 0.6, express: 0.4 }, count: [2, 5], fmt: 0.4, fmtPick: ['petit', 'moyen', 'grand'], fam: 0.5, style: 0.1, rarity: 0.1 },
  entreprise: { types: { normale: 0.5, chaine: 0.25, geante: 0.25 }, count: [3, 10], fmt: 0.35, fmtPick: ['moyen', 'grand'], fam: 0.25, style: 0.4, rarity: 0.2 },
  hotel: { types: { normale: 0.5, geante: 0.5 }, count: [5, 14], fmt: 0.3, fmtPick: ['moyen', 'grand'], fam: 0.7, style: 0.2, rarity: 0.1 },
  musee: { types: { normale: 0.4, chaine: 0.6 }, count: [2, 5], fmt: 0.2, fmtPick: ['grand'], fam: 0.1, style: 0.7, rarity: 0.8 },
  celebrite: { types: { express: 0.65, normale: 0.35 }, count: [1, 3], fmt: 0.4, fmtPick: ['grand', 'petit'], fam: 0.5, style: 0.3, rarity: 0.7 },
};

const FAMILY_IDS = E.FAMILIES.map((f) => f.id);

/** Contraintes tirées au hasard selon le client et ce que le joueur sait déjà faire. */
export function makeConstraints(rng, kindId, ctx) {
  const k = KINDS[kindId] ?? KINDS.voisin;
  const c = {};
  if (rng.chance(k.fmt)) c.format = rng.pick(k.fmtPick);
  if (rng.chance(k.fam)) c.family = rng.pick(FAMILY_IDS);
  if (ctx.maxStyle > 0 && rng.chance(k.style)) {
    // Souvent le style du moment, parfois un ancien (à peindre soi-même)
    const st = rng.chance(0.6) ? ctx.maxStyle : rng.int(0, ctx.maxStyle);
    if (!(ctx.blockedStyles ?? []).includes(st)) c.style = st;
  }
  if (rng.chance(k.rarity)) c.rarity = kindId === 'musee' || kindId === 'celebrite' ? (rng.chance(0.35) ? 'remarquable' : 'belle') : 'belle';
  return c;
}

/**
 * Une offre de commande. ctx = { s, maxStyle, blockedStyles, festival, loyal:Set, canGiant, now }
 * Le nombre de toiles est choisi pour viser la durée type, puis la durée est recalculée :
 * toujours faisable, jamais confortable.
 */
export function makeOffer(rng, client, ctx, forcedType) {
  const k = KINDS[client.kind] ?? KINDS.voisin;
  let type = forcedType ?? (ctx.festival ? 'surprise' : rng.weighted(Object.entries(k.types).map(([id, w]) => ({ id, weight: id === 'geante' && !ctx.canGiant ? 0 : w }))).id);
  if (type === 'geante' && !ctx.canGiant && !forcedType) type = 'normale';
  const stages = type === 'chaine' ? 3 : 1;
  const steps = Array.from({ length: stages }, (_, i) => makeStep(rng, client, ctx, type, i));
  const T = ORDER_TYPES[type];
  const loyal = ctx.loyal?.has(client.id) ?? false;
  return {
    id: `${client.id}-${Math.floor(rng.next() * 1e9).toString(36)}`,
    client: client.id,
    type,
    steps,
    stage: 0,
    expiresIn: T.window,
    loyal,
  };
}

function makeStep(rng, client, ctx, type, i) {
  const k = KINDS[client.kind] ?? KINDS.voisin;
  const T = ORDER_TYPES[type];
  const c = makeConstraints(rng, client.kind, ctx);
  const rate = Math.max(0.004, matchingRate(ctx.s, c, ctx.maxStyle));
  // Plus l'atelier produit, plus les commandes grossissent : elles restent tendues à tout moment
  const scale = 1 + Math.log10(1 + rate * 20);
  const [lo, hi0] = type === 'geante' ? [k.count[1] * 2, k.count[1] * 5] : type === 'express' || type === 'surprise' ? [1, Math.max(2, Math.ceil(k.count[1] / 2))] : k.count;
  // Quand les assistants prennent le relais, la taille suit la production pour viser la durée type
  const follow = rate > 0.5 ? Math.round(((rate * T.target) / T.slack) * 0.85) : 0;
  const hi = Math.min(5000, Math.max(Math.round(hi0 * scale), follow));
  const count = clamp(Math.round((rate * T.target) / T.slack), lo, hi + (type === 'chaine' ? i : 0));
  const duration = clamp(Math.round((count / rate) * T.slack), T.min[0], T.min[1]);
  return { c, count, duration, delivered: 0, left: duration };
}

/** Valeur marchande de référence d'une toile pour ces contraintes. */
export function stepValue(s, step, maxStyle) {
  const r = E.RARITIES[Math.max(rarityRank(step.c.rarity), 0)];
  return E.paintingValue(s, r, step.c.style ?? maxStyle, step.c.format ?? 'moyen');
}

/** Paiement d'une étape (ou de la commande entière pour les types à une étape). */
export function stepReward(s, order, stepIdx, maxStyle, { festival = false } = {}) {
  const step = order.steps[stepIdx];
  const T = ORDER_TYPES[order.type];
  const last = stepIdx === order.steps.length - 1;
  const chainBonus = order.type === 'chaine' ? (last ? 2.5 : 1) : 1;
  const money = stepValue(s, step, maxStyle) * step.count * T.pay * chainBonus * E.repPayMult(s.rep ?? 0) * (order.loyal ? 1.3 : 1) * (festival ? 1.5 : 1) * (1 + 0.1 * (s.contracts?.length ?? 0));
  const rep = last ? Math.round((2 + order.steps.reduce((n, st) => n + st.count, 0) * 0.6) * (order.type === 'geante' ? 1.5 : order.type === 'chaine' ? 1.4 : 1)) : 0;
  return { money, rep };
}

/** Pénalité d'un échec : proportionnée, jamais bloquante. */
export function failurePenalty(s, order, maxStyle) {
  const step = order.steps[order.stage];
  const reward = stepReward(s, order, order.stage, maxStyle).money;
  const money = Math.min(reward * 0.1, (s.money ?? 0) * 0.05);
  const rep = Math.min(s.rep ?? 0, 3 + Math.round(step.count * 0.5));
  return { money, rep, cooldown: 300 };
}

export const ITEMS = {
  pigment: { name: 'Pigment rare', desc: 'Ta prochaine toile peinte à la main gagne un cran de rareté.' },
  toile: { name: 'Toile spéciale', desc: 'Ta prochaine toile peinte à la main sera au moins remarquable.' },
  plan: { name: 'Plan de bâtiment', desc: '−30 % sur ton prochain achat de bâtiment.' },
};
/** Objet rare offert parfois par un client satisfait. */
export function rollItem(rng, order) {
  const chance = order.client === 'vega' ? 0.6 : order.type === 'geante' || order.type === 'chaine' ? 0.4 : 0.12;
  if (!rng.chance(chance)) return null;
  return rng.weighted([
    { id: 'pigment', weight: 5 },
    { id: 'toile', weight: 3 },
    { id: 'plan', weight: 2 },
  ]).id;
}

// ---------- Contrats de galeries ----------
export const CONTRACT_HOURS = { blanche: 1, port: 2, aurore: 3 };

/** Proposition de contrat d'une galerie : un style exclusif, un volume, une durée en heures. */
export function makeContract(rng, gallery, s, maxStyle) {
  const affinity = (gallery.styles ?? []).map((id) => E.STYLES.findIndex((st) => st.id === id)).filter((i) => i >= 0 && i <= maxStyle);
  const style = affinity.length && rng.chance(0.6) ? rng.pick(affinity) : maxStyle;
  const hours = CONTRACT_HOURS[gallery.id] ?? 1;
  const total = hours * 3600;
  // Surtout le travail qui tourne seul (assistants, chevalet), plus quelques minutes de pinceau
  const assist = style === maxStyle ? E.assistantPaintingRate(s) : 0;
  const auto = E.autoStrokes(s) / 12;
  const hand = (CLICKS_PER_SECOND * E.strokesPerClick(s)) / 12;
  const volume = Math.max(10, Math.round((assist + auto) * total * 0.45 + hand * 300));
  return { gallery: gallery.id, style, hours, volume, delivered: 0, elapsed: 0, total };
}
export function contractReward(s, ct) {
  const value = E.paintingValue(s, E.RARITIES[0], ct.style);
  return { money: value * ct.volume * 1.5, rep: 30 + ct.hours * 20 };
}
/** Retard sur le rythme attendu (0 = dans les temps, 1 = rien de livré). */
export function contractLag(ct) {
  const expected = ct.volume * (ct.elapsed / ct.total);
  return expected <= 0 ? 0 : clamp((expected - ct.delivered) / expected);
}
export const contractBreakPenalty = (s) => ({ rep: Math.min(s.rep ?? 0, 25), cooldown: 1800 });
