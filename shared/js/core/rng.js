// Générateur pseudo-aléatoire déterministe (mulberry32) et seeds journalières.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed = Date.now()) {
  let a = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    weighted(items, weightOf = (it) => it.weight) {
      const total = items.reduce((s, it) => s + weightOf(it), 0);
      let r = next() * total;
      for (const it of items) {
        r -= weightOf(it);
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },
  };
}

// Jour local au format AAAA-MM-JJ (le défi du jour change à minuit, heure du joueur).
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetween(keyA, keyB) {
  const [ya, ma, da] = keyA.split('-').map(Number);
  const [yb, mb, db] = keyB.split('-').map(Number);
  const a = Date.UTC(ya, ma - 1, da);
  const b = Date.UTC(yb, mb - 1, db);
  return Math.round((b - a) / 86400000);
}

export const dailySeed = (salt = '', date = new Date()) => hashString(`gameverse:${salt}:${dayKey(date)}`);

export const random = createRng();
