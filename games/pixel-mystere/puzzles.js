// Pixel Mystère — l'album de grilles (dessins en pixels faits pour le jeu), les indices, un
// solveur ligne par ligne (chaque grille doit se résoudre sans deviner) et la grille du jour.

import { createRng, dailySeed } from '../../shared/js/core/rng.js';

// Couleurs des pixels : une lettre = une couleur, « . » = case vide
export const COLORS = {
  r: '#e63946', o: '#f4a261', y: '#ffc93c', g: '#40916c', l: '#95d5b2', b: '#457b9d', c: '#4cc3ff',
  v: '#7b2cbf', p: '#ff8fab', n: '#8a5a3b', k: '#2b2d42', s: '#a9b3c4', w: '#f4efe4',
};

const P = (id, name, rows) => ({ id, name, rows, size: rows.length });

export const CHAPTERS = [
  {
    id: 'debut',
    name: 'Premiers pas',
    unlock: 0,
    puzzles: [
      P('coeur', 'Cœur', ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..']),
      P('maison', 'Maison', ['..r..', '.rrr.', 'rrrrr', '.y.y.', '.yyy.']),
      P('champi', 'Champignon', ['.rrr.', 'rwrwr', 'rrrrr', '.sss.', '.s.s.']),
      P('etoile', 'Étoile', ['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.']),
      P('sapin', 'Petit arbre', ['.ggg.', 'ggggg', '.ggg.', '..n..', '.nnn.']),
      P('sablier', 'Sablier', ['yyyyy', '.yyy.', '..y..', '.y.y.', 'yyyyy']),
      P('poisson', 'Poisson', ['.....', 'b.bb.', 'bbbbb', 'b.bb.', '.....']),
      P('fleur', 'Fleur', ['.ppp.', 'ppypp', '.ppp.', '..g..', '.gg..']),
    ],
  },
  {
    id: 'promenade',
    name: 'Promenade',
    unlock: 5,
    puzzles: [
      P('chat', 'Chat', ['.k......k.', '.kk....kk.', '.kkkkkkkk.', 'kkkkkkkkkk', 'kk.kkkk.kk', 'kkkkkkkkkk', 'kkkkppkkkk', '.kkkkkkkk.', '..kkkkkk..', '...kkkk...']),
      P('fusee', 'Fusée', ['....rr....', '...rrrr...', '...ssss...', '...sccs...', '...sccs...', '...ssss...', '..rssssr..', '.rrssssrr.', '.rr.oo.rr.', '....oo....']),
      P('voilier', 'Voilier', ['....w.....', '....ww....', '....www...', '....wwww..', '....wwwww.', '....n.....', 'nnnnnnnnnn', '.nnnnnnnn.', '..bbbbbb..', 'bbbbbbbbbb']),
      P('parapluie', 'Parapluie', ['...rrrr...', '.rrrrrrrr.', 'rrrrrrrrrr', 'rrrrrrrrrr', '....n.....', '....n.....', '....n.....', '....n.....', '.n..n.....', '..nn......']),
      P('sapin2', 'Sapin', ['....y.....', '....g.....', '...ggg....', '..ggggg...', '...ggg....', '..ggggg...', '.ggggggg..', 'ggggggggg.', '....n.....', '...nnn....']),
      P('tasse', 'Tasse fumante', ['..s..s....', '...s..s...', '..s..s....', 'bbbbbbb...', 'bbbbbbbbb.', 'bbbbbbb..b', 'bbbbbbbbb.', 'bbbbbbb...', '.bbbbb....', 'nnnnnnnn..']),
      P('cle', 'Clé', ['..yyyy....', '.yy..yy...', '.yy..yy...', '..yyyy....', '...yy.....', '...yy.....', '...yyyy...', '...yy.....', '...yyy....', '...yy.....']),
      P('note', 'Note de musique', ['....kkkkkk', '....kkkkkk', '....k....k', '....k....k', '....k....k', '..kkk..kkk', '.kkkk.kkkk', '.kkk..kkk.', '..........', '..........']),
      P('poisson2', 'Poisson-lune', ['..........', '...bbbb...', 'b.bbbbbb..', 'bbbbbbkbb.', 'bbbbbbbbbb', 'bbbbbbbbb.', 'b.bbbbbb..', '...bbbb...', '..........', '..........']),
      P('chalet', 'Chalet', ['....r.....', '...rrr....', '..rrrrr...', '.rrrrrrr..', 'rrrrrrrrr.', '.nnnnnnn..', '.n..nn.n..', '.n..nn.n..', '.nnn..nn..', '.nnn..nn..']),
      P('coeur2', 'Grand cœur', ['.rrr..rrr.', 'rrrrrrrrrr', 'rrrrrrrrrr', 'rrrrrrrrrr', '.rrrrrrrr.', '..rrrrrr..', '...rrrr...', '....rr....', '..........', '..........']),
      P('lune', 'Lune et étoile', ['...vvv....', '..vv......', '.vv....y..', '.vv...yyy.', '.vv....y..', '.vv.......', '..vv......', '...vvv....', '..........', '..........']),
      P('robot', 'Robot', ['....r.....', '....s.....', '..ssssss..', '..s.ss.s..', '..ssssss..', '..ss..ss..', '...ssss...', '.ssssssss.', '.s.ssss.s.', '...s..s...']),
    ],
  },
  {
    id: 'grand',
    name: 'Grand art',
    unlock: 12,
    puzzles: [
      P('montgolfiere', 'Montgolfière', ['.....rrrrr.....', '...rrryyyrrr...', '..rrryyyyyrrr..', '.rrryyyyyyyrrr.', '.rrryyyyyyyrrr.', 'rrrryyyyyyyrrrr', 'rrrryyyyyyyrrrr', '.rrryyyyyyyrrr.', '.rrryyyyyyyrrr.', '..rrryyyyyrrr..', '...rrryyyrrr...', '.....n...n.....', '......n.n......', '......nnn......', '......nnn......']),
      P('phare', 'Phare', ['.......y.......', '......kkk......', '......y.y......', '......kkk......', '.....rrrrr.....', '.....rrrrr.....', '.....wwwww.....', '.....wwwww.....', '....rrrrrrr....', '....rrrrrrr....', '....wwwwwww....', '....wwwwwww....', '...rrrrrrrrr...', '..nnnnnnnnnnn..', 'bbbbbbbbbbbbbbb']),
      P('hibou', 'Hibou', ['..n.........n..', '..nn.......nn..', '..nnnnnnnnnnn..', '.nnnnnnnnnnnnn.', '.nn...nnn...nn.', '.nn.k.nnn.k.nn.', '.nn...nnn...nn.', '.nnnnnyyynnnnn.', '.nnnnnnynnnnnn.', '.nnoonnnnnoonn.', '.nnnoonnnoonnn.', '..nnnnnnnnnnn..', '...nnnnnnnnn...', '....y.....y....', '...yyy...yyy...']),
      P('voiture', 'Voiture', ['...............', '...............', '....rrrrrrr....', '...rr..r..rr...', '..rr...r...rr..', '.rrrrrrrrrrrrr.', 'rrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrr', 'rrkkkrrrrrkkkrr', '.kkkkk...kkkkk.', '..kkk.....kkk..', '...............', 'sssssssssssssss', '...............', '...............']),
    ],
  },
];

export const ALL = CHAPTERS.flatMap((ch) => ch.puzzles.map((p) => ({ ...p, chapter: ch.id })));
export const byId = (id) => ALL.find((p) => p.id === id) ?? null;

// ---------- Indices ----------
export const filled = (rows) => rows.map((r) => [...r].map((c) => c !== '.'));
export function runs(line) {
  const out = [];
  let n = 0;
  for (const v of line) {
    if (v) n++;
    else if (n) {
      out.push(n);
      n = 0;
    }
  }
  if (n) out.push(n);
  return out.length ? out : [0];
}
export function clues(grid) {
  const size = grid.length;
  return {
    rows: grid.map((r) => runs(r)),
    cols: Array.from({ length: size }, (_, x) => runs(grid.map((r) => r[x]))),
  };
}

// ---------- Solveur ligne par ligne ----------
// Pour une ligne (valeurs 1 plein, 0 vide, -1 inconnu) et ses indices, déduit ce qui est sûr.
function solveLine(line, clue) {
  const n = line.length;
  const blocks = clue[0] === 0 ? [] : clue;
  const canFill = Array(n).fill(false);
  const canEmpty = Array(n).fill(false);
  // Énumère les placements compatibles, par récursion mémorisée
  const memo = new Map();
  const place = (bi, pos) => {
    const k = bi * (n + 1) + pos;
    if (memo.has(k)) return memo.get(k);
    let ok = false;
    if (bi === blocks.length) {
      ok = true;
      for (let i = pos; i < n; i++) if (line[i] === 1) ok = false;
      if (ok) for (let i = pos; i < n; i++) canEmpty[i] = true;
      memo.set(k, ok);
      return ok;
    }
    const len = blocks[bi];
    for (let s = pos; s + len <= n; s++) {
      // Cases avant le bloc : vides
      let before = true;
      for (let i = pos; i < s; i++) if (line[i] === 1) before = false;
      if (!before) break;
      let fits = true;
      for (let i = s; i < s + len; i++) if (line[i] === 0) fits = false;
      if (!fits) continue;
      if (s + len < n && line[s + len] === 1) continue;
      const next = s + len + (s + len < n ? 1 : 0);
      if (place(bi + 1, next)) {
        ok = true;
        for (let i = pos; i < s; i++) canEmpty[i] = true;
        for (let i = s; i < s + len; i++) canFill[i] = true;
        if (s + len < n) canEmpty[s + len] = true;
      }
    }
    memo.set(k, ok);
    return ok;
  };
  if (!place(0, 0)) return null;
  return line.map((v, i) => (v !== -1 ? v : canFill[i] && !canEmpty[i] ? 1 : !canFill[i] && canEmpty[i] ? 0 : -1));
}

/** Résout par déduction ligne par ligne. Renvoie la grille, ou null si on reste bloqué. */
export function solve(cl) {
  const size = cl.rows.length;
  const g = Array.from({ length: size }, () => Array(size).fill(-1));
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < size; y++) {
      const r = solveLine(g[y], cl.rows[y]);
      if (!r) return null;
      for (let x = 0; x < size; x++) if (r[x] !== g[y][x]) {
        g[y][x] = r[x];
        changed = true;
      }
    }
    for (let x = 0; x < size; x++) {
      const col = g.map((row) => row[x]);
      const r = solveLine(col, cl.cols[x]);
      if (!r) return null;
      for (let y = 0; y < size; y++) if (r[y] !== g[y][x]) {
        g[y][x] = r[y];
        changed = true;
      }
    }
  }
  return g.every((row) => row.every((v) => v !== -1)) ? g : null;
}

// ---------- Grille du jour : un emblème symétrique, toujours soluble ----------
const DAILY_PALETTES = [['r', 'y'], ['b', 'c'], ['g', 'l'], ['v', 'p'], ['o', 'y'], ['k', 's']];
export function dailyPuzzle(date = new Date(), size = 10) {
  const rng = createRng(dailySeed('pixel-mystere', date));
  const [c1, c2] = rng.pick(DAILY_PALETTES);
  for (let attempt = 0; attempt < 400; attempt++) {
    const half = Math.ceil(size / 2);
    const rows = Array.from({ length: size }, (_, y) => {
      const left = Array.from({ length: half }, () => rng.chance(0.58));
      const full = [...left, ...left.slice(0, size - half).reverse()];
      return full.map((v, x) => (v ? (Math.abs(x - (size - 1) / 2) + Math.abs(y - (size - 1) / 2) < size / 3 ? c2 : c1) : '.')).join('');
    });
    const grid = filled(rows);
    if (grid.some((r) => !r.some(Boolean))) continue;
    if (solve(clues(grid))) return { id: 'jour', name: 'Emblème du jour', rows, size };
  }
  return { ...ALL[0], id: 'jour', name: 'Emblème du jour' };
}
