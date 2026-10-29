// Lettres en vrac — sept lettres sur une roue : forme le plus de mots possible en glissant d'une
// lettre à l'autre (ou au clavier). Le mot de sept lettres vaut gros. Contre la montre, en zen,
// ou sur le tirage du jour.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createFxLayer, wiggle } from '../../shared/js/engine/fx.js';
import { createRng, dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { createDict, fits, norm, MIN, MAX, POINTS } from './words.js';

const START_TIME = 90;
const DAILY_TIME = 120;
const params = new URLSearchParams(location.search);
const FAST = params.has('fast');

const MODES = {
  chrono: { id: 'chrono', label: 'Contre la montre', hint: 'Chaque mot rend du temps, enchaîne les tirages' },
  zen: { id: 'zen', label: 'Zen', hint: 'Sans chrono : trouve tous les mots du tirage' },
  jour: { id: 'jour', label: 'Tirage du jour', hint: '2 minutes, les mêmes lettres pour tous' },
};
const THEMES = [
  { id: 'bois', name: 'Bois', unlock: 0, c1: '#c8955a', c2: '#3a2414' },
  { id: 'ardoise', name: 'Ardoise', unlock: 100, c1: '#3b4a5a', c2: '#e9eef5' },
  { id: 'neon', name: 'Néon', unlock: 300, c1: '#1b0f2e', c2: '#ff5fa2' },
  { id: 'or', name: 'Or', unlock: 700, c1: '#ffc93c', c2: '#3a2600' },
];

const store = createStore('lettres', {
  version: 1,
  defaults: { mode: 'chrono', theme: 'bois', words: 0, sevens: 0, bonus: 0, daily: { day: '', best: 0, plays: 0, found: 0 } },
});

const $ = (id) => document.getElementById(id);
const els = { wrap: document.querySelector('.lt-wrap'), timer: $('timer'), round: $('round'), found: $('found'), word: $('word'), wheel: $('wheel'), lines: $('lines'), tools: $('tools'), msg: $('msg') };

const gv = bootGame('lettres', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'words', label: 'Mots' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['icon:touch', 'icon:pointer'], text: 'Glisse d’une lettre à l’autre, ou touche-les une à une, puis valide.' },
    { keys: ['A', 'Entrée'], text: 'Au clavier : tape le mot et Entrée. Espace mélange, Retour arrière efface.' },
    { keys: ['icon:star'], text: 'Le mot de sept lettres vaut 250 points. Pluriels et verbes conjugués comptent en bonus.' },
    { keys: ['icon:clock'], text: 'Contre la montre : chaque mot rend du temps, le mot entier ouvre un nouveau tirage.' },
  ],
  // P doit rester une lettre : seule Échap met en pause
  pauseKeys: ['Escape'],
  onStart: startGame,
  onRestart: startGame,
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
});
const fx = createFxLayer(gv.stage, { shakeTarget: els.word });

let DICT = null;
let mode = MODES.chrono;
let rng = createRng(1);
let tirage = null; // { root, letters, targets }
let found = new Set();
let bonusFound = new Set();
let picked = []; // indices des lettres choisies
let drag = null;
const run = {};

const today = () => dayKey();
const theme = () => THEMES.find((t) => t.id === store.data.theme) ?? THEMES[0];
const word = () => picked.map((i) => tirage.letters[i]).join('');
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function load() {
  const d = await fetch('data/mots.json').then((r) => r.json());
  DICT = createDict(d.mots);
}

function startGame() {
  mode = MODES[store.data.mode] ?? MODES.chrono;
  rng = mode.id === 'jour' ? createRng(dailySeed('lettres')) : createRng(Number(params.get('seed')) || Date.now());
  Object.assign(run, { score: 0, words: 0, sevens: 0, bonus: 0, round: 0, time: mode.id === 'jour' ? DAILY_TIME : START_TIME, over: false, hints: 3, used: [], streak: 0 });
  els.wrap.dataset.mode = mode.id;
  newTirage();
  gv.hud('score', 0);
  gv.hud('words', 0);
}

function newTirage() {
  run.round++;
  tirage = DICT.draw(rng, { minTargets: mode.id === 'zen' ? 14 : 12, avoid: run.used });
  run.used.push(tirage.root);
  found = new Set();
  bonusFound = new Set();
  run.hinted = new Map();
  picked = [];
  renderWheel();
  renderFound();
  renderWord();
  renderTop();
  if (run.round > 1) {
    gv.banner(`Tirage ${run.round}`, { color: '#ffc93c' });
    gv.audio.play('levelUp');
  }
}

