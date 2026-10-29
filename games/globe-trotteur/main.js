// Globe-trotteur — quiz de géographie : drapeaux, capitales et cartes, quatre propositions.
// Les séries de bonnes réponses multiplient les points ; chaque pays a sa maîtrise, et un pays
// raté revient vite. Les continents s'ouvrent au fil des bonnes réponses.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createFxLayer, wiggle } from '../../shared/js/engine/fx.js';
import { createRng, dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { flagSVG } from './flags.js';
import { KINDS, MAX_MASTERY, createPicker, dailyQuestions } from './quiz.js';
import { createWorld } from './worldmap.js';

const TOUR_TIME = 60;
const DAILY_TIME = 12;
const STUDY_LEN = 15;
const params = new URLSearchParams(location.search);
const FAST = params.has('fast');
const wait = (ms) => (FAST ? Math.min(ms, 60) : motion.reduced ? Math.round(ms * 0.7) : ms);

const MODES = {
  tour: { id: 'tour', label: 'Tour du monde', hint: '60 secondes, tous tes continents' },
  etude: { id: 'etude', label: 'Apprentissage', hint: '15 questions, sans chrono, avec les réponses' },
  jour: { id: 'jour', label: 'Défi du jour', hint: '12 questions, les mêmes pour tous' },
};
const STUDY_KINDS = [
  { id: 'mix', label: 'Mélange' },
  { id: 'flag', label: 'Drapeaux' },
  { id: 'capital', label: 'Capitales' },
  { id: 'map', label: 'Cartes' },
];

const store = createStore('globe-trotteur', {
  version: 1,
  defaults: { mode: 'tour', cont: 'europe', kind: 'mix', mastery: {}, correct: 0, flags: 0, bestStreak: 0, daily: { day: '', best: 0, plays: 0, right: 0 } },
});

const $ = (id) => document.getElementById(id);
const els = { wrap: document.querySelector('.gt-wrap'), timer: $('timer'), streak: $('streak'), count: $('count'), card: $('card'), kicker: $('kicker'), prompt: $('prompt'), visual: $('visual'), answers: $('answers'), learn: $('learn') };

const gv = bootGame('globe-trotteur', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['icon:pointer', 'icon:touch'], text: 'Un drapeau, une capitale ou une carte : choisis la bonne réponse parmi quatre.' },
    { keys: ['1', '4'], text: 'Au clavier, les touches 1 à 4 répondent.' },
    { keys: ['icon:flame'], text: 'Les séries multiplient les points : ×1,5 à 5, ×2 à 10, ×3 à 20.' },
    { keys: ['icon:lock'], text: 'Les bonnes réponses ouvrent de nouveaux continents. Un pays raté revient vite.' },
  ],
  onStart: startGame,
  onRestart: startGame,
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
});
const fx = createFxLayer(gv.stage, { shakeTarget: els.card });

// ---------- Données ----------
let DATA = null;
let WORLD = null;
let mode = MODES.tour;
let picker = null;
let daily = [];
let q = null;
let answered = true;
let waitingLearn = false;
const run = {};

const today = () => dayKey();
const continents = () => DATA.continents;
const contOpen = (c) => store.data.correct >= c.unlock;
const mastery = () => store.data.mastery;
const multOf = (s) => (s >= 20 ? 3 : s >= 10 ? 2 : s >= 5 ? 1.5 : 1);
const mastered = (list) => list.filter((c) => (mastery()[c.id] ?? 0) >= 3).length;

async function load() {
  const [c, w] = await Promise.all([fetch('data/countries.json').then((r) => r.json()), fetch('data/world.json').then((r) => r.json())]);
  DATA = c;
  WORLD = createWorld(w.land);
}

