// Le Juste Prix — plateau télé. Quatre façons de jouer :
// Plus ou moins (trouver le prix exact avant la fin des ampoules), Au plus juste (une seule offre,
// notée à la précision), Le plus cher (duel rapide, 3 vies) et Les 5 du jour (les mêmes pour tous).

import { bootGame } from '../../shared/js/gameverse.js';
import { createFxLayer, squash, wiggle } from '../../shared/js/engine/fx.js';
import { createRng, dayKey } from '../../shared/js/core/rng.js';
import { clamp, formatInt } from '../../shared/js/core/math.js';
import { createStore, readJSON } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { itemSVG } from './art.js';
import {
  RAYONS,
  rayonName,
  loadCatalog,
  stepLabel,
  formatPrice,
  startRange,
  classicPoints,
  classicMult,
  estimate,
  estimateMult,
  TIERS,
  pickDuel,
  duelPoints,
  duelMult,
  duelTime,
  dailyItems,
  dailyIndex,
  shareText,
  fromLegacy,
} from './logic.js';

const params = new URLSearchParams(location.search);
// ?fast=1 : enchaînements raccourcis (tests)
const FAST = params.has('fast');
const wait = (ms) => (FAST ? Math.min(ms, 80) : motion.reduced ? Math.round(ms * 0.6) : ms);

const CLASSIC_COUNT = 5;
const CLASSIC_TIME = 30;
const EST_COUNT = 8;
const EST_TIME = 20;
const LIVES = 3;
const BULBS = 14; // par rangée

const MODES = {
  classique: { id: 'classique', label: 'Plus ou moins', hint: '5 objets · 30 s chacun', icon: 'target' },
  estimation: { id: 'estimation', label: 'Au plus juste', hint: '8 objets · une seule offre', icon: 'sliders' },
  duel: { id: 'duel', label: 'Le plus cher', hint: 'Choisis le plus cher · 3 vies', icon: 'bolt' },
  jour: { id: 'jour', label: 'Les 5 du jour', hint: 'Les mêmes pour tous, une fois par jour', icon: 'calendar' },
};

// Décors du plateau, débloqués par le record
const THEMES = [
  { id: 'studio', name: 'Studio', unlock: 0 },
  { id: 'neon', name: 'Néon', unlock: 2500 },
  { id: 'retro', name: 'Rétro', unlock: 4500 },
  { id: 'prestige', name: 'Prestige', unlock: 8000 },
];

const store = createStore('juste-prix', {
  version: 1,
  defaults: {
    mode: 'classique',
    theme: 'studio',
    found: 0,
    piles: 0,
    bestStreak: 0,
    recent: [],
    bonusRayons: [],
    daily: { day: '', score: 0, tiers: [] },
    legacy: null,
    legacyNoticed: false,
  },
  // Première visite : on reprend les victoires et les catégories de l'ancien Juste Prix
  migrate: (data, from) => (from === -1 ? fromLegacy(readJSON('playerData')) ?? undefined : data),
});

const $ = (id) => document.getElementById(id);
const wrapEl = $('wrap');
const roundEl = $('round');
const podiumsEl = $('podiums');
const rangeEl = $('range');
const guessesEl = $('guesses');
const boardEl = $('board');
const priceEl = $('price');
const boardSubEl = $('boardSub');
const verdictEl = $('verdict');
const padEl = $('pad');
const bulbsTop = $('bulbsTop');
const bulbsBot = $('bulbsBot');

const gv = bootGame('juste-prix', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'combo', label: 'Combo' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['0–9', 'Entrée'], text: 'Tape ton prix et valide.' },
    { keys: ['icon:clock'], text: 'C’est plus, c’est moins : trouve le prix avant que les ampoules s’éteignent.' },
    { keys: ['←', '→'], text: 'Le plus cher : choisis l’objet qui coûte le plus.' },
  ],
  music: {
    bpm: 128,
    tracks: [
      { type: 'triangle', volume: 0.16, length: 0.6, notes: ['C3', null, 'G3', null, 'A2', null, 'E3', null, 'F2', null, 'C3', null, 'G2', null, 'D3', null] },
      { type: 'square', volume: 0.04, length: 0.4, filter: 2200, notes: ['E5', null, 'G5', 'C6', null, 'G5', 'E5', null, 'C5', null, 'E5', 'A5', null, 'F5', 'D5', null] },
      { drum: 'kick', volume: 0.2, pattern: 'x...x...x...x...' },
      { drum: 'hat', volume: 0.08, pattern: '..x...x...x...xx' },
    ],
  },
  onStart: startGame,
  onRestart: startGame,
});
const fx = createFxLayer(gv.stage, { shakeTarget: wrapEl });

