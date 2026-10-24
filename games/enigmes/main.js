// Énigmes Éclair — QCM contre la montre : devinettes, questions pièges, logique, suites et calcul.
// La série fait grimper le multiplicateur ; trois jokers (50/50, +5 s, passer) se regagnent en
// enchaînant. Modes Éclair (12 énigmes), Survie (3 vies) et Énigme du jour.

import { bootGame } from '../../shared/js/gameverse.js';
import { createFxLayer, wiggle } from '../../shared/js/engine/fx.js';
import { createRng, dayKey } from '../../shared/js/core/rng.js';
import { formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { CATS, loadBank, prepare, pickQuestion, multOf, pointsFor, DAILY_COUNT, dailyIndex, dailyQuestions, shareText } from './logic.js';

const params = new URLSearchParams(location.search);
// ?fast=1 : enchaînements raccourcis (tests)
const FAST = params.has('fast');
const wait = (ms) => (FAST ? Math.min(ms, 80) : motion.reduced ? Math.round(ms * 0.7) : ms);

const ECLAIR_COUNT = 12;
const LIVES = 3;
const JOKER_MAX = 2;
const CAT_COLORS = { devinette: '#ffc93c', piege: '#ff8a5b', logique: '#4cc3ff', suite: '#a68bff', calcul: '#3ee6a8' };

const MODES = {
  eclair: { id: 'eclair', label: 'Éclair', hint: '12 énigmes · 15 s chacune', icon: 'bolt', unlock: 0 },
  survie: { id: 'survie', label: 'Survie', hint: '3 vies · le chrono raccourcit', icon: 'heart', unlock: 2500 },
  jour: { id: 'jour', label: 'Énigme du jour', hint: '6 énigmes, les mêmes pour tous', icon: 'calendar', unlock: 0 },
};

const THEMES = [
  { id: 'ambre', name: 'Ambre', unlock: 0, c1: '#ffc93c', c2: '#f4efe4' },
  { id: 'craie', name: 'Craie', unlock: 2000, c1: '#e8f0e0', c2: '#23402f' },
  { id: 'nuit', name: 'Nuit', unlock: 4500, c1: '#8fb4ff', c2: '#e8ecf8' },
  { id: 'neon', name: 'Néon', unlock: 7500, c1: '#ff4fd8', c2: '#170b1c' },
];

const JOKERS = [
  { id: 'fifty', label: '50/50', icon: 'minus', title: 'Retire deux mauvaises réponses' },
  { id: 'time', label: '+5 s', icon: 'clock', title: 'Ajoute 5 secondes' },
  { id: 'skip', label: 'Passer', icon: 'forward', title: 'Passe l’énigme sans casser la série' },
];

const store = createStore('enigmes', {
  version: 1,
  defaults: { mode: 'eclair', theme: 'ambre', correct: 0, traps: 0, seen: [], daily: { day: '', score: 0, marks: [] } },
});

const $ = (id) => document.getElementById(id);
const stageEl = $('stage');
const wrapEl = $('wrap');
const cardEl = $('card');
const catEl = $('cat');
const fuseEl = $('fuse');
const questionEl = $('question');
const explainEl = $('explain');
const answersEl = $('answers');
const jokersEl = $('jokers');
const progressEl = $('progress');
const streakEl = $('streak');
const livesEl = $('lives');

const gv = bootGame('enigmes', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'combo', label: 'Multi' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['1–4', 'A–D'], text: 'Choisis la bonne réponse avant la fin de la mèche.' },
    { keys: ['icon:flame'], text: 'Enchaîne : tous les 3 bons, le multiplicateur grimpe.' },
    { keys: ['icon:sparkle'], text: '50/50, +5 s, passer : un joker regagné tous les 5 bons d’affilée.' },
  ],
  onStart: startGame,
  onRestart: startGame,
});
const fx = createFxLayer(gv.stage, { shakeTarget: wrapEl });

