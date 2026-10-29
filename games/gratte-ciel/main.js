// Gratte-Ciel — une dalle glisse au-dessus de la tour : la lâcher au bon moment. Ce qui dépasse
// est coupé et tombe. Les lâchers parfaits jouent une gamme qui monte ; trois d'affilée rendent de
// la largeur. Toutes les quinze étages, la tour change d'époque, et le ciel change avec l'altitude.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { createInput } from '../../shared/js/engine/input.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { createRng, dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { clamp, lerp, formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { FLOOR_H, EPOCHS, epochOf, CITIES, createScenery, drawSky, drawWorldDecor, drawFloor, drawSlab, drawRuler } from './draw.js';

const BASE_W = 220;
const PERFECT = 5; // px de tolérance pour un lâcher parfait
const NEAR = 12;
const REGROW = 14;
const MODES = {
  classique: { id: 'classique', label: 'Classique', hint: 'Monte aussi haut que possible' },
  jour: { id: 'jour', label: 'Tour du jour', hint: 'Les mêmes dalles pour tous' },
};
// Gamme des lâchers parfaits (do majeur pentatonique, sur deux octaves)
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

const params = new URLSearchParams(location.search);
const store = createStore('gratte-ciel', {
  version: 1,
  defaults: { mode: 'classique', city: 'ville', floors: 0, perfects: 0, daily: { day: '', best: 0, plays: 0 } },
});

const gv = bootGame('gratte-ciel', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['Espace', 'icon:touch'], text: 'Lâche la dalle au-dessus de la tour.' },
    { keys: ['icon:target'], text: 'Ce qui dépasse tombe : vise juste, la tour s’affine sinon.' },
    { keys: ['icon:sparkle'], text: 'Trois lâchers parfaits d’affilée : la dalle s’élargit.' },
  ],
  onStart: startRun,
  onRestart: startRun,
  onPause: () => loop.pause(),
  onResume: () => {
    input.reset();
    loop.resume();
  },
});

const stage = document.getElementById('stage');
const view = createCanvas(stage, { mode: 'stage', height: 720, minWidth: (w, h) => (w > h ? 980 : 430) });
const input = createInput({ surface: stage, view, bindings: { drop: ['pointer', 'Space', 'Enter'] } });
const fx = { particles: new Particles(500), popups: new Popups(24), shake: new Shake({ maxOffset: 10 }), flash: new Flash() };

let state = 'attract'; // attract | run | ending | over
let mode = MODES.classique;
let rng = createRng(1);
let scenery = createScenery(createRng(7));
let time = 0;
let floors = [];
let debris = [];
let slab = null;
let cam = { top: -600, zoom: 1 };
let endTimer = 0;
let autoplay = false;
const run = {};

const city = () => CITIES.find((c) => c.id === store.data.city) ?? CITIES[0];
const best = () => gv.best ?? 0;
const today = () => dayKey();
const height = () => floors.length - 1; // étages posés au-dessus des fondations

function resetTower() {
  floors = [{ x: -BASE_W / 2, w: BASE_W, epoch: 0, squash: 1 }];
  for (let i = 0; i < (state === 'attract' ? 5 : 0); i++) floors.push({ x: -BASE_W / 2, w: BASE_W, epoch: 0, squash: 1 });
  debris = [];
}

function resetRun() {
  Object.assign(run, { points: 0, streak: 0, bestStreak: 0, perfects: 0, regrows: 0, nears: 0, lockUntil: 0, shown: -1, reason: '' });
}

function startRun() {
  mode = MODES[store.data.mode] ?? MODES.classique;
  rng = mode.id === 'jour' ? createRng(dailySeed('gratte-ciel')) : createRng(Number(params.get('seed')) || Date.now());
  state = 'run';
  resetRun();
  resetTower();
  cam.zoom = 1;
  nextSlab();
  fx.particles.clear();
  fx.popups.clear();
  loop.timeScale = 1;
  input.reset();
  run.lockUntil = time + 0.25;
  gv.hud('score', 0);
  gv.hud('best', formatInt(best()));
  loop.resume();
}

function speedFor(n) {
  const jitter = mode.id === 'jour' || state === 'run' ? rng.range(0.92, 1.08) : 1;
  return Math.min(560, 200 + n * 7) * jitter;
}

function nextSlab() {
  const top = floors[floors.length - 1];
  const n = floors.length;
  const fromLeft = n % 2 === 0;
  const span = view.width * 0.42;
  slab = {
    w: top.w,
    x: fromLeft ? -span - top.w : span,
    dir: fromLeft ? 1 : -1,
    v: speedFor(n),
    epoch: epochOf(n),
  };
}

