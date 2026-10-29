// Conquête — stratégie en temps réel : chaque base produit des troupes. Glisse d'une de tes bases
// vers une autre pour y envoyer une flotte : renforcer, prendre un neutre ou attaquer une IA.
// Élimine toutes les IA pour gagner. Campagne de 12 niveaux, escarmouche et carte du jour.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { clamp, formatInt, TAU } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { WORLD, SIZES, FACTIONS, PLAYER, SKILLS, LEVELS, generate, send, fleetPos, step, power, owned, winner, autopilot } from './logic.js';

const PCTS = [0.25, 0.5, 0.75, 1];
const MODES = {
  campagne: { id: 'campagne', label: 'Campagne', hint: '12 batailles, des IA de plus en plus fortes' },
  escarmouche: { id: 'escarmouche', label: 'Escarmouche', hint: 'Carte au hasard, adversaires au choix', unlock: 3 },
  jour: { id: 'jour', label: 'Carte du jour', hint: 'Deux Généraux, la même carte pour tous' },
};
// Niveau d'IA débloqué en escarmouche quand on a gagné le niveau de campagne indiqué
const SKILL_UNLOCK = [0, 3, 5, 7];

const params = new URLSearchParams(location.search);
const store = createStore('conquete', {
  version: 1,
  defaults: { mode: 'campagne', level: 0, stars: [], sk: { ais: 1, skill: 0 }, pct: 0.5, wins: 0, captures: 0, daily: { day: '', won: false, best: 0, plays: 0 } },
});

const gv = bootGame('conquete', {
  hud: [
    { id: 'time', label: 'Temps' },
    { id: 'bases', label: 'Bases' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['icon:pointer', 'icon:touch'], text: 'Glisse d’une de tes bases vers une autre : la moitié de ses troupes y part.' },
    { keys: ['icon:target'], text: 'Plus de troupes que la garnison ? La base est à toi. Passe sur plusieurs bases pour les envoyer ensemble.' },
    { keys: ['1', '4'], text: 'Choisis la part envoyée : 25, 50, 75 ou 100 %. A sélectionne toutes tes bases.' },
    { keys: ['icon:crown'], text: 'Élimine toutes les IA pour gagner. Garde ta capitale pour la 3ᵉ étoile.' },
  ],
  onStart: startGame,
  onRestart: startGame,
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
});

const stage = document.getElementById('stage');
let bgCache = null; // fond pré-dessiné, refait à chaque redimensionnement
const view = createCanvas(stage, { mode: 'fill', onResize: () => (bgCache = null) });
const controls = document.getElementById('controls');
const fx = { particles: new Particles(600), popups: new Popups(24), shake: new Shake({ maxOffset: 8 }), flash: new Flash() };

let state = 'attract'; // attract | run | ending | over
let mode = MODES.campagne;
let world = demoWorld();
let selected = new Set();
let drag = null; // { x, y, moved, hover }
let cursor = -1; // base visée au clavier
let lastHit = 0;
const run = {};

const today = () => dayKey();
const stars = () => store.data.stars;
const levelWon = (i) => (stars()[i] ?? 0) > 0;
const levelOpen = (i) => i === 0 || levelWon(i - 1);
const skillOpen = (s) => s === 0 || levelWon(SKILL_UNLOCK[s] - 1);
const modeOpen = (m) => !m.unlock || levelWon(m.unlock - 1);
const pct = () => store.data.pct;
const totalStars = () => stars().reduce((a, b) => a + (b ?? 0), 0);

function demoWorld() {
  const w = generate(77, { ais: [1, 1, 1], bases: 16 });
  autopilot(w, 1, 3);
  return w;
}

function config() {
  if (mode.id === 'jour') return { seed: dailySeed('conquete'), ais: [2, 2], bases: 15, par: 150, label: MODES.jour.label };
  if (mode.id === 'escarmouche') {
    const { ais, skill } = store.data.sk;
    return { seed: Number(params.get('seed')) || Math.floor(Math.random() * 1e9), ais: Array(ais).fill(skill), bases: 10 + ais * 3, par: 100 + ais * 25, label: `Escarmouche · ${ais} × ${SKILLS[skill].name}` };
  }
  const i = clamp(store.data.level, 0, LEVELS.length - 1);
  return { seed: 5000 + i * 97, ...LEVELS[i], level: i, label: `Campagne · niveau ${i + 1}` };
}