// ---------- Mots ----------
function submit() {
  if (run.over || gv.state !== 'playing') return;
  const w = word();
  picked = [];
  if (!w) return;
  if (w.length < MIN) return reject(w, `${MIN} lettres minimum`, 'short');
  if (found.has(w) || bonusFound.has(w)) return reject(w, 'Déjà trouvé', 'dup');
  const kind = DICT.kind(w);
  if (!kind || !fits(w, letterPool())) return reject(w, 'Pas dans mon dictionnaire', 'bad');
  const mult = mode.id === 'chrono' ? 1 + (run.round - 1) * 0.25 : 1;
  let pts = Math.round(POINTS[w.length] * mult * (kind === 'bonus' ? 0.5 : 1));
  run.streak++;
  if (kind === 'target') found.add(w);
  else {
    bonusFound.add(w);
    run.bonus++;
    store.data.bonus++;
  }
  run.words++;
  store.data.words++;
  run.score += pts;
  if (mode.id !== 'zen') {
    const bonusT = kind === 'bonus' ? 1 : w.length - 2;
    run.time += mode.id === 'chrono' ? bonusT : 0;
    if (mode.id === 'chrono') fx.popupAt(els.timer, `+${bonusT} s`, { size: 18, color: '#3ee6a8', rise: 26 });
  }
  const seven = w.length === MAX;
  if (seven) {
    run.sevens++;
    store.data.sevens++;
    gv.unlock('mot-complet');
    gv.banner('Mot complet !', { color: '#ffc93c' });
    gv.audio.play('record');
  } else gv.audio.play(kind === 'bonus' ? 'coin' : 'confirm', { pitch: 0.9 + w.length * 0.08 });
  fx.burstAt(els.word, { count: seven ? 60 : 12 + w.length * 3, colors: seven ? ['#ffc93c', '#fff3c4', '#ff8fab', '#4cc3ff'] : ['#3ee6a8', '#fff8ec'], speed: [80, seven ? 420 : 240], size: [3, 6], gravity: 500, shape: seven ? 'star' : 'circle', life: [0.4, 0.9] });
  fx.popupAt(els.word, `+${formatInt(pts)}${kind === 'bonus' ? ' bonus' : ''}`, { size: seven ? 32 : 24, color: '#ffc93c', rise: 50 });
  setMsg(kind === 'bonus' ? `${w} : mot bonus` : seven ? `${w} : le mot entier !` : w, 'good');
  els.word.classList.add('is-good');
  setTimeout(() => els.word.classList.remove('is-good'), 300);
  gv.unlock('premier-mot');
  if (store.data.words >= 100) gv.unlock('cent');
  if (store.data.words >= 1000) gv.unlock('mille');
  checkThemes();
  store.save();
  gv.hud('score', formatInt(run.score), true);
  gv.hud('words', formatInt(run.words), true);
  renderFound(w);
  renderWord();
  renderTop();
  // Fin du tirage
  const all = found.size === tirage.targets.length;
  if (all) gv.unlock('tirage-complet');
  if (mode.id === 'chrono' && (seven || found.size >= Math.ceil(tirage.targets.length * 0.6))) {
    run.time += 10;
    if (run.round + 1 >= 3) gv.unlock('trois-tirages');
    gv.after(FAST ? 50 : 700, newTirage);
  } else if (mode.id === 'zen' && all) {
    gv.after(FAST ? 50 : 900, finish);
  }
}

function reject(w, text, kind) {
  run.streak = 0;
  setMsg(`${w} : ${text}`, kind === 'dup' ? 'dup' : 'bad');
  wiggle(els.word, { amount: 8 });
  gv.audio.play(kind === 'dup' ? 'tock' : 'error', { volume: 0.6 });
  els.word.textContent = w;
  els.word.classList.add(kind === 'dup' ? 'is-dup' : 'is-bad');
  setTimeout(() => {
    els.word.classList.remove('is-dup', 'is-bad');
    renderWord();
  }, 420);
  renderWheel();
}

function letterPool() {
  const c = {};
  for (const ch of tirage.letters) c[ch] = (c[ch] ?? 0) + 1;
  return c;
}

function shuffle() {
  if (run.over) return;
  const order = rng.shuffle(tirage.letters.map((_, i) => i));
  tirage.letters = order.map((i) => tirage.letters[i]);
  picked = [];
  gv.audio.play('whoosh', { pitch: 1.4, volume: 0.5 });
  renderWheel(true);
  renderWord();
}

