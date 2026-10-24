// Énigmes Éclair — banque d'énigmes, questions générées (suites, calcul), tirage, barème.

import { createRng, dailySeed, daysBetween, dayKey } from '../../shared/js/core/rng.js';
import { clamp, formatInt } from '../../shared/js/core/math.js';

export const CATS = {
  devinette: { label: 'Devinette', icon: 'sparkle' },
  piege: { label: 'Question piège', icon: 'eye' },
  logique: { label: 'Logique', icon: 'blocks' },
  suite: { label: 'Suite logique', icon: 'chart' },
  calcul: { label: 'Calcul éclair', icon: 'bolt' },
};

let bank = null;
export async function loadBank() {
  if (bank) return bank;
  const res = await fetch(new URL('./data/riddles.json', import.meta.url));
  if (!res.ok) throw new Error(`Énigmes introuvables (${res.status})`);
  bank = await res.json();
  return bank;
}

// ---------- Questions générées ----------
const fmt = (n) => formatInt(n);

// Trois leurres proches de la bonne réponse, tous différents
function nearby(rng, answer, spread) {
  const out = new Set();
  const cands = [answer + spread, answer - spread, answer + 1, answer - 1, answer + spread * 2, answer * 2, Math.round(answer / 2), answer + 10, answer - 10];
  for (const c of rng.shuffle(cands)) {
    if (out.size >= 3) break;
    if (c !== answer && c >= 0 && Number.isInteger(c)) out.add(c);
  }
  let k = 2;
  while (out.size < 3) out.add(answer + k++);
  return [...out];
}

function makeSuite(rng, level) {
  const kinds = level < 2 ? ['add', 'mul2'] : level < 4 ? ['add', 'mul2', 'mul3', 'sub', 'squares'] : ['mul3', 'squares', 'alt', 'fib', 'addGrow'];
  const kind = rng.pick(kinds);
  let seq;
  let ans;
  let e;
  if (kind === 'add' || kind === 'sub') {
    const step = rng.int(2, level < 2 ? 9 : 25) * (kind === 'sub' ? -1 : 1);
    const start = kind === 'sub' ? rng.int(60, 120) : rng.int(1, 30);
    seq = Array.from({ length: 4 }, (_, i) => start + step * i);
    ans = start + step * 4;
    e = `On ${step > 0 ? 'ajoute' : 'retire'} ${Math.abs(step)} à chaque fois.`;
  } else if (kind === 'mul2' || kind === 'mul3') {
    const f = kind === 'mul2' ? 2 : 3;
    const start = rng.int(1, f === 2 ? 6 : 4);
    seq = Array.from({ length: 4 }, (_, i) => start * f ** i);
    ans = start * f ** 4;
    e = `Chaque nombre est multiplié par ${f}.`;
  } else if (kind === 'squares') {
    const s = rng.int(1, 6);
    seq = Array.from({ length: 4 }, (_, i) => (s + i) ** 2);
    ans = (s + 4) ** 2;
    e = `Les carrés : ${s}², ${s + 1}², … puis ${s + 4}².`;
  } else if (kind === 'alt') {
    const a = rng.int(2, 9);
    const b = rng.int(2, 6);
    seq = [10, 10 + a, 10 + a - b, 10 + 2 * a - b, 10 + 2 * a - 2 * b];
    ans = 10 + 3 * a - 2 * b;
    e = `On ajoute ${a}, on retire ${b}, et ainsi de suite.`;
  } else if (kind === 'fib') {
    const a = rng.int(1, 5);
    const b = rng.int(a, a + 5);
    seq = [a, b];
    while (seq.length < 5) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
    ans = seq[3] + seq[4];
    e = 'Chaque nombre est la somme des deux précédents.';
  } else {
    const start = rng.int(1, 10);
    seq = [start];
    for (let i = 1; i < 5; i++) seq.push(seq[i - 1] + i);
    ans = seq[4] + 5;
    e = 'On ajoute 1, puis 2, puis 3… un de plus à chaque fois.';
  }
  return {
    id: `suite-${seq.join('-')}`,
    c: 'suite',
    d: kind === 'add' || kind === 'mul2' ? 1 : 2,
    q: `Quel nombre vient ensuite : ${seq.map(fmt).join(', ')}, … ?`,
    a: fmt(ans),
    w: nearby(rng, ans, Math.max(2, Math.abs(ans - seq[seq.length - 1]))).map(fmt),
    e,
  };
}