function startGame() {
  mode = MODES[store.data.mode] ?? MODES.tour;
  const rng = mode.id === 'jour' ? createRng(dailySeed('globe-trotteur')) : createRng(Number(params.get('seed')) || Date.now());
  Object.assign(run, { score: 0, right: 0, wrong: 0, streak: 0, best: 0, index: 0, time: mode.id === 'tour' ? TOUR_TIME : DAILY_TIME, qTime: 0, over: false, flags: 0 });
  if (mode.id === 'jour') daily = dailyQuestions(DATA.countries, continents(), rng);
  else {
    const open = continents().filter(contOpen).map((c) => c.id);
    const cont = mode.id === 'etude' && open.includes(store.data.cont) ? [store.data.cont] : open;
    const pool = DATA.countries.filter((c) => cont.includes(c.cont));
    picker = createPicker({ pool, all: DATA.countries, continents: continents(), rng, mastery: mastery(), kindFilter: mode.id === 'etude' ? store.data.kind : 'mix' });
  }
  els.wrap.dataset.mode = mode.id;
  gv.hud('score', 0);
  renderTop();
  nextQuestion();
}

function nextQuestion() {
  if (run.over) return;
  if ((mode.id === 'jour' && run.index >= daily.length) || (mode.id === 'etude' && run.index >= STUDY_LEN)) return finish();
  q = mode.id === 'jour' ? daily[run.index] : picker.next();
  run.index++;
  run.qTime = 0;
  if (mode.id === 'jour') run.time = DAILY_TIME;
  answered = false;
  waitingLearn = false;
  renderQuestion();
  renderTop();
}

function answer(i) {
  if (answered || run.over || gv.state !== 'playing') return;
  answered = true;
  const pick = q.options[i];
  const ok = pick?.id === q.answer.id;
  const btns = [...els.answers.children];
  const good = q.options.findIndex((o) => o.id === q.answer.id);
  btns.forEach((b) => (b.disabled = true));
  btns[good]?.classList.add('is-right');
  const m = mastery();
  if (ok) {
    run.right++;
    run.streak++;
    run.best = Math.max(run.best, run.streak);
    store.data.correct++;
    if (q.kind.startsWith('flag')) {
      run.flags++;
      store.data.flags++;
    }
    store.data.mastery = { ...m, [q.answer.id]: Math.min(MAX_MASTERY, (m[q.answer.id] ?? 0) + 1) };
    const mult = multOf(run.streak);
    const speed = mode.id === 'jour' ? Math.round(Math.max(0, run.time) * 10) : 0;
    const pts = Math.round((100 + speed) * mult);
    run.score += pts;
    if (mode.id === 'tour' && run.streak % 5 === 0) {
      run.time += 3;
      fx.popupAt(els.timer, '+3 s', { size: 20, color: '#3ee6a8', rise: 30 });
    }
    gv.audio.play(run.streak >= 5 ? 'combo' : 'confirm', { pitch: 1 + Math.min(0.6, run.streak * 0.03) });
    fx.burstAt(btns[good], { count: 18 + Math.min(30, run.streak * 2), colors: ['#3ee6a8', '#ffc93c', '#fff8ec'], speed: [80, 300], size: [3, 6], gravity: 500, shape: run.streak >= 10 ? 'star' : 'circle', life: [0.4, 0.8] });
    fx.popupAt(btns[good], `+${formatInt(pts)}`, { size: 24, color: '#ffc93c', rise: 46 });
    gv.hud('score', formatInt(run.score), true);
    if (run.streak === 5 || run.streak === 10 || run.streak === 20) gv.banner(`Série ${run.streak} · ×${String(multOf(run.streak)).replace('.', ',')}`, { color: '#ffc93c' });
    checkUnlocks();
  } else {
    run.wrong++;
    run.streak = 0;
    store.data.mastery = { ...m, [q.answer.id]: Math.max(0, (m[q.answer.id] ?? 0) - 2) };
    if (picker) picker.missed(q.answer.id);
    if (i >= 0) {
      btns[i]?.classList.add('is-wrong');
      wiggle(btns[i], { amount: 6 });
    }
    fx.addShake(0.15);
    gv.audio.play('error');
    if (mode.id === 'tour') {
      run.time = Math.max(0, run.time - 3);
      fx.popupAt(els.timer, '−3 s', { size: 20, color: '#ff9a90', rise: 30 });
    }
    showLearn();
  }
  store.data.bestStreak = Math.max(store.data.bestStreak, run.best);
  if (run.best >= 10) gv.unlock('serie-10');
  if (run.best >= 25) gv.unlock('serie-25');
  if (store.data.flags >= 50) gv.unlock('drapeaux');
  store.save();
  renderTop();
  if (!ok && mode.id === 'etude') {
    waitingLearn = true;
    return;
  }
  gv.after(ok ? wait(650) : FAST ? 700 : wait(1800), nextQuestion);
}