const arrow = (dir) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${dir === 'plus' ? 'M12 4l8 9h-5v7H9v-7H4z' : 'M12 20l8-9h-5V4H9v7H4z'}" fill="currentColor"/></svg>`;

// ---------- État ----------
let catalog = [];
let mode = MODES.classique;
let rng = createRng(Date.now());
let run = null;
let cur = null; // objet (ou duel) en cours
let entry = '';
let locked = true;
const clock = { left: 0, total: 1, running: false, last: 0, lastSec: 0 };
let clockId = 0;

const best = () => gv.best ?? 0;
const theme = () => THEMES.find((t) => t.id === store.data.theme) ?? THEMES[0];
const dailyDone = () => store.data.daily.day === dayKey();
const openRayons = () => RAYONS.filter((r) => best() >= r.unlock || store.data.bonusRayons.includes(r.id));
const pool = () => {
  const ids = new Set(openRayons().map((r) => r.id));
  return catalog.filter((i) => ids.has(i.rayon));
};

// ---------- Ampoules (chrono) ----------
for (const el of [bulbsTop, bulbsBot]) el.innerHTML = Array.from({ length: BULBS }, (_, k) => `<i style="--k:${k}"></i>`).join('');
const bulbs = [...bulbsTop.children, ...[...bulbsBot.children].reverse()];

function renderBulbs() {
  const on = clock.running || clock.left > 0 ? Math.ceil((clock.left / clock.total) * bulbs.length) : bulbs.length;
  bulbs.forEach((b, i) => b.classList.toggle('on', i < on));
  boardEl.classList.toggle('is-low', clock.running && clock.left <= Math.min(5, clock.total * 0.25));
}

function startClock(seconds) {
  clock.total = seconds;
  clock.left = seconds;
  clock.running = true;
  clock.last = performance.now();
  clock.lastSec = Math.ceil(seconds);
  renderBulbs();
}
function stopClock() {
  clock.running = false;
  boardEl.classList.remove('is-low');
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
    if (sec <= 5 && sec > 0) gv.audio.play('tick', { pitch: sec <= 3 ? 1.3 : 1 });
  }
  renderBulbs();
  if (clock.left <= 0) {
    stopClock();
    timeUp();
  }
}

// ---------- Partie ----------
async function startGame() {
  clearInterval(clockId);
  stopClock();
  mode = MODES[store.data.mode] ?? MODES.classique;
  if (mode.id === 'jour' && dailyDone()) mode = MODES.classique;
  rng = createRng(Number(params.get('seed')) || Date.now() + Math.random() * 1e6);
  if (!catalog.length) catalog = await loadCatalog();
  run = { points: 0, index: 0, items: [], streak: 0, bestStreak: 0, found: 0, results: [], lives: LIVES, level: 0, duels: 0, hot: 0, piles: 0, fastest: Infinity };
  document.body.dataset.mode = mode.id;
  wrapEl.classList.toggle('is-duel', mode.id === 'duel');
  rangeEl.hidden = true;
  if (mode.id === 'classique') run.items = drawItems(CLASSIC_COUNT);
  else if (mode.id === 'estimation') run.items = drawItems(EST_COUNT);
  else if (mode.id === 'jour') run.items = dailyItems(catalog);
  gv.hud('score', 0);
  gv.hud('combo', '×1');
  gv.hud('best', formatInt(best()));
  clockId = setInterval(tick, 100);
  next();
}

function drawItems(n) {
  const src = pool();
  const recent = new Set(store.data.recent);
  const fresh = src.filter((i) => !recent.has(i.id));
  const picks = rng.shuffle([...(fresh.length >= n ? fresh : src)]).slice(0, n);
  store.data.recent = [...store.data.recent, ...picks.map((p) => p.id)].slice(-40);
  store.save();
  return picks;
}

function next() {
  if (gv.state !== 'playing') return;
  if (mode.id === 'duel') return presentDuel();
  if (run.index >= run.items.length) return endGame();
  present(run.items[run.index]);
}

function lotHtml(item, { button = false, index = 0, tag = '? €' } = {}) {
  const tagName = button ? 'button' : 'div';
  const attrs = button ? `type="button" data-pick="${index}" aria-label="${esc(item.name)}"` : '';
  return `<${tagName} class="jp-lot is-in" ${attrs}>
    <div class="jp-item">${itemSVG(item)}</div>
    <div class="jp-pedestal" aria-hidden="true"></div>
    <p class="jp-name">${esc(item.name)}</p>
    <span class="jp-tag" data-tag>${tag}</span>
    ${button ? `<span class="jp-key-hint" aria-hidden="true">${index ? '→ ou 2' : '← ou 1'}</span>` : ''}
  </${tagName}>`;
}

