// Alchimie — un plateau 5 × 5, quatre éléments de base. Choisis deux éléments : s'ils forment une
// recette, ils fusionnent (eau + feu = vapeur…). Chaque essai fait apparaître un élément de base ;
// la partie s'arrête quand le plateau est plein. 54 éléments à découvrir et noter au grimoire.

import { bootGame } from '../../shared/js/gameverse.js';
import { createFxLayer, squash, wiggle } from '../../shared/js/engine/fx.js';
import { createRng, dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { ELEMENTS, BASICS, RECIPES, combine, TIER, FINAL, recipesFor, tokenSVG } from './elements.js';

const SIZE = 5;
const CELLS = SIZE * SIZE;
const START = 6;
const TOTAL = Object.keys(ELEMENTS).length;
const params = new URLSearchParams(location.search);
const FAST = params.has('fast');
const wait = (ms) => (FAST ? Math.min(ms, 40) : motion.reduced ? Math.round(ms * 0.5) : ms);

const MODES = {
  classique: { id: 'classique', label: 'Classique', hint: 'Découvre, fusionne, tiens le plateau' },
  jour: { id: 'jour', label: 'Formule du jour', hint: 'Un élément à créer, le même pour tous' },
};
const THEMES = [
  { id: 'grimoire', name: 'Grimoire', unlock: 0, c1: '#2b2118', c2: '#e9d8a6' },
  { id: 'labo', name: 'Laboratoire', unlock: 15, c1: '#10262b', c2: '#5bc0be' },
  { id: 'nocturne', name: 'Nocturne', unlock: 30, c1: '#14102b', c2: '#a68bff' },
  { id: 'or', name: 'Or', unlock: 45, c1: '#2a1d00', c2: '#ffc93c' },
];

const store = createStore('alchimie', {
  version: 1,
  defaults: { mode: 'classique', theme: 'grimoire', found: [...BASICS], creations: 0, transmutes: 0, daily: { day: '', best: 0, plays: 0, won: false } },
});

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const grimoireEl = $('grimoire');
const foundEl = $('foundCount');
const comboEl = $('combo');
const toolsEl = $('tools');
const goalEl = $('goal');
const discoEl = $('discovery');
const msgEl = $('msg');

const gv = bootGame('alchimie', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['icon:pointer', 'icon:touch'], text: 'Touche un élément, puis un autre : s’ils vont ensemble, ils fusionnent.' },
    { keys: ['icon:grid'], text: 'Chaque essai fait apparaître un élément : ne laisse pas le plateau se remplir.' },
    { keys: ['icon:sparkle'], text: 'Les créations finales (✦) se transmutent en points et libèrent une case.' },
  ],
  onStart: startGame,
  onRestart: startGame,
});
const fx = createFxLayer(gv.stage, { shakeTarget: boardEl });

// ---------- État ----------
let mode = MODES.classique;
let rng = createRng(Date.now());
let board = Array(CELLS).fill(null);
let selected = -1;
let cauldron = false;
let busy = false;
let focusIdx = 12;
const run = {};

const best = () => gv.best ?? 0;
const found = () => new Set(store.data.found);
const theme = () => THEMES.find((t) => t.id === store.data.theme) ?? THEMES[0];
const today = () => dayKey();
const multOf = (combo) => Math.min(3, 1 + Math.floor(combo / 3) * 0.5);
const empty = () => board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);

function dailyTarget() {
  const r = createRng(dailySeed('alchimie-cible'));
  const pool = Object.keys(TIER).filter((id) => TIER[id] >= 4 && TIER[id] <= 6);
  return r.pick(pool);
}

function startGame() {
  mode = MODES[store.data.mode] ?? MODES.classique;
  rng = mode.id === 'jour' ? createRng(dailySeed('alchimie')) : createRng(Number(params.get('seed')) || Date.now() + Math.random() * 1e6);
  board = Array(CELLS).fill(null);
  selected = -1;
  cauldron = false;
  busy = false;
  Object.assign(run, { points: 0, combo: 0, bestCombo: 0, creations: 0, discoveries: 0, maxTier: 1, transmutes: 0, cauldron: 3, hints: 3, hintPair: null, target: mode.id === 'jour' ? dailyTarget() : null, won: false });
  for (let i = 0; i < START; i++) spawn(false);
  gv.hud('score', 0);
  gv.hud('best', formatInt(best()));
  setMsg(run.target ? `Formule du jour : crée ${ELEMENTS[run.target].name}.` : 'Choisis deux éléments à mélanger.');
  renderAll();
}

