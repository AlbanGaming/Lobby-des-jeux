// Morpion Dynamique — 3 pions chacun : poser le 4e efface le plus ancien. Match en 3 manches gagnantes
// contre un robot (3 niveaux) ou à deux sur le même appareil.

import { bootGame } from '../../shared/js/gameverse.js';
import { getData } from '../../shared/js/meta.js';
import { createFxLayer, squash, wiggle } from '../../shared/js/engine/fx.js';
import { createRng } from '../../shared/js/core/rng.js';
import { formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { avatarSVG } from '../../shared/js/ui/avatar.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { newState, play, occupied, doomed, threats, aiMove, LEVELS, MAX_PIECES, other } from './rules.js';

const WIN_ROUNDS = 3;
// ?fast=1 (tests) : le robot répond vite et les manches s'enchaînent sans attendre
const FAST = new URLSearchParams(location.search).has('fast');

// Styles de pions, débloqués par le nombre de matchs gagnés contre les robots
const SKINS = [
  { id: 'classique', name: 'Classique', unlock: 0 },
  { id: 'neon', name: 'Néon', unlock: 3 },
  { id: 'craie', name: 'Craie', unlock: 8 },
  { id: 'pixel', name: 'Pixel', unlock: 15 },
  { id: 'or', name: 'Or', unlock: 25 },
];

const LINES_AI = {
  start: ['Prêt à perdre ?', 'Je calcule déjà trois coups d’avance.', 'Allez, montre-moi.', 'Bip. Bonne chance.'],
  block: ['Pas si vite !', 'Bien tenté.', 'Je t’ai vu venir.', 'Raté !'],
  blocked: ['Hé ! C’était ma case.', 'Bien vu…', 'Grrr.', 'Tu lis dans mes circuits ?'],
  aiWin: ['Et une manche !', 'Trop facile.', 'Bip bip, victoire.', 'Calcul validé.'],
  playerWin: ['Bien joué…', 'Erreur de calcul.', 'Tu as eu de la chance.', 'Revanche !'],
};

const store = createStore('morpion', {
  version: 1,
  defaults: { mode: 'ai', level: 'normal', skin: 'classique', wins: 0, streak: 0, blocks: 0, beatNormal: false, matches: 0 },
});

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const lineEl = $('winLine');
const bubbleEl = $('bubble');
const statusEl = $('status');
const rng = createRng(Date.now());

const gv = bootGame('morpion', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['icon:pointer', 'icon:touch'], text: 'Aligne 3 pions pour gagner la manche. Premier à 3 manches.' },
    { keys: ['icon:clock'], text: 'Tu n’as que 3 pions : le plus ancien clignote, il s’efface au prochain coup.' },
    { keys: ['←', '→', 'Entrée'], text: 'Jouable au clavier : flèches et Entrée.' },
  ],
  onStart: startMatch,
  onRestart: startMatch,
});

const fx = createFxLayer(gv.stage, { shakeTarget: document.querySelector('.mo-board-wrap') });

// ---------- État ----------
let state = newState('X');
let match = null;
let busy = false; // animation ou robot en train de jouer
let focusCell = 4;
let aiTimer = 0;

const level = () => LEVELS[store.data.level] ?? LEVELS.normal;
const isDuel = () => match?.mode === 'duel';
const skin = () => SKINS.find((s) => s.id === store.data.skin) ?? SKINS[0];
const profile = () => getData().profile;
const nameOf = (p) => (p === 'X' ? (isDuel() ? 'Joueur 1' : profile().name) : isDuel() ? 'Joueur 2' : capitalize(level().name));
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- Plateau ----------
for (let i = 0; i < 9; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mo-cell';
  b.dataset.cell = i;
  b.tabIndex = i === 4 ? 0 : -1;
  b.addEventListener('click', () => humanPlay(i));
  boardEl.appendChild(b);
}
const cells = [...boardEl.children];

boardEl.addEventListener('keydown', (e) => {
  const dirs = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
  if (!(e.key in dirs)) return;
  e.preventDefault();
  let n = focusCell + dirs[e.key];
  if (e.key === 'ArrowLeft' && focusCell % 3 === 0) n = focusCell + 2;
  if (e.key === 'ArrowRight' && focusCell % 3 === 2) n = focusCell - 2;
  if (n < 0) n += 9;
  if (n > 8) n -= 9;
  setFocus(n, true);
});

function setFocus(n, move) {
  focusCell = n;
  cells.forEach((c, i) => (c.tabIndex = i === n ? 0 : -1));
  if (move) cells[n].focus();
}