function present(item) {
  cur = { item, tries: 0, guesses: [], t0: performance.now() };
  if (mode.id === 'classique') {
    const { lo, hi } = startRange(item.price, rng);
    Object.assign(cur, { lo, hi, lo0: lo, hi0: hi });
  }
  entry = '';
  locked = false;
  const total = run.items.length;
  roundEl.innerHTML = `<span class="jp-round__n">Objet ${run.index + 1} / ${total}</span><span class="jp-chip">${icon('grid')}${esc(rayonName(item.rayon))}</span><span class="jp-chip">${esc(stepLabel(item.price))}</span>`;
  podiumsEl.innerHTML = lotHtml(item);
  guessesEl.innerHTML = '';
  rangeEl.hidden = mode.id !== 'classique';
  if (mode.id === 'classique') renderRange();
  else rangeEl.innerHTML = '';
  setVerdict('info', mode.id === 'classique' ? `Entre ${formatPrice(cur.lo)} et ${formatPrice(cur.hi)} : à toi !` : 'Une seule offre : vise au plus juste.');
  boardSubEl.textContent = 'Ton offre';
  boardEl.classList.remove('is-win');
  padEl.removeAttribute('aria-disabled');
  renderPrice();
  startClock(mode.id === 'classique' ? CLASSIC_TIME : EST_TIME);
  gv.audio.play('whoosh');
}

// ---------- Saisie ----------
function press(d) {
  if (locked || gv.state !== 'playing' || mode.id === 'duel') return;
  if (entry.length >= 6 || (entry === '' && d === 0)) {
    wiggle(priceEl, { amount: 4 });
    return;
  }
  entry += String(d);
  gv.audio.play('tock', { pitch: 0.9 + d * 0.03 });
  renderPrice(true);
}
function erase() {
  if (locked || gv.state !== 'playing' || !entry) return;
  entry = entry.slice(0, -1);
  gv.audio.play('back', { pitch: 1.3, volume: 0.6 });
  renderPrice();
}
function submit() {
  if (locked || gv.state !== 'playing' || mode.id === 'duel') return;
  if (!entry) {
    wiggle(priceEl);
    setVerdict('info', 'Tape un prix d’abord.');
    gv.audio.play('error');
    return;
  }
  const g = Number(entry);
  entry = '';
  if (mode.id === 'classique') guessClassic(g);
  else guessEstimate(g);
}

// ---------- Plus ou moins ----------
function guessClassic(g) {
  const price = cur.item.price;
  cur.tries++;
  if (g === price) return foundIt();
  const dir = g < price ? 'plus' : 'moins';
  const already = (dir === 'plus' && g <= cur.lo) || (dir === 'moins' && g >= cur.hi);
  cur.guesses.push({ g, dir });
  if (dir === 'plus') cur.lo = Math.max(cur.lo, g);
  else cur.hi = Math.min(cur.hi, g);
  const err = Math.abs(g - price) / price;
  const near = err <= 0.05;
  setVerdict(near ? 'near' : dir, `${arrow(dir)}C’est ${dir} !`, near ? 'Brûlant ! Tu y es presque.' : already ? `Tu savais déjà que c’était ${dir === 'plus' ? 'plus que' : 'moins que'} ${formatPrice(dir === 'plus' ? cur.lo : cur.hi)}.` : '');
  if (near) {
    gv.audio.play('nearMiss');
    fx.addShake(0.08);
  } else gv.audio.play(dir === 'plus' ? 'pickup' : 'back', { pitch: dir === 'plus' ? 1.1 : 0.85 });
  squash(boardEl, { scaleX: 1.04, scaleY: 0.96, duration: 180 });
  renderRange();
  renderGuesses();
  renderPrice();
}

function foundIt() {
  locked = true;
  stopClock();
  const used = (performance.now() - cur.t0) / 1000;
  const mult = classicMult(run.streak);
  const pts = classicPoints({ secondsLeft: Math.ceil(clock.left), tries: cur.tries, mult });
  run.points += pts;
  run.streak++;
  run.found++;
  run.fastest = Math.min(run.fastest, used);
  run.results.push({ item: cur.item, ok: true, tries: cur.tries, time: used });
  store.data.found++;
  store.save();
  gv.unlock('premier');
  if (cur.tries === 1) gv.unlock('premier-coup');
  if (used < 10) gv.unlock('eclair');
  if (store.data.found >= 50) gv.unlock('connaisseur');
  celebrate(pts, `Le juste prix !`, `${formatPrice(cur.item.price)} en ${cur.tries} offre${cur.tries > 1 ? 's' : ''}`);
  gv.hud('combo', `×${formatMult(classicMult(run.streak))}`, true);
  run.index++;
  setTimeout(next, wait(1500));
}

