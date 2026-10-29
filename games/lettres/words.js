// Lettres en vrac — dictionnaire et tirages. Les mots sont comparés sans accents, en majuscules.
// Mots « cibles » : ceux de la liste. Mots « bonus » : pluriels et formes courantes des verbes en -er.

export const MIN = 3;
export const MAX = 7;
export const norm = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');

const counts = (w) => {
  const c = {};
  for (const ch of w) c[ch] = (c[ch] ?? 0) + 1;
  return c;
};
export const fits = (w, pool) => {
  const c = { ...pool };
  for (const ch of w) {
    if (!c[ch]) return false;
    c[ch]--;
  }
  return true;
};

const VERB_ENDS = ['E', 'ES', 'ENT', 'ONS', 'EZ', 'A', 'AS', 'AI', 'AIT', 'AIS', 'ANT', 'EE', 'EES'];

export function createDict(raw) {
  const base = new Set(raw.split(/\s+/).map(norm).filter((w) => w.length >= MIN && w.length <= MAX));
  const bonus = new Set();
  for (const w of base) {
    if (w.length < MAX) bonus.add(`${w}S`);
    if (w.length >= 5 && w.endsWith('ER')) for (const e of VERB_ENDS) bonus.add(w.slice(0, -2) + e);
  }
  for (const w of base) bonus.delete(w);
  for (const w of [...bonus]) if (w.length > MAX || w.length < MIN) bonus.delete(w);
  const list = [...base];
  const roots = list.filter((w) => w.length === MAX);
  return {
    base,
    bonus,
    /** Mots cibles d'un tirage */
    targets(letters) {
      const pool = counts(letters);
      return list.filter((w) => fits(w, pool)).sort((a, b) => a.length - b.length || a.localeCompare(b));
    },
    /** Tirage : un mot de 7 lettres riche en sous-mots, mélangé */
    draw(rng, { minTargets = 12, avoid = [] } = {}) {
      for (let k = 0; k < 400; k++) {
        const root = rng.pick(roots);
        if (avoid.includes(root)) continue;
        const t = this.targets(root);
        if (t.length < minTargets) continue;
        return { root, letters: rng.shuffle([...root]), targets: t };
      }
      const root = roots[0];
      return { root, letters: [...root], targets: this.targets(root) };
    },
    kind(w) {
      return base.has(w) ? 'target' : bonus.has(w) ? 'bonus' : null;
    },
  };
}

export const POINTS = { 3: 30, 4: 50, 5: 80, 6: 120, 7: 250 };