function hint() {
  if (run.over || run.hints <= 0) return;
  const left = tirage.targets.filter((w) => !found.has(w));
  if (!left.length) return;
  // Révèle une lettre de plus d'un mot encore caché
  const w = left.find((x) => run.hinted.has(x)) ?? rng.pick(left);
  run.hinted.set(w, Math.min(w.length - 1, (run.hinted.get(w) ?? 0) + 1));
  run.hints--;
  gv.audio.play('powerup');
  setMsg(`Indice : un mot de ${w.length} lettres commence par ${w.slice(0, run.hinted.get(w))}…`);
  renderFound();
  renderTop();
}

function finish() {
  if (run.over) return;
  run.over = true;
  picked = [];
  renderWord();
  const isDaily = mode.id === 'jour';
  if (isDaily) {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), best: 0, plays: 0, found: 0 });
    d.plays++;
    d.best = Math.max(d.best, run.score);
    d.found = Math.max(d.found, found.size);
    gv.unlock('du-jour');
  }
  store.save();
  const missed = tirage.targets.filter((w) => !found.has(w));
  const next = THEMES.find((t) => t.unlock > store.data.words);
  gv.gameOver({
    score: run.score,
    stats: { score: run.score, words: run.words, seven: run.sevens, daily: isDaily ? 1 : 0 },
    extraStats: [
      { label: 'Mots', value: `${run.words}${run.bonus ? ` (dont ${run.bonus} bonus)` : ''}` },
      { label: mode.id === 'chrono' ? 'Tirages' : 'Trouvés', value: mode.id === 'chrono' ? formatInt(run.round) : `${found.size} / ${tirage.targets.length}` },
    ],
    kicker: mode.label,
    title: mode.id === 'zen' && !missed.length ? 'Tirage complet !' : `Le mot entier : ${tirage.root}`,
    extraHtml: missed.length ? `<div class="lt-missed"><p>Il restait :</p><p>${missed.slice(0, 24).map((w) => `<span>${esc(w)}</span>`).join('')}${missed.length > 24 ? ` <em>+${missed.length - 24}</em>` : ''}</p></div>` : '',
    nextUnlock: next ? { label: `Thème ${next.name}`, current: store.data.words, target: next.unlock } : undefined,
  });
  gv.hud('best', formatInt(gv.best ?? 0));
  renderOptions();
}

function checkThemes() {
  for (const t of THEMES) if (t.unlock > 0 && store.data.words === t.unlock) toast({ title: 'Nouveau thème !', text: `Thème ${t.name} débloqué.`, iconName: 'palette', tone: 'var(--mint)' });
}

// ---------- Rendu ----------
function setMsg(text, tone = '') {
  els.msg.textContent = text;
  els.msg.dataset.tone = tone;
}

function renderTop() {
  const timed = mode.id !== 'zen';
  els.timer.hidden = !timed;
  const max = mode.id === 'jour' ? DAILY_TIME : START_TIME;
  els.timer.style.setProperty('--t', Math.max(0, Math.min(1, run.time / max)));
  els.timer.classList.toggle('is-low', timed && run.time < 10);
  els.timer.querySelector('b').textContent = timed ? fmt(Math.max(0, run.time)) : '';
  els.round.textContent = mode.id === 'chrono' ? `Tirage ${run.round} · ${found.size} / ${tirage.targets.length}` : `${found.size} / ${tirage.targets.length} mots${mode.id === 'zen' ? ` · ${run.hints} indice${run.hints > 1 ? 's' : ''}` : ''}`;
  els.tools.querySelector('[data-act="hint"]').hidden = mode.id !== 'zen';
  els.tools.querySelector('[data-act="hint"]').disabled = run.hints <= 0;
}

function renderWheel(spin = false) {
  const n = tirage.letters.length;
  els.wheel.querySelectorAll('.lt-letter').forEach((b) => b.remove());
  tirage.letters.forEach((ch, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `lt-letter${picked.includes(i) ? ' is-on' : ''}${spin ? ' is-spin' : ''}`;
    b.dataset.i = i;
    b.style.setProperty('--x', `${50 + Math.cos(a) * 36}%`);
    b.style.setProperty('--y', `${50 + Math.sin(a) * 36}%`);
    b.textContent = ch;
    b.setAttribute('aria-label', `Lettre ${ch}`);
    b.setAttribute('aria-pressed', String(picked.includes(i)));
    els.wheel.append(b);
  });
  drawLines();
}

