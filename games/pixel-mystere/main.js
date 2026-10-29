// Pixel Mystère — des grilles à cocher : les chiffres de chaque ligne et de chaque colonne disent
// combien de cases pleines se suivent. Remplis les bonnes, barre les autres : un dessin en pixels
// apparaît. Trois erreurs et le dessin reste caché. Un album à compléter et un emblème du jour.

import { bootGame } from '../../shared/js/gameverse.js';
import { createFxLayer, wiggle } from '../../shared/js/engine/fx.js';
import { dayKey } from '../../shared/js/core/rng.js';
import { formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { COLORS, CHAPTERS, ALL, byId, filled, clues, dailyPuzzle } from './puzzles.js';

const LIVES = 3;
const HINTS = 2;
const params = new URLSearchParams(location.search);
const FAST = params.has('fast');
const wait = (ms) => (FAST ? Math.min(ms, 40) : motion.reduced ? Math.round(ms * 0.5) : ms);

const MODES = {
  album: { id: 'album', label: 'Album', hint: 'Choisis une grille, révèle le dessin' },
  jour: { id: 'jour', label: 'Emblème du jour', hint: 'Une grille 10 × 10, la même pour tous' },
};
const THEMES = [
  { id: 'papier', name: 'Papier', unlock: 0, c1: '#f4efe4', c2: '#2b2d42' },
  { id: 'nuit', name: 'Nuit', unlock: 6, c1: '#141a33', c2: '#4cc3ff' },
  { id: 'arcade', name: 'Arcade', unlock: 14, c1: '#1b0f2e', c2: '#ff5fa2' },
  { id: 'or', name: 'Or', unlock: ALL.length, c1: '#2a1d00', c2: '#ffc93c' },
];

const store = createStore('pixel-mystere', {
  version: 1,
  defaults: { mode: 'album', pick: ALL[0].id, theme: 'papier', tool: 'fill', solved: {}, daily: { day: '', done: false, best: 0, time: 0, plays: 0 } },
});

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const wrapEl = document.querySelector('.pm-wrap');
const panelEl = $('panel');
const previewEl = $('preview');
const titleEl = $('title');
const metaEl = $('meta');
const livesEl = $('lives');
const toolsEl = $('tools');
const msgEl = $('msg');

const gv = bootGame('pixel-mystere', {
  hud: [
    { id: 'time', label: 'Temps' },
    { id: 'album', label: 'Album' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['icon:grid'], text: 'Les chiffres disent combien de cases pleines se suivent, dans l’ordre, sur la ligne ou la colonne.' },
    { keys: ['icon:pointer', 'icon:touch'], text: 'Touche ou glisse pour remplir. Passe en mode croix pour barrer les cases vides.' },
    { keys: ['icon:heart'], text: 'Une case mal jouée coûte une vie : à trois erreurs, le dessin reste caché.' },
    { keys: ['Entrée', 'X'], text: 'Au clavier : flèches pour bouger, Entrée pour l’outil choisi, X pour une croix.' },
  ],
  onStart: startGame,
  onRestart: startGame,
});
const fx = createFxLayer(gv.stage, { shakeTarget: boardEl });

// ---------- État ----------
// cells : 0 inconnue, 1 pleine, 2 barrée
let puzzle = ALL[0];
let N = 5;
let sol = [];
let cells = new Uint8Array(0);
let errs = new Set();
let doneRows = [];
let doneCols = [];
let cl = { rows: [], cols: [] };
let focusIdx = 0;
let mode = MODES.album;
const run = { time: 0, lives: LIVES, hints: HINTS, errors: 0, done: true, won: false, points: 0 };

const today = () => dayKey();
const solvedCount = () => Object.keys(store.data.solved).filter((id) => byId(id)).length;
const chapterOpen = (ch) => solvedCount() >= ch.unlock;
const theme = () => THEMES.find((t) => t.id === store.data.theme) ?? THEMES[0];
const tool = () => store.data.tool;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const sizeLabel = (p) => `${p.size} × ${p.size}`;
const picked = () => {
  const p = byId(store.data.pick);
  const ch = p && CHAPTERS.find((c) => c.id === p.chapter);
  return p && chapterOpen(ch) ? p : ALL[0];
};
const nextUnsolved = (after) => {
  const i = ALL.findIndex((p) => p.id === after);
  return [...ALL.slice(i + 1), ...ALL.slice(0, i + 1)].find((p) => !store.data.solved[p.id] && chapterOpen(CHAPTERS.find((c) => c.id === p.chapter)));
};

function load(p) {
  puzzle = p;
  N = p.size;
  sol = filled(p.rows).flat();
  cl = clues(filled(p.rows));
  cells = new Uint8Array(N * N);
  errs = new Set();
  doneRows = Array(N).fill(false);
  doneCols = Array(N).fill(false);
  focusIdx = 0;
  // Les lignes vides (indice 0) sont barrées d'office
  for (let y = 0; y < N; y++) if (cl.rows[y][0] === 0) for (let x = 0; x < N; x++) cells[y * N + x] = 2;
  for (let x = 0; x < N; x++) if (cl.cols[x][0] === 0) for (let y = 0; y < N; y++) cells[y * N + x] = 2;
  for (let i = 0; i < N; i++) {
    lineDone('row', i, false);
    lineDone('col', i, false);
  }
  buildBoard();
}

function startGame() {
  mode = MODES[store.data.mode] ?? MODES.album;
  load(mode.id === 'jour' ? dailyPuzzle() : picked());
  Object.assign(run, { time: 0, lives: LIVES, hints: HINTS, errors: 0, done: false, won: false, points: 0, drag: null });
  wrapEl.classList.remove('is-solved', 'is-lost');
  gv.hud('time', '0:00');
  setMsg(mode.id === 'jour' ? 'Emblème du jour : le même dessin pour tout le monde.' : 'Lis les chiffres, remplis les cases sûres.');
  renderPanel();
  layout();
  cellEl(0)?.focus({ preventScroll: true });
}

// ---------- Règles ----------
function apply(i, action) {
  if (run.done || cells[i] !== 0) return 'skip';
  const x = i % N;
  const y = (i / N) | 0;
  if (action === 'fill' && sol[i]) {
    cells[i] = 1;
    paint(i, 'is-pop');
    gv.audio.play('pop', { pitch: 0.9 + (filledIn() / sol.filter(Boolean).length) * 0.7, volume: 0.5 });
  } else if (action === 'cross' && !sol[i]) {
    cells[i] = 2;
    paint(i, 'is-pop');
    gv.audio.play('tick', { volume: 0.4 });
  } else {
    // Erreur : la case prend sa vraie valeur, marquée en rouge
    cells[i] = sol[i] ? 1 : 2;
    errs.add(i);
    paint(i, 'is-err');
    mistake(i);
  }
  const r = lineDone('row', y);
  const c = lineDone('col', x);
  if (r || c) gv.audio.play('confirm', { pitch: 1 + Math.random() * 0.2, volume: 0.5 });
  drawPreview();
  if (!run.done && filledIn() === sol.filter(Boolean).length) win();
  return errs.has(i) ? 'error' : 'ok';
}

function filledIn() {
  let n = 0;
  for (let i = 0; i < cells.length; i++) if (cells[i] === 1 && sol[i]) n++;
  return n;
}

// Ligne terminée : toutes ses cases pleines trouvées, on barre le reste
function lineDone(kind, k, animate = true) {
  const done = kind === 'row' ? doneRows : doneCols;
  if (done[k]) return false;
  const idx = Array.from({ length: N }, (_, j) => (kind === 'row' ? k * N + j : j * N + k));
  if (!idx.every((i) => !sol[i] || cells[i] === 1)) return false;
  done[k] = true;
  idx.forEach((i, j) => {
    if (cells[i] !== 0) return;
    cells[i] = 2;
    if (animate) paint(i, 'is-auto', j * 18);
  });
  if (animate) {
    const clueEl = boardEl.querySelector(`[data-${kind}="${k}"]`);
    clueEl?.classList.add('is-done');
  }
  return true;
}

function mistake(i) {
  run.errors++;
  run.lives--;
  gv.audio.play('error');
  fx.addShake(0.18);
  fx.burstAt(cellEl(i), { count: 14, colors: ['#e63946', '#ff9a90'], speed: [80, 220], size: [2, 5], gravity: 300, shape: 'square', life: [0.3, 0.6] });
  wiggle(livesEl, { amount: 5 });
  renderLives();
  setMsg(run.lives > 0 ? `Raté ! Encore ${run.lives} ${run.lives > 1 ? 'vies' : 'vie'}.` : 'Trois erreurs…', 'warn');
  if (run.lives <= 0) lose();
}

function useHint() {
  if (run.done || run.hints <= 0) return;
  // Révèle la ligne (ou la colonne) où il reste le plus de cases à trouver
  let bestLine = null;
  for (let k = 0; k < N; k++) {
    for (const kind of ['row', 'col']) {
      if ((kind === 'row' ? doneRows : doneCols)[k]) continue;
      let left = 0;
      for (let j = 0; j < N; j++) if (cells[kind === 'row' ? k * N + j : j * N + k] === 0) left++;
      if (!bestLine || left > bestLine.left) bestLine = { kind, k, left };
    }
  }
  if (!bestLine) return;
  run.hints--;
  gv.audio.play('powerup');
  for (let j = 0; j < N; j++) {
    const i = bestLine.kind === 'row' ? bestLine.k * N + j : j * N + bestLine.k;
    if (cells[i] !== 0) continue;
    cells[i] = sol[i] ? 1 : 2;
    paint(i, 'is-hinted', j * 25);
    lineDone('row', (i / N) | 0);
    lineDone('col', i % N);
  }
  setMsg(`Indice : ${bestLine.kind === 'row' ? 'ligne' : 'colonne'} ${bestLine.k + 1} dévoilée.`);
  renderPanel();
  drawPreview();
  if (filledIn() === sol.filter(Boolean).length) win();
}

function score() {
  const base = sol.filter(Boolean).length * 10;
  const par = N * N * 0.9;
  const speed = Math.round((Math.max(0, par - run.time) / par) * base);
  const lifeMult = [1, 1.1, 1.25, 1.5][run.lives];
  return Math.max(0, Math.round((base + speed) * lifeMult * (1 - 0.15 * (HINTS - run.hints))));
}

function win() {
  run.done = true;
  run.won = true;
  run.points = score();
  const daily = mode.id === 'jour';
  if (daily) {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), done: false, best: 0, time: 0, plays: 0 });
    d.plays++;
    d.done = true;
    d.best = Math.max(d.best, run.points);
    d.time = d.time ? Math.min(d.time, run.time) : run.time;
    gv.unlock('du-jour');
  } else {
    const prev = store.data.solved[puzzle.id];
    const wasNew = !prev;
    store.data.solved = { ...store.data.solved, [puzzle.id]: { time: prev ? Math.min(prev.time, run.time) : run.time, score: Math.max(prev?.score ?? 0, run.points), perfect: (prev?.perfect ?? false) || run.errors === 0 } };
    const next = nextUnsolved(puzzle.id);
    if (next) store.data.pick = next.id;
    if (wasNew) announceUnlocks();
  }
  store.save();
  checkAchievements();
  reveal();
  gv.hud('album', `${solvedCount()}/${ALL.length}`, true);
  gv.after(wait(N * 2 * 32 + 500), () => {
    gv.banner(`${puzzle.name} !`, { color: '#ffc93c' });
    gv.audio.play('win');
  });
  gv.after(wait(N * 2 * 32 + 1900), () => endGame());
}

