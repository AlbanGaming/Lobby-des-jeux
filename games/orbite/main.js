// Orbite — le vaisseau tourne autour d'une planète. Touche pour le lâcher : il file tout droit
// et s'accroche à la prochaine planète s'il entre dans son anneau. Viser le cœur de l'anneau, c'est
// un lâcher parfait. Plus haut : astéroïdes, planètes qui bougent, puis trous noirs.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { createInput } from '../../shared/js/engine/input.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { createRng, dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { clamp, lerp, formatInt, TAU } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { SKINS, GALAXIES, PLANET_COLORS, drawShip, drawPlanet, drawBackground, makeStars } from './draw.js';

const SPEED = 560;
const SPAN = 200; // écart horizontal maximal des planètes (indépendant de l'écran : même carte pour tous)
const FLY_MAX = 3.2;
const MODES = {
  classique: { id: 'classique', label: 'Classique', hint: 'Va le plus loin possible' },
  jour: { id: 'jour', label: 'Voyage du jour', hint: 'Les mêmes planètes pour tous' },
};
// Note pentatonique des lâchers parfaits
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

const params = new URLSearchParams(location.search);
const store = createStore('orbite', {
  version: 1,
  defaults: { mode: 'classique', skin: 'fusee', galaxy: 'voie', dust: 0, bestPlanets: 0, perfects: 0, daily: { day: '', best: 0, plays: 0 } },
});

const gv = bootGame('orbite', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'dust', label: 'Poussière' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['Espace', 'icon:touch'], text: 'Lâche le vaisseau : il part tout droit, dans le sens de sa course.' },
    { keys: ['icon:target'], text: 'Entre dans l’anneau d’une planète pour t’y accrocher. Vise le centre : lâcher parfait.' },
    { keys: ['icon:sparkle'], text: 'Ramasse la poussière d’étoile pour débloquer de nouveaux vaisseaux.' },
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
const view = createCanvas(stage, { mode: 'stage', height: 780, minWidth: (w, h) => (w > h ? 820 : 480) });
const input = createInput({ surface: stage, view, bindings: { go: ['pointer', 'Space', 'Enter'] } });
const fx = { particles: new Particles(700), popups: new Popups(24), shake: new Shake({ maxOffset: 10 }), flash: new Flash() };

let state = 'attract'; // attract | run | ending | over
let mode = MODES.classique;
let rng = createRng(3);
let planets = [];
let dusts = [];
let rocks = [];
let holes = [];
let ship = null;
let camTop = 0;
let time = 0;
let endTimer = 0;
let autoplay = params.has('autoplay');
let stars = makeStars(createRng(11));
const run = {};

const skin = () => SKINS.find((s) => s.id === store.data.skin) ?? SKINS[0];
const galaxy = () => GALAXIES.find((g) => g.id === store.data.galaxy) ?? GALAXIES[0];
const today = () => dayKey();
const best = () => gv.best ?? 0;

// ---------- Monde ----------
function addPlanet() {
  const n = planets.length;
  const prev = planets[n - 1];
  const r = n === 0 ? 40 : rng.range(24, 44);
  let x = 0;
  let y = 0;
  if (prev) {
    y = prev.y - (rng.range(270, 340) + Math.min(120, n * 2.4));
    do x = rng.range(-SPAN, SPAN);
    while (Math.abs(x - prev.x) < 90);
  }
  const p = { i: n, x, y, bx: x, r, ring: r + Math.max(42, 70 - n * 0.55), color: rng.pick(PLANET_COLORS), bands: rng.int(0, 3), spin: rng.range(-0.6, 0.6), osc: null, visited: false };
  if (n >= 25 && rng.chance(Math.min(0.6, 0.25 + (n - 25) * 0.01))) p.osc = { amp: rng.range(50, 110), speed: rng.range(0.7, 1.3), phase: rng.range(0, TAU) };
  planets.push(p);
  if (!prev) return;
  // Poussière d'étoile sur le chemin, parfois un petit trésor à l'écart
  for (const t of [0.3, 0.5, 0.7]) dusts.push({ x: lerp(prev.x, x, t) + rng.range(-36, 36), y: lerp(prev.y, y, t), v: 1, got: false, a: rng.range(0, TAU) });
  if (rng.chance(0.3)) {
    const side = rng.sign();
    for (let k = 0; k < 3; k++) dusts.push({ x: (prev.x + x) / 2 + side * (110 + k * 22), y: (prev.y + y) / 2 - k * 14, v: 3, got: false, a: rng.range(0, TAU) });
  }
  if (n >= 10 && rng.chance(Math.min(0.7, 0.35 + (n - 10) * 0.01))) {
    rocks.push({ x: rng.range(-SPAN - 200, SPAN + 200), y: (prev.y + y) / 2 + rng.range(-40, 40), vx: rng.sign() * rng.range(70, 140 + n), r: rng.range(14, 22), rot: rng.range(0, TAU), shape: Array.from({ length: 7 }, () => rng.range(0.75, 1.15)) });
  }
  if (n >= 60 && rng.chance(0.3)) {
    const side = rng.sign();
    holes.push({ x: (prev.x + x) / 2 + side * rng.range(90, 160), y: (prev.y + y) / 2, pull: 200, core: 16 });
  }
}