// ---------- État ----------
let bank = [];
let mode = MODES.eclair;
let rng = createRng(Date.now());
let run = null;
let cur = null; // { q, removed:Set, answered }
let advanceId = null;
const clock = { left: 0, total: 1, running: false, last: 0, lastSec: 0 };
let clockId = 0;

const best = () => gv.best ?? 0;
const theme = () => THEMES.find((t) => t.id === store.data.theme) ?? THEMES[0];
const dailyDone = () => store.data.daily.day === dayKey();
const timeFor = () => (mode.id === 'survie' ? Math.max(6, 12 - run.level * 0.25) : 15);

// ---------- Chrono (la mèche) ----------
function startClock(s) {
  Object.assign(clock, { left: s, total: s, running: true, last: performance.now(), lastSec: Math.ceil(s) });
  renderFuse();
}
function stopClock() {
  clock.running = false;
  renderFuse();
}
function tick() {
  const now = performance.now();
  const dt = (now - clock.last) / 1000;
  clock.last = now;
  if (!clock.running || !gv.playing) return;
  clock.left = Math.max(0, clock.left - dt);
  const sec = Math.ceil(clock.left);
  if (sec !== clock.lastSec) {
    clock.lastSec = sec;
    if (sec <= 4 && sec > 0) gv.audio.play('tick', { pitch: sec <= 2 ? 1.3 : 1 });
  }
  renderFuse();
  if (clock.left <= 0) {
    clock.running = false;
    choose(null);
  }
}
function renderFuse() {
  fuseEl.style.transform = `scaleX(${Math.max(0, Math.min(1, clock.left / clock.total))})`;
  fuseEl.parentElement.classList.toggle('is-low', clock.running && clock.left <= 4);
  fuseEl.parentElement.classList.toggle('is-off', !clock.running);
}

// ---------- Partie ----------
async function startGame() {
  clearInterval(clockId);
  advanceId?.cancel();
  stopClock();
  mode = MODES[store.data.mode] ?? MODES.eclair;
  if (mode.unlock > best()) mode = MODES.eclair;
  if (mode.id === 'jour' && dailyDone()) mode = MODES.eclair;
  rng = createRng(Number(params.get('seed')) || Date.now() + Math.random() * 1e6);
  if (!bank.length) bank = await loadBank();
  run = {
    points: 0,
    index: 0,
    total: mode.id === 'eclair' ? ECLAIR_COUNT : mode.id === 'jour' ? DAILY_COUNT : Infinity,
    list: mode.id === 'jour' ? dailyQuestions(bank) : null,
    streak: 0,
    bestStreak: 0,
    correct: 0,
    flashes: 0,
    wires: 0,
    lives: LIVES,
    level: 0,
    jokers: { fifty: 1, time: 1, skip: 1 },
    jokersUsed: 0,
    marks: [],
    avoid: new Set(store.data.seen),
  };
  livesEl.hidden = mode.id !== 'survie';
  gv.hud('score', 0);
  gv.hud('combo', '×1');
  gv.hud('best', formatInt(best()));
  renderStreak();
  renderLives();
  clockId = setInterval(tick, 100);
  next();
}

function next() {
  advanceId?.cancel();
  if (gv.state !== 'playing') return;
  if (run.index >= run.total || (mode.id === 'survie' && run.lives <= 0)) return endGame();
  let q;
  if (run.list) q = run.list[run.index];
  else {
    q = prepare(rng, pickQuestion(rng, bank, run.level, run.avoid));
    run.avoid.add(q.id);
    if (!q.id.startsWith('suite-') && !q.id.startsWith('calcul-')) store.data.seen = [...store.data.seen.filter((s) => s !== q.id), q.id].slice(-60);
  }
  present(q);
}