function spawn(animate = true) {
  const free = empty();
  if (!free.length) return -1;
  const i = rng.pick(free);
  board[i] = rng.pick(BASICS);
  if (animate) {
    renderCell(i, 'is-spawn');
    gv.audio.play('pop', { pitch: 1.2 + rng.next() * 0.3, volume: 0.6 });
  }
  return i;
}

// ---------- Actions ----------
function tapCell(i) {
  if (busy || gv.state !== 'playing') return;
  const el = board[i];
  run.hintPair = null;
  if (cauldron) {
    if (!el) return;
    cauldron = false;
    run.cauldron--;
    board[i] = null;
    fx.burstAt(cellEl(i), { count: 24, colors: ['#3a2a4a', '#a68bff', '#5bc0be'], speed: [80, 260], size: [3, 6], gravity: -80, shape: 'circle', life: [0.5, 1] });
    gv.audio.play('whoosh', { pitch: 0.7 });
    setMsg(`${ELEMENTS[el].name} part au chaudron.`);
    renderAll();
    return;
  }
  if (selected < 0) {
    if (!el) return;
    if (FINAL.has(el)) return transmute(i);
    selected = i;
    gv.audio.play('select');
    renderCell(i);
    setMsg(`${ELEMENTS[el].name} + … ?`);
    return;
  }
  if (selected === i) {
    selected = -1;
    gv.audio.play('back');
    renderCell(i);
    setMsg('Choisis deux éléments à mélanger.');
    return;
  }
  if (!el) {
    // Déplacer un élément sur une case vide
    board[i] = board[selected];
    board[selected] = null;
    const from = selected;
    selected = -1;
    gv.audio.play('place');
    renderCell(from);
    renderCell(i, 'is-spawn');
    return;
  }
  if (FINAL.has(el)) {
    wiggle(cellEl(i), { amount: 4 });
    setMsg(`${ELEMENTS[el].name} ne se mélange plus : touche-le pour le transmuter.`);
    return;
  }
  mix(selected, i);
}

async function mix(a, b) {
  const ea = board[a];
  const eb = board[b];
  const out = combine(ea, eb);
  selected = -1;
  busy = true;
  if (!out) {
    // Rien ne se passe : la série retombe et un élément apparaît quand même
    run.combo = 0;
    wiggle(cellEl(a), { amount: 6 });
    wiggle(cellEl(b), { amount: 6 });
    gv.audio.play('error');
    setMsg(`${ELEMENTS[ea].name} + ${ELEMENTS[eb].name} : rien ne se passe…`, 'warn');
    renderCell(a);
    await sleep(wait(260));
    busy = false;
    afterTurn(true);
    return;
  }
  await flyTo(a, b);
  board[a] = null;
  board[b] = out;
  const isNew = !found().has(out);
  const tier = TIER[out];
  const mult = multOf(run.combo);
  let pts = Math.round(10 * tier * mult);
  run.combo++;
  run.bestCombo = Math.max(run.bestCombo, run.combo);
  run.creations++;
  run.maxTier = Math.max(run.maxTier, tier);
  store.data.creations++;
  if (isNew) {
    pts += 50 * tier;
    run.discoveries++;
    store.data.found = [...store.data.found, out];
    discover(out, ea, eb, pts);
  } else {
    gv.audio.play('combo', { pitch: 0.9 + tier * 0.06 });
  }
  run.points += pts;
  if (FINAL.has(out) && run.cauldron < 5) run.cauldron++;
  if (run.creations % 10 === 0 && run.hints < 5) run.hints++;
  renderCell(a);
  renderCell(b, 'is-made');
  fx.burstAt(cellEl(b), { count: isNew ? 40 : 16, colors: [ELEMENTS[out].color, '#fff8ec', '#ffc93c'], speed: [100, isNew ? 420 : 260], size: [3, 7], gravity: 400, shape: isNew ? 'star' : 'circle', life: [0.4, 0.9] });
  fx.popupAt(cellEl(b), `+${formatInt(pts)}`, { size: isNew ? 30 : 22, color: '#ffc93c', rise: 50 });
  fx.addShake(isNew ? 0.2 : 0.06);
  setMsg(`${ELEMENTS[ea].name} + ${ELEMENTS[eb].name} = ${ELEMENTS[out].name}${FINAL.has(out) ? ' ✦' : ''}`, 'good');
  checkUnlocks(out);
  if (run.target === out && !run.won) {
    run.won = true;
    run.points += 400;
    gv.banner('Formule réussie !', { color: '#ffc93c' });
    gv.audio.play('record');
    gv.unlock('du-jour');
  }
  gv.hud('score', formatInt(run.points), true);
  store.save();
  await sleep(wait(180));
  busy = false;
  afterTurn();
}