function ensureWorld() {
  while (!planets.length || planets[planets.length - 1].y > camTop - 1400) addPlanet();
}

function resetWorld(seed) {
  rng = createRng(seed);
  planets = [];
  dusts = [];
  rocks = [];
  holes = [];
  camTop = -view.height * 0.7;
  ensureWorld();
  const p = planets[0];
  p.visited = true;
  ship = { mode: 'orbit', p, angle: -Math.PI / 2, radius: p.r + 34, target: p.r + 34, dir: 1, x: 0, y: 0, vx: 0, vy: 0, t: 0, heading: 0 };
  placeOnOrbit();
}

function startRun() {
  mode = MODES[store.data.mode] ?? MODES.classique;
  state = 'run';
  resetWorld(mode.id === 'jour' ? dailySeed('orbite') : Number(params.get('seed')) || Math.floor(Math.random() * 1e9));
  Object.assign(run, { points: 0, planets: 0, streak: 0, bestStreak: 0, perfects: 0, dust: 0, skips: 0, reason: '', lock: time + 0.25, shown: -1 });
  fx.particles.clear();
  fx.popups.clear();
  loop.timeScale = 1;
  input.reset();
  gv.hud('score', 0);
  gv.hud('dust', 0);
  gv.hud('best', formatInt(best()));
}

const omega = () => Math.min(3.9, 2.3 + run.planets * 0.03) * (state === 'attract' ? 0.9 : 1);