function present(q) {
  cur = { q, removed: new Set(), answered: false };
  progressEl.textContent = mode.id === 'survie' ? `Survie · énigme ${run.index + 1}` : `Énigme ${run.index + 1} / ${run.total}`;
  const cat = CATS[q.c] ?? CATS.devinette;
  catEl.style.setProperty('--cat', CAT_COLORS[q.c] ?? CAT_COLORS.devinette);
  catEl.innerHTML = `${icon(cat.icon)}${cat.label}`;
  questionEl.textContent = q.q;
  explainEl.hidden = true;
  explainEl.innerHTML = '';
  cardEl.classList.remove('is-in', 'is-wrong');
  void cardEl.offsetWidth;
  cardEl.classList.add('is-in');
  answersEl.innerHTML = q.options
    .map((o, i) => `<button type="button" class="en-ans is-in" style="--k:${i}" data-i="${i}"><span class="en-key" aria-hidden="true">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`)
    .join('');
  renderJokers();
  startClock(timeFor());
  gv.audio.play('whoosh', { pitch: 1.1 });
}

// ---------- Réponse ----------
function choose(i) {
  if (!cur || cur.answered || gv.state !== 'playing') return;
  if (i !== null && cur.removed.has(i)) return;
  cur.answered = true;
  const left = clock.left;
  stopClock();
  const q = cur.q;
  const buttons = [...answersEl.children];
  buttons.forEach((b) => (b.disabled = true));
  const ok = i === q.correct;
  buttons[q.correct].classList.add('is-right');
  run.level++;
  run.index++;
  if (ok) {
    const { pts, flash, wire } = pointsFor({ left, total: clock.total, mult: multOf(run.streak) });
    run.points += pts;
    run.streak++;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    run.correct++;
    if (flash) run.flashes++;
    if (wire) run.wires++;
    run.marks.push(flash ? 'flash' : 'ok');
    store.data.correct++;
    if (q.c === 'piege') store.data.traps++;
    store.save();
    gv.unlock('premier');
    if (run.streak >= 10) gv.unlock('serie-10');
    if (wire) gv.unlock('sur-le-fil');
    if (run.flashes >= 5) gv.unlock('eclair-5');
    if (mode.id === 'survie' && run.correct >= 25) gv.unlock('survie-25');
    if (store.data.correct >= 200) gv.unlock('savant');
    if (store.data.traps >= 20) gv.unlock('piege');
    rewardEffects(buttons[i], pts, flash, wire);
    if (run.streak % 5 === 0) gainJoker();
    showExplain(true, flash ? `Éclair ! +${formatInt(pts)}` : wire ? `Sur le fil ! +${formatInt(pts)}` : `Bonne réponse · +${formatInt(pts)}`);
  } else {
    const lostStreak = run.streak;
    run.streak = 0;
    run.marks.push('ko');
    if (i !== null) buttons[i].classList.add('is-wrong');
    if (mode.id === 'survie') {
      run.lives--;
      renderLives(true);
    }
    cardEl.classList.remove('is-in');
    cardEl.classList.add('is-wrong');
    fx.addShake(0.35);
    gv.audio.play('error');
    showExplain(false, i === null ? 'Temps écoulé' : lostStreak >= 3 ? `Raté · série de ${lostStreak} perdue` : 'Raté');
  }
  gv.hud('score', formatInt(run.points), ok);
  gv.hud('combo', `×${multOf(run.streak)}`, ok && run.streak % 3 === 0);
  renderStreak(ok);
  renderJokers();
  advanceId = gv.after(wait(ok ? 1700 : 3000), next);
}