// ---------- Au plus juste / Les 5 du jour ----------
function guessEstimate(g) {
  locked = true;
  stopClock();
  const price = cur.item.price;
  const r = estimate(g, price);
  const hot = r.tier === 'pile' || r.tier === 'chaud';
  const mult = estimateMult(run.streak);
  const speed = r.pts > 0 ? Math.round(100 * (clock.left / clock.total)) : 0;
  const pts = Math.round((r.pts + speed) * mult);
  run.streak = hot ? run.streak + 1 : 0;
  if (hot) run.hot++;
  if (r.tier === 'pile') {
    run.piles++;
    store.data.piles++;
    store.save();
    gv.unlock('pile');
  }
  run.points += pts;
  run.results.push({ item: cur.item, guess: g, tier: r.tier, err: r.err, pts });
  revealEstimate(g, r, pts);
  gv.hud('combo', `×${formatMult(estimateMult(run.streak))}`, hot);
  run.index++;
  setTimeout(next, wait(1900));
}

function revealEstimate(g, r, pts) {
  const price = cur.item.price;
  const tag = podiumsEl.querySelector('[data-tag]');
  rollTo(tag, price);
  const signed = g === null ? 1 : (g - price) / price;
  rangeEl.hidden = false;
  rangeEl.innerHTML = `
    <div class="jp-gauge" role="img" aria-label="${g === null ? 'Pas d’offre' : `Ton offre : ${formatPrice(g)}, écart ${formatInt(r.err * 100)} %`}">
      <div class="jp-gauge__track"><span class="jp-gauge__target"></span><span class="jp-gauge__you" style="left:50%"></span></div>
      <div class="jp-gauge__labels"><span>Trop bas</span><span>${g === null ? 'Pas d’offre' : `Écart ${formatInt(Math.round(r.err * 100))} %`}</span><span>Trop haut</span></div>
    </div>`;
  requestAnimationFrame(() => {
    const you = rangeEl.querySelector('.jp-gauge__you');
    if (you) you.style.left = `${50 + clamp(signed / 0.5, -1, 1) * 48}%`;
  });
  const t = TIERS[r.tier];
  const kind = r.tier === 'pile' ? 'win' : r.tier === 'chaud' ? 'near' : 'info';
  setVerdict(kind, r.tier === 'pile' ? 'Pile !' : g === null ? 'Temps écoulé' : t.label, pts ? `+${formatInt(pts)} points` : `C’était ${formatPrice(price)}`);
  if (r.tier === 'pile') {
    celebrate(pts, null);
  } else if (pts) {
    fx.popupAt(podiumsEl.querySelector('.jp-item'), `+${formatInt(pts)}`, { size: 30, color: t.color, rise: 60 });
    gv.hud('score', formatInt(run.points), true);
    gv.audio.play(r.tier === 'chaud' ? 'coin' : 'pickup');
  } else {
    fx.addShake(0.2);
    gv.audio.play('error');
    gv.hud('score', formatInt(run.points));
  }
}

// ---------- Le plus cher ----------
function presentDuel() {
  const avoid = new Set(cur?.pair ? [cur.pair[0].id, cur.pair[1].id] : []);
  const d = pickDuel(rng, pool(), run.level, avoid);
  const pair = rng.chance(0.5) ? [d.a, d.b] : [d.b, d.a];
  cur = { pair, ratio: d.ratio, t0: performance.now() };
  locked = false;
  roundEl.innerHTML = `<span class="jp-round__n">Duel ${run.level + 1}</span><span class="jp-lives" role="img" aria-label="${run.lives} vie${run.lives > 1 ? 's' : ''}">${Array.from({ length: LIVES }, (_, i) => icon('heartFill', { className: i < run.lives ? '' : 'is-lost' })).join('')}</span>`;
  podiumsEl.innerHTML = `${lotHtml(pair[0], { button: true, index: 0 })}<span class="jp-vs" aria-hidden="true">ou</span>${lotHtml(pair[1], { button: true, index: 1 })}`;
  priceEl.classList.remove('is-empty');
  priceEl.innerHTML = `Série ${run.streak}`;
  boardSubEl.textContent = `Multiplicateur ×${duelMult(run.streak)}`;
  boardEl.classList.remove('is-win');
  setVerdict('info', 'Lequel coûte le plus cher ?');
  startClock(duelTime(run.level));
  gv.audio.play('whoosh', { pitch: 1.2 });
}