function placeOnOrbit() {
  const p = ship.p;
  ship.x = p.x + Math.cos(ship.angle) * ship.radius;
  ship.y = p.y + Math.sin(ship.angle) * ship.radius;
  ship.heading = ship.angle + (ship.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
}

function release() {
  const a = ship.angle;
  ship.vx = -Math.sin(a) * ship.dir * SPEED;
  ship.vy = Math.cos(a) * ship.dir * SPEED;
  ship.mode = 'fly';
  ship.t = 0;
  ship.from = ship.p.i;
  if (state === 'run') gv.audio.play('whoosh', { pitch: 1.2, volume: 0.7 });
  fx.particles.emit(ship.x, ship.y, { count: 10, colors: [skin().trail, '#ffffff'], speed: [40, 160], gravity: 0, size: [2, 4], shape: 'circle', life: [0.2, 0.45] });
}

function capture(p) {
  const rx = ship.x - p.x;
  const ry = ship.y - p.y;
  const vl = Math.hypot(ship.vx, ship.vy);
  const b = Math.abs(rx * ship.vy - ry * ship.vx) / vl; // distance d'approche au centre
  const cross = rx * ship.vy - ry * ship.vx;
  const perfect = b < p.r + 14;
  ship.mode = 'orbit';
  ship.p = p;
  ship.dir = cross >= 0 ? 1 : -1;
  ship.angle = Math.atan2(ry, rx);
  ship.radius = Math.hypot(rx, ry);
  ship.target = clamp(b, p.r + 18, p.ring - 8);
  if (state !== 'run') {
    p.visited = true;
    return;
  }
  const fresh = !p.visited;
  p.visited = true;
  if (!fresh) return;
  const skipped = p.i - ship.from > 1;
  run.planets += p.i - ship.from;
  let pts = 10 * (p.i - ship.from);
  let label = '';
  if (skipped) {
    run.skips++;
    pts += 20;
    label = 'Saut double !';
    gv.unlock('saut-double');
  }
  if (perfect) {
    run.streak++;
    run.perfects++;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    pts += 5 * Math.min(run.streak, 10);
    label ||= run.streak > 1 ? `Parfait ×${run.streak}` : 'Parfait !';
    gv.audio.tone({ type: 'triangle', freq: SCALE[(run.streak - 1) % SCALE.length], duration: 0.24, volume: 0.16 });
    fx.flash.trigger('#fff3c4', 0.12, 6);
    loop.hitstop(0.035);
    if (run.streak >= 5) gv.unlock('parfait-5');
  } else {
    run.streak = 0;
    gv.audio.play('land', { pitch: 1 + Math.min(run.planets, 40) * 0.01 });
  }
  run.points += pts;
  fx.particles.ring(p.x, p.y, { color: perfect ? '#ffc93c' : '#ffffff', size: p.r, growth: 240, life: 0.4, lineWidth: perfect ? 5 : 3 });
  fx.particles.emit(ship.x, ship.y, { count: perfect ? 26 : 12, colors: perfect ? ['#ffc93c', '#fff3c4', '#ffffff'] : [p.color[0], '#ffffff'], speed: [60, 260], gravity: 0, size: [2, 5], shape: perfect ? 'star' : 'circle', life: [0.3, 0.7] });
  fx.shake.add(perfect ? 0.14 : 0.06);
  if (label) fx.popups.add(p.x, p.y - p.ring - 12, label, { size: perfect ? 28 : 22, color: perfect ? '#ffc93c' : '#3ee6a8', rise: 46 });
  milestones();
}

function milestones() {
  const n = run.planets;
  const g = GALAXIES.find((x) => x.at === n && x.at > 0);
  if (g) gv.banner(g.zone, { color: '#4cc3ff' });
  if (n === 10 || n === 25 || n === 60) {
    gv.audio.play('levelUp');
    gv.banner(n === 10 ? 'Astéroïdes !' : n === 25 ? 'Planètes mobiles !' : 'Trous noirs !', { color: '#ff8a5b' });
  }
  if (n >= 10) gv.unlock('decollage');
  if (n >= 25) gv.unlock('navigateur');
  if (n >= 50) gv.unlock('explorateur');
  if (n >= 100) gv.unlock('legende');
}

function lose(reason) {
  if (state !== 'run') {
    if (state === 'attract') resetWorld(Math.floor(Math.random() * 1e6));
    return;
  }
  state = 'ending';
  run.reason = reason;
  endTimer = motion.reduced ? 0.8 : 1.5;
  fx.shake.add(0.5);
  fx.particles.emit(ship.x, ship.y, { count: 40, colors: [skin().body, skin().trail, '#ffffff'], speed: [60, 320], gravity: 0, size: [2, 6], shape: 'square', life: [0.4, 1] });
  gv.audio.play('explode');
  loop.timeScale = 0.6;
  ship.mode = 'dead';
}

function finish() {
  state = 'over';
  loop.timeScale = 1;
  const before = { dust: store.data.dust, best: store.data.bestPlanets };
  store.data.dust += run.dust;
  store.data.bestPlanets = Math.max(store.data.bestPlanets, run.planets);
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
  if (store.data.dust >= 1000) gv.unlock('poussiere');
  for (const s of SKINS) if (s.unlock > 0 && before.dust < s.unlock && store.data.dust >= s.unlock) toast({ title: 'Nouveau vaisseau !', text: `${s.name} débloqué : choisis-le à l’accueil.`, iconName: 'sparkle', tone: 'var(--coin)' });
  for (const g of GALAXIES) if (g.unlock > 0 && before.best < g.unlock && store.data.bestPlanets >= g.unlock) toast({ title: 'Nouvelle galaxie !', text: `${g.name} débloquée.`, iconName: 'star', tone: 'var(--mint)' });
  if (SKINS.every((s) => store.data.dust >= s.unlock)) gv.unlock('flotte');
  const nextSkin = SKINS.find((s) => s.unlock > store.data.dust);
  gv.gameOver({
    score: run.points,
    stats: { score: run.points, planets: run.planets, perfects: run.perfects, dust: run.dust, daily: mode.id === 'jour' ? 1 : 0 },
    extraStats: [
      { label: 'Planètes', value: formatInt(run.planets) },
      { label: 'Parfaits', value: `${run.perfects} (série ${run.bestStreak})` },
      { label: 'Poussière', value: `+${formatInt(run.dust)}` },
    ],
    kicker: mode.label,
    title: run.reason,
    nextUnlock: nextSkin ? { label: `Vaisseau ${nextSkin.name}`, current: store.data.dust, target: nextSkin.unlock } : undefined,
    extraHtml: dailyLine ? `<p class="or-daily">${esc(dailyLine)}</p>` : '',
  });
  gv.hud('best', formatInt(best()));
  renderOptions();
}

// ---------- Pilote (démo de l'accueil et tests) ----------
function wouldHit() {
  const next = planets[ship.p.i + 1];
  if (!next) return false;
  const a = ship.angle;
  const dx = -Math.sin(a) * ship.dir;
  const dy = Math.cos(a) * ship.dir;
  const dist = Math.hypot(next.x - ship.x, next.y - ship.y);
  const tx = next.osc ? next.bx + Math.sin((time + dist / SPEED) * next.osc.speed + next.osc.phase) * next.osc.amp : next.x;
  const rx = tx - ship.x;
  const ry = next.y - ship.y;
  const along = rx * dx + ry * dy;
  if (along <= 0) return false;
  const b = Math.abs(rx * dy - ry * dx);
  return b < next.r * 0.5;
}

// ---------- Boucle ----------
function update(dt, realDt) {
  time += dt;
  fx.shake.update(realDt);
  fx.flash.update(realDt);
  fx.particles.update(dt);
  fx.popups.update(dt);

  for (const p of planets) if (p.osc) p.x = p.bx + Math.sin(time * p.osc.speed + p.osc.phase) * p.osc.amp;
  const wHalf = Math.max(view.width / 2, SPAN + 120) + 160;
  for (const k of rocks) {
    k.x += k.vx * dt;
    k.rot += dt * 0.8;
    if (k.x > wHalf) k.x = -wHalf;
    if (k.x < -wHalf) k.x = wHalf;
  }

  if (ship && (state === 'run' || state === 'attract')) {
    if (ship.mode === 'orbit') {
      ship.radius = lerp(ship.radius, ship.target, 1 - Math.pow(0.004, dt));
      ship.angle += (omega() * ship.dir * (ship.p.r + 34)) / Math.max(ship.radius, 1) * dt;
      placeOnOrbit();
      const auto = state === 'attract' || autoplay;
      if (auto ? wouldHit() : input.pressed('go') && time >= run.lock) release();
      if (Math.random() < 0.4) fx.particles.emit(ship.x, ship.y, { count: 1, color: skin().trail, speed: [0, 10], gravity: 0, size: [1.5, 3], shape: 'circle', life: [0.2, 0.4] });
    } else if (ship.mode === 'fly') {
      for (const h of holes) {
        const dx = h.x - ship.x;
        const dy = h.y - ship.y;
        const d = Math.hypot(dx, dy);
        if (d < h.core) return lose('Avalé par un trou noir');
        if (d < h.pull) {
          const a = Math.min(1500, 2.6e5 / (d * d));
          ship.vx += (dx / d) * a * dt;
          ship.vy += (dy / d) * a * dt;
        }
      }
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      ship.t += dt;
      ship.heading = Math.atan2(ship.vy, ship.vx);
      fx.particles.emit(ship.x, ship.y, { count: 2, colors: [skin().trail, '#ffffff'], speed: [0, 30], gravity: 0, size: [2, 4], shape: 'circle', life: [0.25, 0.5] });
      for (const p of planets) {
        if (p.i <= ship.p.i) continue;
        if (Math.hypot(ship.x - p.x, ship.y - p.y) < p.ring) {
          capture(p);
          break;
        }
      }
      if (ship.mode === 'fly') {
        const off = Math.abs(ship.x) > Math.max(view.width / 2, SPAN + 60) + 40 || ship.y > camTop + view.height + 40 || ship.t > FLY_MAX;
        if (off) lose('Perdu dans le vide');
      }
    }
    if (ship.mode !== 'dead') {
      for (const k of rocks) if (Math.hypot(k.x - ship.x, k.y - ship.y) < k.r + 8) return lose('Percuté par un astéroïde');
      for (const d of dusts) {
        if (d.got || Math.hypot(d.x - ship.x, d.y - ship.y) > 24) continue;
        d.got = true;
        if (state !== 'run') continue;
        run.dust += d.v;
        run.points += d.v;
        gv.audio.play('coin', { pitch: 1.2 + Math.random() * 0.3, volume: 0.5 });
        fx.particles.emit(d.x, d.y, { count: 6, colors: ['#ffc93c', '#ffffff'], speed: [30, 120], gravity: 0, size: [1.5, 3], shape: 'star', life: [0.2, 0.4] });
        gv.hud('dust', formatInt(run.dust), true);
      }
    }
  }

  // Caméra : la planète courante aux deux tiers de l'écran ; le vaisseau en vol reste visible
  if (ship) {
    let target = ship.p.y - view.height * 0.68;
    if (ship.mode === 'fly') target = Math.min(target, ship.y - view.height * 0.55);
    camTop = lerp(camTop, target, 1 - Math.pow(0.02, realDt));
  }
  ensureWorld();
  // Ménage sous l'écran
  const bottom = camTop + view.height + 400;
  dusts = dusts.filter((d) => d.y < bottom);
  rocks = rocks.filter((k) => k.y < bottom);
  holes = holes.filter((h) => h.y < bottom);

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
  const g = galaxy();
  drawBackground(ctx, view, camTop, stars, g, time);
  ctx.save();
  fx.shake.apply(ctx, view.width / 2, view.height / 2);
  ctx.translate(view.width / 2, -camTop);

  // Trous noirs
  for (const h of holes) {
    const grad = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.pull);
    grad.addColorStop(0, 'rgba(0,0,0,0.9)');
    grad.addColorStop(0.15, 'rgba(120,60,200,0.35)');
    grad.addColorStop(1, 'rgba(120,60,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.pull, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,170,255,0.6)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.core + 10 + k * 9, time * (2 - k * 0.4) + k, time * (2 - k * 0.4) + k + 2.2);
      ctx.stroke();
    }
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.core, 0, TAU);
    ctx.fill();
  }

  // Planètes et anneaux
  for (const p of planets) {
    if (p.y < camTop - 200 || p.y > camTop + view.height + 200) continue;
    const current = ship?.p === p;
    ctx.save();
    ctx.strokeStyle = current ? 'rgba(255,255,255,0.18)' : p.visited ? 'rgba(255,255,255,0.12)' : hexA(p.color[0], 0.65);
    ctx.lineWidth = current ? 2 : 3;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -time * 30 * (p.i % 2 ? 1 : -1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.ring, 0, TAU);
    ctx.stroke();
    ctx.restore();
    if (!p.visited) {
      ctx.fillStyle = hexA(p.color[0], 0.08);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.ring, 0, TAU);
      ctx.fill();
    }
    drawPlanet(ctx, p, time);
  }

  // Poussière d'étoile
  for (const d of dusts) {
    if (d.got) continue;
    const s = (d.v > 1 ? 7 : 5) * (1 + Math.sin(time * 5 + d.a) * 0.2);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(time * 1.5 + d.a);
    ctx.fillStyle = d.v > 1 ? '#ffc93c' : '#fff3c4';
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const rr = k % 2 ? s * 0.35 : s;
      const a = (k / 8) * TAU;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Astéroïdes
  for (const k of rocks) {
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.rot);
    ctx.fillStyle = '#6b6f80';
    ctx.strokeStyle = '#3a3d4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    k.shape.forEach((m, j) => {
      const a = (j / k.shape.length) * TAU;
      ctx.lineTo(Math.cos(a) * k.r * m, Math.sin(a) * k.r * m);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#545866';
    ctx.beginPath();
    ctx.arc(k.r * 0.25, -k.r * 0.2, k.r * 0.22, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Guide de visée : la direction du lâcher
  if (ship?.mode === 'orbit' && state === 'run' && run.planets < 6) {
    const dx = -Math.sin(ship.angle) * ship.dir;
    const dy = Math.cos(ship.angle) * ship.dir;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(ship.x + dx * 18, ship.y + dy * 18);
    ctx.lineTo(ship.x + dx * 130, ship.y + dy * 130);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  fx.particles.draw(ctx);
  if (ship && ship.mode !== 'dead') drawShip(ctx, skin(), ship.x, ship.y, ship.heading, time);
  fx.popups.draw(ctx);
  ctx.restore();

  // Compteur de planètes
  if (state === 'run' || state === 'ending') {
    ctx.textAlign = 'center';
    ctx.font = '900 64px "Big Shoulders Display", sans-serif';
    ctx.fillStyle = 'rgba(5,6,11,0.45)';
    ctx.fillText(formatInt(run.planets), view.width / 2, 94);
    ctx.fillStyle = '#f4efe4';
    ctx.fillText(formatInt(run.planets), view.width / 2, 90);
    if (run.streak > 1) {
      ctx.font = '800 16px Rubik, sans-serif';
      ctx.fillStyle = '#ffc93c';
      ctx.fillText(`PARFAIT ×${run.streak}`, view.width / 2, 116);
    }
  }
  fx.flash.draw(ctx, view.width, view.height);
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const dd = store.data.daily;
  gv.shell.startExtra.innerHTML = `
    <div class="or-options">
      <div class="or-row">
        <span class="or-label" id="or-mode-label">Mode</span>
        <div class="or-modes" role="radiogroup" aria-labelledby="or-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const sub = m.id === 'jour' && dd.day === today() ? `Meilleur : ${formatInt(dd.best)} · ${dd.plays} essai${dd.plays > 1 ? 's' : ''}` : m.hint;
              return `<button type="button" role="radio" class="or-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}">${icon(m.id === 'jour' ? 'calendar' : 'target')}<span>${m.label}</span><small>${esc(sub)}</small></button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="or-row">
        <span class="or-label" id="or-skin-label">Vaisseau · ${formatInt(store.data.dust)} poussières</span>
        <div class="or-picks" role="radiogroup" aria-labelledby="or-skin-label">
          ${SKINS.map((s) => {
            const locked = store.data.dust < s.unlock;
            const label = locked ? `${s.name}, débloqué à ${s.unlock} poussières` : s.name;
            return `<button type="button" role="radio" class="or-pick" data-skin="${s.id}" aria-checked="${store.data.skin === s.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><canvas width="88" height="88" data-preview="${s.id}" aria-hidden="true"></canvas>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="or-row">
        <span class="or-label" id="or-gal-label">Galaxie</span>
        <div class="or-picks" role="radiogroup" aria-labelledby="or-gal-label">
          ${GALAXIES.map((g) => {
            const locked = store.data.bestPlanets < g.unlock;
            const label = locked ? `${g.name}, débloquée à ${g.unlock} planètes` : g.name;
            return `<button type="button" role="radio" class="or-gal" data-galaxy="${g.id}" style="--c1:${g.sky[0]};--c2:${g.nebula}" aria-checked="${store.data.galaxy === g.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span></span>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="or-hint" id="or-hint">Record : ${formatInt(store.data.bestPlanets)} planètes.</p>
    </div>`;
  for (const c of gv.shell.startExtra.querySelectorAll('[data-preview]')) {
    const s = SKINS.find((x) => x.id === c.dataset.preview);
    const k = c.getContext('2d');
    k.translate(44, 44);
    k.scale(2.2, 2.2);
    drawShip(k, s, 0, 0, -Math.PI / 2, 0);
  }
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    const s = SKINS.find((x) => x.id === b.dataset.skin);
    const g = GALAXIES.find((x) => x.id === b.dataset.galaxy);
    document.getElementById('or-hint').textContent = s ? `Ramasse ${formatInt(s.unlock)} poussières d’étoile pour piloter ce vaisseau.` : `Atteins ${g.unlock} planètes pour ouvrir cette galaxie.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.skin) store.data.skin = b.dataset.skin;
  if (b.dataset.galaxy) store.data.galaxy = b.dataset.galaxy;
  store.save();
  gv.audio.play('select');
  renderOptions();
  const key = ['mode', 'skin', 'galaxy'].find((k) => b.dataset[k] !== undefined);
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

window.__or = {
  get state() { return state; },
  get run() { return run; },
  get ship() { return ship; },
  get planets() { return planets; },
  get frameMs() { return frameMs; },
  set autoplay(v) { autoplay = v; },
  wouldHit,
};

resetWorld(42);
Object.assign(run, { points: 0, planets: 0, streak: 0, dust: 0 });
renderOptions();
gv.hud('best', formatInt(best()));
gv.hud('dust', formatInt(store.data.dust));
loop.start();
gv.showStart();
