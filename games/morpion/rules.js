// Morpion Dynamique — règles et IA.
// Chaque joueur a au plus 3 pions : poser le 4e efface son plus ancien (avant de vérifier
// l'alignement). Pas de match nul possible. L'IA est un negamax alpha-bêta qui connaît la règle.

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
export const MAX_PIECES = 3;

/** État : { X: [cases du plus ancien au plus récent], O: [...], turn: 'X' | 'O' } */
export const newState = (first = 'X') => ({ X: [], O: [], turn: first });

export const other = (p) => (p === 'X' ? 'O' : 'X');

export function occupied(s) {
  const cells = Array(9).fill(null);
  for (const p of ['X', 'O']) for (const c of s[p]) cells[c] = p;
  return cells;
}

/** Le pion qui disparaîtra si `player` joue maintenant (ou null). */
export const doomed = (s, player) => (s[player].length >= MAX_PIECES ? s[player][0] : null);

export const moves = (s) => {
  const cells = occupied(s);
  const out = [];
  for (let i = 0; i < 9; i++) if (!cells[i]) out.push(i);
  return out;
};

/** Joue un coup ; renvoie le nouvel état et ce qui s'est passé. */
export function play(s, cell) {
  const p = s.turn;
  const mine = [...s[p], cell];
  let removed = null;
  if (mine.length > MAX_PIECES) removed = mine.shift();
  const next = { ...s, [p]: mine, turn: other(p) };
  const line = winningLine(mine);
  return { state: next, removed, winner: line ? p : null, line };
}

export function winningLine(pieces) {
  if (pieces.length < 3) return null;
  for (const l of LINES) if (l.every((c) => pieces.includes(c))) return l;
  return null;
}

/** Cases où `player` gagnerait immédiatement en jouant maintenant. */
export function threats(s, player) {
  const out = [];
  const t = { ...s, turn: player };
  for (const m of moves(t)) if (play(t, m).winner) out.push(m);
  return out;
}

// ---------- IA ----------
const key = (s) => `${s.X.join('')}|${s.O.join('')}|${s.turn}`;

function evaluate(s, me) {
  // Menaces immédiates, centre, et pression sur l'adversaire
  const t1 = threats(s, me).length;
  const t2 = threats(s, other(me)).length;
  let v = (t1 - t2) * 12;
  if (s[me].includes(4)) v += 3;
  if (s[other(me)].includes(4)) v -= 3;
  return v;
}

function negamax(s, depth, alpha, beta, me, memo) {
  const k = key(s) + depth;
  if (memo.has(k)) return memo.get(k);
  if (depth === 0) {
    const v = s.turn === me ? evaluate(s, me) : -evaluate(s, me);
    return v;
  }
  let best = -Infinity;
  const ms = order(s, moves(s));
  for (const m of ms) {
    const r = play(s, m);
    let v;
    if (r.winner) v = 1000 + depth; // gagner vite vaut mieux
    else v = -negamax(r.state, depth - 1, -beta, -alpha, me, memo);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  memo.set(k, best);
  return best;
}

// Explore d'abord les coups gagnants, les blocages et le centre
function order(s, ms) {
  const win = new Set(threats(s, s.turn));
  const block = new Set(threats(s, other(s.turn)));
  return ms.sort((a, b) => score(b) - score(a));
  function score(m) {
    return (win.has(m) ? 100 : 0) + (block.has(m) ? 50 : 0) + (m === 4 ? 5 : 0) + ([0, 2, 6, 8].includes(m) ? 2 : 0);
  }
}

export const LEVELS = {
  facile: { id: 'facile', name: 'Pixel', label: 'Facile', depth: 1, blunder: 0.45, mult: 1, palette: 2, seed: 'pixel' },
  normal: { id: 'normal', name: 'Rouille', label: 'Normal', depth: 4, blunder: 0.12, mult: 2, palette: 6, seed: 'rouille' },
  expert: { id: 'expert', name: 'l’Oracle', label: 'Expert', depth: 9, blunder: 0, mult: 4, palette: 4, seed: 'oracle-9' },
};

/** Choisit le coup de l'IA pour le joueur `s.turn`. rng() ∈ [0, 1). */
export function aiMove(s, level, rng = Math.random) {
  const ms = moves(s);
  if (!ms.length) return null;
  const me = s.turn;
  // Ne rate jamais une victoire immédiate, même en Facile
  const win = threats(s, me);
  if (win.length) return win[0];
  if (rng() < level.blunder) return ms[Math.floor(rng() * ms.length)];
  let best = null;
  let bestV = -Infinity;
  const memo = new Map();
  for (const m of order(s, ms)) {
    const r = play(s, m);
    const v = r.winner ? 1000 : -negamax(r.state, level.depth - 1, -Infinity, Infinity, me, memo);
    // Légère part d'aléa entre coups équivalents, pour ne pas jouer toujours pareil
    const jitter = rng() * 0.5;
    if (v + jitter > bestV) {
      bestV = v + jitter;
      best = m;
    }
  }
  return best;
}