function startGame() {
  mode = MODES[store.data.mode] ?? MODES.campagne;
  if (!modeOpen(mode)) mode = MODES.campagne;
  if (mode.id === 'campagne' && !levelOpen(store.data.level)) store.data.level = 0;
  const cfg = config();
  world = generate(cfg.seed, cfg);
  state = 'run';
  selected = new Set();
  drag = null;
  cursor = -1;
  Object.assign(run, { cfg, time: 0, captures: 0, lost: 0, capitalLost: false, sent: 0, result: null, stars: 0, points: 0 });
  fx.particles.clear?.();
  loop.timeScale = 1;
  controls.hidden = false;
  gv.hud('time', '0:00');
  hudBases();
  renderControls();
}

// ---------- Ordres du joueur ----------
function order(targetId) {
  const t = world.bases[targetId];
  if (!t || state !== 'run') return;
  let total = 0;
  for (const id of selected) {
    const b = world.bases[id];
    if (b.owner !== PLAYER || id === targetId) continue;
    const f = send(world, b, t, { pct: pct() });
    if (f) total += f.n;
  }
  if (total) {
    run.sent += total;
    gv.audio.play('whoosh', { pitch: 1.1 + Math.min(0.5, total / 120), volume: 0.6 });
    const p = toScreen(t.x, t.y);
    fx.particles.ring(p.x, p.y, { color: FACTIONS[PLAYER].color, size: radius(t), growth: 90, life: 0.3, lineWidth: 2 });
  } else gv.audio.play('error', { volume: 0.5 });
  selected = new Set();
}

function selectAll() {
  if (state !== 'run') return;
  selected = new Set(owned(world, PLAYER).map((b) => b.id));
  gv.audio.play('select');
}

// ---------- Évènements de la simulation ----------
function onEvents(events) {
  for (const e of events) {
    if (e.type === 'capture') {
      const b = e.base;
      const p = toScreen(b.x, b.y);
      const col = FACTIONS[e.owner].color;
      fx.particles.ring(p.x, p.y, { color: col, size: radius(b), growth: 220, life: 0.45, lineWidth: 4 });
      fx.particles.emit(p.x, p.y, { count: 22, colors: [col, '#ffffff'], speed: [60, 240], size: [2, 5], gravity: 0, drag: 0.06, life: [0.3, 0.7], shape: 'spark' });
      if (e.owner === PLAYER) {
        run.captures++;
        store.data.captures++;
        fx.popups.add(p.x, p.y - radius(b) - 8, e.prev ? 'Prise !' : 'Annexée', { color: col, size: e.prev ? 24 : 20, rise: 40 });
        gv.audio.play(e.prev ? 'powerup' : 'coin', { pitch: e.prev ? 1 : 1.15, volume: 0.7 });
        loop.hitstop(e.prev ? 0.04 : 0);
      } else if (e.prev === PLAYER) {
        run.lost++;
        if (b.id === 0) run.capitalLost = true;
        fx.shake.add(0.35);
        fx.flash.trigger('#ff5d5d', 0.18, 5);
        fx.popups.add(p.x, p.y - radius(b) - 8, 'Perdue', { color: '#ff9a90', size: 20, rise: 40 });
        gv.audio.play('hit', { volume: 0.8 });
      }
      hudBases();
    } else if (e.type === 'hit') {
      const now = performance.now();
      if (now - lastHit > 90 && (e.owner === PLAYER || e.base.owner === PLAYER)) {
        lastHit = now;
        gv.audio.play('tick', { pitch: e.owner === PLAYER ? 1.2 : 0.8, volume: 0.35 });
      }
    } else if (e.type === 'eliminated' && state === 'run' && e.owner !== PLAYER) {
      gv.banner(`${FACTIONS[e.owner].name} est éliminé`, { color: FACTIONS[e.owner].color });
      gv.audio.play('levelUp');
    }
  }
}

function checkEnd() {
  const r = winner(world);
  if (!r) return;
  state = 'ending';
  run.result = r;
  hudBases();
  selected = new Set();
  drag = null;
  loop.timeScale = 0.35;
  if (r === 'win') {
    gv.audio.play('win');
    fx.flash.trigger('#ffffff', 0.25, 3);
    gv.banner('Victoire !', { color: '#ffc93c' });
  } else {
    gv.audio.play('lose');
    gv.banner('Défaite', { color: '#ff5d5d' });
  }
  gv.after(params.has('fast') ? 100 : 1500, endGame);
}