function showLearn() {
  const c = q.answer;
  els.learn.innerHTML = `${flagSVG(c.flag, { className: 'gt-flag gt-learn__flag' })}<p><b>${esc(c.name)}</b><span>Capitale : ${esc(c.cap)}</span></p>${mode.id === 'etude' ? `<button type="button" class="gv-btn gv-btn--primary gt-next" id="nextBtn">Continuer ${icon('forward')}</button>` : ''}`;
  els.learn.hidden = false;
  $('nextBtn')?.focus({ preventScroll: true });
}

function finish() {
  if (run.over) return;
  run.over = true;
  answered = true;
  const isDaily = mode.id === 'jour';
  if (isDaily) {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), best: 0, plays: 0, right: 0 });
    d.plays++;
    d.best = Math.max(d.best, run.score);
    d.right = Math.max(d.right, run.right);
    if (run.right === daily.length) gv.unlock('jour-parfait');
  }
  if (mode.id === 'tour') {
    gv.unlock('premier-tour');
    if (run.score >= 3000) gv.unlock('grand-voyageur');
  }
  store.save();
  const total = run.right + run.wrong;
  const nextC = continents().find((c) => !contOpen(c));
  const learnHtml = mode.id === 'etude' && picker ? passportHtml() : '';
  gv.gameOver({
    score: run.score,
    stats: { score: run.score, correct: run.right, streak: run.best, daily: isDaily ? 1 : 0 },
    extraStats: [
      { label: 'Bonnes', value: `${run.right} / ${total}` },
      { label: 'Série', value: formatInt(run.best) },
    ],
    kicker: mode.label,
    title: isDaily ? `${run.right} / ${daily.length} au défi du jour` : mode.id === 'tour' ? 'Le chrono est à zéro' : 'Leçon terminée',
    extraHtml: learnHtml,
    nextUnlock: nextC ? { label: `Continent ${nextC.name}`, current: store.data.correct, target: nextC.unlock } : undefined,
  });
  gv.hud('best', formatInt(gv.best ?? 0));
  renderOptions();
}

function checkUnlocks() {
  for (const c of continents()) {
    if (c.unlock > 0 && store.data.correct === c.unlock) {
      toast({ title: 'Nouveau continent !', text: `${c.name} : ses pays rejoignent tes questions.`, iconName: 'target', tone: 'var(--mint)' });
      gv.audio.play('achievement');
    }
  }
  if (continents().every(contOpen)) gv.unlock('continents');
  const eu = DATA.countries.filter((c) => c.cont === 'europe');
  if (mastered(eu) === eu.length) gv.unlock('europe');
  if (mastered(DATA.countries) === DATA.countries.length) gv.unlock('globe');
}