// ---------- Lâcher ----------
function drop() {
  const top = floors[floors.length - 1];
  const n = floors.length; // indice de l'étage qu'on pose
  const y = -(n + 1) * FLOOR_H;
  let x = slab.x;
  const dx = x - top.x;
  const demo = state === 'attract';
  if (Math.abs(dx) <= PERFECT) x = top.x;
  const left = Math.max(x, top.x);
  const right = Math.min(x + slab.w, top.x + top.w);
  const overlap = right - left;
  if (overlap <= 0) {
    // Raté : la dalle entière tombe
    debris.push(piece(x, slab.w, n, slab.dir * 120));
    if (!demo) return fail();
    resetTower();
    nextSlab();
    return;
  }
  const perfect = x === top.x;
  // La partie qui dépasse tombe
  if (!perfect) {
    const cutX = x < top.x ? x : right;
    const cutW = slab.w - overlap;
    if (cutW > 0.5) debris.push(piece(cutX, cutW, n, (x < top.x ? -1 : 1) * 140));
  }
  const floor = { x: left, w: overlap, epoch: slab.epoch, squash: 1.18 };
  floors.push(floor);
  if (demo) {
    nextSlab();
    if (floors.length > 9) resetTower();
    return;
  }

  // Points, série, effets
  let label = '';
  if (perfect) {
    run.streak++;
    run.perfects++;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    run.points += 10 + 5 * Math.min(run.streak, 10);
    label = run.streak > 1 ? `Parfait ×${run.streak}` : 'Parfait !';
    gv.audio.tone({ type: 'triangle', freq: SCALE[(run.streak - 1) % SCALE.length], duration: 0.22, volume: 0.16 });
    loop.hitstop(0.04);
    fx.flash.trigger('#fff3c4', 0.14, 6);
    if (run.streak % 3 === 0 && floor.w < BASE_W) {
      floor.w = Math.min(BASE_W, floor.w + REGROW);
      floor.x -= REGROW / 2;
      run.regrows++;
      gv.unlock('agrandi');
      fx.popups.add(floor.x + floor.w / 2, y - 40, 'Élargie !', { size: 22, color: '#3ee6a8', rise: 30 });
      gv.audio.play('powerup');
    }
    if (run.streak >= 5) gv.unlock('parfait-5');
    if (run.streak >= 15) gv.unlock('millimetre');
    dust(floor, y, 18, ['#ffc93c', '#fff3c4', '#ffffff']);
  } else {
    const over = slab.w - overlap;
    run.streak = 0;
    run.points += 10;
    if (over <= NEAR) {
      run.points += 2;
      run.nears++;
      label = 'Presque !';
      gv.audio.play('nearMiss');
    }
    gv.audio.play('place', { pitch: 0.9 + Math.min(height(), 40) * 0.01 });
    dust(floor, y, 8, ['#d9cfbd', '#ffffff']);
  }
  fx.shake.add(perfect ? 0.12 : 0.06);
  if (label) fx.popups.add(floor.x + floor.w / 2, y - 16, label, { size: perfect ? 26 : 20, color: perfect ? '#ffc93c' : '#ff8a5b', rise: 40 });

  const h = height();
  // Nouvelle époque
  const e = EPOCHS.findIndex((ep) => ep.at === h);
  if (e > 0) {
    gv.banner(EPOCHS[e].name, { color: '#ffc93c' });
    gv.audio.play('levelUp');
  }
  if (h >= 10) gv.unlock('fondations');
  if (h >= 15) gv.unlock('art-deco');
  if (h >= 30) gv.unlock('verre');
  if (h >= 50) gv.unlock('neon');
  if (h >= 80) gv.unlock('orbite');
  nextSlab();
}

function piece(x, w, n, vx) {
  return { x, w, y: -(n + 1) * FLOOR_H, vx, vy: -60, rot: 0, vr: vx > 0 ? 2.5 : -2.5, epoch: slab.epoch, life: 3 };
}
function dust(floor, y, n, colors) {
  for (const px of [floor.x, floor.x + floor.w]) fx.particles.emit(px, y + FLOOR_H, { count: n, colors, speed: [40, 180], angle: -Math.PI / 2, spread: 2.4, gravity: 300, size: [2, 4], shape: 'square', life: [0.3, 0.6] });
}

function fail() {
  state = 'ending';
  run.reason = height() ? `${formatInt(height())} étage${height() > 1 ? 's' : ''}` : 'Raté !';
  endTimer = motion.reduced ? 0.8 : 1.8;
  slab = null;
  fx.shake.add(0.5);
  gv.audio.play('hit');
  loop.timeScale = 0.6;
}

