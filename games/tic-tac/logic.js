// Règles pures de Tic Tac : angles, difficulté, jugement d'une touche.
// Angle 0 = midi, croissant dans le sens des aiguilles d'une montre.

import { TAU, clamp } from '../../shared/js/core/math.js';
import { DIFF, SCORE, FEATURES } from './config.js';

/** Écart angulaire ramené dans ]-π, π]. */
export function wrapSigned(a) {
  a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a === -Math.PI ? Math.PI : a;
}

/** Vitesse, largeur de zone et part « pile » après `hits` réussites. */
export function difficulty(hits) {
  const speed = Math.min(DIFF.speedMax, DIFF.speed0 + hits * DIFF.speedPerHit);
  const half = Math.max(DIFF.halfMin, DIFF.half0 - hits * DIFF.halfPerHit);
  const perfect = Math.max(DIFF.perfectMin, half * DIFF.perfectRatio);
  return { speed, half, perfect };
}

export const hourOf = (hits) => 1 + Math.floor(hits / DIFF.hitsPerHour);
export const hasFeature = (hour, id) => hour >= (FEATURES.find((f) => f.id === id)?.hour ?? Infinity);
export const hourLabel = (h) => (h === 12 ? 'Midi' : h === 24 ? 'Minuit' : `${h} h`);

/** Distance de l'aiguille au centre d'une cible, positive tant que la cible est devant. */
export const distanceTo = (target, angle, dir) => wrapSigned(target.center - angle) * dir;

/**
 * Jugement d'une touche. Renvoie la cible touchée et la qualité, ou null si l'aiguille n'est
 * dans aucune zone (« trop tôt » ou « à côté »).
 */
export function judge(targets, angle, dir) {
  let bestT = null;
  let bestK = Infinity;
  for (const t of targets) {
    if (t.dead) continue;
    const d = distanceTo(t, angle, dir);
    if (Math.abs(d) > t.half + DIFF.grace) continue;
    const k = Math.abs(d) / t.half;
    if (k < bestK) {
      bestK = k;
      bestT = t;
    }
  }
  if (!bestT) return null;
  const d = Math.abs(distanceTo(bestT, angle, dir));
  const quality = d <= bestT.perfect ? 'perfect' : d <= bestT.half ? 'hit' : 'limit';
  return { target: bestT, quality, offset: d };
}

export const multOf = (combo) => clamp(1 + Math.floor(combo / SCORE.comboStep), 1, SCORE.multMax);

/** Points d'une touche réussie. */
export function pointsFor(kind, quality, mult) {
  if (kind === 'bell') return SCORE.bell * mult;
  if (kind === 'key') return SCORE.key * mult;
  return (quality === 'perfect' ? SCORE.perfect : quality === 'limit' ? SCORE.limit : SCORE.hit) * mult;
}