function makeCalcul(rng, level) {
  const kinds = level < 2 ? ['add', 'mul'] : level < 4 ? ['add', 'mul', 'half', 'sub'] : ['mul', 'percent', 'mix', 'sub'];
  const kind = rng.pick(kinds);
  let q;
  let ans;
  let e;
  if (kind === 'add') {
    const a = rng.int(12, 89);
    const b = rng.int(12, 89);
    q = `${a} + ${b} = ?`;
    ans = a + b;
    e = `${a} + ${b} = ${ans}.`;
  } else if (kind === 'sub') {
    const a = rng.int(50, 150);
    const b = rng.int(12, a - 5);
    q = `${a} − ${b} = ?`;
    ans = a - b;
    e = `${a} − ${b} = ${ans}.`;
  } else if (kind === 'mul') {
    const a = rng.int(3, level < 2 ? 9 : 12);
    const b = rng.int(3, level < 2 ? 9 : 12);
    q = `${a} × ${b} = ?`;
    ans = a * b;
    e = `${a} × ${b} = ${ans}.`;
  } else if (kind === 'half') {
    const a = rng.int(11, 99) * 2;
    q = `Quelle est la moitié de ${a} ?`;
    ans = a / 2;
    e = `${a} ÷ 2 = ${ans}.`;
  } else if (kind === 'percent') {
    const p = rng.pick([10, 20, 25, 50]);
    const base = rng.pick([40, 60, 80, 120, 200, 240, 300]);
    q = `Combien font ${p} % de ${base} ?`;
    ans = (base * p) / 100;
    e = `${p} % de ${base}, c’est ${base} × ${p} ÷ 100 = ${ans}.`;
  } else {
    const a = rng.int(2, 9);
    const b = rng.int(2, 9);
    const c = rng.int(2, 20);
    q = `${a} × ${b} + ${c} = ?`;
    ans = a * b + c;
    e = `La multiplication d’abord : ${a * b}, puis + ${c}.`;
  }
  return { id: `calcul-${q}`, c: 'calcul', d: 1, q, a: fmt(ans), w: nearby(rng, ans, kind === 'mul' ? rng.pick([rng.int(3, 9), 10]) : rng.int(2, 10)).map(fmt), e };
}

export function generated(rng, level) {
  return rng.chance(0.5) ? makeSuite(rng, level) : makeCalcul(rng, level);
}

// ---------- Tirage ----------
/** Mélange les réponses d'une question ; renvoie { ...q, options, correct }. */
export function prepare(rng, q) {
  const options = rng.shuffle([q.a, ...q.w]);
  return { ...q, options, correct: options.indexOf(q.a) };
}

/**
 * Prochaine question : énigme de la banque (difficulté qui monte avec `level`)
 * ou question générée. `avoid` : identifiants déjà vus récemment.
 */
export function pickQuestion(rng, riddles, level, avoid, { gen = true } = {}) {
  const genChance = level < 1 ? 0.15 : 0.28;
  if (gen && rng.chance(genChance)) return generated(rng, level);
  const maxD = level < 3 ? 1 : level < 7 ? 2 : 3;
  const minD = level < 9 ? 1 : 2;
  let pool = riddles.filter((r) => r.d <= maxD && r.d >= minD && !avoid.has(r.id));
  if (pool.length < 3) pool = riddles.filter((r) => !avoid.has(r.id));
  if (!pool.length) pool = riddles;
  return rng.pick(pool);
}

// ---------- Barème ----------
export const multOf = (streak) => clamp(1 + Math.floor(streak / 3), 1, 5);
export function pointsFor({ left, total, mult }) {
  const flash = total - left <= 2;
  const wire = left <= 1;
  const base = 100 + Math.round(10 * left) + (flash ? 50 : 0) + (wire ? 50 : 0);
  return { pts: Math.round(base * mult), flash, wire };
}

// ---------- Énigme du jour ----------
export const DAILY_COUNT = 6;
const EPOCH = '2026-01-01';
export const dailyIndex = (date = new Date()) => daysBetween(EPOCH, dayKey(date)) + 1;
export function dailyQuestions(riddles, date = new Date()) {
  const rng = createRng(dailySeed('enigmes', date));
  const seen = new Set();
  const out = [];
  for (let i = 0; i < DAILY_COUNT; i++) {
    const q = i === 3 ? generated(rng, 3) : pickQuestion(rng, riddles, 2 + i * 2, seen, { gen: false });
    seen.add(q.id);
    out.push(prepare(rng, q));
  }
  return out;
}
export function shareText(marks, total, index) {
  const sq = { flash: '⚡', ok: '🟩', ko: '🟥', skip: '⬜' };
  return `Énigme du jour n°${index} · ${formatInt(total)} pts\n${marks.map((m) => sq[m]).join('')}\nalbangaming.github.io/Lobby-des-jeux`;
}