function transmute(i) {
  const el = board[i];
  const pts = Math.round(15 * TIER[el] * multOf(run.combo));
  board[i] = null;
  run.points += pts;
  run.transmutes++;
  store.data.transmutes++;
  store.save();
  if (store.data.transmutes >= 10) gv.unlock('transmute-10');
  fx.burstAt(cellEl(i), { count: 30, colors: ['#ffc93c', '#fff3c4', ELEMENTS[el].color], speed: [120, 380], size: [3, 7], gravity: -60, shape: 'star', life: [0.6, 1.1] });
  fx.popupAt(cellEl(i), `Transmutation +${formatInt(pts)}`, { size: 22, color: '#ffc93c', rise: 50 });
  gv.audio.play('coin');
  gv.hud('score', formatInt(run.points), true);
  setMsg(`${ELEMENTS[el].name} transmuté en or.`, 'good');
  renderAll();
}

function afterTurn(failed = false) {
  // Un essai raté sur un plateau plein : il déborde
  if (failed && !empty().length) return endGame();
  const i = spawn(true);
  if (i < 0 || !empty().length) {
    // Plateau plein : encore une chance s'il reste une fusion ou une transmutation possible
    if (!hasMove()) return endGame();
    setMsg('Plateau plein ! Une fusion ou une transmutation, vite.', 'warn');
  }
  renderAll();
}

function hasMove() {
  if (board.some((e) => e && FINAL.has(e))) return true;
  if (run.cauldron > 0) return true;
  return !!findPair();
}

function findPair() {
  for (let a = 0; a < CELLS; a++) for (let b = a + 1; b < CELLS; b++) if (board[a] && board[b] && combine(board[a], board[b])) return [a, b];
  return null;
}

function useHint() {
  if (busy || run.hints <= 0) return;
  const p = findPair();
  if (!p) {
    setMsg('Aucune fusion possible : transmute ou passe au chaudron.', 'warn');
    gv.audio.play('error');
    return;
  }
  run.hints--;
  run.hintPair = p;
  gv.audio.play('powerup');
  setMsg(`Indice : ${ELEMENTS[board[p[0]]].name} et ${ELEMENTS[board[p[1]]].name}.`);
  renderAll();
}

function toggleCauldron() {
  if (busy || run.cauldron <= 0) return;
  cauldron = !cauldron;
  selected = -1;
  gv.audio.play('select');
  setMsg(cauldron ? 'Chaudron : touche l’élément à faire disparaître.' : 'Choisis deux éléments à mélanger.');
  renderAll();
}

// ---------- Découvertes et succès ----------
function discover(id, a, b, pts) {
  const e = ELEMENTS[id];
  discoEl.innerHTML = `<div class="al-disco">${tokenSVG(id, { className: 'al-disco__token' })}<p class="al-disco__kicker">Découverte !</p><p class="al-disco__name">${esc(e.name)}</p><p class="al-disco__recipe">${esc(ELEMENTS[a].name)} + ${esc(ELEMENTS[b].name)} · +${formatInt(pts)}</p></div>`;
  discoEl.classList.remove('is-on');
  void discoEl.offsetWidth;
  discoEl.classList.add('is-on');
  clearTimeout(discover.t);
  discover.t = setTimeout(() => discoEl.classList.remove('is-on'), wait(1700));
  gv.audio.play('perfect');
  setTimeout(() => gv.audio.play('achievement'), 160);
  gv.unlock('premiere');
}

function checkUnlocks(out) {
  const n = found().size - BASICS.length;
  if (n >= 10) gv.unlock('dix');
  if (n >= 25) gv.unlock('vingt-cinq');
  if (found().size >= TOTAL) gv.unlock('grimoire');
  if (out === 'vie') gv.unlock('vie');
  if (out === 'philosophale') gv.unlock('philosophale');
  if (out === 'cosmos') gv.unlock('cosmos');
  if (run.combo >= 10) gv.unlock('combo-10');
  for (const t of THEMES) if (t.unlock > 0 && found().size - BASICS.length === t.unlock) toast({ title: 'Nouveau thème !', text: `Thème ${t.name} débloqué.`, iconName: 'palette', tone: 'var(--mint)' });
}