function pieceSVG(p) {
  const s = skin().id;
  if (s === 'pixel') {
    return p === 'X'
      ? '<svg viewBox="0 0 100 100" class="mo-piece mo-piece--x"><path d="M18 18h16v16h-16zM34 34h16v16h-16zM50 50h16v16h-16zM66 66h16v16h-16zM66 18h16v16h-16zM50 34h0M18 66h16v16h-16zM50 34h16v16h-16zM34 50h16v16h-16z"/></svg>'
      : '<svg viewBox="0 0 100 100" class="mo-piece mo-piece--o"><path d="M34 14h32v14h-32zM34 72h32v14h-32zM14 34h14v32h-14zM72 34h14v32h-14zM24 24h12v12h-12zM64 24h12v12h-12zM24 64h12v12h-12zM64 64h12v12h-12z"/></svg>';
  }
  return p === 'X'
    ? '<svg viewBox="0 0 100 100" class="mo-piece mo-piece--x"><path class="mo-piece__shadow" d="M24 28l52 52M76 28L24 80"/><path d="M24 22l52 52M76 22L24 74"/></svg>'
    : '<svg viewBox="0 0 100 100" class="mo-piece mo-piece--o"><circle class="mo-piece__shadow" cx="50" cy="54" r="27"/><circle cx="50" cy="48" r="27"/></svg>';
}

function render(fresh = -1) {
  const occ = occupied(state);
  // Le plus ancien pion du joueur qui doit jouer clignote : il s'effacera à son prochain coup
  const doom = match?.roundOver ? null : doomed(state, state.turn);
  boardEl.dataset.skin = skin().id;
  cells.forEach((c, i) => {
    const p = occ[i];
    const list = p ? state[p] : [];
    const age = p ? list.length - 1 - list.indexOf(i) : 0; // 0 = le plus récent
    const life = MAX_PIECES - age;
    c.classList.toggle('is-x', p === 'X');
    c.classList.toggle('is-o', p === 'O');
    c.classList.toggle('is-doomed', i === doom);
    c.classList.toggle('is-fresh', i === fresh);
    const label = p ? `${p === 'X' ? 'Croix' : 'Rond'}${i === doom ? ', disparaît au prochain coup' : ''}` : 'vide';
    c.setAttribute('aria-label', `Ligne ${Math.floor(i / 3) + 1}, colonne ${(i % 3) + 1} : ${label}`);
    c.innerHTML = p ? `${pieceSVG(p)}<span class="mo-life" aria-hidden="true">${'<i></i>'.repeat(life)}${'<i class="off"></i>'.repeat(MAX_PIECES - life)}</span>${i === doom ? '<span class="mo-crack" aria-hidden="true"></span>' : ''}` : '';
  });
  boardEl.classList.toggle('is-turn-x', state.turn === 'X');
  boardEl.classList.toggle('is-turn-o', state.turn === 'O');
  boardEl.classList.toggle('is-locked', busy || (!isDuel() && state.turn === 'O'));
}

function renderScore() {
  if (!match) return;
  $('nameX').textContent = nameOf('X');
  $('nameO').textContent = nameOf('O');
  $('avX').innerHTML = isDuel() ? avatarSVG({ kind: 'gen', seed: 'joueur-1', palette: 1 }, { size: 44 }) : avatarSVG(profile().avatar, { size: 44 });
  $('avO').innerHTML = avatarSVG({ kind: 'gen', seed: isDuel() ? 'joueur-2' : level().seed, palette: isDuel() ? 0 : level().palette }, { size: 44 });
  for (const p of ['X', 'O']) {
    $(`pips${p}`).innerHTML = Array.from({ length: WIN_ROUNDS }, (_, i) => `<i class="${i < match.rounds[p] ? 'on' : ''}"></i>`).join('');
    $(`side${p}`).classList.toggle('is-turn', state.turn === p && !match.roundOver);
  }
}