function lose() {
  run.done = true;
  run.won = false;
  wrapEl.classList.add('is-lost');
  if (mode.id === 'jour') {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), done: false, best: 0, time: 0, plays: 0 });
    d.plays++;
    store.save();
  }
  gv.after(wait(900), () => endGame());
}

function endGame() {
  if (gv.state === 'over') return;
  const daily = mode.id === 'jour';
  const next = THEMES.find((t) => t.unlock > solvedCount());
  const nextCh = CHAPTERS.find((c) => !chapterOpen(c));
  gv.gameOver({
    score: run.won ? run.points : 0,
    stats: { score: run.won ? run.points : 0, solved: run.won ? 1 : 0, perfect: run.won && run.errors === 0 ? 1 : 0, size: run.won ? N : 0, daily: daily ? 1 : 0 },
    extraStats: [
      { label: 'Temps', value: fmtTime(run.time) },
      { label: 'Erreurs', value: `${run.errors} / ${LIVES}` },
      { label: 'Album', value: `${solvedCount()} / ${ALL.length}` },
    ],
    kicker: daily ? MODES.jour.label : `${CHAPTERS.find((c) => c.id === puzzle.chapter)?.name ?? ''} · ${sizeLabel(puzzle)}`,
    title: run.won ? `C’était : ${puzzle.name}` : 'Le dessin reste caché',
    sound: run.won ? undefined : 'lose',
    extraHtml: run.won ? `<div class="pm-over-art">${artSVG(puzzle.rows)}</div>` : '',
    nextUnlock: nextCh ? { label: `Chapitre ${nextCh.name}`, current: solvedCount(), target: nextCh.unlock } : next ? { label: `Thème ${next.name}`, current: solvedCount(), target: next.unlock } : undefined,
  });
  gv.hud('best', formatInt(gv.best ?? 0));
  renderOptions();
}