function drawLines() {
  const r = els.wheel.getBoundingClientRect();
  const pts = picked.map((i) => {
    const b = els.wheel.querySelector(`.lt-letter[data-i="${i}"]`).getBoundingClientRect();
    return [b.left + b.width / 2 - r.left, b.top + b.height / 2 - r.top];
  });
  if (drag?.x !== undefined && pts.length) pts.push([drag.x - r.left, drag.y - r.top]);
  els.lines.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  els.lines.innerHTML = pts.length > 1 ? `<polyline points="${pts.map((p) => p.join(',')).join(' ')}"/>` : '';
}

function renderWord() {
  els.word.textContent = word() || '';
  els.word.classList.toggle('is-empty', !picked.length);
  els.wheel.querySelectorAll('.lt-letter').forEach((b) => {
    const on = picked.includes(Number(b.dataset.i));
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  drawLines();
}

function renderFound(fresh = '') {
  const groups = [];
  for (let len = MIN; len <= MAX; len++) {
    const all = tirage.targets.filter((w) => w.length === len);
    if (!all.length) continue;
    const got = all.filter((w) => found.has(w));
    const chips = all
      .map((w) => {
        if (found.has(w)) return `<span class="lt-chip is-got ${w === fresh ? 'is-new' : ''}">${esc(w)}</span>`;
        const h = run.hinted?.get(w);
        return mode.id === 'zen' ? `<span class="lt-chip is-hole" aria-label="Mot caché de ${len} lettres">${h ? esc(w.slice(0, h)) : ''}${'·'.repeat(len - (h ?? 0))}</span>` : '';
      })
      .join('');
    const rest = mode.id === 'zen' ? '' : all.length - got.length ? `<span class="lt-chip is-left">+${all.length - got.length}</span>` : '';
    groups.push(`<div class="lt-group"><h2>${len} lettres <small>${got.length} / ${all.length}</small></h2><div class="lt-chips">${chips}${rest}</div></div>`);
  }
  const extra = [...bonusFound];
  if (extra.length) groups.push(`<div class="lt-group"><h2>Bonus <small>${extra.length}</small></h2><div class="lt-chips">${extra.map((w) => `<span class="lt-chip is-bonus ${w === fresh ? 'is-new' : ''}">${esc(w)}</span>`).join('')}</div></div>`);
  els.found.innerHTML = groups.join('');
}

// ---------- Saisie ----------
const letterAt = (x, y) => {
  const el = document.elementFromPoint(x, y)?.closest?.('.lt-letter');
  if (!el) return -1;
  // Zone de prise : le cœur de la lettre, pour pouvoir passer entre deux lettres voisines
  const b = el.getBoundingClientRect();
  return Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2)) < b.width * 0.42 ? Number(el.dataset.i) : -1;
};
function pick(i) {
  if (i < 0 || run.over) return;
  const at = picked.indexOf(i);
  if (at >= 0 && at === picked.length - 2) {
    // Revenir sur l'avant-dernière lettre retire la dernière
    picked.pop();
    gv.audio.play('back', { volume: 0.4 });
  } else if (at < 0) {
    picked.push(i);
    gv.audio.play('tick', { pitch: 0.9 + picked.length * 0.12, volume: 0.5 });
  } else return;
  renderWord();
}
els.wheel.addEventListener('pointerdown', (e) => {
  if (gv.state !== 'playing' || run.over) return;
  const i = letterAt(e.clientX, e.clientY);
  if (i < 0) return;
  e.preventDefault();
  els.wheel.setPointerCapture?.(e.pointerId);
  // Une lettre déjà choisie, touchée seule : on la retire (mode toucher)
  if (picked.includes(i) && picked[picked.length - 1] === i) {
    drag = { id: e.pointerId, moved: false, start: i, x: e.clientX, y: e.clientY, removeOnTap: true };
    return;
  }
  drag = { id: e.pointerId, moved: false, start: i, x: e.clientX, y: e.clientY, startCount: picked.length };
  pick(i);
});
els.wheel.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  const i = letterAt(e.clientX, e.clientY);
  if (i >= 0 && i !== picked[picked.length - 1]) {
    drag.moved = true;
    pick(i);
  } else drawLines();
});
const release = (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const d = drag;
  drag = null;
  if (d.removeOnTap && !d.moved) {
    picked.pop();
    gv.audio.play('back', { volume: 0.4 });
    renderWord();
    return;
  }
  // Un vrai glissé se valide en relâchant ; un simple toucher garde le mot en cours
  if (d.moved) submit();
  else drawLines();
};
els.wheel.addEventListener('pointerup', release);
els.wheel.addEventListener('pointercancel', (e) => {
  if (drag?.id === e.pointerId) drag = null;
  drawLines();
});
// Clavier sur les lettres (Entrée / Espace sur un bouton)
els.wheel.addEventListener('click', (e) => {
  if (e.detail !== 0) return;
  const b = e.target.closest('.lt-letter');
  if (b) pick(Number(b.dataset.i));
});
els.tools.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (b.dataset.act === 'ok') submit();
  else if (b.dataset.act === 'clear') {
    picked = [];
    renderWord();
  } else if (b.dataset.act === 'shuffle') shuffle();
  else if (b.dataset.act === 'hint') hint();
});
document.addEventListener('keydown', (e) => {
  if (gv.state !== 'playing' || run.over || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('button') && (e.key === 'Enter' || e.key === ' ')) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    return submit();
  }
  if (e.key === 'Backspace') {
    e.preventDefault();
    picked.pop();
    return renderWord();
  }
  if (e.key === ' ') {
    e.preventDefault();
    return shuffle();
  }
  const ch = norm(e.key);
  if (ch.length !== 1) return;
  // La première lettre libre qui correspond
  const i = tirage.letters.findIndex((c, k) => c === ch && !picked.includes(k));
  if (i >= 0) {
    picked.push(i);
    gv.audio.play('tick', { pitch: 0.9 + picked.length * 0.12, volume: 0.5 });
    renderWord();
  } else wiggle(els.word, { amount: 4 });
});
addEventListener('resize', () => drawLines());