// ---------- Rendu ----------
function renderQuestion() {
  const k = KINDS[q.kind];
  const c = q.answer;
  els.kicker.textContent = k.label;
  els.learn.hidden = true;
  els.card.dataset.kind = q.kind;
  if (q.kind === 'flag') {
    els.prompt.textContent = k.prompt;
    els.visual.innerHTML = flagSVG(c.flag, { label: 'Drapeau mystère' });
  } else if (q.kind === 'capital' || q.kind === 'flagpick') {
    els.prompt.textContent = k.prompt;
    els.visual.innerHTML = `<p class="gt-name">${esc(c.name)}</p>`;
  } else if (q.kind === 'city') {
    els.prompt.textContent = k.prompt;
    els.visual.innerHTML = `<p class="gt-name gt-name--city">${esc(c.cap)}</p>`;
  } else {
    const box = continents().find((x) => x.id === c.cont).box;
    const [x, y] = WORLD.project(box, c.lon, c.lat);
    els.prompt.textContent = k.prompt;
    const ratio = WORLD.dots(box).aspect;
    els.visual.innerHTML = `<div class="gt-map" style="--ratio:${ratio}"><canvas aria-hidden="true"></canvas><span class="gt-pin" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%" role="img" aria-label="Point sur la carte : ${esc(continents().find((x2) => x2.id === c.cont).name)}"></span></div>`;
    requestAnimationFrame(() => {
      const cv = els.visual.querySelector('canvas');
      if (cv) WORLD.draw(cv, box, { color: getComputedStyle(els.card).getPropertyValue('--land').trim() || '#4cc3ff' });
    });
  }
  els.answers.dataset.kind = q.kind;
  els.answers.innerHTML = q.options
    .map((o, i) => {
      const body = q.kind === 'flagpick' ? flagSVG(o.flag, { label: `Drapeau ${i + 1}` }) : `<span>${esc(q.kind === 'capital' ? o.cap : o.name)}</span>`;
      return `<button type="button" class="gt-answer" data-i="${i}" aria-keyshortcuts="${i + 1}"><kbd>${i + 1}</kbd>${body}</button>`;
    })
    .join('');
  els.card.classList.remove('is-in');
  void els.card.offsetWidth;
  els.card.classList.add('is-in');
}

function renderTop() {
  const timed = mode.id !== 'etude';
  const max = mode.id === 'tour' ? TOUR_TIME : DAILY_TIME;
  els.timer.hidden = !timed;
  els.timer.style.setProperty('--t', timed ? Math.max(0, Math.min(1, run.time / max)) : 1);
  els.timer.classList.toggle('is-low', timed && run.time < (mode.id === 'tour' ? 10 : 4));
  els.timer.querySelector('b').textContent = timed ? `${Math.ceil(Math.max(0, run.time))} s` : '';
  const mult = multOf(run.streak);
  els.streak.innerHTML = run.streak ? `${icon('flame')}<b>${run.streak}</b>${mult > 1 ? `<small>×${String(mult).replace('.', ',')}</small>` : ''}` : '';
  els.streak.classList.toggle('is-hot', run.streak >= 5);
  els.count.textContent = mode.id === 'tour' ? `${run.right} bonne${run.right > 1 ? 's' : ''}` : `${run.index} / ${mode.id === 'jour' ? daily.length : STUDY_LEN}`;
}

function passportHtml() {
  return `<div class="gt-passport">${continents()
    .map((c) => {
      const list = DATA.countries.filter((x) => x.cont === c.id);
      const n = mastered(list);
      return `<div class="gt-stamp ${contOpen(c) ? '' : 'is-locked'}"><span>${esc(c.name)}</span><i style="--p:${n / list.length}"></i><small>${contOpen(c) ? `${n} / ${list.length} maîtrisés` : `${icon('lock')} ${c.unlock} bonnes réponses`}</small></div>`;
    })
    .join('')}</div>`;
}

// ---------- Saisie ----------
els.answers.addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (b) answer(Number(b.dataset.i));
});
els.learn.addEventListener('click', (e) => {
  if (e.target.closest('#nextBtn')) nextQuestion();
});
document.addEventListener('keydown', (e) => {
  if (gv.state !== 'playing' || e.ctrlKey || e.metaKey || e.altKey) return;
  const n = ['1', '2', '3', '4'].indexOf(e.key);
  if (n >= 0 && !answered) {
    e.preventDefault();
    answer(n);
  } else if (e.key === 'Enter' && waitingLearn && !e.target.closest('button')) {
    e.preventDefault();
    nextQuestion();
  }
});