function pickLot(i) {
  if (locked || gv.state !== 'playing' || mode.id !== 'duel') return;
  locked = true;
  stopClock();
  resolveDuel(i);
}

function resolveDuel(i) {
  const [a, b] = cur.pair;
  const winner = a.price > b.price ? 0 : 1;
  const lots = podiumsEl.querySelectorAll('.jp-lot');
  lots.forEach((l, k) => {
    l.disabled = true;
    rollTo(l.querySelector('[data-tag]'), cur.pair[k].price);
  });
  lots[winner].classList.add('is-right');
  const close = cur.ratio < 1.3;
  run.level++;
  if (i === winner) {
    const speed = clock.left / clock.total;
    const prevMult = duelMult(run.streak);
    run.streak++;
    run.duels++;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    const mult = duelMult(run.streak);
    let pts = duelPoints(prevMult, speed);
    if (close) pts += 25;
    run.points += pts;
    if (run.streak >= 10) gv.unlock('duel-10');
    if (run.streak >= 25) gv.unlock('duel-25');
    fx.popupAt(lots[i], `+${formatInt(pts)}`, { size: 32, color: '#3ee6a8', rise: 70 });
    fx.burstAt(lots[i].querySelector('.jp-item'), { count: 18, colors: ['#3ee6a8', '#ffc93c', '#fff8ec'], speed: [120, 320], size: [3, 6], gravity: 600, shape: 'star' });
    setVerdict(close ? 'near' : 'plus', close ? 'De justesse !' : 'Bien vu !', close ? '+25 points de flair' : '');
    gv.audio.play('coin');
    if (mult > prevMult) {
      setTimeout(() => gv.audio.play('combo'), 160);
      fx.popupAt(boardEl, `×${mult}`, { size: 40, color: '#ffc93c', rise: 50 });
    }
    gv.hud('score', formatInt(run.points), true);
    gv.hud('combo', `×${mult}`, mult > prevMult);
    priceEl.textContent = `Série ${run.streak}`;
  } else {
    run.lives--;
    run.streak = 0;
    if (i !== null) lots[i].classList.add('is-wrong');
    fx.addShake(0.45);
    gv.audio.play('error');
    // Écart serré : quelques points de consolation
    if (close) {
      run.points += 10;
      fx.popupAt(lots[winner], 'Serré ! +10', { size: 24, color: '#ffb347', rise: 50 });
      gv.hud('score', formatInt(run.points));
    }
    setVerdict('moins', i === null ? 'Trop tard !' : 'Raté !', `${esc(a.name)} : ${formatPrice(a.price)} · ${esc(b.name)} : ${formatPrice(b.price)}`);
    gv.hud('combo', '×1');
    priceEl.textContent = 'Série 0';
    const hearts = roundEl.querySelectorAll('.jp-lives .icon');
    hearts[run.lives]?.classList.add('is-lost');
    if (hearts[run.lives]) wiggle(hearts[run.lives], { amount: 6 });
  }
  if (run.lives <= 0) setTimeout(endGame, wait(1500));
  else setTimeout(next, wait(i === winner ? 1100 : 1700));
}

// ---------- Temps écoulé ----------
function timeUp() {
  if (locked || gv.state !== 'playing') return;
  if (mode.id === 'duel') {
    locked = true;
    return resolveDuel(null);
  }
  if (mode.id !== 'classique') {
    // Une offre tapée mais pas validée compte quand même
    if (entry) return submit();
    locked = true;
    run.streak = 0;
    run.results.push({ item: cur.item, guess: null, tier: 'froid', err: 1, pts: 0 });
    revealEstimate(null, { tier: 'froid', err: 1, pts: 0 }, 0);
    gv.hud('combo', '×1');
    run.index++;
    setTimeout(next, wait(1900));
    return;
  }
  locked = true;
  run.streak = 0;
  const price = cur.item.price;
  const closest = cur.guesses.reduce((m, x) => Math.min(m, Math.abs(x.g - price) / price), Infinity);
  run.results.push({ item: cur.item, ok: false, tries: cur.tries });
  rollTo(podiumsEl.querySelector('[data-tag]'), price);
  if (closest <= 0.05) {
    run.points += 100;
    setVerdict('near', 'Si près !', `C’était ${formatPrice(price)} · +100 points`);
    fx.popupAt(podiumsEl.querySelector('.jp-item'), '+100', { size: 28, color: '#ffb347', rise: 60 });
    gv.audio.play('nearMiss');
  } else {
    setVerdict('moins', 'Temps écoulé', `C’était ${formatPrice(price)}`);
    gv.audio.play('error');
  }
  fx.addShake(0.25);
  padEl.setAttribute('aria-disabled', 'true');
  gv.hud('score', formatInt(run.points));
  gv.hud('combo', '×1');
  run.index++;
  setTimeout(next, wait(1900));
}