function finish() {
  state = 'over';
  loop.timeScale = 1;
  const h = height();
  const beforeBest = best();
  store.data.floors = Math.max(store.data.floors, h);
  store.data.perfects += run.perfects;
  let dailyLine = '';
  if (mode.id === 'jour') {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), best: 0, plays: 0 });
    d.plays++;
    d.best = Math.max(d.best, run.points);
    gv.unlock('du-jour');
    dailyLine = `Meilleur score du jour : ${formatInt(d.best)} (${d.plays} essai${d.plays > 1 ? 's' : ''})`;
  }
  store.save();
  const next = CITIES.filter((c) => c.unlock > store.data.floors).sort((a, b) => a.unlock - b.unlock)[0];
  gv.gameOver({
    score: run.points,
    stats: { score: run.points, floors: h, perfects: run.perfects, daily: mode.id === 'jour' ? 1 : 0 },
    extraStats: [
      { label: 'Hauteur', value: `${formatInt(h * 3)} m` },
      { label: 'Parfaits', value: `${run.perfects} (série ${run.bestStreak})` },
    ],
    kicker: `${mode.label} · ${EPOCHS[epochOf(h)].name}`,
    title: run.reason,
    nextUnlock: next ? { label: `Ville ${next.name}`, current: store.data.floors, target: next.unlock } : undefined,
    extraHtml: dailyLine ? `<p class="gc-daily">${esc(dailyLine)}</p>` : '',
  });
  for (const c of CITIES) if (c.unlock > 0 && store.data.floors >= c.unlock && (beforeFloors ?? 0) < c.unlock) toast({ title: 'Nouvelle ville !', text: `${c.name} débloqué : choisis-la à l’accueil.`, iconName: 'home', tone: 'var(--coin)' });
  if (CITIES.every((c) => store.data.floors >= c.unlock)) gv.unlock('collection');
  beforeFloors = store.data.floors;
  gv.hud('best', formatInt(Math.max(beforeBest, run.points)));
  renderOptions();
}
let beforeFloors = null;

// ---------- Boucle ----------
function update(dt, realDt) {
  time += dt;
  fx.shake.update(realDt);
  fx.flash.update(realDt);
  fx.particles.update(dt);
  fx.popups.update(dt);
  for (const f of floors) if (f.squash !== 1) f.squash = lerp(f.squash, 1, 1 - Math.pow(0.0005, realDt));

  if (slab && (state === 'run' || state === 'attract')) {
    const span = view.width * 0.42;
    slab.x += slab.dir * slab.v * dt;
    if (slab.x > span) {
      slab.x = span;
      slab.dir = -1;
    } else if (slab.x + slab.w < -span) {
      slab.x = -span - slab.w;
      slab.dir = 1;
    }
    const top = floors[floors.length - 1];
    // Démonstration de l'accueil et pilote des tests : lâcher pile au-dessus
    if (state === 'attract' || autoplay) {
      if (Math.abs(slab.x - top.x) < slab.v * dt) drop();
    } else if (input.pressed('drop') && time >= run.lockUntil) drop();
  }

  for (const d of debris) {
    d.vy += 1600 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rot += d.vr * dt;
    d.life -= dt;
  }
  debris = debris.filter((d) => d.life > 0);

  // Caméra : suit le sommet ; en fin de partie, recule pour montrer toute la tour
  const topY = -(floors.length + 1) * FLOOR_H;
  let zoomT = 1;
  let topT = Math.min(topY - view.height * 0.32, -(view.height - 150));
  if (state === 'ending' || state === 'over') {
    const towerH = floors.length * FLOOR_H + 260;
    zoomT = clamp((view.height * 0.86) / towerH, 0.12, 1);
    topT = -(view.height / zoomT) + 120 / zoomT;
  }
  const k = 1 - Math.pow(state === 'ending' ? 0.08 : 0.004, realDt);
  cam.zoom = lerp(cam.zoom, zoomT, k);
  cam.top = lerp(cam.top, topT, k);

  if (state === 'run') {
    const shown = Math.floor(run.points);
    if (shown !== run.shown) {
      run.shown = shown;
      gv.hud('score', formatInt(shown), true);
    }
  }
  if (state === 'ending') {
    endTimer -= realDt;
    if (endTimer <= 0) finish();
  }
  input.endFrame();
}