function checkAchievements() {
  const n = solvedCount();
  gv.unlock('premiere');
  if (run.errors === 0) gv.unlock('sans-faute');
  if (N >= 10 && run.time < 120) gv.unlock('eclair');
  if (N >= 15) gv.unlock('grand');
  if (N >= 15 && run.errors === 0 && run.hints === HINTS) gv.unlock('maitre');
  if (CHAPTERS[1].puzzles.every((p) => store.data.solved[p.id])) gv.unlock('promenade');
  if (n >= ALL.length) gv.unlock('album');
}

function announceUnlocks() {
  const n = solvedCount();
  for (const ch of CHAPTERS) if (ch.unlock > 0 && n === ch.unlock) toast({ title: 'Nouveau chapitre !', text: `${ch.name} : ${ch.puzzles.length} grilles.`, iconName: 'image', tone: 'var(--mint)' });
  for (const t of THEMES) if (t.unlock > 0 && n === t.unlock) toast({ title: 'Nouveau thème !', text: `Thème ${t.name} débloqué.`, iconName: 'palette', tone: 'var(--mint)' });
}

// ---------- Rendu ----------
const cellEl = (i) => boardEl.querySelector(`[data-i="${i}"]`);
const clueHtml = (nums) => nums.map((n) => `<span>${n}</span>`).join('');

