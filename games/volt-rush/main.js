// Volt Rush — runner sur les toits. Un bouton pour sauter (double saut en l'air),
// bas pour plonger ou glisser, boulons pour remplir la jauge de Surcharge.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { createInput } from '../../shared/js/engine/input.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { Spring, Tweens, Ease } from '../../shared/js/core/tween.js';
import { TAU, clamp, formatInt } from '../../shared/js/core/math.js';
import { createStore, readRaw } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { WORLD_H, UNITS_PER_M, PLAYER_X, PHYS, PLAYER, MODES, SKINS, SCORE, SURGE, MUSIC } from './config.js';
import { createWorld } from './world.js';
import { skyPalette, createBackdrop, drawSky, drawSkylines, drawRoof, drawDecor, drawSolid, drawDrone, drawPickup, drawVolt } from './draw.js';

const stage = document.getElementById('stage');
const params = new URLSearchParams(location.search);

// ---------- Sauvegarde propre au jeu ----------
const store = createStore('volt-rush', {
  version: 1,
  defaults: { skin: 'jeton', mode: 'normal', runs: 0, totalBolts: 0, totalMeters: 0, seenHint: false },
  // v0 = ancienne page « Dino Runner » : son record est déjà repris par la méta-progression
  migrate: (data) => {
    if (data) return data;
    return readRaw('dinoHighScore') ? { seenHint: true } : {};
  },
});

// ---------- Interface commune ----------
const gv = bootGame('volt-rush', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['Espace', 'icon:touch'], text: 'Sauter. Une 2e fois en l’air : double saut.' },
    { keys: ['↓', 'icon:chevronDown'], text: 'Plonger en l’air, glisser au sol (balaie vers le bas).' },
    { keys: ['icon:bolt'], text: 'Les boulons remplissent la jauge : Surcharge !' },
  ],
  music: MUSIC,
  onStart: startRun,
  onRestart: startRun,
  onPause: () => loop.pause(),
  onResume: () => {
    input.reset();
    loop.resume();
  },
});