function rewardEffects(btn, pts, flash, wire) {
  stageEl.classList.remove('is-flash');
  void stageEl.offsetWidth;
  stageEl.classList.add('is-flash');
  setTimeout(() => stageEl.classList.remove('is-flash'), 450);
  fx.burstAt(btn, { count: flash ? 34 : 18, colors: ['#ffc93c', '#fff3c4', '#3ee6a8'], speed: [140, flash ? 460 : 300], size: [3, 7], gravity: 700, shape: flash ? 'star' : 'spark', life: [0.5, 1] });
  fx.popupAt(btn, `+${formatInt(pts)}`, { size: flash ? 38 : 30, color: '#ffc93c', rise: 60 });
  if (flash) {
    fx.addShake(0.2);
    gv.audio.play('perfect');
  } else if (wire) {
    gv.audio.play('nearMiss');
    fx.addShake(0.15);
  } else gv.audio.play('coin', { pitch: 1 + Math.min(run.streak, 12) * 0.03 });
  if (run.streak > 0 && run.streak % 3 === 0) setTimeout(() => gv.audio.play('combo', { pitch: 0.9 + multOf(run.streak) * 0.08 }), 160);
}

function showExplain(ok, title) {
  const q = cur.q;
  explainEl.innerHTML = `
    <b class="${ok ? 'is-ok' : 'is-ko'}">${esc(title)}</b>
    ${ok ? '' : `<span>La réponse : <strong>${esc(q.a)}</strong></span>`}
    <small>${esc(q.e)}</small>`;
  explainEl.hidden = false;
}

// ---------- Jokers ----------
function useJoker(id) {
  if (!cur || cur.answered || gv.state !== 'playing' || !run.jokers[id]) return;
  run.jokers[id]--;
  run.jokersUsed++;
  const buttons = [...answersEl.children];
  if (id === 'fifty') {
    const wrong = rng.shuffle(cur.q.options.map((_, i) => i).filter((i) => i !== cur.q.correct && !cur.removed.has(i))).slice(0, 2);
    for (const i of wrong) {
      cur.removed.add(i);
      buttons[i].classList.add('is-out');
      buttons[i].disabled = true;
    }
    gv.audio.play('pop');
  } else if (id === 'time') {
    clock.left += 5;
    clock.total = Math.max(clock.total, clock.left);
    fx.popupAt(fuseEl.parentElement, '+5 s', { size: 24, color: '#3ee6a8', rise: 30 });
    gv.audio.play('powerup');
  } else {
    cur.answered = true;
    stopClock();
    run.marks.push('skip');
    run.index++;
    run.level++;
    gv.audio.play('whoosh', { pitch: 0.8 });
    buttons.forEach((b) => (b.disabled = true));
    buttons[cur.q.correct].classList.add('is-dim');
    showExplain(true, 'Énigme passée');
    advanceId = gv.after(wait(900), next);
  }
  renderJokers();
}

function gainJoker() {
  const choices = JOKERS.filter((j) => run.jokers[j.id] < JOKER_MAX);
  if (!choices.length) return;
  const j = rng.pick(choices);
  run.jokers[j.id]++;
  renderJokers(j.id);
  fx.popupAt(jokersEl, `Joker gagné : ${j.label}`, { size: 22, color: '#3ee6a8', rise: 30 });
}

function renderJokers(gained = '') {
  const done = !cur || cur.answered;
  jokersEl.innerHTML = JOKERS.map(
    (j) => `<button type="button" class="en-joker ${gained === j.id ? 'is-gain' : ''}" data-joker="${j.id}" title="${esc(j.title)}" ${done || !run?.jokers[j.id] ? 'disabled' : ''}>${icon(j.icon)}${j.label} <b>${run?.jokers[j.id] ?? 0}</b><span class="sr-only">, ${esc(j.title.toLowerCase())}</span></button>`,
  ).join('');
}

// ---------- Rendu ----------
function renderStreak(bump = false) {
  const s = run?.streak ?? 0;
  streakEl.innerHTML = s >= 2 ? `${icon('flame')}Série ${s}` : '';
  if (bump && s >= 2) {
    streakEl.classList.remove('is-bump');
    void streakEl.offsetWidth;
    streakEl.classList.add('is-bump');
  }
}
function renderLives(lost = false) {
  if (!run) return;
  livesEl.innerHTML = Array.from({ length: LIVES }, (_, i) => icon('heartFill', { className: i < run.lives ? '' : 'is-lost' })).join('');
  livesEl.setAttribute('role', 'img');
  livesEl.setAttribute('aria-label', `${run.lives} vie${run.lives > 1 ? 's' : ''}`);
  if (lost) wiggle(livesEl, { amount: 6 });
}