function endGame() {
  if (gv.state === 'over') return;
  state = 'over';
  loop.timeScale = 1;
  controls.hidden = true;
  const win = run.result === 'win';
  const { cfg } = run;
  const isDaily = mode.id === 'jour';
  if (win) {
    run.stars = 1 + (run.time <= cfg.par ? 1 : 0) + (run.capitalLost ? 0 : 1);
    const diff = cfg.ais.reduce((s, a) => s + a + 1, 0);
    run.points = Math.round(600 + diff * 220 + Math.max(0, cfg.par * 1.5 - run.time) * 8 + run.stars * 250 + run.captures * 10);
    store.data.wins++;
    if (mode.id === 'campagne') {
      const s = [...stars()];
      s[cfg.level] = Math.max(s[cfg.level] ?? 0, run.stars);
      store.data.stars = s;
      announce(cfg.level);
      if (cfg.level + 1 < LEVELS.length) store.data.level = cfg.level + 1;
    }
    achievements();
  }
  if (isDaily) {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), won: false, best: 0, plays: 0 });
    d.plays++;
    d.won ||= win;
    d.best = Math.max(d.best, win ? run.points : 0);
    if (win) gv.unlock('du-jour');
  }
  if (store.data.captures >= 200) gv.unlock('conquerant');
  store.save();
  const starHtml = win ? `<p class="cq-stars" aria-label="${run.stars} étoiles sur 3">${[0, 1, 2].map((k) => `<span class="${k < run.stars ? 'is-on' : ''}">${icon(k < run.stars ? 'starFill' : 'star')}</span>`).join('')}</p><p class="cq-stars__why">Victoire${run.time <= cfg.par ? ' · rapide' : ` · moins de ${fmt(cfg.par)} pour l’étoile`}${run.capitalLost ? ' · capitale perdue' : ' · capitale gardée'}</p>` : '';
  const nextLevel = mode.id === 'campagne' && win && cfg.level + 1 < LEVELS.length ? cfg.level + 1 : null;
  const lockedMode = Object.values(MODES).find((m) => !modeOpen(m));
  gv.gameOver({
    score: win ? run.points : 0,
    stats: { score: win ? run.points : 0, win: win ? 1 : 0, captures: run.captures, level: mode.id === 'campagne' && win ? cfg.level + 1 : 0, daily: isDaily ? 1 : 0 },
    extraStats: [
      { label: 'Temps', value: fmt(run.time) },
      { label: 'Prises', value: formatInt(run.captures) },
      { label: 'Perdues', value: formatInt(run.lost) },
    ],
    kicker: cfg.label,
    title: win ? (nextLevel !== null ? `Niveau ${nextLevel + 1} débloqué` : 'La carte est à toi') : 'Tes bases sont tombées',
    extraHtml: starHtml,
    nextUnlock: lockedMode ? { label: `Mode ${lockedMode.label}`, current: stars().filter(Boolean).length, target: lockedMode.unlock } : { label: 'Étoiles de campagne', current: totalStars(), target: LEVELS.length * 3 },
  });
  gv.hud('best', formatInt(gv.best ?? 0));
  renderOptions();
}

function achievements() {
  const { cfg } = run;
  gv.unlock('premiere');
  if (run.time < 60) gv.unlock('blitz');
  if (!run.capitalLost) gv.unlock('capitale');
  if (cfg.ais.length >= 3) gv.unlock('melee');
  if (cfg.ais.includes(3)) gv.unlock('stratege');
  if (LEVELS.every((_, i) => levelWon(i))) gv.unlock('campagne');
  if (totalStars() >= LEVELS.length * 3) gv.unlock('etoiles');
}

function announce(level) {
  const n = level + 1;
  for (const m of Object.values(MODES)) if (m.unlock === n && (stars().filter(Boolean).length === n)) toast({ title: 'Nouveau mode !', text: `${m.label} est ouverte.`, iconName: 'sparkle', tone: 'var(--mint)' });
  SKILL_UNLOCK.forEach((lv, s) => {
    if (s > 0 && lv === n) toast({ title: 'Nouvel adversaire', text: `L’IA ${SKILLS[s].name} rejoint l’escarmouche.`, iconName: 'user', tone: 'var(--mint)' });
  });
}