function buildBoard() {
  const parts = ['<div class="pm-corner" aria-hidden="true"></div>'];
  for (let x = 0; x < N; x++) parts.push(`<div class="pm-clue pm-clue--col ${doneCols[x] ? 'is-done' : ''}" data-col="${x}" aria-hidden="true">${clueHtml(cl.cols[x])}</div>`);
  for (let y = 0; y < N; y++) {
    parts.push(`<div class="pm-clue pm-clue--row ${doneRows[y] ? 'is-done' : ''}" data-row="${y}" aria-hidden="true">${clueHtml(cl.rows[y])}</div>`);
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      parts.push(`<button type="button" class="${cellClass(i)}" data-i="${i}" tabindex="${i === focusIdx ? 0 : -1}" aria-label="${cellLabel(i)}"></button>`);
    }
  }
  boardEl.style.setProperty('--n', N);
  boardEl.setAttribute('aria-label', `Grille de ${N} cases sur ${N}`);
  boardEl.innerHTML = parts.join('');
}

function cellClass(i) {
  const x = i % N;
  const y = (i / N) | 0;
  return ['pm-cell', cells[i] === 1 ? 'is-fill' : cells[i] === 2 ? 'is-cross' : '', errs.has(i) ? 'is-wrong' : '', x === 0 ? 'is-left' : '', y === 0 ? 'is-top' : '', x === N - 1 ? 'is-right' : '', y === N - 1 ? 'is-bottom' : '', x % 5 === 4 && x < N - 1 ? 'is-sep-x' : '', y % 5 === 4 && y < N - 1 ? 'is-sep-y' : ''].filter(Boolean).join(' ');
}
function cellLabel(i) {
  const x = i % N;
  const y = (i / N) | 0;
  const s = cells[i] === 1 ? 'pleine' : cells[i] === 2 ? 'barrée' : 'vide';
  return `Ligne ${y + 1} (${cl.rows[y].join(' ')}), colonne ${x + 1} (${cl.cols[x].join(' ')}) : ${s}`;
}