// ---------- Effets ----------
function celebrate(pts, title, sub = '') {
  const itemEl = podiumsEl.querySelector('.jp-item');
  const tag = podiumsEl.querySelector('[data-tag]');
  rollTo(tag, cur.item.price, 500);
  if (title) setVerdict('win', title, sub);
  boardEl.classList.add('is-win');
  priceEl.classList.remove('is-empty');
  priceEl.innerHTML = `${formatInt(cur.item.price)}<span class="jp-cur">€</span>`;
  fx.addShake(0.3);
  fx.burstAt(itemEl, { count: 46, colors: ['#ffc93c', '#fff3c4', '#ff5a4e', '#3ee6a8', '#4cc3ff'], speed: [200, 560], size: [4, 9], gravity: 900, spin: [-12, 12], life: [0.7, 1.3], shape: 'star' });
  fx.popupAt(itemEl, `+${formatInt(pts)}`, { size: 44, color: '#ffc93c', rise: 80, life: 1.2 });
  squash(itemEl, { scaleX: 1.2, scaleY: 0.82, duration: 320 });
  gv.audio.play('win');
  setTimeout(() => gv.audio.play('coin'), 380);
  gv.hud('score', formatInt(run.points), true);
}

const formatMult = (m) => String(Math.round(m * 100) / 100).replace('.', ',');

// Compteur qui défile jusqu'au prix
function rollTo(el, value, ms = 700) {
  if (!el) return;
  el.classList.add('is-shown');
  if (motion.reduced || FAST) {
    el.textContent = formatPrice(value);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = formatPrice(Math.round(value * e));
    if (t < 1) requestAnimationFrame(step);
    else squash(el, { scaleX: 1.15, scaleY: 0.88, duration: 200 });
  };
  requestAnimationFrame(step);
}