function hudBases() {
  gv.hud('bases', `${owned(world, PLAYER).length}/${world.bases.length}`, true);
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- Repère : monde → écran (en portrait, la carte pivote, ta capitale en bas) ----------
const L = { k: 1, ox: 0, oy: 0, portrait: false, lw: WORLD.w, lh: WORLD.h };
function measure() {
  const cw = view.width;
  const ch = view.height;
  L.portrait = cw < ch * 0.9;
  L.lw = L.portrait ? WORLD.h : WORLD.w;
  L.lh = L.portrait ? WORLD.w : WORLD.h;
  const top = 34;
  const bottom = L.portrait ? 72 : 16;
  L.k = Math.min((cw - 20) / L.lw, (ch - top - bottom) / L.lh);
  L.ox = (cw - L.lw * L.k) / 2;
  L.oy = top + (ch - top - bottom - L.lh * L.k) / 2;
}
function toScreen(x, y) {
  const X = L.portrait ? y : x;
  const Y = L.portrait ? WORLD.w - x : y;
  return { x: L.ox + X * L.k, y: L.oy + Y * L.k };
}
const radius = (b) => b.r * Math.max(L.k, 0.6);
function baseAt(sx, sy, slack = 16) {
  let best = null;
  let bd = Infinity;
  for (const b of world.bases) {
    const p = toScreen(b.x, b.y);
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d < Math.max(radius(b) + slack, 28) && d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

// ---------- Saisie ----------
const local = (e) => {
  const r = view.canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};
view.canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'run' || !gv.playing) return;
  e.preventDefault();
  view.canvas.setPointerCapture?.(e.pointerId);
  const p = local(e);
  const b = baseAt(p.x, p.y);
  cursor = -1;
  if (!b) {
    selected = new Set();
    return;
  }
  // Une sélection est déjà faite au toucher : ce toucher désigne la cible
  if (selected.size && !selected.has(b.id)) {
    order(b.id);
    return;
  }
  if (b.owner !== PLAYER) return;
  const was = selected.has(b.id);
  selected.add(b.id);
  drag = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, hover: null, first: b.id, was };
  gv.audio.play('select', { volume: 0.5 });
});
view.canvas.addEventListener('pointermove', (e) => {
  const p = local(e);
  if (!drag || drag.id !== e.pointerId) {
    view.canvas.style.cursor = state === 'run' && baseAt(p.x, p.y) ? 'pointer' : 'default';
    return;
  }
  drag.x = p.x;
  drag.y = p.y;
  if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 10) drag.moved = true;
  const b = baseAt(p.x, p.y, 8);
  drag.hover = b && b.id !== drag.first ? b.id : null;
  // Passer sur ses propres bases les ajoute à l'envoi
  if (b && b.owner === PLAYER && !selected.has(b.id)) {
    selected.add(b.id);
    gv.audio.play('select', { pitch: 1 + selected.size * 0.08, volume: 0.4 });
  }
});
const release = (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const d = drag;
  drag = null;
  if (state !== 'run') return;
  if (!d.moved) {
    // Simple toucher : on garde la sélection (ou on la retire si la base l'était déjà)
    if (d.was) {
      selected.delete(d.first);
      gv.audio.play('back', { volume: 0.4 });
    }
    return;
  }
  const t = baseAt(d.x, d.y, 8);
  if (t && (!selected.has(t.id) || selected.size > 1)) order(t.id);
  else selected = new Set();
};
view.canvas.addEventListener('pointerup', release);
view.canvas.addEventListener('pointercancel', (e) => {
  if (drag?.id === e.pointerId) drag = null;
});

// Clavier : flèches pour viser une base, Espace pour la sélectionner, Entrée pour envoyer
function moveCursor(dx, dy) {
  const from = world.bases[cursor] ?? world.bases.find((b) => b.owner === PLAYER) ?? world.bases[0];
  if (cursor < 0) return (cursor = from.id);
  const a = toScreen(from.x, from.y);
  let best = null;
  let bs = Infinity;
  for (const b of world.bases) {
    if (b === from) continue;
    const p = toScreen(b.x, b.y);
    const vx = p.x - a.x;
    const vy = p.y - a.y;
    const d = Math.hypot(vx, vy);
    const along = (vx * dx + vy * dy) / d;
    if (along < 0.45) continue;
    const s = d / along;
    if (s < bs) {
      bs = s;
      best = b;
    }
  }
  if (best) {
    cursor = best.id;
    gv.audio.play('hover', { volume: 0.4 });
  }
}
document.addEventListener('keydown', (e) => {
  if (state !== 'run' || !gv.playing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('button, input')) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  }
  const n = ['1', '2', '3', '4'].indexOf(e.key);
  if (n >= 0) return setPct(PCTS[n]);
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (dir) {
    e.preventDefault();
    return moveCursor(...dir);
  }
  if (e.key === 'a' || e.key === 'A') return selectAll();
  if (e.key === 'Escape' && selected.size) {
    e.stopPropagation();
    selected = new Set();
    return;
  }
  const b = world.bases[cursor];
  if (!b) return;
  if (e.key === ' ') {
    e.preventDefault();
    if (b.owner !== PLAYER) return;
    if (selected.has(b.id)) selected.delete(b.id);
    else selected.add(b.id);
    gv.audio.play('select', { volume: 0.5 });
  } else if (e.key === 'Enter' && selected.size) {
    e.preventDefault();
    order(b.id);
  }
});