function paint(i, anim = '', delay = 0) {
  const el = cellEl(i);
  if (!el) return;
  el.className = cellClass(i);
  el.setAttribute('aria-label', cellLabel(i));
  if (anim) {
    el.style.animationDelay = delay ? `${wait(delay)}ms` : '';
    el.classList.add(anim);
  }
}

// Le dessin apparaît en vague diagonale
function reveal() {
  wrapEl.classList.add('is-solved');
  for (let i = 0; i < cells.length; i++) {
    const el = cellEl(i);
    const x = i % N;
    const y = (i / N) | 0;
    const ch = puzzle.rows[y][x];
    el.style.setProperty('--px', ch === '.' ? 'transparent' : COLORS[ch]);
    el.style.animationDelay = `${wait((x + y) * 32)}ms`;
    el.classList.add('is-reveal');
  }
  drawPreview(true);
  gv.after(wait(N * 32), () => {
    fx.burstAt(boardEl, { count: 60, colors: ['#ffc93c', '#fff8ec', '#4cc3ff', '#ff8fab'], speed: [160, 520], size: [3, 7], gravity: 380, shape: 'star', life: [0.6, 1.2] });
    fx.addShake(0.12);
  });
  gv.audio.play('perfect');
}

function drawPreview(color = false) {
  const ctx = previewEl.getContext('2d');
  previewEl.width = N;
  previewEl.height = N;
  ctx.clearRect(0, 0, N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const ch = puzzle.rows[y][x];
      if (color) {
        if (ch === '.') continue;
        ctx.fillStyle = COLORS[ch];
      } else if (cells[i] === 1) ctx.fillStyle = getComputedStyle(boardEl).getPropertyValue('--ink').trim() || '#2b2d42';
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function renderLives() {
  livesEl.innerHTML = Array.from({ length: LIVES }, (_, k) => `<span class="${k < run.lives ? '' : 'is-lost'}">${icon(k < run.lives ? 'heartFill' : 'heart')}</span>`).join('');
  livesEl.setAttribute('aria-label', `${run.lives} ${run.lives > 1 ? 'vies' : 'vie'} sur ${LIVES}`);
}

function renderPanel() {
  const daily = puzzle.id === 'jour';
  const solved = store.data.solved[puzzle.id];
  titleEl.textContent = daily ? 'Emblème du jour' : solved ? puzzle.name : `Grille n° ${ALL.findIndex((p) => p.id === puzzle.id) + 1}`;
  metaEl.textContent = `${sizeLabel(puzzle)}${solved ? ` · record ${fmtTime(solved.time)}` : ''}`;
  renderLives();
  toolsEl.innerHTML = `
    <div class="pm-switch" role="radiogroup" aria-label="Outil">
      <button type="button" role="radio" class="pm-tool" data-tool="fill" aria-checked="${tool() === 'fill'}"><i class="pm-ico pm-ico--fill" aria-hidden="true"></i>Remplir</button>
      <button type="button" role="radio" class="pm-tool" data-tool="cross" aria-checked="${tool() === 'cross'}"><i class="pm-ico pm-ico--cross" aria-hidden="true"></i>Croix</button>
    </div>
    <button type="button" class="pm-hint" data-tool="hint" ${run.hints > 0 && !run.done ? '' : 'disabled'}>${icon('eye')}Indice <b>${run.hints}</b></button>`;
  gv.hud('album', `${solvedCount()}/${ALL.length}`);
  drawPreview();
}

function setMsg(text, tone = '') {
  msgEl.textContent = text;
  msgEl.dataset.tone = tone;
}

// Taille des cases selon la place disponible et la longueur des indices
function layout() {
  const rc = Math.max(...cl.rows.map((r) => r.length));
  const cc = Math.max(...cl.cols.map((c) => c.length));
  const stage = gv.stage.getBoundingClientRect();
  const wide = stage.width >= 760;
  const panelH = wide ? 0 : panelEl.getBoundingClientRect().height + 16;
  const W = stage.width - (wide ? 300 : 24);
  const H = stage.height - panelH - 32;
  const c = Math.floor(Math.max(14, Math.min(46, W / (N + rc * 0.62 + 0.5), H / (N + cc * 0.78 + 0.5))));
  boardEl.style.setProperty('--c', `${c}px`);
  boardEl.style.setProperty('--rc', rc);
  boardEl.style.setProperty('--cc', cc);
  wrapEl.classList.toggle('is-wide', wide);
}

// Dessin en pixels (album et fin de partie)
export function artSVG(rows, { mono = false } = {}) {
  const n = rows.length;
  let rects = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < n) {
      const ch = row[x];
      let w = 1;
      while (x + w < n && row[x + w] === ch) w++;
      if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${mono ? 'currentColor' : COLORS[ch]}"/>`;
      x += w;
    }
  });
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