function endGame() {
  if (gv.state === 'over') return;
  const isDaily = mode.id === 'jour';
  if (isDaily) {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), best: 0, plays: 0, won: false });
    d.plays++;
    d.best = Math.max(d.best, run.points);
    d.won ||= run.won;
  }
  store.save();
  const nextT = THEMES.find((t) => t.unlock > found().size - BASICS.length);
  gv.gameOver({
    score: run.points,
    stats: { score: run.points, creations: run.creations, tier: run.maxTier, discoveries: run.discoveries, daily: isDaily ? 1 : 0 },
    extraStats: [
      { label: 'Fusions', value: formatInt(run.creations) },
      { label: 'Découvertes', value: `+${run.discoveries} · ${found().size}/${TOTAL}` },
    ],
    kicker: mode.label,
    title: isDaily ? (run.won ? `${ELEMENTS[run.target].name} créé !` : `${ELEMENTS[run.target].name} t’échappe encore`) : 'Plateau plein',
    nextUnlock: nextT ? { label: `Thème ${nextT.name}`, current: found().size - BASICS.length, target: nextT.unlock } : undefined,
  });
  gv.hud('best', formatInt(best()));
  renderOptions();
}

// ---------- Rendu ----------
const cellEl = (i) => boardEl.children[i];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cellHtml(i) {
  const el = board[i];
  const cls = ['al-cell', el ? 'is-full' : '', i === selected ? 'is-selected' : '', run.hintPair?.includes(i) ? 'is-hint' : '', el && FINAL.has(el) ? 'is-final' : '', cauldron && el ? 'is-target' : ''].filter(Boolean).join(' ');
  const label = el ? `${ELEMENTS[el].name}${FINAL.has(el) ? ', création finale : touche pour transmuter' : ''}` : 'Case vide';
  return `<button type="button" class="${cls}" data-i="${i}" aria-label="${esc(label)}" aria-pressed="${i === selected}" tabindex="${i === focusIdx ? 0 : -1}">${el ? `${tokenSVG(el)}<span class="al-name">${esc(ELEMENTS[el].name)}</span>${FINAL.has(el) ? '<i class="al-final" aria-hidden="true">✦</i>' : ''}` : ''}</button>`;
}

function renderCell(i, anim = '') {
  const old = cellEl(i);
  const tmp = document.createElement('div');
  tmp.innerHTML = cellHtml(i);
  const neu = tmp.firstElementChild;
  if (anim) neu.classList.add(anim);
  old.replaceWith(neu);
}

function renderBoard() {
  boardEl.innerHTML = board.map((_, i) => cellHtml(i)).join('');
}

function renderGrimoire() {
  const f = found();
  foundEl.textContent = `${f.size} / ${TOTAL}`;
  grimoireEl.innerHTML = Object.keys(ELEMENTS)
    .map((id) => {
      const known = f.has(id);
      const recipe = recipesFor(id)[0];
      const title = known ? `${ELEMENTS[id].name}${recipe ? ` = ${ELEMENTS[recipe[0]].name} + ${ELEMENTS[recipe[1]].name}` : ' (élément de base)'}` : 'Élément inconnu';
      return `<li class="al-page ${known ? '' : 'is-unknown'}" title="${esc(title)}">${known ? tokenSVG(id, { label: true }) : '<span aria-label="Élément inconnu" role="img">?</span>'}</li>`;
    })
    .join('');
}

function renderTools() {
  const g = mode.id === 'jour' && run.target;
  goalEl.innerHTML = g ? `${tokenSVG(run.target)}<span><small>Formule du jour</small><b>${esc(ELEMENTS[run.target].name)}</b></span>${run.won ? icon('check') : ''}` : '';
  goalEl.hidden = !g;
  toolsEl.innerHTML = `
    <button type="button" class="al-tool ${cauldron ? 'is-on' : ''}" data-tool="cauldron" aria-pressed="${cauldron}" ${run.cauldron > 0 ? '' : 'disabled'}>${icon('trash')}Chaudron <b>${run.cauldron ?? 0}</b></button>
    <button type="button" class="al-tool" data-tool="hint" ${run.hints > 0 ? '' : 'disabled'}>${icon('eye')}Indice <b>${run.hints ?? 0}</b></button>`;
  comboEl.textContent = run.combo > 1 ? `Série ${run.combo} · ×${String(multOf(run.combo)).replace('.', ',')}` : '';
}

function renderAll() {
  renderBoard();
  renderGrimoire();
  renderTools();
}

function setMsg(text, tone = '') {
  msgEl.textContent = text;
  msgEl.dataset.tone = tone;
}