// ---------- Rendu ----------
function setVerdict(kind, html, sub = '') {
  verdictEl.innerHTML = `<div><span class="jp-stamp jp-stamp--${kind}">${html}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
}

function renderPrice(fresh = false) {
  if (!entry) {
    priceEl.classList.add('is-empty');
    priceEl.innerHTML = `—<span class="jp-cur">€</span>`;
  } else {
    priceEl.classList.remove('is-empty');
    priceEl.innerHTML = `${formatInt(Number(entry))}<span class="jp-caret"></span><span class="jp-cur">€</span>`;
  }
  priceEl.setAttribute('aria-label', entry ? `Ton offre : ${formatPrice(Number(entry))}` : 'Aucune offre');
  if (fresh) squash(priceEl, { scaleX: 1.06, scaleY: 0.94, duration: 140 });
}

function renderRange() {
  const span = cur.hi0 - cur.lo0 || 1;
  const pos = (v) => `${clamp(((v - cur.lo0) / span) * 100, 0, 100)}%`;
  rangeEl.innerHTML = `
    <div class="jp-range__labels"><span>Plus que <b>${formatPrice(cur.lo)}</b></span><span>Moins que <b>${formatPrice(cur.hi)}</b></span></div>
    <div class="jp-range__track" role="img" aria-label="Le prix est entre ${formatPrice(cur.lo)} et ${formatPrice(cur.hi)}">
      <span class="jp-range__zone" style="left:${pos(cur.lo)};width:calc(${pos(cur.hi)} - ${pos(cur.lo)})"></span>
      ${cur.guesses.map((x) => `<span class="jp-range__mark" style="left:${pos(x.g)}"></span>`).join('')}
    </div>`;
}

function renderGuesses() {
  guessesEl.innerHTML = cur.guesses
    .map((x) => `<li class="jp-guess jp-guess--${x.dir}" aria-label="${formatPrice(x.g)} : c’est ${x.dir}">${arrow(x.dir)}${formatInt(x.g)}</li>`)
    .join('');
}

function renderPad() {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'erase', 0, 'ok'];
  padEl.innerHTML = keys
    .map((k) => {
      if (k === 'erase') return `<button type="button" class="jp-key jp-key--fn" data-act="erase" aria-label="Effacer">${icon('back')}</button>`;
      if (k === 'ok') return `<button type="button" class="jp-key jp-key--ok" data-act="ok" aria-label="Valider l’offre">${icon('check')}</button>`;
      return `<button type="button" class="jp-key" data-digit="${k}">${k}</button>`;
    })
    .join('');
}

// ---------- Fin de partie ----------
function endGame() {
  if (gv.state === 'over' || !run) return;
  clearInterval(clockId);
  stopClock();
  locked = true;
  const beforeBest = best();
  const isDaily = mode.id === 'jour';
  if (isDaily) {
    store.data.daily = { day: dayKey(), score: run.points, tiers: run.results.map((r) => r.tier) };
    gv.unlock('du-jour');
  }
  if (mode.id === 'duel') store.data.bestStreak = Math.max(store.data.bestStreak, run.bestStreak);
  store.save();
  if (mode.id === 'classique' && run.found === CLASSIC_COUNT) gv.unlock('sans-faute');
  if (mode.id === 'estimation' && run.hot >= 5) gv.unlock('expert');

  const next = [...THEMES.map((t) => ({ label: `Décor ${t.name}`, unlock: t.unlock })), ...RAYONS.map((r) => ({ label: `Rayon ${r.name}`, unlock: r.unlock }))]
    .filter((u) => u.unlock > Math.max(beforeBest, run.points))
    .sort((a, b) => a.unlock - b.unlock)[0];

  const extraStats = {
    classique: [
      { label: 'Trouvés', value: `${run.found} / ${CLASSIC_COUNT}` },
      { label: 'Plus rapide', value: Number.isFinite(run.fastest) ? `${run.fastest.toFixed(1).replace('.', ',')} s` : '—' },
    ],
    estimation: [
      { label: 'Précision', value: `${formatInt(Math.round(100 - avgErr() * 100))} %` },
      { label: 'Pile', value: String(run.piles) },
    ],
    jour: [
      { label: 'Précision', value: `${formatInt(Math.round(100 - avgErr() * 100))} %` },
      { label: 'Pile', value: String(run.piles) },
    ],
    duel: [
      { label: 'Meilleure série', value: String(run.bestStreak) },
      { label: 'Bons choix', value: String(run.duels) },
    ],
  }[mode.id];

  gv.gameOver({
    score: run.points,
    stats: { score: run.points, found: run.found, piles: run.piles, streak: run.bestStreak, daily: isDaily ? 1 : 0 },
    extraStats,
    kicker: mode.label,
    title: mode.id === 'duel' ? 'Plus de vies' : isDaily ? `Les 5 du jour n°${dailyIndex()}` : 'Fin de l’émission',
    nextUnlock: next ? { label: next.label, current: Math.max(beforeBest, run.points), target: next.unlock } : undefined,
    extraHtml: recapHtml(),
    sound: run.points > 0 ? 'record' : 'lose',
  });

  const after = best();
  for (const t of THEMES) if (t.unlock > 0 && beforeBest < t.unlock && after >= t.unlock) toast({ title: 'Nouveau décor !', text: `Plateau ${t.name} débloqué.`, iconName: 'palette', tone: 'var(--tomato)' });
  for (const r of RAYONS) if (r.unlock > 0 && beforeBest < r.unlock && after >= r.unlock && !store.data.bonusRayons.includes(r.id)) toast({ title: 'Nouveau rayon !', text: `${r.name} : de nouveaux objets à estimer.`, iconName: 'grid', tone: 'var(--tomato)' });
  if (openRayons().length === RAYONS.length) gv.unlock('rayons');
  gv.hud('best', formatInt(after));

  document.querySelector('[data-screen="over"] [data-share]')?.addEventListener('click', async () => {
    const text = shareText(run.results, run.points, dailyIndex());
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Résultat copié', text: 'Colle-le où tu veux : les prix restent secrets.', iconName: 'share', tone: 'var(--mint)', duration: 2400 });
    } catch {
      toast({ title: 'Copie impossible', text: text.split('\n')[0], iconName: 'info', tone: 'var(--tomato)' });
    }
  });
  renderOptions();
}

function avgErr() {
  const r = run.results;
  return r.length ? Math.min(1, r.reduce((s, x) => s + Math.min(1, x.err), 0) / r.length) : 1;
}

function recapHtml() {
  if (mode.id === 'duel' || !run.results.length) return '';
  const rows = run.results
    .map((r) => {
      const right =
        mode.id === 'classique'
          ? r.ok
            ? `${r.time.toFixed(1).replace('.', ',')} s`
            : 'raté'
          : `<i class="jp-recap__tier" style="background:${TIERS[r.tier].color}"></i>${r.guess === null ? '—' : formatPrice(r.guess)}`;
      return `<div class="jp-recap__row">${itemSVG(r.item)}<span>${esc(r.item.name)} · <b>${formatPrice(r.item.price)}</b></span><b>${right}</b></div>`;
    })
    .join('');
  const share = mode.id === 'jour' ? `<button class="btn btn--sm btn--block jp-share" type="button" data-share>${icon('share')}Copier mon résultat</button>` : '';
  return `<div class="jp-recap">${rows}</div>${share}`;
}

// ---------- Évènements ----------
padEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.digit !== undefined) press(Number(b.dataset.digit));
  else if (b.dataset.act === 'erase') erase();
  else if (b.dataset.act === 'ok') submit();
  b.blur?.();
});
podiumsEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (b) pickLot(Number(b.dataset.pick));
});
window.addEventListener('keydown', (e) => {
  if (gv.state !== 'playing' || e.repeat) return;
  if (mode.id === 'duel') {
    if (e.key === 'ArrowLeft' || e.key === '1') pickLot(0);
    else if (e.key === 'ArrowRight' || e.key === '2') pickLot(1);
    return;
  }
  if (/^[0-9]$/.test(e.key)) {
    press(Number(e.key));
    const k = padEl.querySelector(`[data-digit="${e.key}"]`);
    k?.classList.add('is-pressed');
    setTimeout(() => k?.classList.remove('is-pressed'), 120);
  } else if (e.key === 'Backspace') erase();
  else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    submit();
  }
});

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const d = store.data;
  const b = best();
  const open = new Set(openRayons().map((r) => r.id));
  gv.shell.startExtra.innerHTML = `
    <div class="jp-options">
      <div class="jp-opt">
        <span class="jp-label" id="jp-mode-label">Émission</span>
        <div class="jp-modes" role="radiogroup" aria-labelledby="jp-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const done = m.id === 'jour' && dailyDone();
              const sub = done ? `${formatInt(d.daily.score)} pts aujourd’hui · reviens demain` : m.hint;
              return `<button type="button" role="radio" class="jp-mode" data-mode="${m.id}" aria-checked="${d.mode === m.id}" ${done ? 'aria-disabled="true"' : ''}>
                ${icon(m.icon)}<span>${m.label}</span><small>${esc(sub)}</small>
              </button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="jp-opt">
        <span class="jp-label" id="jp-theme-label">Décor</span>
        <div class="jp-themes" role="radiogroup" aria-labelledby="jp-theme-label">
          ${THEMES.map((t) => {
            const locked = b < t.unlock;
            const label = locked ? `${t.name}, débloqué à ${formatInt(t.unlock)} points` : t.name;
            return `<button type="button" role="radio" class="jp-theme jp-theme--${t.id}" data-theme="${t.id}" aria-checked="${d.theme === t.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span></span>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="jp-opt">
        <span class="jp-label">Rayons</span>
        <div class="jp-rayons">
          ${RAYONS.map((r) => (open.has(r.id) ? `<span class="jp-rayon is-open">${icon('check')}${esc(r.name)}</span>` : `<span class="jp-rayon is-locked">${icon('lock')}${esc(r.name)} · ${formatInt(r.unlock)} pts</span>`)).join('')}
        </div>
      </div>
      <p class="jp-hint" id="jp-hint" aria-live="polite"></p>
    </div>`;
}

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    $('jp-hint').textContent = b.dataset.mode ? 'Les 5 du jour se renouvellent à minuit.' : `Atteins ${formatInt(THEMES.find((t) => t.id === b.dataset.theme).unlock)} points pour le débloquer.`;
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
window.__jp = {
  get mode() { return mode; },
  get run() { return run; },
  get cur() { return cur; },
  get entry() { return entry; },
  get locked() { return locked; },
  get catalog() { return catalog; },
  get clock() { return clock; },
  setTime(s) { clock.left = s; },
};

document.body.dataset.theme = theme().id;
renderPad();
renderBulbs();
renderOptions();
gv.hud('best', formatInt(best()));
gv.hud('combo', '×1');
gv.showStart();

if (store.data.legacy && !store.data.legacyNoticed) {
  store.data.legacyNoticed = true;
  store.save();
  toast({ title: 'Progression reprise', text: `${formatInt(store.data.legacy.wins)} victoires de l’ancien Juste Prix comptent dans ton total.`, iconName: 'download', tone: 'var(--mint)' });
}

// Décor de l'accueil : un lot déjà sur le podium, rendu tout de suite (pas de décalage de mise en page)
podiumsEl.innerHTML = lotHtml({ id: 'velo', name: 'Un vélo de ville', icon: 'bike' });
roundEl.innerHTML = `<span class="jp-round__n">Le Juste Prix</span>`;
setVerdict('info', 'Combien ça coûte ?');
wrapEl.classList.add('is-ready');
loadCatalog()
  .then((c) => (catalog = c))
  .catch((err) => {
    console.warn('[juste-prix]', err);
    setVerdict('info', 'Catalogue indisponible : recharge la page.');
  });