function setPct(p) {
  store.data.pct = p;
  store.save();
  gv.audio.play('select', { volume: 0.5 });
  renderControls();
}
function renderControls() {
  controls.innerHTML = `
    <div class="cq-pcts" role="radiogroup" aria-label="Part des troupes envoyées">
      ${PCTS.map((p, i) => `<button type="button" role="radio" class="cq-pct" data-pct="${p}" aria-checked="${pct() === p}" aria-keyshortcuts="${i + 1}">${p * 100} %</button>`).join('')}
    </div>
    <button type="button" class="cq-all" data-all aria-keyshortcuts="A">${icon('grid')}Tout</button>`;
}
controls.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.pct) setPct(Number(b.dataset.pct));
  else if (b.hasAttribute('data-all')) selectAll();
});

// ---------- Boucle ----------
function update(dt, realDt) {
  if (state === 'attract' || state === 'run' || state === 'ending') {
    const events = step(world, dt);
    if (state !== 'attract') onEvents(events);
    if (state === 'attract' && winner(world)) world = demoWorld();
  }
  if (state === 'run') {
    const before = Math.floor(run.time);
    run.time += dt;
    if (Math.floor(run.time) !== before) gv.hud('time', fmt(run.time));
    // Une base sélectionnée perdue sort de la sélection
    for (const id of selected) if (world.bases[id].owner !== PLAYER) selected.delete(id);
    checkEnd();
  }
  fx.particles.update(realDt);
  fx.popups.update(realDt);
  fx.shake.update(realDt);
  fx.flash.update(realDt);
}