// ---------- Boucle : chronomètre ----------
const loop = createLoop({
  update(dt) {
    if (gv.state !== 'playing' || run.over || mode.id === 'zen' || !tirage) return;
    const before = Math.ceil(run.time);
    run.time -= dt;
    if (Math.ceil(run.time) !== before) {
      renderTop();
      if (run.time <= 5 && run.time > 0) gv.audio.play('tick', { volume: 0.35 });
    }
    if (run.time <= 0) {
      run.time = 0;
      renderTop();
      finish();
    }
  },
  render() {},
  onAutoPause() {
    if (gv.playing) gv.pause();
  },
});

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const dd = store.data.daily;
  const n = store.data.words;
  gv.shell.startExtra.innerHTML = `
    <div class="lt-options">
      <div class="lt-row">
        <span class="lt-label" id="lt-mode-label">Mode</span>
        <div class="lt-modes" role="radiogroup" aria-labelledby="lt-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const sub = m.id === 'jour' && dd.day === today() ? `Fait : ${dd.found} mots · ${formatInt(dd.best)} pts` : m.hint;
              return `<button type="button" role="radio" class="lt-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}">${icon({ chrono: 'clock', zen: 'eye', jour: 'calendar' }[m.id])}<span>${m.label}</span><small>${esc(sub)}</small></button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="lt-row">
        <span class="lt-label" id="lt-theme-label">Thème · ${formatInt(n)} mots trouvés</span>
        <div class="lt-themes" role="radiogroup" aria-labelledby="lt-theme-label">
          ${THEMES.map((t) => {
            const locked = n < t.unlock;
            const label = locked ? `${t.name}, débloqué à ${t.unlock} mots` : t.name;
            return `<button type="button" role="radio" class="lt-theme" data-theme="${t.id}" style="--c1:${t.c1};--c2:${t.c2}" aria-checked="${store.data.theme === t.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span>A</span>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="lt-hint" id="lt-hint">${store.data.sevens ? `${store.data.sevens} mot${store.data.sevens > 1 ? 's' : ''} de sept lettres trouvé${store.data.sevens > 1 ? 's' : ''}.` : 'Astuce : cherche d’abord les petits mots, le grand viendra.'}</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    $('lt-hint').textContent = `Trouve ${THEMES.find((t) => t.id === b.dataset.theme).unlock} mots pour ce thème.`;
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
window.__lt = {
  get tirage() { return tirage; },
  get run() { return run; },
  get found() { return [...found]; },
  get word() { return word(); },
  dict: () => DICT,
  // Tape un mot (tests)
  type(w) {
    picked = [];
    for (const ch of w) {
      const i = tirage.letters.findIndex((c, k) => c === ch && !picked.includes(k));
      if (i >= 0) picked.push(i);
    }
    renderWord();
  },
  submit,
};

document.body.dataset.theme = theme().id;
await load();
// Décor de l'accueil : un tirage d'exemple
Object.assign(run, { score: 0, words: 0, round: 1, time: START_TIME, hints: 3, hinted: new Map(), used: [] });
tirage = DICT.draw(createRng(7));
renderWheel();
renderFound();
renderWord();
renderTop();
renderOptions();
els.wrap.classList.add('is-ready');
gv.hud('best', formatInt(gv.best ?? 0));
loop.start();
gv.showStart();