// ---------- Saisie : toucher, glisser, clavier ----------
function indexAt(e) {
  const first = cellEl(0).getBoundingClientRect();
  const last = cellEl(N * N - 1).getBoundingClientRect();
  const x = Math.floor(((e.clientX - first.left) / (last.right - first.left)) * N);
  const y = Math.floor(((e.clientY - first.top) / (last.bottom - first.top)) * N);
  if (x < 0 || y < 0 || x >= N || y >= N) return -1;
  return y * N + x;
}

boardEl.addEventListener('pointerdown', (e) => {
  if (gv.state !== 'playing' || run.done) return;
  const i = indexAt(e);
  if (i < 0) return;
  e.preventDefault();
  boardEl.setPointerCapture?.(e.pointerId);
  const action = e.button === 2 ? 'cross' : tool();
  run.drag = { id: e.pointerId, start: i, last: i, axis: null, action, stopped: false };
  focusIdx = i;
  setFocus(i);
  if (apply(i, action) === 'error') run.drag.stopped = true;
});
boardEl.addEventListener('pointermove', (e) => {
  const d = run.drag;
  if (!d || d.id !== e.pointerId || d.stopped) return;
  let i = indexAt(e);
  if (i < 0 || i === d.last) return;
  const sx = d.start % N;
  const sy = (d.start / N) | 0;
  if (!d.axis) d.axis = ((i / N) | 0) === sy ? 'row' : 'col';
  // Le trait reste sur la ligne ou la colonne de départ
  const cx = d.axis === 'row' ? i % N : sx;
  const cy = d.axis === 'row' ? sy : (i / N) | 0;
  i = cy * N + cx;
  const lx = d.last % N;
  const ly = (d.last / N) | 0;
  const steps = Math.max(Math.abs(cx - lx), Math.abs(cy - ly));
  for (let s = 1; s <= steps; s++) {
    const k = (ly + Math.sign(cy - ly) * s) * N + lx + Math.sign(cx - lx) * s;
    if (apply(k, d.action) === 'error') {
      d.stopped = true;
      break;
    }
  }
  d.last = i;
});
const endDrag = (e) => {
  if (run.drag?.id === e.pointerId) run.drag = null;
};
boardEl.addEventListener('pointerup', endDrag);
boardEl.addEventListener('pointercancel', endDrag);
boardEl.addEventListener('contextmenu', (e) => e.preventDefault());
// Clic clavier (Entrée / Espace sur un bouton) : le pointerdown s'en est déjà chargé à la souris
boardEl.addEventListener('click', (e) => {
  if (e.detail !== 0) return;
  const b = e.target.closest('[data-i]');
  if (b && gv.state === 'playing') apply(Number(b.dataset.i), tool());
});