function background(ctx) {
  const cw = view.width;
  const ch = view.height;
  if (!bgCache) {
    bgCache = document.createElement('canvas');
    bgCache.width = Math.round(cw * view.dpr);
    bgCache.height = Math.round(ch * view.dpr);
    const g = bgCache.getContext('2d');
    g.scale(view.dpr, view.dpr);
    const grad = g.createRadialGradient(cw / 2, ch * 0.45, 0, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    grad.addColorStop(0, '#1b2a44');
    grad.addColorStop(1, '#0b1220');
    g.fillStyle = grad;
    g.fillRect(0, 0, cw, ch);
    // Carte : cadre et quadrillage d'état-major
    const x0 = L.ox;
    const y0 = L.oy;
    const w = L.lw * L.k;
    const h = L.lh * L.k;
    g.fillStyle = 'rgba(255,255,255,0.025)';
    g.beginPath();
    g.roundRect(x0 - 8, y0 - 8, w + 16, h + 16, 18);
    g.fill();
    g.strokeStyle = 'rgba(160,190,255,0.06)';
    g.lineWidth = 1;
    const step = 50 * L.k;
    g.beginPath();
    for (let x = x0; x <= x0 + w + 0.5; x += step) {
      g.moveTo(x, y0);
      g.lineTo(x, y0 + h);
    }
    for (let y = y0; y <= y0 + h + 0.5; y += step) {
      g.moveTo(x0, y);
      g.lineTo(x0 + w, y);
    }
    g.stroke();
    g.strokeStyle = 'rgba(160,190,255,0.14)';
    g.setLineDash([6, 8]);
    g.beginPath();
    g.roundRect(x0 - 8, y0 - 8, w + 16, h + 16, 18);
    g.stroke();
  }
  ctx.drawImage(bgCache, 0, 0, cw, ch);
}

function render() {
  measure();
  const ctx = view.begin();
  background(ctx);
  ctx.save();
  fx.shake.apply(ctx, view.width / 2, view.height / 2);
  const t = performance.now() / 1000;

  // Zones d'influence
  ctx.globalCompositeOperation = 'lighter';
  for (const b of world.bases) {
    if (!b.owner) continue;
    const p = toScreen(b.x, b.y);
    const R = radius(b) * 4;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
    g.addColorStop(0, hexA(FACTIONS[b.owner].color, 0.16));
    g.addColorStop(1, hexA(FACTIONS[b.owner].color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Trajets des flottes
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 6]);
  for (const f of world.fleets) {
    const a = world.bases[f.from];
    const b = world.bases[f.to];
    const p = toScreen(a.x, a.y);
    const q = toScreen(b.x, b.y);
    ctx.strokeStyle = hexA(FACTIONS[f.owner].color, 0.22);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Ordres en cours (glisser)
  if (state === 'run' && selected.size) {
    const target = drag ? (drag.hover !== null ? world.bases[drag.hover] : null) : world.bases[cursor] && !selected.has(cursor) ? world.bases[cursor] : null;
    const end = target ? toScreen(target.x, target.y) : drag?.moved ? { x: drag.x, y: drag.y } : null;
    let n = 0;
    for (const id of selected) {
      const b = world.bases[id];
      const p = toScreen(b.x, b.y);
      n += Math.floor(b.troops * pct());
      if (!end || b === target) continue;
      arrow(ctx, p, end, radius(b), target ? radius(target) + 6 : 0);
    }
    if (end) {
      ctx.font = `900 ${18}px "Big Shoulders Display", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#05060b';
      ctx.lineWidth = 4;
      const ty = end.y - (target ? radius(target) + 16 : 22);
      ctx.strokeText(`${n}`, end.x, ty);
      ctx.fillText(`${n}`, end.x, ty);
    }
  }

  // Flottes
  for (const f of world.fleets) drawFleet(ctx, f, t);
  // Bases
  for (const b of world.bases) drawBase(ctx, b, t);

  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  ctx.restore();
  drawPowerBar(ctx);
  fx.flash.draw(ctx, view.width, view.height);
}

function arrow(ctx, p, q, r0, r1) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const sx = p.x + ux * r0;
  const sy = p.y + uy * r0;
  const ex = q.x - ux * r1;
  const ey = q.y - uy * r1;
  ctx.strokeStyle = 'rgba(76,195,255,0.85)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.lineDashOffset = -performance.now() / 30;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(76,195,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(ex + ux * 4, ey + uy * 4);
  ctx.lineTo(ex - ux * 12 - uy * 8, ey - uy * 12 + ux * 8);
  ctx.lineTo(ex - ux * 12 + uy * 8, ey - uy * 12 - ux * 8);
  ctx.closePath();
  ctx.fill();
}

function drawFleet(ctx, f, t) {
  const w = fleetPos(world, f);
  const p = toScreen(w.x, w.y);
  // Direction à l'écran
  const dx = L.portrait ? w.dy : w.dx;
  const dy = L.portrait ? -w.dx : w.dy;
  const col = FACTIONS[f.owner].color;
  const m = Math.min(16, Math.ceil(f.n / 2));
  const s = Math.max(3, 4.5 * Math.max(L.k, 0.6));
  ctx.fillStyle = col;
  for (let j = 0; j < m; j++) {
    const back = j * s * 0.9;
    const side = Math.sin(f.seed + j * 2.3 + t * 3) * s * (0.6 + (j % 3) * 0.5);
    const x = p.x - dx * back - dy * side;
    const y = p.y - dy * back + dx * side;
    ctx.beginPath();
    ctx.moveTo(x + dx * s, y + dy * s);
    ctx.lineTo(x - dx * s * 0.7 - dy * s * 0.6, y - dy * s * 0.7 + dx * s * 0.6);
    ctx.lineTo(x - dx * s * 0.7 + dy * s * 0.6, y - dy * s * 0.7 - dx * s * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  if (f.n >= 4) {
    ctx.font = `800 ${Math.round(12 + Math.min(6, f.n / 10))}px Rubik, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#05060b';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(f.n, p.x - dy * 14, p.y + dx * 14 + 4);
    ctx.fillText(f.n, p.x - dy * 14, p.y + dx * 14 + 4);
  }
}

function drawBase(ctx, b, t) {
  const p = toScreen(b.x, b.y);
  const R = radius(b);
  const fac = FACTIONS[b.owner];
  const sel = selected.has(b.id);
  // Ombre
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + R * 0.35, R * 1.05, R * 0.8, 0, 0, TAU);
  ctx.fill();
  // Remparts : créneaux selon la taille
  const notches = [0, 6, 8][b.size];
  if (notches) {
    ctx.fillStyle = fac.color;
    for (let k = 0; k < notches; k++) {
      const a = (k / notches) * TAU + (b.owner ? t * 0.15 : 0);
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, R * 0.18, 0, TAU);
      ctx.fill();
    }
  }
  // Corps
  const pulse = b.pulse > 0 ? 1 + Math.sin(b.pulse * Math.PI) * 0.25 : 1;
  b.pulse = Math.max(0, b.pulse - 0.04);
  ctx.fillStyle = fac.dark;
  ctx.strokeStyle = fac.color;
  ctx.lineWidth = Math.max(2, R * 0.14);
  if (!b.owner) ctx.setLineDash([R * 0.35, R * 0.22]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, R * pulse, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  // Remplissage de la garnison
  if (b.owner) {
    const cap = SIZES[b.size].cap;
    ctx.strokeStyle = hexA(fac.color, 0.55);
    ctx.lineWidth = Math.max(2, R * 0.1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, R * 0.72, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(b.troops / cap));
    ctx.stroke();
  }
  if (b.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.4})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, TAU);
    ctx.fill();
  }
  // Troupes
  ctx.font = `900 ${Math.round(Math.max(13, R * 0.9))}px "Big Shoulders Display", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(Math.floor(b.troops), p.x, p.y + 1);
  ctx.textBaseline = 'alphabetic';
  // Capitale du joueur
  if (b.id === 0 && b.owner === PLAYER && state !== 'attract') {
    ctx.fillStyle = '#ffc93c';
    crown(ctx, p.x, p.y - R - 9, Math.max(7, R * 0.32));
  }
  // Sélection et visée
  if (sel) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R + 6 + Math.sin(t * 8) * 1.5, 0, TAU);
    ctx.stroke();
  }
  if (b.id === cursor || drag?.hover === b.id) {
    ctx.strokeStyle = b.owner === PLAYER ? '#ffffff' : '#ffc93c';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = t * 20;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R + 11, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function crown(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.6);
  ctx.lineTo(x - s, y - s * 0.4);
  ctx.lineTo(x - s * 0.5, y + s * 0.05);
  ctx.lineTo(x, y - s * 0.7);
  ctx.lineTo(x + s * 0.5, y + s * 0.05);
  ctx.lineTo(x + s, y - s * 0.4);
  ctx.lineTo(x + s, y + s * 0.6);
  ctx.closePath();
  ctx.fill();
}

// Rapport de force : une barre par faction en haut de l'écran
function drawPowerBar(ctx) {
  const pw = power(world);
  const total = Object.values(pw).reduce((a, b) => a + b, 0) || 1;
  const w = Math.min(520, view.width - 40);
  const x0 = (view.width - w) / 2;
  const y0 = 12;
  ctx.fillStyle = 'rgba(5,6,11,0.55)';
  ctx.beginPath();
  ctx.roundRect(x0 - 3, y0 - 3, w + 6, 16, 8);
  ctx.fill();
  let x = x0;
  for (const p of world.players) {
    const ww = (pw[p] / total) * w;
    if (ww <= 0) continue;
    ctx.fillStyle = FACTIONS[p].color;
    ctx.fillRect(x, y0, ww, 10);
    x += ww;
  }
  if (state !== 'attract') {
    ctx.font = '800 11px Rubik, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round((pw[PLAYER] / total) * 100)} %`, x0 + 4, y0 + 9);
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const dd = store.data.daily;
  const sk = store.data.sk;
  const m = store.data.mode;
  gv.shell.startExtra.innerHTML = `
    <div class="cq-options">
      <div class="cq-row">
        <span class="cq-label" id="cq-mode-label">Mode</span>
        <div class="cq-modes" role="radiogroup" aria-labelledby="cq-mode-label">
          ${Object.values(MODES)
            .map((md) => {
              const open = modeOpen(md);
              const sub = !open ? `Gagne le niveau ${md.unlock} de la campagne` : md.id === 'jour' && dd.day === today() ? `${dd.won ? 'Gagnée' : 'Pas encore gagnée'} · ${dd.plays} essai${dd.plays > 1 ? 's' : ''}` : md.hint;
              return `<button type="button" role="radio" class="cq-mode" data-mode="${md.id}" aria-checked="${m === md.id}" ${open ? '' : 'aria-disabled="true"'}>${icon(open ? { campagne: 'flame', escarmouche: 'dice', jour: 'calendar' }[md.id] : 'lock')}<span>${md.label}</span><small>${esc(sub)}</small></button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="cq-row" ${m === 'campagne' ? '' : 'hidden'}>
        <span class="cq-label">Campagne · ${totalStars()} / ${LEVELS.length * 3} étoiles</span>
        <div class="cq-levels" role="radiogroup" aria-label="Niveau">
          ${LEVELS.map((lv, i) => {
            const open = levelOpen(i);
            const st = stars()[i] ?? 0;
            const label = open ? `Niveau ${i + 1} : ${lv.ais.map((a) => SKILLS[a].name).join(', ')}${st ? `, ${st} étoile${st > 1 ? 's' : ''}` : ''}` : `Niveau ${i + 1}, verrouillé`;
            return `<button type="button" role="radio" class="cq-level" data-level="${i}" aria-checked="${open && store.data.level === i}" aria-label="${esc(label)}" title="${esc(label)}" ${open ? '' : 'aria-disabled="true"'}><b>${open ? i + 1 : icon('lock')}</b><span class="cq-mini">${[0, 1, 2].map((k) => `<i class="${k < st ? 'is-on' : ''}"></i>`).join('')}</span></button>`;
          }).join('')}
        </div>
      </div>
      <div class="cq-row" ${m === 'escarmouche' ? '' : 'hidden'}>
        <span class="cq-label" id="cq-ais-label">Adversaires</span>
        <div class="cq-chips" role="radiogroup" aria-labelledby="cq-ais-label">
          ${[1, 2, 3].map((n) => `<button type="button" role="radio" class="cq-chip" data-ais="${n}" aria-checked="${sk.ais === n}">${n} IA</button>`).join('')}
        </div>
        <span class="cq-label" id="cq-skill-label">Niveau des IA</span>
        <div class="cq-chips" role="radiogroup" aria-labelledby="cq-skill-label">
          ${SKILLS.map((s) => {
            const open = skillOpen(s.id);
            return `<button type="button" role="radio" class="cq-chip" data-skill="${s.id}" aria-checked="${sk.skill === s.id}" ${open ? '' : `aria-disabled="true" title="Gagne le niveau ${SKILL_UNLOCK[s.id]} de la campagne"`}>${open ? '' : icon('lock')}${s.name}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="cq-hint" id="cq-hint">${m === 'campagne' ? levelHint(store.data.level) : m === 'jour' ? 'Deux Généraux sur une carte qui change chaque jour.' : 'Une nouvelle carte à chaque partie.'}</p>
    </div>`;
}
const levelHint = (i) => `Niveau ${i + 1} : contre ${LEVELS[i].ais.map((a) => SKILLS[a].name).join(', ')} · ${LEVELS[i].bases} bases.`;

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const hint = document.getElementById('cq-hint');
  if (b.getAttribute('aria-disabled') === 'true') {
    gv.audio.play('error');
    if (b.dataset.mode) hint.textContent = `Gagne le niveau ${MODES[b.dataset.mode].unlock} de la campagne pour ouvrir ce mode.`;
    else if (b.dataset.level) hint.textContent = `Gagne le niveau ${Number(b.dataset.level)} pour ouvrir celui-ci.`;
    else if (b.dataset.skill) hint.textContent = `Gagne le niveau ${SKILL_UNLOCK[b.dataset.skill]} de la campagne pour affronter l’IA ${SKILLS[b.dataset.skill].name}.`;
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.level) store.data.level = Number(b.dataset.level);
  if (b.dataset.ais) store.data.sk = { ...store.data.sk, ais: Number(b.dataset.ais) };
  if (b.dataset.skill) store.data.sk = { ...store.data.sk, skill: Number(b.dataset.skill) };
  store.save();
  gv.audio.play('select');
  renderOptions();
  const key = ['mode', 'level', 'ais', 'skill'].find((k) => b.dataset[k] !== undefined);
  gv.shell.startExtra.querySelector(`[data-${key}="${b.dataset[key]}"]`)?.focus();
});