function render() {
  const ctx = view.begin();
  // Altitude du ciel : zéro tant que le sol est à sa place en bas de l'écran
  const level = Math.max(0, (-cam.top - (view.height - 150) / cam.zoom) / FLOOR_H);
  drawSky(ctx, view, cam, level, scenery, city(), time);
  ctx.save();
  fx.shake.apply(ctx, view.width / 2, view.height / 2);
  ctx.translate(view.width / 2, 0);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(0, -cam.top);
  drawWorldDecor(ctx, scenery, city(), time, level);
  const lit = level > 35;
  floors.forEach((f, i) => drawFloor(ctx, f, i, lit || i % 7 === 3, time));
  if (slab) drawSlab(ctx, slab, floors.length, time);
  for (const d of debris) {
    ctx.save();
    ctx.translate(d.x + d.w / 2, d.y + FLOOR_H / 2);
    ctx.rotate(d.rot);
    ctx.globalAlpha = clamp(d.life);
    drawFloor(ctx, { x: -d.w / 2, w: d.w, epoch: d.epoch }, -0.5, false, time);
    ctx.restore();
  }
  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  ctx.restore();
  drawRuler(ctx, view, cam.top, cam.zoom);
  fx.flash.draw(ctx, view.width, view.height);

  // Compteur d'étages
  if (state !== 'attract') {
    const h = height();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.font = '900 64px "Big Shoulders Display", sans-serif';
    ctx.fillText(formatInt(h), view.width / 2, 92);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(formatInt(h), view.width / 2, 88);
    ctx.font = '700 14px "Silkscreen", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`${formatInt(h * 3)} M · ${EPOCHS[epochOf(h)].name.toUpperCase()}`, view.width / 2, 112);
    if (run.streak > 1) {
      ctx.fillStyle = '#ffc93c';
      ctx.font = '900 22px "Big Shoulders Display", sans-serif';
      ctx.fillText(`PARFAIT ×${run.streak}`, view.width / 2, 140);
    }
  }
}

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const fl = store.data.floors;
  const dd = store.data.daily;
  gv.shell.startExtra.innerHTML = `
    <div class="gc-options">
      <div class="gc-row">
        <span class="gc-label" id="gc-mode-label">Mode</span>
        <div class="gc-modes" role="radiogroup" aria-labelledby="gc-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const sub = m.id === 'jour' && dd.day === today() ? `Meilleur du jour : ${formatInt(dd.best)}` : m.hint;
              return `<button type="button" role="radio" class="gc-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}">${icon(m.id === 'jour' ? 'calendar' : 'blocks')}<span>${m.label}</span><small>${esc(sub)}</small></button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="gc-row">
        <span class="gc-label" id="gc-city-label">Ville</span>
        <div class="gc-cities" role="radiogroup" aria-labelledby="gc-city-label">
          ${CITIES.map((c) => {
            const locked = fl < c.unlock;
            const label = locked ? `${c.name}, débloquée à ${c.unlock} étages` : c.name;
            return `<button type="button" role="radio" class="gc-city" data-city="${c.id}" style="--c1:${c.ground};--c2:${c.far}" aria-checked="${store.data.city === c.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span></span>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="gc-hint" id="gc-hint" aria-live="polite">${fl ? `Ta plus haute tour : ${formatInt(fl)} étages (${formatInt(fl * 3)} m).` : ''}</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    document.getElementById('gc-hint').textContent = `Monte une tour de ${CITIES.find((c) => c.id === b.dataset.city).unlock} étages pour la débloquer.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.city) store.data.city = b.dataset.city;
  store.save();
  gv.audio.play('select');
  renderOptions();
  gv.shell.startExtra.querySelector(b.dataset.mode ? `[data-mode="${b.dataset.mode}"]` : `[data-city="${b.dataset.city}"]`)?.focus();
});

// ---------- Démarrage ----------
let frameMs = 0;
let frameStart = 0;
const loop = createLoop({
  update(dt, realDt) {
    frameStart = performance.now();
    update(dt, realDt);
  },
  render() {
    render();
    frameMs = frameMs * 0.95 + (performance.now() - frameStart) * 0.05;
  },
  onAutoPause() {
    if (state === 'run' && gv.playing) gv.pause();
  },
});

window.__gc = {
  get state() { return state; },
  get run() { return run; },
  get slab() { return slab; },
  get floors() { return floors; },
  get frameMs() { return frameMs; },
  get top() { return floors[floors.length - 1]; },
  set autoplay(v) { autoplay = v; },
};

beforeFloors = store.data.floors;
resetRun();
resetTower();
nextSlab();
gv.hud('best', formatInt(best()));
renderOptions();
loop.start();
gv.showStart();