function setStatus(text, tone = '') {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

function say(kind) {
  if (isDuel()) return;
  const lines = LINES_AI[kind];
  bubbleEl.textContent = lines[Math.floor(rng.next() * lines.length)];
  bubbleEl.hidden = false;
  bubbleEl.classList.remove('is-in');
  void bubbleEl.offsetWidth;
  bubbleEl.classList.add('is-in');
  clearTimeout(say.t);
  say.t = setTimeout(() => (bubbleEl.hidden = true), 1800);
}

// ---------- Match ----------
function startMatch() {
  clearTimeout(aiTimer);
  match = {
    mode: store.data.mode,
    level: level(),
    rounds: { X: 0, O: 0 },
    first: 'X',
    points: 0,
    blocks: 0,
    fastWin: 0,
    movesX: 0,
    wasDown02: false,
    roundOver: false,
  };
  if (match.mode === 'duel') gv.unlock('duel');
  gv.hud('score', 0);
  gv.hud('best', formatInt(gv.best ?? 0));
  startRound();
  say('start');
}

function startRound() {
  state = newState(match.first);
  match.roundOver = false;
  match.movesX = 0;
  busy = false;
  lineEl.classList.remove('is-on');
  cells.forEach((c) => c.classList.remove('is-win'));
  render();
  renderScore();
  nextTurn();
  if (state.turn === 'X' || isDuel()) setFocus(4, gv.playing && !matchMedia('(pointer: coarse)').matches);
}

function nextTurn() {
  renderScore();
  const t = state.turn;
  if (isDuel()) {
    setStatus(`À ${nameOf(t)} de jouer`, t === 'X' ? 'x' : 'o');
    return;
  }
  if (t === 'X') setStatus('À toi de jouer !', 'x');
  else {
    setStatus(`${nameOf('O')} réfléchit`, 'thinking');
    busy = true;
    render();
    const think = FAST ? 30 : 450 + rng.next() * 450;
    const aiStep = () => {
      // En pause, le robot attend le retour du joueur
      if (!gv.playing) {
        aiTimer = setTimeout(aiStep, 200);
        return;
      }
      apply(aiMove(state, match.level, rng.next), 'O');
    };
    aiTimer = setTimeout(aiStep, think);
  }
}

function humanPlay(i) {
  if (gv.state !== 'playing' || busy || match?.roundOver) return;
  if (!isDuel() && state.turn !== 'X') return;
  if (occupied(state)[i]) {
    wiggle(cells[i]);
    gv.audio.play('error');
    return;
  }
  setFocus(i, false);
  apply(i, state.turn);
}

function apply(cell, player) {
  busy = false;
  const opp = other(player);
  const blocking = threats(state, opp).includes(cell);
  const r = play(state, cell);
  state = r.state;
  if (player === 'X') match.movesX++;

  // Pion effacé : il se désagrège
  if (r.removed !== null) {
    const el = cells[r.removed];
    fx.burstAt(el, { count: 14, colors: player === 'X' ? ['#ff5a4e', '#b8281f', '#8d93b3'] : ['#ffc93c', '#c98f00', '#8d93b3'], speed: [60, 200], size: [3, 6], gravity: 500, life: [0.4, 0.7] });
    gv.audio.play('whoosh', { pitch: 1.6, volume: 0.5 });
  }
  render(cell);
  const el = cells[cell];
  squash(el.querySelector('.mo-piece'), { scaleX: 1.25, scaleY: 0.78, duration: 320 });
  fx.burstAt(el, { count: 10, colors: player === 'X' ? ['#ff5a4e', '#ff8a5b'] : ['#ffc93c', '#fff3c4'], speed: [80, 220], size: [2, 5], gravity: 200, shape: 'circle', life: [0.25, 0.5] });
  gv.audio.play('place', { pitch: player === 'X' ? 1 : 1.25 });

  if (blocking && !r.winner) {
    if (player === 'X' && !isDuel()) {
      match.blocks++;
      store.data.blocks++;
      store.saveSoon();
      const pts = gainPoints(25);
      fx.popupAt(el, `Bloqué ! +${pts}`, { size: 22, color: '#4cc3ff', rise: 50 });
      gv.audio.play('nearMiss');
      say('blocked');
      if (store.data.blocks >= 15) gv.unlock('bloqueur');
    } else if (!isDuel()) {
      fx.popupAt(el, 'Contré !', { size: 20, color: '#8d93b3', rise: 40 });
      say('block');
    } else fx.popupAt(el, 'Bloqué !', { size: 22, color: '#4cc3ff', rise: 50 });
  }

  if (r.winner) return roundWon(r.winner, r.line);
  nextTurn();
}

function gainPoints(n) {
  if (isDuel()) return 0;
  const g = n * match.level.mult;
  match.points += g;
  gv.hud('score', formatInt(match.points), true);
  return g;
}

function drawLine(line, winner) {
  const c = (i) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
  const [x1, y1] = c(line[0]);
  const [x2, y2] = c(line[2]);
  const l = lineEl.querySelector('line');
  const dx = (x2 - x1) * 0.18;
  const dy = (y2 - y1) * 0.18;
  l.setAttribute('x1', x1 - dx);
  l.setAttribute('y1', y1 - dy);
  l.setAttribute('x2', x2 + dx);
  l.setAttribute('y2', y2 + dy);
  lineEl.dataset.winner = winner.toLowerCase();
  lineEl.classList.remove('is-on');
  void lineEl.getBoundingClientRect();
  lineEl.classList.add('is-on');
}

function roundWon(winner, line) {
  match.roundOver = true;
  busy = true;
  match.rounds[winner]++;
  drawLine(line, winner);
  line.forEach((i) => cells[i].classList.add('is-win'));
  const center = cells[line[1]];
  fx.addShake(0.45);
  fx.ring(fx.centerOf(center).x, fx.centerOf(center).y, { color: winner === 'X' ? '#ff5a4e' : '#ffc93c', size: 20, growth: 520, life: 0.5, lineWidth: 8 });
  fx.burstAt(center, { count: 40, colors: ['#ff5a4e', '#ffc93c', '#3ee6a8', '#4cc3ff', '#f4efe4'], speed: [200, 520], size: [4, 8], gravity: 700, spin: [-10, 10], life: [0.6, 1.2] });

  const humanWon = winner === 'X';
  if (!isDuel()) {
    if (humanWon) {
      const fast = match.movesX <= 4;
      let pts = gainPoints(100);
      if (fast) {
        match.fastWin++;
        pts += gainPoints(60);
        fx.popupAt(center, 'Éclair !', { size: 26, color: '#3ee6a8', rise: 30, life: 1 });
      }
      if (match.movesX === 3) gv.unlock('eclair');
      fx.popupAt(center, `+${pts}`, { size: 34, color: '#ffc93c', rise: 70 });
      gv.audio.play('win');
      say('playerWin');
    } else {
      gv.audio.play('lose');
      say('aiWin');
    }
    if (match.rounds.O === 2 && match.rounds.X === 0) match.wasDown02 = true;
  } else gv.audio.play('win');

  setStatus(isDuel() ? `Manche pour ${nameOf(winner)} !` : humanWon ? 'Manche pour toi !' : `Manche pour ${nameOf('O')}`, humanWon ? 'win' : 'lose');
  renderScore();

  setTimeout(() => {
    if (match.rounds[winner] >= WIN_ROUNDS) return endMatch(winner);
    match.first = other(match.first);
    startRound();
  }, FAST ? 120 : motion.reduced ? 700 : 1500);
}

function endMatch(winner) {
  const humanWon = winner === 'X';
  store.data.matches++;
  if (isDuel()) {
    store.save();
    gv.gameOver({
      score: 0,
      xp: 15,
      scoreText: `${match.rounds.X} – ${match.rounds.O}`,
      title: `Victoire de ${nameOf(winner)}`,
      kicker: 'Duel terminé',
      extraStats: [{ label: 'Vainqueur', value: nameOf(winner) }],
      sound: 'win',
    });
    renderOptions();
    return;
  }
  const lv = match.level;
  if (humanWon) {
    gainPoints(200);
    if (match.rounds.O === 0) gainPoints(100);
    store.data.wins++;
    store.data.streak++;
    if (lv.id === 'normal') store.data.beatNormal = true;
    gv.unlock('premiere');
    if (lv.id === 'normal') gv.unlock('rouille');
    if (lv.id === 'expert') gv.unlock('oracle');
    if (match.rounds.O === 0) gv.unlock('sans-faute');
    if (store.data.streak >= 5) gv.unlock('serie-5');
    if (match.wasDown02) gv.unlock('remontada');
  } else store.data.streak = 0;
  store.save();
  const wonBefore = store.data.wins - (humanWon ? 1 : 0);
  const unlocked = SKINS.filter((s) => store.data.wins >= s.unlock);
  if (unlocked.length === SKINS.length) gv.unlock('collection');
  const next = SKINS.find((s) => s.unlock > store.data.wins);
  gv.gameOver({
    score: match.points,
    stats: { score: match.points, blocks: match.blocks, fastWin: match.fastWin, normalWin: humanWon && lv.id === 'normal' ? 1 : 0 },
    extraStats: [
      { label: 'Manches', value: `${match.rounds.X} – ${match.rounds.O}` },
      { label: 'Blocages', value: formatInt(match.blocks) },
      { label: 'Série', value: formatInt(store.data.streak) },
    ],
    title: humanWon ? `Victoire contre ${nameOf('O')}` : `${nameOf('O')} l’emporte`,
    kicker: humanWon ? `Match gagné · ${lv.label}` : `Match perdu · ${lv.label}`,
    nextUnlock: next ? { label: `Pions ${next.name}`, current: store.data.wins, target: next.unlock } : undefined,
    sound: humanWon ? 'record' : 'lose',
  });
  for (const s of SKINS) if (s.unlock > 0 && wonBefore < s.unlock && store.data.wins >= s.unlock) toast({ title: 'Nouveaux pions !', text: `Style ${s.name} débloqué.`, iconName: 'sparkle', tone: 'var(--tomato)' });
  gv.hud('best', formatInt(gv.best ?? 0));
  renderOptions();
}

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const d = store.data;
  const lvlBtn = (l) => {
    const locked = l.id === 'expert' && !d.beatNormal;
    return `<button type="button" role="radio" class="mo-opt" data-level="${l.id}" aria-checked="${d.level === l.id}" ${locked ? 'aria-disabled="true"' : ''}>
      <span class="mo-opt__av">${locked ? icon('lock') : avatarSVG({ kind: 'gen', seed: l.seed, palette: l.palette }, { size: 30 })}</span>
      <span><strong>${esc(capitalize(l.name))}</strong><small>${locked ? 'Bats Rouille pour le défier' : `${l.label} · points ×${l.mult}`}</small></span>
    </button>`;
  };
  gv.shell.startExtra.innerHTML = `
    <div class="mo-options">
      <div class="mo-row">
        <span class="mo-label" id="mo-mode-label">Mode</span>
        <div class="mo-seg" role="radiogroup" aria-labelledby="mo-mode-label">
          <button type="button" role="radio" data-mode="ai" aria-checked="${d.mode === 'ai'}">${icon('gamepad')}Contre un robot</button>
          <button type="button" role="radio" data-mode="duel" aria-checked="${d.mode === 'duel'}">${icon('user')}À deux</button>
        </div>
      </div>
      ${d.mode === 'ai' ? `<div class="mo-row"><span class="mo-label" id="mo-lvl-label">Adversaire</span><div class="mo-levels" role="radiogroup" aria-labelledby="mo-lvl-label">${Object.values(LEVELS).map(lvlBtn).join('')}</div></div>` : ''}
      <div class="mo-row">
        <span class="mo-label" id="mo-skin-label">Pions · ${formatInt(d.wins)} victoire${d.wins > 1 ? 's' : ''}</span>
        <div class="mo-skins" role="radiogroup" aria-labelledby="mo-skin-label">
          ${SKINS.map((s) => {
            const locked = d.wins < s.unlock;
            const label = locked ? `${s.name}, débloqué à ${s.unlock} victoires` : s.name;
            return `<button type="button" role="radio" class="mo-skin" data-skin="${s.id}" aria-checked="${d.skin === s.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span class="mo-skin__demo mo-skin__demo--${s.id}">✕○</span>${locked ? `<span class="mo-skin__lock">${icon('lock')}</span>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="mo-hint" id="mo-hint" aria-live="polite"></p>
    </div>`;
}

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    $('mo-hint').textContent = b.dataset.level ? 'Gagne un match contre Rouille pour affronter l’Oracle.' : `Gagne ${SKINS.find((s) => s.id === b.dataset.skin).unlock} matchs pour débloquer ce style.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.level) store.data.level = b.dataset.level;
  if (b.dataset.skin) store.data.skin = b.dataset.skin;
  store.save();
  gv.audio.play('select');
  renderOptions();
  const sel = b.dataset.mode ? `[data-mode="${b.dataset.mode}"]` : b.dataset.level ? `[data-level="${b.dataset.level}"]` : `[data-skin="${b.dataset.skin}"]`;
  gv.shell.startExtra.querySelector(sel)?.focus();
});

// ---------- Démarrage ----------
window.__morpion = {
  get state() { return state; },
  get match() { return match; },
  get busy() { return busy; },
  play: (i) => humanPlay(i),
  refresh: () => render(),
};

// Démo derrière l'accueil : un plateau en cours de partie
state = { X: [0, 4], O: [2, 6], turn: 'X' };
match = { mode: 'ai', level: level(), rounds: { X: 1, O: 1 }, roundOver: false };
render();
renderScore();
setStatus('');
gv.hud('best', formatInt(gv.best ?? 0));
renderOptions();
gv.showStart();