// ---------- Fin de partie ----------
function endGame() {
  if (gv.state === 'over' || !run) return;
  clearInterval(clockId);
  advanceId?.cancel();
  stopClock();
  const beforeBest = best();
  const isDaily = mode.id === 'jour';
  if (isDaily) {
    store.data.daily = { day: dayKey(), score: run.points, marks: run.marks };
    gv.unlock('du-jour');
  }
  store.save();
  if (mode.id === 'eclair' && run.correct === ECLAIR_COUNT) gv.unlock('sans-faute');
  if (mode.id === 'eclair' && run.jokersUsed === 0 && run.correct >= 10) gv.unlock('sans-joker');

  const nextU = [...THEMES.map((t) => ({ label: `Thème ${t.name}`, unlock: t.unlock })), { label: 'Mode Survie', unlock: MODES.survie.unlock }]
    .filter((u) => u.unlock > Math.max(beforeBest, run.points))
    .sort((a, b) => a.unlock - b.unlock)[0];
  const answered = run.marks.filter((m) => m !== 'skip').length;
  gv.gameOver({
    score: run.points,
    stats: { score: run.points, correct: run.correct, streak: run.bestStreak, daily: isDaily ? 1 : 0 },
    extraStats: [
      { label: 'Bonnes réponses', value: mode.id === 'survie' ? String(run.correct) : `${run.correct} / ${answered}` },
      { label: 'Meilleure série', value: String(run.bestStreak) },
    ],
    kicker: mode.label,
    title: mode.id === 'survie' ? 'Plus de vies' : isDaily ? `Énigme du jour n°${dailyIndex()}` : run.correct === ECLAIR_COUNT ? 'Sans faute !' : 'Fin de la rafale',
    nextUnlock: nextU ? { label: nextU.label, current: Math.max(beforeBest, run.points), target: nextU.unlock } : undefined,
    extraHtml: recapHtml(),
    sound: run.correct > 0 ? 'record' : 'lose',
  });
  const after = best();
  for (const t of THEMES) if (t.unlock > 0 && beforeBest < t.unlock && after >= t.unlock) toast({ title: 'Nouveau thème !', text: `Thème ${t.name} débloqué.`, iconName: 'palette', tone: 'var(--coin)' });
  if (beforeBest < MODES.survie.unlock && after >= MODES.survie.unlock) toast({ title: 'Mode Survie débloqué', text: '3 vies, et le chrono raccourcit.', iconName: 'heart', tone: 'var(--coin)' });
  if (THEMES.every((t) => after >= t.unlock)) gv.unlock('collection');
  gv.hud('best', formatInt(after));
  document.querySelector('[data-screen="over"] [data-share]')?.addEventListener('click', async () => {
    const text = shareText(run.marks, run.points, dailyIndex());
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Résultat copié', text: 'Colle-le où tu veux : les énigmes restent secrètes.', iconName: 'share', tone: 'var(--mint)', duration: 2400 });
    } catch {
      toast({ title: 'Copie impossible', text: text.split('\n')[0], iconName: 'info', tone: 'var(--tomato)' });
    }
  });
  renderOptions();
}

function recapHtml() {
  if (!run.marks.length) return '';
  const glyph = { flash: '⚡', ok: '✓', ko: '✗', skip: '»' };
  const label = { flash: 'Éclair', ok: 'Bonne réponse', ko: 'Raté', skip: 'Passée' };
  const marks = run.marks.slice(-24);
  const row = `<div class="en-recap" role="img" aria-label="${esc(marks.map((m) => label[m]).join(', '))}">${marks.map((m) => `<i class="${m}" aria-hidden="true">${glyph[m]}</i>`).join('')}</div>`;
  const share = mode.id === 'jour' ? `<button class="btn btn--sm btn--block en-share" type="button" data-share>${icon('share')}Copier mon résultat</button>` : '';
  return row + share;
}