// Assez d'horizon pour réagir à pleine vitesse : ~960 unités en paysage, 480 en portrait
const view = createCanvas(stage, { mode: 'stage', height: WORLD_H, minWidth: (w, h) => (w > h ? Math.min(980, 520 + (w / h) * 260) : 480) });
const input = createInput({
  surface: stage,
  view,
  bindings: { jump: ['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'pointer'], down: ['ArrowDown', 'KeyS'] },
});
const fx = { particles: new Particles(900), popups: new Popups(30), shake: new Shake({ maxOffset: 16 }), flash: new Flash() };
const tweens = new Tweens();
const backdrop = createBackdrop(11);
const squash = new Spring(1, { stiffness: 420, damping: 15 });

// ---------- État ----------
let world;
let mode = MODES[store.data.mode] ?? MODES.normal;
let state = 'attract'; // attract | run | dying | over
let time = 0;
let cameraX = 0;
let speed = mode.startSpeed;
const run = {};
const p = {};
let deathTimer = 0;
let dustTimer = 0;
let swipeUsed = false;
let bestAtStart = 0;
let inputLockUntil = 0; // la touche qui lance la partie ne doit pas aussi faire sauter

const skin = () => SKINS.find((s) => s.id === store.data.skin) ?? SKINS[0];
const bestScore = () => gv.best ?? 0;
const unlockedSkins = (best = bestScore()) => SKINS.filter((s) => best >= s.unlock);

function resetPlayer() {
  Object.assign(p, {
    x: PLAYER_X + 60,
    y: 280,
    vy: 0,
    vx: 0,
    onGround: true,
    standing: null,
    coyote: 0,
    buffer: 0,
    jumps: 0,
    cut: true,
    fastFall: false,
    sliding: false,
    slideT: 0,
    run: 0,
    rot: 0,
    spin: 0,
    flip: 1,
    sx: 1,
    sy: 1,
    blink: 0,
    blinkT: 2.5,
    mood: 'run',
    alive: true,
    jumpedAt: -1,
    jumpFromY: 0,
  });
  squash.set(1);
}

function resetRun() {
  Object.assign(run, {
    meters: 0,
    points: 0,
    bolts: 0,
    nearMisses: 0,
    smashes: 0,
    mult: 1,
    maxMult: 1,
    chain: 0,
    chainT: 0,
    surge: 0,
    surgeT: 0,
    time: 0,
    jumped: false,
    shownScore: -1,
  });
}

function resetWorld(seed) {
  world = createWorld(seed);
  resetPlayer();
  resetRun();
  speed = state === 'attract' ? 380 : mode.startSpeed;
  cameraX = p.x - PLAYER_X;
  world.generate(cameraX + 2600, speed, 0);
  fx.particles.clear();
  fx.popups.clear();
}

function startRun() {
  mode = MODES[store.data.mode] ?? MODES.normal;
  if (mode.unlock > bestScore()) mode = MODES.normal;
  state = 'run';
  resetWorld(Number(params.get('seed')) || Date.now());
  bestAtStart = bestScore();
  loop.timeScale = 1;
  tweens.clear();
  input.reset();
  inputLockUntil = performance.now() + 150;
  gv.hud('score', 0);
  gv.hud('best', formatInt(bestAtStart));
  loop.resume();
}

// ---------- Actions du joueur ----------
function jump() {
  if (p.onGround || p.coyote > 0) {
    p.vy = -PHYS.jumpV;
    p.jumpFromY = p.y;
    p.onGround = false;
    p.standing = null;
    p.coyote = 0;
    p.jumps = 1;
    p.cut = false;
    p.sliding = false;
    p.fastFall = false;
    p.jumpedAt = time;
    squash.set(1.28);
    dust(p.x + PLAYER.w / 2, p.y, 6, 140);
    gv.audio.play('jump');
    if (state === 'run' && !run.jumped) {
      run.jumped = true;
      if (!store.data.seenHint) {
        store.data.seenHint = true;
        store.saveSoon();
      }
    }
    return true;
  }
  if (p.jumps < 2) {
    p.vy = -PHYS.doubleJumpV;
    p.jumps = 2;
    p.cut = false;
    p.fastFall = false;
    p.flip = 0;
    squash.set(1.22);
    fx.particles.ring(p.x + PLAYER.w / 2, p.y - 6, { color: skin().body, size: 6, growth: 160, life: 0.3, lineWidth: 4 });
    fx.particles.emit(p.x + PLAYER.w / 2, p.y, { count: 10, colors: [skin().body, '#f4efe4'], speed: [80, 220], angle: Math.PI / 2, spread: 1.6, gravity: 300, size: [2, 4], life: [0.25, 0.45] });
    gv.audio.play('doubleJump');
    return true;
  }
  return false;
}

function down() {
  if (p.onGround) {
    if (!p.sliding) {
      gv.audio.play('whoosh', { pitch: 1.4, volume: 0.8 });
      squash.set(0.8);
    }
    p.sliding = true;
    p.slideT = PHYS.slideTime;
  } else if (!p.fastFall) {
    p.fastFall = true;
    p.vy = Math.max(p.vy, PHYS.fastFallV);
    gv.audio.play('whoosh', { pitch: 1.1, volume: 0.7 });
  }
}

// Sur mobile, balayer vers le bas juste après le tap : le saut se transforme en glissade
function jumpToSlide() {
  if (p.jumps === 1 && time - p.jumpedAt < 0.16 && Math.abs(p.y - p.jumpFromY) < 34) {
    p.y = p.jumpFromY;
    p.vy = 0;
    p.onGround = true;
    p.jumps = 0;
    p.cut = true;
  }
  down();
}

// ---------- Effets ----------
function dust(x, y, count, spread = 90) {
  fx.particles.emit(x, y - 2, { count, colors: ['#8d93b3', '#4a5175', '#c4c7dc'], speed: [30, spread], angle: -Math.PI / 2, spread: 2.6, gravity: -40, drag: 0.02, size: [3, 6], life: [0.25, 0.55], shape: 'circle' });
}

function addPoints(n, x, y, label, opts = {}) {
  const gain = Math.round(n * run.mult * mode.scoreMul);
  run.points += gain;
  if (label !== null) fx.popups.add(x, y, label ?? `+${gain}`, { size: 18 + run.mult * 2, color: run.mult > 1 ? '#ffc93c' : '#f4efe4', rise: 50, life: 0.7, ...opts });
  return gain;
}

function bumpChain(amount) {
  run.chain += amount;
  run.chainT = SCORE.chainTime;
  const m = Math.min(SCORE.maxMult, 1 + Math.floor(run.chain / SCORE.chainPerLevel));
  if (m > run.mult) {
    run.mult = m;
    run.maxMult = Math.max(run.maxMult, m);
    fx.popups.add(p.x + PLAYER.w / 2, p.y - 70, `×${m}`, { size: 44, color: '#3ee6a8', rise: 40, life: 0.9 });
    fx.particles.ring(p.x + PLAYER.w / 2, p.y - 20, { color: '#3ee6a8', size: 10, growth: 260, life: 0.35, lineWidth: 5 });
    gv.audio.play('combo', { pitch: 1 + m * 0.08 });
    if (m >= 5) gv.unlock('combo-5');
  }
}

function addSurge(amount) {
  if (run.surgeT > 0) return;
  run.surge = Math.min(1, run.surge + amount);
  if (run.surge >= 1) {
    run.surgeT = SURGE.duration;
    gv.banner('Surcharge !', { color: '#4cc3ff' });
    fx.flash.trigger('#4cc3ff', 0.35);
    fx.shake.add(0.3);
    gv.audio.play('powerup');
    p.mood = 'surge';
    if (state === 'run') gv.unlock('survolte');
  }
}

function collect(pk) {
  pk.alive = false;
  if (state !== 'run') return;
  if (pk.kind === 'battery') {
    addPoints(SCORE.battery, pk.x, pk.y - 10, 'Énergie !', { color: '#3ee6a8', size: 24 });
    addSurge(SURGE.perBattery);
    bumpChain(3);
    fx.particles.emit(pk.x, pk.y, { count: 22, colors: ['#3ee6a8', '#f4efe4'], speed: [120, 340], size: [3, 6], gravity: 400 });
    fx.particles.ring(pk.x, pk.y, { color: '#3ee6a8', size: 8, growth: 240 });
    gv.audio.play('pickup', { pitch: 0.8 });
    return;
  }
  run.bolts++;
  addPoints(SCORE.bolt, pk.x, pk.y - 8);
  addSurge(SURGE.perBolt);
  bumpChain(1);
  fx.particles.emit(pk.x, pk.y, { count: 8, colors: ['#ffc93c', '#fff3c4'], speed: [80, 220], size: [2, 4], gravity: 200, shape: 'spark', life: [0.2, 0.4] });
  gv.audio.play('coin', { pitch: 1 + Math.min(run.chain, 24) * 0.022, volume: 0.8 });
}

function nearMiss(ob) {
  if (state !== 'run') return;
  run.nearMisses++;
  addPoints(SCORE.nearMiss, ob.x + ob.w / 2, ob.y - 16, null);
  fx.popups.add(ob.x + ob.w / 2, ob.y - 14, 'Frôlé !', { size: 26, color: '#4cc3ff', rise: 60, life: 0.8 });
  bumpChain(3);
  addSurge(SURGE.perNearMiss);
  fx.shake.add(0.1);
  gv.audio.play('nearMiss');
  // Micro-ralenti : on sent le danger passer
  loop.timeScale = 0.55;
  tweens.cancel(loop);
  tweens.to(loop, { timeScale: 1 }, 0.25, { ease: Ease.inQuad });
  if (run.nearMisses >= 10) gv.unlock('frole-10');
}

function smash(ob, colors) {
  ob.alive = false;
  run.smashes++;
  const cx = ob.x + ob.w / 2;
  const cy = ob.y + ob.h / 2;
  addPoints(SCORE.smash, cx, ob.y - 10, 'Boum !', { color: '#ff5a4e', size: 30 });
  bumpChain(2);
  fx.particles.emit(cx, cy, { count: 26, colors, speed: [180, 520], size: [4, 9], gravity: 1200, spin: [-14, 14], life: [0.4, 0.9] });
  fx.particles.ring(cx, cy, { color: '#f4efe4', size: 8, growth: 340, life: 0.3, lineWidth: 5 });
  fx.shake.add(0.35);
  loop.hitstop(0.035);
  gv.audio.play('explode', { pitch: 1.4, volume: 0.6 });
  if (run.smashes >= 10) gv.unlock('casseur');
}

function die(cause) {
  if (state !== 'run' && state !== 'attract') return;
  if (state === 'attract') {
    resetWorld(Date.now());
    return;
  }
  state = 'dying';
  p.alive = false;
  p.mood = 'dead';
  p.sliding = false;
  deathTimer = 1.05;
  loop.hitstop(0.1);
  fx.shake.add(0.8);
  fx.flash.trigger('#ff5a4e', 0.4, 2.5);
  const cx = p.x + PLAYER.w / 2;
  const cy = p.y - 20;
  fx.particles.emit(cx, cy, { count: 34, colors: [skin().body, skin().deep, '#4cc3ff', '#f4efe4'], speed: [160, 520], size: [3, 8], gravity: 1100, life: [0.5, 1.1], spin: [-12, 12] });
  fx.particles.emit(cx, cy, { count: 16, color: '#4cc3ff', speed: [200, 600], shape: 'spark', gravity: 300, life: [0.2, 0.5] });
  fx.particles.ring(cx, cy, { color: '#ff5a4e', size: 10, growth: 420, life: 0.4, lineWidth: 7 });
  gv.audio.play('hit');
  if (cause !== 'fall') {
    p.vy = -620;
    p.vx = -160;
    p.spin = -1;
  }
  loop.timeScale = 0.3;
  tweens.to(loop, { timeScale: 1 }, 0.5, { delay: 0.3, ease: Ease.inQuad });
}

function finish() {
  state = 'over';
  loop.timeScale = 1;
  const score = Math.floor(run.points);
  const meters = Math.floor(run.meters);
  store.data.runs++;
  store.data.totalBolts += run.bolts;
  store.data.totalMeters += meters;
  store.save();
  if (mode.id === 'turbo' && score >= 3000) gv.unlock('turbo');

  const before = unlockedSkins(bestAtStart).length;
  const newBest = Math.max(bestAtStart, score);
  const next = [...SKINS, MODES.turbo].filter((u) => u.unlock > newBest).sort((a, b) => a.unlock - b.unlock)[0];
  gv.gameOver({
    score,
    stats: { score, bolts: run.bolts, nearMisses: run.nearMisses, distance: meters, smashes: run.smashes },
    extraStats: [
      { label: 'Distance', value: `${formatInt(meters)} m` },
      { label: 'Boulons', value: formatInt(run.bolts) },
      { label: 'Frôlés', value: formatInt(run.nearMisses) },
    ],
    kicker: mode.id === 'turbo' ? 'Mode Turbo · partie terminée' : 'Partie terminée',
    nextUnlock: next ? { label: next.name ? `Volt ${next.name}` : 'Mode Turbo', current: newBest, target: next.unlock } : undefined,
  });

  const unlocked = unlockedSkins(newBest);
  for (const s of unlocked.slice(before)) {
    if (s.unlock > 0) toast({ title: 'Nouvelle couleur !', text: `Volt ${s.name} t’attend dans le garage.`, iconName: 'sparkle', tone: s.body });
  }
  if (bestAtStart < MODES.turbo.unlock && newBest >= MODES.turbo.unlock) {
    toast({ title: 'Mode Turbo débloqué', text: 'Départ lancé, points ×1,5.', iconName: 'bolt', tone: 'var(--tomato)' });
  }
  if (unlocked.length === SKINS.length) gv.unlock('collection');
  gv.hud('best', formatInt(newBest));
  renderGarage();
}

// ---------- Pilote automatique (démo derrière l'écran d'accueil) ----------
function autopilot() {
  const front = p.x + PLAYER.w;
  const look = speed * 0.2;
  const groundAhead = world.roofAt(front + speed * 0.1);
  const cur = world.roofAt(p.x + PLAYER.w / 2);
  let wantJump = false;
  let wantSlide = false;
  if (p.onGround && (!groundAhead || (groundAhead !== cur && groundAhead.y < p.y - 4))) wantJump = true;
  for (const s of world.solids) {
    if (s.alive && s.x > front && s.x - front < look && p.onGround && s !== p.standing) wantJump = true;
  }
  for (const d of world.drones) {
    if (d.x > front && d.x - front < speed * 0.22 && p.onGround) wantSlide = true;
  }
  if (!p.onGround && p.jumps === 1 && p.vy > 0) {
    const below = world.roofAt(p.x + PLAYER.w / 2 + speed * 0.25);
    if (!below || below.y < p.y - 10) wantJump = true; // double saut de secours
  }
  return { wantJump, wantSlide };
}

// ---------- Physique ----------
function hitbox() {
  const h = p.sliding ? PLAYER.slideH : PLAYER.h;
  return { x: p.x + PLAYER.hitInset, y: p.y - h, w: PLAYER.w - PLAYER.hitInset * 2, h: h - 4 };
}

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function surfaceBelow(prevY, nowY) {
  const x0 = p.x + 8;
  const x1 = p.x + PLAYER.w - 8;
  let best = null;
  let obj = null;
  const test = (top, o) => {
    if (top >= prevY - 0.5 && top <= nowY + 0.5 && (best === null || top < best)) {
      best = top;
      obj = o;
    }
  };
  for (const r of world.roofs) if (x1 > r.x && x0 < r.x + r.w) test(r.y, r);
  for (const s of world.solids) if (s.alive && x1 > s.x && x0 < s.x + s.w) test(s.y, s);
  return best === null ? null : { y: best, obj };
}

function supported() {
  const x0 = p.x + 8;
  const x1 = p.x + PLAYER.w - 8;
  for (const r of world.roofs) if (x1 > r.x && x0 < r.x + r.w && Math.abs(r.y - p.y) < 1) return r;
  for (const s of world.solids) if (s.alive && x1 > s.x && x0 < s.x + s.w && Math.abs(s.y - p.y) < 1) return s;
  return null;
}

function land(surface) {
  const impact = p.vy;
  p.y = surface.y;
  p.vy = 0;
  p.onGround = true;
  p.standing = surface.obj;
  p.jumps = 0;
  p.fastFall = false;
  p.flip = 1;
  p.rot = 0;
  if (surface.obj.kind) surface.obj.stoodOn = true;
  const k = clamp(impact / 1200);
  squash.set(1 - 0.32 * k - 0.05);
  dust(p.x + PLAYER.w / 2, p.y, 3 + Math.round(k * 8), 60 + k * 120);
  gv.audio.play('land', { volume: 0.4 + k * 0.8 });
  if (impact > 950) fx.shake.add(0.12);
  if (p.buffer > 0) {
    p.buffer = 0;
    jump();
  }
}

function step(h) {
  if (state === 'dying') {
    p.vy += PHYS.gravity * h;
    p.y += p.vy * h;
    p.x += p.vx * h;
    p.rot += p.spin * 9 * h;
    return;
  }

  // Défilement
  p.x += speed * h;
  run.meters += (speed * h) / UNITS_PER_M;
  if (state === 'run') run.points += ((speed * h) / UNITS_PER_M) * SCORE.perMeter * mode.scoreMul;

  // Vertical
  if (p.onGround) {
    const s = supported();
    if (!s) {
      p.onGround = false;
      p.standing = null;
      p.coyote = PHYS.coyote;
      p.sliding = false;
    } else p.standing = s;
  }
  if (!p.onGround) {
    p.coyote -= h;
    p.vy += PHYS.gravity * h * (p.fastFall ? 1.45 : 1);
    const prevY = p.y;
    p.y += p.vy * h;
    if (p.vy >= 0) {
      const s = surfaceBelow(prevY, p.y);
      if (s) land(s);
    }
  }

  // Collisions
  const hb = hitbox();
  for (const r of world.roofs) {
    if (r === p.standing) continue;
    if (hb.x + hb.w > r.x && hb.x < r.x + r.w && hb.y + hb.h > r.y + 3) {
      if (run.surgeT > 0) {
        p.y = r.y;
        p.vy = -PHYS.jumpV * 0.6;
        p.onGround = false;
        fx.particles.emit(p.x + PLAYER.w, p.y, { count: 10, color: '#4cc3ff', shape: 'spark', speed: [100, 300] });
      } else return die('wall');
    }
  }
  for (const s of world.solids) {
    if (!s.alive || s === p.standing) continue;
    if (overlap(hb, s)) {
      if (run.surgeT > 0) smash(s, s.kind === 'relay' ? ['#353b58', '#4a5175', '#ff5a4e'] : ['#ff5a4e', '#ffc93c', '#b8281f']);
      else return die('solid');
    }
  }
  for (const d of world.drones) {
    if (!d.alive) continue;
    const box = { x: d.x + 2, y: d.y + Math.sin(time * 5 + d.phase) * 3, w: d.w - 4, h: d.h };
    if (overlap(hb, box)) {
      if (run.surgeT > 0) smash(d, ['#4a5175', '#c4c7dc', '#ff5a4e']);
      else return die('drone');
    }
  }

  // Frôlements : plus petite distance verticale pendant le passage au-dessus/au-dessous
  for (const list of [world.solids, world.drones]) {
    for (const o of list) {
      if (!o.alive || o.passed) continue;
      if (hb.x + hb.w > o.x - 2 && hb.x < o.x + o.w + 2) {
        const c = Math.max(o.y - (hb.y + hb.h), hb.y - (o.y + o.h));
        if (c >= 0) o.clear = Math.min(o.clear, c);
      } else if (o.x + o.w < hb.x) {
        o.passed = true;
        if (o.clear < 14 && !o.stoodOn) nearMiss(o);
      }
    }
  }

  // Chute dans le vide
  if (p.y > WORLD_H + 50) {
    if (run.surgeT > 0) {
      p.y = WORLD_H + 50;
      p.vy = -1150;
      p.jumps = 1;
      fx.particles.emit(p.x + PLAYER.w / 2, p.y - 10, { count: 20, color: '#4cc3ff', shape: 'spark', speed: [150, 420], angle: -Math.PI / 2, spread: 1.4 });
      gv.audio.play('doubleJump', { pitch: 0.7 });
    } else die('fall');
  }
}

// ---------- Boucle ----------
function update(dt, realDt) {
  time += realDt;
  tweens.update(realDt);
  squash.update(realDt);
  fx.shake.update(realDt);
  fx.flash.update(realDt);
  fx.particles.update(dt);
  fx.popups.update(dt);

  if (state === 'over') {
    input.endFrame();
    return;
  }

  // Entrées
  if (state === 'run' && gv.playing && performance.now() > inputLockUntil) {
    if (input.pressed('jump')) {
      swipeUsed = false;
      if (!jump()) p.buffer = PHYS.buffer;
    }
    const ptr = input.pointer;
    if (ptr.down && !swipeUsed && ptr.y - ptr.startY > 26 && performance.now() - ptr.startTime < 350) {
      swipeUsed = true;
      jumpToSlide();
    }
    if (input.pressed('down')) down();
    if (input.down('down') && p.sliding) p.slideT = Math.max(p.slideT, 0.12);
    if (!input.down('jump') && !p.cut && p.vy < -220) {
      p.vy *= PHYS.jumpCut;
      p.cut = true;
    }
  } else if (state === 'attract') {
    const ai = autopilot();
    if (ai.wantJump) jump();
    if (ai.wantSlide) down();
  }
  input.endFrame();

  if (state === 'run' && !gv.playing) return;

  // Vitesse : montée progressive, coup de fouet en Surcharge
  if (state !== 'dying') {
    const base = mode.startSpeed + (mode.maxSpeed - mode.startSpeed) * Ease.outQuad(clamp(run.meters / 2200));
    speed = state === 'attract' ? 380 : base * (run.surgeT > 0 ? SURGE.speedBoost : 1);
  }

  // Simulation en sous-pas pour des collisions fiables à haute vitesse
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps && (state === 'run' || state === 'attract' || state === 'dying'); i++) step(h);

  // Timers
  if (p.buffer > 0) p.buffer -= dt;
  if (p.sliding) {
    p.slideT -= dt;
    if (p.slideT <= 0) p.sliding = false;
    if (Math.random() < 0.6) fx.particles.emit(p.x + 6, p.y - 2, { count: 1, colors: ['#ffc93c', '#ff8a5b'], speed: [60, 160], angle: -Math.PI + 0.4, spread: 0.6, gravity: 500, shape: 'spark', life: [0.15, 0.3] });
  }
  if (p.onGround && !p.sliding) p.run += dt * (speed / 22);
  p.blinkT -= dt;
  if (p.blinkT <= 0) {
    p.blink = 0.12;
    p.blinkT = 2 + Math.random() * 3;
  }
  if (p.blink > 0) p.blink -= dt;
  if (p.alive) p.mood = run.surgeT > 0 ? 'surge' : p.onGround ? 'run' : 'jump';
  const sy = squash.value;
  p.sy = sy;
  p.sx = 1 + (1 - sy) * 0.8;
  // Vrille du double saut : un tour complet, puis stabilisé
  if (p.alive && p.flip < 1) {
    p.flip = Math.min(1, p.flip + dt * 2.8);
    p.rot = TAU * Ease.outCubic(p.flip);
    if (p.flip >= 1) p.rot = 0;
  }

  // Poussière de course
  if (p.onGround && state !== 'dying') {
    dustTimer -= dt;
    if (dustTimer <= 0) {
      dustTimer = 0.09;
      fx.particles.emit(p.x + 10, p.y - 1, { count: 1, color: '#4a5175', speed: [20, 50], angle: -Math.PI + 0.3, spread: 0.6, gravity: -30, size: [2, 4], life: [0.2, 0.35], shape: 'circle' });
    }
  }

  if (state === 'run' || state === 'attract') {
    // Boulons (aimantés en Surcharge)
    const cx = p.x + PLAYER.w / 2;
    const cy = p.y - (p.sliding ? 10 : 20);
    for (const pk of world.pickups) {
      if (!pk.alive || pk.x > cx + 400) continue;
      const dx = cx - pk.x;
      const dy = cy - pk.y;
      const d2 = dx * dx + dy * dy;
      if (run.surgeT > 0 && d2 < SURGE.magnet * SURGE.magnet) {
        const d = Math.sqrt(d2) || 1;
        pk.x += (dx / d) * 700 * dt;
        pk.y += (dy / d) * 700 * dt;
      }
      if (d2 < 26 * 26) collect(pk);
    }

    // Chaîne et Surcharge
    if (run.chainT > 0) {
      run.chainT -= dt;
      if (run.chainT <= 0) {
        if (run.mult > 1 && state === 'run') fx.popups.add(p.x + PLAYER.w / 2, p.y - 60, 'Combo perdu', { size: 16, color: '#8d93b3', life: 0.7 });
        run.chain = 0;
        run.mult = 1;
      }
    }
    if (run.surgeT > 0) {
      run.surgeT -= dt;
      run.surge = Math.max(0, run.surgeT / SURGE.duration);
      fx.particles.emit(p.x + 4, p.y - 18, { count: 2, colors: ['#4cc3ff', '#f4efe4'], speed: [40, 140], angle: Math.PI, spread: 1.2, gravity: 0, shape: 'spark', life: [0.15, 0.35] });
      if (run.surgeT <= 0) {
        run.surge = 0;
        fx.popups.add(p.x + PLAYER.w / 2, p.y - 60, 'Fin de surcharge', { size: 16, color: '#4cc3ff', life: 0.7 });
      }
    }

    if (state === 'run') {
      if (run.meters >= 100) gv.unlock('cent-metres');
      if (run.meters >= 1000) gv.unlock('kilometre');
      if (run.meters >= 400 && run.bolts === 0) gv.unlock('sobre');
      run.time += dt;
      const shown = Math.floor(run.points);
      if (shown !== run.shownScore) {
        run.shownScore = shown;
        gv.hud('score', formatInt(shown));
      }
    }

    cameraX = p.x - PLAYER_X;
    const d = clamp(run.meters / 1500);
    world.generate(cameraX + view.width + 1400, speed, state === 'attract' ? 0.3 : d);
    world.prune(cameraX - 300);
  }

  if (state === 'dying') {
    deathTimer -= realDt;
    if (deathTimer <= 0) finish();
  }
}

// ---------- Rendu ----------
// Ordonnée écran du haut de la bande jouable : les toits se placent vers 72 % de la hauteur,
// les façades descendent jusqu'en bas (utile en portrait, où l'écran est très haut)
const worldTop = () => clamp(view.height * 0.72 - 280, 0, view.height - WORLD_H);

function render() {
  const ctx = view.begin();
  const pal = skyPalette(run.meters ?? 0);
  const y0 = worldTop();
  drawSky(ctx, view, pal, time, backdrop, y0 + WORLD_H, cameraX);
  drawSkylines(ctx, view, pal, cameraX, backdrop, y0 + WORLD_H);

  ctx.save();
  fx.shake.apply(ctx, view.width / 2, view.height / 2);
  ctx.translate(-cameraX, y0);
  const x0 = cameraX - 80;
  const x1 = cameraX + view.width + 80;

  for (const d of world.decor) if (d.x > x0 && d.x < x1) drawDecor(ctx, d, pal);
  for (const r of world.roofs) if (r.x < x1 && r.x + r.w > x0) drawRoof(ctx, r, pal, x0, x1, view.height - y0);
  for (const s of world.solids) if (s.alive && s.x < x1 && s.x + s.w > x0) drawSolid(ctx, s, time);
  for (const d of world.drones) if (d.alive && d.x < x1 && d.x + d.w > x0) drawDrone(ctx, d, time, world.roofAt(d.x + d.w / 2)?.y);
  for (const pk of world.pickups) if (pk.alive && pk.x < x1 && pk.x > x0) drawPickup(ctx, pk, time);

  // Ombre de Volt sur le toit
  const under = world.roofAt(p.x + PLAYER.w / 2);
  if (under && p.alive) {
    const hgt = clamp((under.y - p.y) / 160);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x + PLAYER.w / 2, under.y + 1, 15 * (1 - hgt * 0.5), 3.5, 0, 0, TAU);
    ctx.fill();
  }
  drawVolt(ctx, p, skin(), time);
  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  ctx.restore();

  // Lignes de vitesse
  const fast = clamp((speed - 520) / 300) + (run.surgeT > 0 ? 0.6 : 0);
  if (fast > 0 && state !== 'over') {
    ctx.strokeStyle = run.surgeT > 0 ? '#4cc3ff' : '#f4efe4';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const yy = ((i * 61) % (view.height - 40)) + 20;
      const xx = view.width - (((time * (900 + i * 120)) + i * 233) % (view.width + 200));
      ctx.globalAlpha = 0.08 * fast * (0.5 + (i % 3) * 0.25);
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx + 60 + i * 6, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (run.surgeT > 0) {
    const g = ctx.createRadialGradient(view.width / 2, view.height / 2, Math.min(view.width, view.height) * 0.35, view.width / 2, view.height / 2, Math.max(view.width, view.height) * 0.75);
    g.addColorStop(0, 'rgba(76,195,255,0)');
    g.addColorStop(1, `rgba(76,195,255,${0.18 + 0.06 * Math.sin(time * 12)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.width, view.height);
  }
  fx.flash.draw(ctx, view.width, view.height);

  if (state === 'run' || state === 'dying') drawHud(ctx);
  if (state === 'run' && !run.jumped && !store.data.seenHint) drawHint(ctx);
}

function drawHud(ctx) {
  const m = 14;
  // Jauge de Surcharge
  ctx.save();
  ctx.translate(m, m);
  ctx.fillStyle = 'rgba(11,12,20,0.78)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 168, 34, 10);
  ctx.fill();
  const full = run.surgeT > 0;
  ctx.fillStyle = full ? '#4cc3ff' : '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(15, 7);
  ctx.lineTo(9, 18);
  ctx.lineTo(14, 18);
  ctx.lineTo(12, 27);
  ctx.lineTo(20, 15);
  ctx.lineTo(15, 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#05060b';
  ctx.beginPath();
  ctx.roundRect(28, 12, 128, 10, 5);
  ctx.fill();
  const v = run.surge;
  if (v > 0) {
    ctx.fillStyle = full ? (Math.sin(time * 20) > 0 ? '#4cc3ff' : '#9ddcff') : '#ffc93c';
    ctx.beginPath();
    ctx.roundRect(29, 13, Math.max(8, 126 * v), 8, 4);
    ctx.fill();
  }
  ctx.restore();

  // Multiplicateur et minuteur de chaîne
  if (run.mult > 1 || run.chain > 0) {
    ctx.save();
    ctx.translate(m + 186, m + 17);
    ctx.fillStyle = 'rgba(11,12,20,0.78)';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3ee6a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(run.chainT / SCORE.chainTime));
    ctx.stroke();
    ctx.fillStyle = run.mult > 1 ? '#3ee6a8' : '#8d93b3';
    ctx.font = '900 17px "Big Shoulders Display", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${run.mult}`, 0, 1);
    ctx.restore();
  }

  // Distance
  ctx.save();
  ctx.font = '700 13px Silkscreen, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(11,12,20,0.6)';
  const label = `${formatInt(run.meters)} m`;
  const tw = ctx.measureText(label).width;
  ctx.beginPath();
  ctx.roundRect(view.width - m - tw - 20, m, tw + 20, 26, 8);
  ctx.fill();
  ctx.fillStyle = '#f4efe4';
  ctx.fillText(label, view.width - m - 10, m + 7);
  ctx.restore();
}

function drawHint(ctx) {
  const a = 0.6 + 0.4 * Math.sin(time * 6);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = '900 22px "Big Shoulders Display", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4efe4';
  ctx.strokeStyle = '#05060b';
  ctx.lineWidth = 5;
  const x = PLAYER_X + PLAYER.w / 2 + 40;
  const y = worldTop() + p.y - 80;
  const text = matchMedia('(pointer: coarse)').matches ? 'TOUCHE POUR SAUTER' : 'ESPACE POUR SAUTER';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------- Garage (écran d'accueil) ----------
function miniVolt(s, locked) {
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="11" width="30" height="24" rx="8" fill="${s.deep}"/><rect x="5" y="8" width="30" height="24" rx="8" fill="${s.body}"/><rect x="10" y="13" width="20" height="13" rx="4" fill="#11131f"/><rect x="14" y="16" width="3.5" height="6.5" rx="1.7" fill="${s.eye}"/><rect x="22.5" y="16" width="3.5" height="6.5" rx="1.7" fill="${s.eye}"/><path d="M20 8l2-6" stroke="#11131f" stroke-width="2.5" stroke-linecap="round"/>${locked ? '<rect width="40" height="40" fill="#0b0c14" opacity=".55"/>' : ''}</svg>`;
}

function renderGarage() {
  const best = bestScore();
  const host = gv.shell.startExtra;
  host.innerHTML = `
    <div class="vr-garage">
      <div class="vr-row">
        <span class="vr-label" id="vr-mode-label">Mode</span>
        <div class="vr-modes" role="radiogroup" aria-labelledby="vr-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const locked = best < m.unlock;
              return `<button type="button" role="radio" class="vr-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}" ${locked ? 'aria-disabled="true"' : ''}>
                ${locked ? icon('lock') : m.id === 'turbo' ? icon('bolt') : icon('play')}<span>${m.label}</span>
                ${locked ? `<small>${formatInt(m.unlock)} pts</small>` : m.id === 'turbo' ? '<small>points ×1,5</small>' : ''}
              </button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="vr-row">
        <span class="vr-label" id="vr-skin-label">Couleur</span>
        <div class="vr-skins" role="radiogroup" aria-labelledby="vr-skin-label">
          ${SKINS.map((s) => {
            const locked = best < s.unlock;
            const label = locked ? `${s.name}, débloquée à ${formatInt(s.unlock)} points` : s.name;
            return `<button type="button" role="radio" class="vr-skin" data-skin="${s.id}" aria-checked="${store.data.skin === s.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}>${miniVolt(s, locked)}${locked ? `<span class="vr-skin__lock">${icon('lock')}</span>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="vr-garage__hint" id="vr-hint" aria-live="polite"></p>
    </div>`;
}

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const hint = document.getElementById('vr-hint');
  if (b.getAttribute('aria-disabled') === 'true') {
    const t = b.dataset.skin ? SKINS.find((s) => s.id === b.dataset.skin) : MODES[b.dataset.mode];
    hint.textContent = `Atteins ${formatInt(t.unlock)} points pour débloquer ${b.dataset.skin ? `Volt ${t.name}` : 'le mode Turbo'}.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.skin) store.data.skin = b.dataset.skin;
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  store.save();
  gv.audio.play('select');
  renderGarage();
  document.querySelector(b.dataset.skin ? `[data-skin="${b.dataset.skin}"]` : `[data-mode="${b.dataset.mode}"]`)?.focus();
});

// ---------- Démarrage ----------
// Coût moyen d'une image (logique + rendu), suivi pour les tests de performance
let frameMs = 0;
let frameStart = 0;
const loop = createLoop({
  update(dt, realDt) {
    frameStart = performance.now();
    update(dt, realDt);
  },
  render(realDt) {
    render(realDt);
    frameMs = frameMs * 0.95 + (performance.now() - frameStart) * 0.05;
  },
  onAutoPause() {
    if (state === 'run' && gv.playing) gv.pause();
  },
});

// Accès de test : état lisible par Playwright
window.__voltRush = {
  get state() { return state; },
  get run() { return run; },
  get player() { return p; },
  get world() { return world; },
  get speed() { return speed; },
  get frameMs() { return frameMs; },
  surge: () => addSurge(1),
};

state = 'attract';
resetWorld(42);
gv.hud('best', formatInt(bestScore()));
renderGarage();
document.fonts?.load('900 20px "Big Shoulders Display"').catch(() => {});
loop.start();
gv.showStart();
