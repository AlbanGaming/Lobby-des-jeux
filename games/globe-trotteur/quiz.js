// Globe-trotteur — fabrication des questions. Chaque pays a une maîtrise de 0 à 5 : les pays mal
// connus reviennent plus souvent, et un pays raté revient trois questions plus tard.

import { sameFlag } from './flags.js';

export const KINDS = {
  flag: { id: 'flag', label: 'Drapeau', prompt: 'À quel pays est ce drapeau ?' },
  capital: { id: 'capital', label: 'Capitale', prompt: 'Quelle est sa capitale ?' },
  city: { id: 'city', label: 'Capitale', prompt: 'De quel pays est-ce la capitale ?' },
  map: { id: 'map', label: 'Carte', prompt: 'Quel pays est marqué sur la carte ?' },
  flagpick: { id: 'flagpick', label: 'Drapeau', prompt: 'Quel est son drapeau ?' },
};
export const MAX_MASTERY = 5;

const deg = (a, b) => Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180)));
export const inBox = (c, box) => c.lon >= box[0] && c.lon <= box[2] && c.lat >= box[1] && c.lat <= box[3];

/** Les types de question possibles pour un pays */
export function kindsFor(c, continents) {
  const out = ['flag', 'flagpick'];
  if (c.cap !== c.name) out.push('capital', 'city');
  const box = continents.find((k) => k.id === c.cont)?.box;
  if (box && inBox(c, box)) out.push('map');
  return out;
}

function distractors(answer, all, rng, kind) {
  const ok = (c) => {
    if (c.id === answer.id) return false;
    if (kind === 'flag' || kind === 'flagpick') return !sameFlag(c.flag, answer.flag);
    if (kind === 'map') return deg(c, answer) >= 6;
    if (kind === 'capital' || kind === 'city') return c.cap !== answer.cap && c.cap !== c.name;
    return true;
  };
  const near = rng.shuffle(all.filter((c) => c.cont === answer.cont && ok(c)));
  const far = rng.shuffle(all.filter((c) => c.cont !== answer.cont && ok(c)));
  const picked = [];
  for (const c of [...near, ...far]) {
    if (picked.length >= 3) break;
    // Pas deux propositions au même drapeau, ni deux points trop proches sur la carte
    if (picked.some((p) => (kind.startsWith('flag') && sameFlag(p.flag, c.flag)) || (kind === 'map' && deg(p, c) < 6))) continue;
    picked.push(c);
  }
  return picked;
}

export function buildQuestion(answer, kind, all, rng) {
  const opts = rng.shuffle([answer, ...distractors(answer, all, rng, kind)]);
  return { kind, answer, options: opts };
}

/** Choix du prochain pays : pondéré par la maîtrise, en évitant les derniers vus */
export function createPicker({ pool, all, continents, rng, mastery, kindFilter = 'mix' }) {
  const recent = [];
  const queue = []; // { id, in } : pays ratés à reposer
  const allowed = (c) => {
    const ks = kindsFor(c, continents);
    if (kindFilter === 'mix') return ks;
    if (kindFilter === 'capital') return ks.filter((k) => k === 'capital' || k === 'city');
    if (kindFilter === 'flag') return ks.filter((k) => k === 'flag' || k === 'flagpick');
    return ks.filter((k) => k === kindFilter);
  };
  const candidates = pool.filter((c) => allowed(c).length);
  return {
    get size() {
      return candidates.length;
    },
    next() {
      queue.forEach((q) => q.in--);
      const due = queue.findIndex((q) => q.in <= 0);
      let c;
      if (due >= 0) {
        c = candidates.find((x) => x.id === queue[due].id);
        queue.splice(due, 1);
      }
      if (!c) {
        const fresh = candidates.filter((x) => !recent.includes(x.id));
        c = rng.weighted(fresh.length ? fresh : candidates, (x) => (MAX_MASTERY + 1 - (mastery[x.id] ?? 0)) ** 2);
      }
      recent.push(c.id);
      if (recent.length > Math.min(8, candidates.length - 1)) recent.shift();
      // Les pays peu connus commencent par les drapeaux, les questions de carte viennent ensuite
      const ks = allowed(c);
      const m = mastery[c.id] ?? 0;
      const easy = ks.filter((k) => k === 'flag' || k === 'capital');
      const kind = m < 1 && easy.length && rng.chance(0.6) ? rng.pick(easy) : rng.pick(ks);
      return buildQuestion(c, kind, all, rng);
    },
    missed(id) {
      if (!queue.some((q) => q.id === id)) queue.push({ id, in: 3 });
    },
  };
}

/** Défi du jour : 12 questions fixées par la date, tous continents confondus */
export function dailyQuestions(all, continents, rng, n = 12) {
  const picks = rng.shuffle(all).slice(0, n);
  return picks.map((c, i) => {
    const ks = kindsFor(c, continents);
    const order = ['flag', 'capital', 'map', 'city', 'flagpick'];
    const kind = ks.includes(order[i % order.length]) ? order[i % order.length] : rng.pick(ks);
    return buildQuestion(c, kind, all, rng);
  });
}