// ---------- Démarrage ----------
let frameMs = 0;
const loop = createLoop({
  update(dt, realDt) {
    const t0 = performance.now();
    update(dt, realDt);
    frameMs = frameMs * 0.95 + (performance.now() - t0) * 0.05;
  },
  render,
  onAutoPause() {
    if (state === 'run' && gv.playing) gv.pause();
  },
});

window.__cq = {
  get state() { return state; },
  get world() { return world; },
  get run() { return run; },
  get selected() { return [...selected]; },
  get frameMs() { return frameMs; },
  toScreen,
  radius,
  order(from, to) {
    selected = new Set(from);
    order(to);
  },
  // Avance la simulation (tests)
  advance(sec) {
    for (let s = 0; s < sec * 30; s++) {
      onEvents(step(world, 1 / 30));
      if (state === 'run') checkEnd();
    }
  },
  // Toutes les bases ennemies passent au joueur (tests)
  conquer() {
    for (const b of world.bases) if (b.owner && b.owner !== PLAYER) b.owner = PLAYER;
    world.fleets = world.fleets.filter((f) => f.owner === PLAYER);
  },
  surrender() {
    for (const b of world.bases) if (b.owner === PLAYER) b.owner = 2;
    world.fleets = world.fleets.filter((f) => f.owner !== PLAYER);
  },
};

if (motion.reduced) fx.shake.add = () => {};
renderControls();
controls.hidden = true;
renderOptions();
gv.hud('best', formatInt(gv.best ?? 0));
gv.hud('time', '0:00');
measure();
loop.start();
gv.showStart();