// ---------- Évènements ----------
answersEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (b) choose(Number(b.dataset.i));
});
jokersEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-joker]');
  if (b) useJoker(b.dataset.joker);
});
explainEl.addEventListener('click', () => cur?.answered && next());
window.addEventListener('keydown', (e) => {
  if (gv.state !== 'playing' || e.repeat || !cur) return;
  const k = e.key.toLowerCase();
  const idx = ['1', '2', '3', '4'].indexOf(k) >= 0 ? ['1', '2', '3', '4'].indexOf(k) : ['a', 'b', 'c', 'd'].indexOf(k);
  if (idx >= 0 && !cur.answered) {
    e.preventDefault();
    choose(idx);
  } else if ((e.key === 'Enter' || e.key === ' ') && cur.answered && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    next();
  }
});

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const b = best();
  const d = store.data;
  gv.shell.startExtra.innerHTML = `
    <div class="en-options">
      <div class="en-row">
        <span class="en-label" id="en-mode-label">Mode</span>
        <div class="en-modes" role="radiogroup" aria-labelledby="en-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const locked = b < m.unlock;
              const done = m.id === 'jour' && dailyDone();
              const sub = locked ? `${formatInt(m.unlock)} pts` : done ? `${formatInt(d.daily.score)} pts · reviens demain` : m.hint;
              return `<button type="button" role="radio" class="en-mode" data-mode="${m.id}" aria-checked="${d.mode === m.id}" ${locked || done ? 'aria-disabled="true"' : ''}>
                ${locked ? icon('lock') : icon(m.icon)}<span>${m.label}</span><small>${esc(sub)}</small>
              </button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="en-row">
        <span class="en-label" id="en-theme-label">Thème</span>
        <div class="en-themes" role="radiogroup" aria-labelledby="en-theme-label">
          ${THEMES.map((t) => {
            const locked = b < t.unlock;
            const label = locked ? `${t.name}, débloqué à ${formatInt(t.unlock)} points` : t.name;
            return `<button type="button" role="radio" class="en-theme" data-theme="${t.id}" style="--c1:${t.c1};--c2:${t.c2}" aria-checked="${d.theme === t.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span></span>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="en-hint" id="en-hint" aria-live="polite"></p>
    </div>`;
}

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    const m = MODES[b.dataset.mode];
    $('en-hint').textContent = m?.id === 'jour' ? 'L’énigme du jour se renouvelle à minuit.' : `Atteins ${formatInt((m ?? THEMES.find((t) => t.id === b.dataset.theme)).unlock)} points pour le débloquer.`;
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
window.__enigmes = {
  get mode() { return mode; },
  get run() { return run; },
  get cur() { return cur; },
  get clock() { return clock; },
  get bank() { return bank; },
};

document.body.dataset.theme = theme().id;
// Décor de l'accueil : une énigme d'exemple, rendue tout de suite
catEl.style.setProperty('--cat', CAT_COLORS.devinette);
catEl.innerHTML = `${icon(CATS.devinette.icon)}${CATS.devinette.label}`;
questionEl.textContent = 'J’ai des dents mais je ne mords jamais. Qui suis-je ?';
answersEl.innerHTML = ['Une agrafeuse', 'Un peigne', 'Un bouton', 'Un livre']
  .map((o, i) => `<button type="button" class="en-ans" data-i="${i}" tabindex="-1"><span class="en-key" aria-hidden="true">${'ABCD'[i]}</span><span>${o}</span></button>`)
  .join('');
progressEl.textContent = 'Énigmes Éclair';
renderJokers();
renderOptions();
wrapEl.classList.add('is-ready');
gv.hud('best', formatInt(best()));
gv.hud('combo', '×1');
gv.showStart();
loadBank()
  .then((b) => (bank = b))
  .catch((err) => console.warn('[enigmes]', err));