function setFocus(i) {
  const old = boardEl.querySelector('.pm-cell[tabindex="0"]');
  if (old) old.tabIndex = -1;
  const el = cellEl(i);
  el.tabIndex = 0;
  el.focus({ preventScroll: true });
}
boardEl.addEventListener('keydown', (e) => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  const i = Number(b.dataset.i);
  if (e.key === 'x' || e.key === 'X') {
    e.preventDefault();
    if (gv.state === 'playing') apply(i, 'cross');
    return;
  }
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!d) return;
  e.preventDefault();
  const x = (i % N) + d[0];
  const y = ((i / N) | 0) + d[1];
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  focusIdx = y * N + x;
  setFocus(focusIdx);
});

toolsEl.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tool]');
  if (!t) return;
  if (t.dataset.tool === 'hint') return useHint();
  store.data.tool = t.dataset.tool;
  store.save();
  gv.audio.play('select');
  renderPanel();
});
// C : changer d'outil
document.addEventListener('keydown', (e) => {
  if ((e.key === 'c' || e.key === 'C') && gv.state === 'playing' && !e.ctrlKey && !e.metaKey) {
    store.data.tool = tool() === 'fill' ? 'cross' : 'fill';
    store.save();
    renderPanel();
  }
});

// Chronomètre : n'avance que pendant la partie
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(1, (now - lastTick) / 1000);
  lastTick = now;
  if (gv.state !== 'playing' || run.done || document.hidden) return;
  const before = Math.floor(run.time);
  run.time += dt;
  if (Math.floor(run.time) !== before) gv.hud('time', fmtTime(run.time));
}, 250);