// ---------- Boucle : chronomètres ----------
const loop = createLoop({
  update(dt) {
    if (gv.state !== 'playing' || run.over || mode.id === 'etude') return;
    if (mode.id === 'jour' && answered) return;
    const before = Math.ceil(run.time);
    run.time -= dt;
    if (Math.ceil(run.time) !== before) {
      renderTop();
      if (run.time <= 5 && run.time > 0) gv.audio.play('tick', { volume: 0.4 });
    } else els.timer.style.setProperty('--t', Math.max(0, run.time / (mode.id === 'tour' ? TOUR_TIME : DAILY_TIME)));
    if (run.time > 0) return;
    if (mode.id === 'tour') {
      run.time = 0;
      renderTop();
      finish();
    } else if (!answered) answer(-1); // temps écoulé : compte comme une erreur
  },
  render() {},
  onAutoPause() {
    if (gv.playing) gv.pause();
  },
});

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const dd = store.data.daily;
  const m = store.data.mode;
  gv.shell.startExtra.innerHTML = `
    <div class="gt-options">
      <div class="gt-row">
        <span class="gt-label" id="gt-mode-label">Mode</span>
        <div class="gt-modes" role="radiogroup" aria-labelledby="gt-mode-label">
          ${Object.values(MODES)
            .map((md) => {
              const sub = md.id === 'jour' && dd.day === today() ? `Fait : ${dd.right} / 12 · ${formatInt(dd.best)} pts` : md.hint;
              return `<button type="button" role="radio" class="gt-mode" data-mode="${md.id}" aria-checked="${m === md.id}">${icon({ tour: 'clock', etude: 'eye', jour: 'calendar' }[md.id])}<span>${md.label}</span><small>${esc(sub)}</small></button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="gt-row" ${m === 'etude' ? '' : 'hidden'}>
        <span class="gt-label" id="gt-cont-label">Continent</span>
        <div class="gt-chips" role="radiogroup" aria-labelledby="gt-cont-label">
          ${continents()
            .map((c) => `<button type="button" role="radio" class="gt-chip" data-cont="${c.id}" aria-checked="${store.data.cont === c.id}" ${contOpen(c) ? '' : 'aria-disabled="true"'}>${contOpen(c) ? '' : icon('lock')}${esc(c.name)}</button>`)
            .join('')}
        </div>
        <span class="gt-label" id="gt-kind-label">Questions</span>
        <div class="gt-chips" role="radiogroup" aria-labelledby="gt-kind-label">
          ${STUDY_KINDS.map((k) => `<button type="button" role="radio" class="gt-chip" data-kind="${k.id}" aria-checked="${store.data.kind === k.id}">${k.label}</button>`).join('')}
        </div>
      </div>
      <div class="gt-row">
        <span class="gt-label">Passeport · ${formatInt(store.data.correct)} bonnes réponses</span>
        ${passportHtml()}
      </div>
      <p class="gt-hint" id="gt-hint">${m === 'jour' ? 'Douze pays du monde entier, les mêmes pour tout le monde aujourd’hui.' : m === 'etude' ? 'Sans chrono : chaque erreur affiche la bonne réponse.' : 'Une erreur coûte 3 secondes, une série de 5 en rend 3.'}</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    const c = continents().find((x) => x.id === b.dataset.cont);
    $('gt-hint').textContent = `${c.name} s’ouvre à ${c.unlock} bonnes réponses (tu en as ${store.data.correct}).`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.cont) store.data.cont = b.dataset.cont;
  if (b.dataset.kind) store.data.kind = b.dataset.kind;
  store.save();
  gv.audio.play('select');
  renderOptions();
  const key = ['mode', 'cont', 'kind'].find((k) => b.dataset[k] !== undefined);
  gv.shell.startExtra.querySelector(`[data-${key}="${b.dataset[key]}"]`)?.focus();
});

// ---------- Démarrage ----------
window.__gt = {
  get q() { return q; },
  get run() { return run; },
  get answered() { return answered; },
  get data() { return DATA; },
  get mastery() { return store.data.mastery; },
  // Index de la bonne réponse (tests)
  good() { return q.options.findIndex((o) => o.id === q.answer.id); },
};

await load();
// Décor de l'accueil : une question d'exemple
q = { kind: 'flag', answer: DATA.countries[0], options: DATA.countries.slice(0, 4) };
Object.assign(run, { score: 0, right: 0, wrong: 0, streak: 0, best: 0, index: 0, time: TOUR_TIME });
renderQuestion();
renderTop();
renderOptions();
els.wrap.classList.add('is-ready');
gv.hud('best', formatInt(gv.best ?? 0));
loop.start();
gv.showStart();