// Fusion : le premier élément vole vers le second
async function flyTo(a, b) {
  const A = cellEl(a).querySelector('.al-token');
  const B = cellEl(b);
  if (!A || motion.reduced || FAST) return;
  const ra = A.getBoundingClientRect();
  const rb = B.getBoundingClientRect();
  const dx = rb.left + rb.width / 2 - (ra.left + ra.width / 2);
  const dy = rb.top + rb.height / 2 - (ra.top + ra.height / 2);
  gv.audio.play('whoosh', { pitch: 1.4, volume: 0.6 });
  await A.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.7 }], { duration: 220, easing: 'cubic-bezier(.5,0,.75,0)' }).finished;
}

// ---------- Évènements ----------
boardEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  focusIdx = Number(b.dataset.i);
  tapCell(focusIdx);
  cellEl(focusIdx)?.focus({ preventScroll: true });
});
boardEl.addEventListener('keydown', (e) => {
  const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -SIZE, ArrowDown: SIZE }[e.key];
  if (d === undefined) return;
  e.preventDefault();
  const n = focusIdx + d;
  if (n < 0 || n >= CELLS || (Math.abs(d) === 1 && Math.floor(n / SIZE) !== Math.floor(focusIdx / SIZE))) return;
  cellEl(focusIdx).tabIndex = -1;
  focusIdx = n;
  cellEl(n).tabIndex = 0;
  cellEl(n).focus();
});
toolsEl.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tool]');
  if (!t) return;
  if (t.dataset.tool === 'cauldron') toggleCauldron();
  else useHint();
});

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const n = found().size - BASICS.length;
  const dd = store.data.daily;
  gv.shell.startExtra.innerHTML = `
    <div class="al-options">
      <div class="al-row">
        <span class="al-label" id="al-mode-label">Mode</span>
        <div class="al-modes" role="radiogroup" aria-labelledby="al-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const sub = m.id === 'jour' ? (dd.day === today() ? `${dd.won ? 'Réussie' : 'Pas encore'} · meilleur ${formatInt(dd.best)}` : `Crée : ${ELEMENTS[dailyTarget()].name}`) : m.hint;
              return `<button type="button" role="radio" class="al-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}">${icon(m.id === 'jour' ? 'calendar' : 'sparkle')}<span>${m.label}</span><small>${esc(sub)}</small></button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="al-row">
        <span class="al-label" id="al-theme-label">Thème</span>
        <div class="al-themes" role="radiogroup" aria-labelledby="al-theme-label">
          ${THEMES.map((t) => {
            const locked = n < t.unlock;
            const label = locked ? `${t.name}, débloqué à ${t.unlock} découvertes` : t.name;
            return `<button type="button" role="radio" class="al-theme" data-theme="${t.id}" style="--c1:${t.c1};--c2:${t.c2}" aria-checked="${store.data.theme === t.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span></span>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="al-hint" id="al-hint">${found().size} / ${TOTAL} éléments au grimoire.</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    $('al-hint').textContent = `Découvre ${THEMES.find((t) => t.id === b.dataset.theme).unlock} éléments pour le débloquer.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.theme) {
    store.data.theme = b.dataset.theme;
    document.body.dataset.theme = b.dataset.theme;
  }
  store.save();
  gv.audio.play('select');
  renderOptions();
  gv.shell.startExtra.querySelector(b.dataset.mode ? `[data-mode="${b.dataset.mode}"]` : `[data-theme="${b.dataset.theme}"]`)?.focus();
});

// ---------- Démarrage ----------
window.__al = {
  get board() { return board; },
  get run() { return run; },
  get selected() { return selected; },
  get busy() { return busy; },
  get found() { return store.data.found; },
  findPair,
  combine,
  // Place un élément (tests)
  put(i, id) { board[i] = id; renderAll(); },
  clear() { board = Array(CELLS).fill(null); renderAll(); },
};

document.body.dataset.theme = theme().id;
// Décor de l'accueil : quelques éléments déjà posés
board = Array(CELLS).fill(null);
['eau', null, 'feu', null, null, null, 'vapeur', null, 'terre', null, null, null, 'air', null, null, 'plante', null, null, null, 'soleil'].forEach((v, i) => (board[i + 2] = v));
Object.assign(run, { combo: 0, cauldron: 3, hints: 3 });
renderAll();
renderOptions();
document.querySelector('.al-wrap').classList.add('is-ready');
gv.hud('best', formatInt(best()));
gv.showStart();