addEventListener('resize', () => layout());

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const n = solvedCount();
  const dd = store.data.daily;
  const pick = picked();
  gv.shell.startExtra.innerHTML = `
    <div class="pm-options">
      <div class="pm-row">
        <span class="pm-label" id="pm-mode-label">Mode</span>
        <div class="pm-modes" role="radiogroup" aria-labelledby="pm-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const sub = m.id === 'jour' ? (dd.day === today() && dd.done ? `Résolu en ${fmtTime(dd.time)} · ${formatInt(dd.best)} pts` : m.hint) : m.hint;
              return `<button type="button" role="radio" class="pm-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}">${icon(m.id === 'jour' ? 'calendar' : 'image')}<span>${m.label}</span><small>${esc(sub)}</small></button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="pm-row pm-album" ${store.data.mode === 'jour' ? 'hidden' : ''}>
        <span class="pm-label">Album · ${n} / ${ALL.length}</span>
        ${CHAPTERS.map((ch) => {
          const open = chapterOpen(ch);
          return `<div class="pm-chapter">
            <p class="pm-chapter__name">${esc(ch.name)} <small>${open ? `${ch.puzzles.filter((p) => store.data.solved[p.id]).length} / ${ch.puzzles.length}` : `${icon('lock')} ${ch.unlock} grilles résolues`}</small></p>
            <div class="pm-pics" role="radiogroup" aria-label="${esc(ch.name)}">
              ${ch.puzzles
                .map((p) => {
                  const s = store.data.solved[p.id];
                  const label = !open ? `Verrouillée` : s ? `${p.name}, ${sizeLabel(p)}, résolue en ${fmtTime(s.time)}` : `Grille mystère ${sizeLabel(p)}`;
                  return `<button type="button" role="radio" class="pm-pic ${s ? 'is-solved' : ''}" data-pick="${p.id}" aria-checked="${open && pick.id === p.id}" aria-label="${esc(label)}" title="${esc(label)}" ${open ? '' : 'aria-disabled="true"'}>${s ? artSVG(p.rows) : `<span>${open ? '?' : icon('lock')}</span>`}<em>${p.size}</em>${s?.perfect ? '<i aria-hidden="true">★</i>' : ''}</button>`;
                })
                .join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="pm-row">
        <span class="pm-label" id="pm-theme-label">Thème</span>
        <div class="pm-themes" role="radiogroup" aria-labelledby="pm-theme-label">
          ${THEMES.map((t) => {
            const locked = n < t.unlock;
            const label = locked ? `${t.name}, débloqué à ${t.unlock} grilles résolues` : t.name;
            return `<button type="button" role="radio" class="pm-theme" data-theme="${t.id}" style="--c1:${t.c1};--c2:${t.c2}" aria-checked="${store.data.theme === t.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span></span>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="pm-hint-text" id="pm-hint">${store.data.mode === 'jour' ? 'Un emblème 10 × 10 qui change chaque jour.' : `Prochaine grille : ${store.data.solved[pick.id] ? pick.name : `mystère ${sizeLabel(pick)}`}.`}</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    const t = THEMES.find((x) => x.id === b.dataset.theme);
    const p = byId(b.dataset.pick);
    const ch = p && CHAPTERS.find((c) => c.id === p.chapter);
    $('pm-hint').textContent = t ? `Résous ${t.unlock} grilles pour débloquer ce thème.` : `Résous ${ch.unlock} grilles pour ouvrir le chapitre ${ch.name}.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.pick) store.data.pick = b.dataset.pick;
  if (b.dataset.theme) {
    store.data.theme = b.dataset.theme;
    document.body.dataset.theme = b.dataset.theme;
  }
  store.save();
  gv.audio.play('select');
  renderOptions();
  preview();
  const sel = b.dataset.mode ? `[data-mode="${b.dataset.mode}"]` : b.dataset.pick ? `[data-pick="${b.dataset.pick}"]` : `[data-theme="${b.dataset.theme}"]`;
  gv.shell.startExtra.querySelector(sel)?.focus();
});

// Derrière l'accueil : la grille qui attend
function preview() {
  load(store.data.mode === 'jour' ? dailyPuzzle() : picked());
  run.done = true;
  renderPanel();
  layout();
}

// ---------- Démarrage ----------
window.__pm = {
  get run() { return run; },
  get cells() { return cells; },
  get sol() { return sol; },
  get puzzle() { return puzzle; },
  get N() { return N; },
  apply,
  // Résout tout sauf une case pleine (tests)
  solveAllBut(k = 1) {
    let left = sol.filter(Boolean).length - filledIn();
    for (let i = 0; i < cells.length && left > k; i++) if (cells[i] === 0 && sol[i]) {
      apply(i, 'fill');
      left--;
    }
  },
  remaining() { return sol.map((v, i) => (v && cells[i] === 0 ? i : -1)).filter((i) => i >= 0); },
};

document.body.dataset.theme = theme().id;
preview();
renderOptions();
wrapEl.classList.add('is-ready');
gv.hud('best', formatInt(gv.best ?? 0));
gv.hud('time', '0:00');
gv.showStart();
