// Plume — un oiseau en origami traverse un livre pop-up. Un tap = un battement d'ailes.
// Passages parfaits et frôlements font monter le multiplicateur ; chaque chapitre change de monde.

import { bootGame } from '../../shared/js/gameverse.js';
import * as meta from '../../shared/js/meta.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { createInput } from '../../shared/js/engine/input.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { Spring, Tweens, Ease } from '../../shared/js/core/tween.js';
import { TAU, clamp, lerp, formatInt } from '../../shared/js/core/math.js';
import { mixPalette } from '../../shared/js/core/color.js';
import { createStore, readRaw } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { WORLD_H, GROUND, BIRD_X, BIRD_R, PHYS, GATE, SCORE, CHAPTERS, MODES, SKINS, MUSIC } from './config.js';
import { createWorld, gapAt } from './world.js';
import { createScenery, drawBackground, drawGate, drawLanternGlow, drawGround, drawStar, drawShieldBubble, drawWind, drawBird, drawPageTurn } from './draw.js';

const stage = document.getElementById('stage');
const params = new URLSearchParams(location.search);

const store = createStore('plume', {
  version: 1,
  defaults: { skin: 'creme', mode: 'normal', runs: 0, totalStars: 0, seenHint: false, legacyConverted: false },
});

// L'ancien Flappy comptait 1 point par tuyau ; le nouveau barème donne 10 points par falaise
if (!store.data.legacyConverted) {
  const old = parseInt(readRaw('flappyBestScore'), 10);
  const g = meta.gameStats('plume');
  if (Number.isFinite(old) && old > 0 && (g.best === null || g.best <= old)) {
    g.best = old * 10;
    meta.save();
  }
  store.data.legacyConverted = true;
  if (Number.isFinite(old) && old > 0) store.data.seenHint = true;
  store.save();
}

const gv = bootGame('plume', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['Espace', 'icon:touch'], text: 'Battre des ailes.' },
    { keys: ['icon:target'], text: 'Passe au centre : « Parfait ! », le multiplicateur grimpe.' },
    { keys: ['icon:star'], text: 'Étoiles = points bonus. Bulle bleue = un choc pardonné.' },
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

const view = createCanvas(stage, { mode: 'stage', height: WORLD_H, minWidth: (w, h) => (w > h ? 760 : 380) });
const input = createInput({ surface: stage, view, bindings: { flap: ['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'pointer'] } });
const fx = { particles: new Particles(700), popups: new Popups(30), shake: new Shake({ maxOffset: 14 }), flash: new Flash() };
const tweens = new Tweens();
const scenery = createScenery(9);
const squash = new Spring(1, { stiffness: 380, damping: 14 });

let world;
let mode = MODES[store.data.mode] ?? MODES.normal;
let state = 'attract'; // attract | run | dying | over
let time = 0;
let cameraX = 0;
let speed = 170;
let deathTimer = 0;
let inputLockUntil = 0;
let bestAtStart = 0;
const bird = {};
const run = {};
// Palette : transition douce d'un chapitre à l'autre, avec un tourne-page
const pal = { from: CHAPTERS[0], to: CHAPTERS[0], t: 1, turn: 0, current: null };

const skin = () => SKINS.find((s) => s.id === store.data.skin) ?? SKINS[0];
const bestScore = () => gv.best ?? 0;
const unlockedSkins = (best = bestScore()) => SKINS.filter((s) => best >= s.unlock);

function resetBird() {
  Object.assign(bird, { x: BIRD_X, y: GROUND * 0.45, vy: 0, rot: 0, flap: 0, sx: 1, sy: 1, dead: false, shield: false, invuln: 0, blink: 0, blinkT: 2, restT: 0 });
  squash.set(1);
}

function resetRun() {
  Object.assign(run, { points: 0, gates: 0, perfects: 0, nearMisses: 0, stars: 0, streak: 0, chain: 0, mult: 1, maxChapter: 0, shownScore: -1, flaps: 0, flapped: false });
}

function setChapter(index, instant) {
  const next = CHAPTERS[index];
  if (instant) {
    pal.from = pal.to = next;
    pal.t = 1;
    pal.turn = 0;
    return;
  }
  pal.from = currentPalette();
  pal.to = next;
  pal.t = 0;
  pal.turn = 0.0001;
}

// Palette numérique d'un chapitre (obscurité et étoiles en 0..1 pour pouvoir les mélanger)
const paletteCache = new Map();
function paletteVals(ch) {
  if (!ch.id) return ch; // déjà une palette mélangée
  if (!paletteCache.has(ch.id)) paletteCache.set(ch.id, { ...ch, dark: ch.dark ? 1 : 0, starAlpha: ch.dark ? 1 : 0.05 });
  return paletteCache.get(ch.id);
}

function currentPalette() {
  if (pal.t >= 1) return paletteVals(pal.to);
  const m = mixPalette(paletteVals(pal.from), paletteVals(pal.to), Ease.inOutQuad(pal.t));
  delete m.id; // palette intermédiaire : ne doit pas être confondue avec un chapitre
  return m;
}

function resetWorld(seed, startChapter) {
  world = createWorld(seed, startChapter);
  resetBird();
  resetRun();
  cameraX = bird.x - BIRD_X;
  world.generate(cameraX + view.width + 900);
  fx.particles.clear();
  fx.popups.clear();
  setChapter(startChapter, true);
}

function startRun() {
  mode = MODES[store.data.mode] ?? MODES.normal;
  if (mode.unlock > bestScore()) mode = MODES.normal;
  state = 'run';
  resetWorld(Number(params.get('seed')) || Date.now(), mode.chapter);
  bestAtStart = bestScore();
  loop.timeScale = 1;
  tweens.clear();
  input.reset();
  inputLockUntil = performance.now() + 150;
  gv.hud('score', 0);
  gv.hud('best', formatInt(bestAtStart));
  loop.resume();
}

// ---------- Actions ----------
function flap() {
  bird.vy = -PHYS.flapV;
  bird.flap = 1;
  squash.set(1.18);
  run.flaps++;
  gv.audio.play('flap', { pitch: 0.95 + Math.random() * 0.15 });
  fx.particles.emit(bird.x - 14, bird.y + 4, { count: 3, colors: [skin().body, skin().wing], speed: [40, 120], angle: Math.PI * 0.8, spread: 1, gravity: 300, shape: 'square', size: [2, 4], life: [0.3, 0.6] });
  if (state === 'run' && !run.flapped) {
    run.flapped = true;
    store.data.seenHint = true;
  }
}

function bumpChain() {
  run.chain++;
  const m = Math.min(SCORE.maxMult, 1 + Math.floor(run.chain / SCORE.chainPerLevel));
  if (m > run.mult) {
    run.mult = m;
    fx.popups.add(bird.x + 10, bird.y - 60, `×${m}`, { size: 40, color: '#3ee6a8', rise: 40, life: 0.9 });
    fx.particles.ring(bird.x, bird.y, { color: '#3ee6a8', size: 8, growth: 220, life: 0.35, lineWidth: 5 });
    gv.audio.play('combo', { pitch: 1 + m * 0.08 });
  }
}

function breakChain() {
  if (run.mult > 1) fx.popups.add(bird.x + 10, bird.y - 46, 'Combo perdu', { size: 15, color: '#8d93b3', life: 0.7, rise: 30 });
  run.chain = 0;
  run.mult = 1;
}

function gain(n) {
  const g = Math.round(n * run.mult * mode.scoreMul);
  run.points += g;
  return g;
}

function passGate(g) {
  g.passed = true;
  if (state !== 'run') return;
  run.gates++;
  const gy = gapAt(g, time);
  const offset = Math.abs(bird.y - gy) / (g.h / 2);
  const perfect = offset < GATE.perfectBand;
  const near = !perfect && g.clear < GATE.nearMiss;
  if (perfect) {
    run.perfects++;
    run.streak++;
    bumpChain();
    const pts = gain(SCORE.gate + SCORE.perfect);
    fx.popups.add(g.x + g.w / 2, gy - 30, `Parfait ! +${pts}`, { size: 24, color: '#3ee6a8', rise: 50 });
    fx.particles.emit(g.x + g.w, gy, { count: 14, colors: ['#3ee6a8', '#fff6e8', '#ffc93c'], speed: [80, 240], size: [3, 6], gravity: 200, shape: 'star', life: [0.4, 0.8] });
    gv.audio.play('perfect', { pitch: 1 + Math.min(run.streak, 10) * 0.04 });
    if (run.perfects >= 10) gv.unlock('parfait-10');
    if (run.streak >= 5) gv.unlock('origami');
  } else if (near) {
    run.nearMisses++;
    run.streak = 0;
    bumpChain();
    const pts = gain(SCORE.gate + SCORE.nearMiss);
    fx.popups.add(g.x + g.w / 2, gy - 30, `Frôlé ! +${pts}`, { size: 22, color: '#4cc3ff', rise: 50 });
    gv.audio.play('nearMiss');
    fx.shake.add(0.1);
    loop.timeScale = 0.55;
    tweens.cancel(loop);
    tweens.to(loop, { timeScale: 1 }, 0.25, { ease: Ease.inQuad });
  } else {
    run.streak = 0;
    breakChain();
    const pts = gain(SCORE.gate);
    fx.popups.add(g.x + g.w / 2, gy - 24, `+${pts}`, { size: 18, life: 0.6, rise: 40 });
    gv.audio.play('tick', { pitch: 1.3 });
  }
  if (run.gates >= 10) gv.unlock('envol');

  // Changement de chapitre : on tourne la page
  if (run.gates % GATE.perChapter === 0) {
    const idx = world.chapterOf(run.gates);
    const ch = CHAPTERS[idx];
    setChapter(idx, false);
    run.maxChapter = Math.max(run.maxChapter, ch.n);
    gv.audio.play('whoosh', { pitch: 0.8 });
    fx.popups.add(bird.x + view.width * 0.3, 210, `Chapitre ${Math.floor(run.gates / GATE.perChapter) + 1 + mode.chapter}`, { size: 22, color: '#fff6e8', rise: 10, life: 2 });
    fx.popups.add(bird.x + view.width * 0.3, 246, ch.name, { size: 46, color: '#fff6e8', rise: 10, life: 2 });
    if (ch.id === 'foret') gv.unlock('foret');
    if (ch.id === 'nuit') gv.unlock('nuit');
    if (ch.id === 'tempete') gv.unlock('tempete');
  }
}

let immortal = false; // réservé aux tests (captures de chaque chapitre)

function hit(g) {
  if (bird.invuln > 0 || immortal) return;
  if (bird.shield) {
    bird.shield = false;
    bird.invuln = 1.2;
    const gy = g ? gapAt(g, time) : GROUND / 2;
    bird.vy = Math.sign(gy - bird.y || -1) * 430;
    fx.particles.ring(bird.x, bird.y, { color: '#4cc3ff', size: 14, growth: 300, life: 0.4, lineWidth: 6 });
    fx.particles.emit(bird.x, bird.y, { count: 16, color: '#4cc3ff', shape: 'circle', speed: [100, 300], size: [2, 5], gravity: 0 });
    fx.shake.add(0.3);
    loop.hitstop(0.05);
    gv.audio.play('pop', { pitch: 0.7 });
    fx.popups.add(bird.x, bird.y - 40, 'Ouf !', { size: 26, color: '#4cc3ff' });
    return;
  }
  die();
}

function die() {
  if (state === 'attract') {
    resetWorld(Date.now(), 0);
    return;
  }
  if (state !== 'run') return;
  state = 'dying';
  bird.dead = true;
  deathTimer = 1.05;
  loop.hitstop(0.1);
  fx.shake.add(0.75);
  fx.flash.trigger('#ff5a4e', 0.35, 2.5);
  // Le papier se froisse et vole en morceaux
  fx.particles.emit(bird.x, bird.y, { count: 26, colors: [skin().body, skin().wing, '#ffffff'], speed: [120, 420], size: [3, 8], gravity: 900, spin: [-12, 12], life: [0.6, 1.2], shape: 'square' });
  fx.particles.ring(bird.x, bird.y, { color: '#ff5a4e', size: 10, growth: 360, life: 0.4, lineWidth: 6 });
  gv.audio.play('hit');
  squash.set(0.55);
  bird.vy = -260;
  loop.timeScale = 0.3;
  tweens.to(loop, { timeScale: 1 }, 0.5, { delay: 0.3, ease: Ease.inQuad });
}

function finish() {
  state = 'over';
  loop.timeScale = 1;
  const score = Math.floor(run.points);
  store.data.runs++;
  store.data.totalStars += run.stars;
  store.save();
  if (store.data.totalStars >= 100) gv.unlock('etoiles-100');
  if (mode.id === 'tempete' && score >= 1500) gv.unlock('mode-tempete');
  const before = unlockedSkins(bestAtStart).length;
  const newBest = Math.max(bestAtStart, score);
  const next = [...SKINS, MODES.tempete].filter((u) => u.unlock > newBest).sort((a, b) => a.unlock - b.unlock)[0];
  const chapterNum = Math.floor(run.gates / GATE.perChapter) + 1 + mode.chapter;
  gv.gameOver({
    score,
    stats: { score, perfects: run.perfects, stars: run.stars, chapter: run.maxChapter || CHAPTERS[mode.chapter].n, gates: run.gates },
    extraStats: [
      { label: 'Falaises', value: formatInt(run.gates) },
      { label: 'Parfaits', value: formatInt(run.perfects) },
      { label: 'Chapitre', value: String(chapterNum) },
    ],
    kicker: mode.id === 'tempete' ? 'Mode Tempête · fin du voyage' : 'Fin du voyage',
    nextUnlock: next ? { label: next.name && next.body ? `Papier ${next.name}` : 'Mode Tempête', current: newBest, target: next.unlock } : undefined,
  });
  const unlocked = unlockedSkins(newBest);
  for (const s of unlocked.slice(before)) if (s.unlock > 0) toast({ title: 'Nouveau papier !', text: `Plume ${s.name} est prête à s’envoler.`, iconName: 'sparkle', tone: s.wing });
  if (bestAtStart < MODES.tempete.unlock && newBest >= MODES.tempete.unlock) toast({ title: 'Mode Tempête débloqué', text: 'Départ au cœur de l’orage, points ×1,5.', iconName: 'bolt', tone: 'var(--sky)' });
  if (unlocked.length === SKINS.length) gv.unlock('collection');
  gv.hud('best', formatInt(newBest));
  renderAtelier();
}

// ---------- Pilote automatique (démo) ----------
function autopilot() {
  const next = world.gates.find((g) => g.x + g.w > bird.x - BIRD_R);
  const target = next ? gapAt(next, time) + 12 : GROUND / 2;
  if (bird.y > target && bird.vy > -60) flap();
}

// ---------- Physique ----------
function circleRect(cx, cy, r, x, y, w, h) {
  const nx = clamp(cx, x, x + w);
  const ny = clamp(cy, y, y + h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

function step(h) {
  if (state === 'dying' || state === 'over') {
    if (bird.y + BIRD_R < GROUND) {
      bird.vy = Math.min(bird.vy + PHYS.gravity * h, PHYS.maxFall);
      bird.y = Math.min(bird.y + bird.vy * h, GROUND - BIRD_R + 4);
      bird.rot += h * 7;
    }
    return;
  }
  bird.x += speed * h;
  bird.vy += PHYS.gravity * h;
  for (const z of world.winds) {
    if (bird.x > z.x0 && bird.x < z.x1) bird.vy += z.force * h;
  }
  bird.vy = Math.min(bird.vy, PHYS.maxFall);
  bird.y += bird.vy * h;
  if (bird.y < BIRD_R + 2) {
    bird.y = BIRD_R + 2;
    bird.vy = Math.max(0, bird.vy);
  }
  if (bird.y + BIRD_R > GROUND) {
    if (bird.shield || bird.invuln > 0 || state === 'attract' || immortal) {
      if (state === 'attract') return die();
      bird.y = GROUND - BIRD_R;
      bird.vy = -PHYS.flapV * 1.05;
      if (bird.shield) hit(null);
    } else return die();
  }
  for (const g of world.gates) {
    if (g.x > bird.x + BIRD_R + 2 || g.x + g.w < bird.x - BIRD_R - 2) {
      if (!g.passed && bird.x - BIRD_R > g.x + g.w) passGate(g);
      continue;
    }
    const gy = gapAt(g, time);
    const top = gy - g.h / 2;
    const bot = gy + g.h / 2;
    if (circleRect(bird.x, bird.y, BIRD_R, g.x, -500, g.w, top + 500) || circleRect(bird.x, bird.y, BIRD_R, g.x, bot, g.w, GROUND + 100 - bot)) {
      hit(g);
      if (state !== 'run' && state !== 'attract') return;
    }
    g.clear = Math.min(g.clear, bird.y - BIRD_R - top, bot - (bird.y + BIRD_R));
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
  if (pal.t < 1) pal.t = Math.min(1, pal.t + realDt / 1.1);
  if (pal.turn > 0) {
    pal.turn += realDt / 0.9;
    if (pal.turn >= 1) pal.turn = 0;
  }

  if (state === 'run' && gv.playing && performance.now() > inputLockUntil) {
    if (input.pressed('flap')) flap();
  } else if (state === 'attract') autopilot();
  input.endFrame();
  if (state === 'run' && !gv.playing) return;

  const d = world.difficulty(run.gates);
  if (state === 'run' || state === 'attract') speed = lerp(170, 245, d);

  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  for (let i = 0; i < steps; i++) step(dt / steps);

  // Animation de l'oiseau
  bird.flap = Math.max(0, bird.flap - realDt * 5.5);
  const targetRot = bird.dead ? bird.rot : clamp(bird.vy / 900, -0.45, 1.05);
  if (!bird.dead) bird.rot += (targetRot - bird.rot) * Math.min(1, realDt * 12);
  bird.sy = squash.value;
  bird.sx = 1 + (1 - squash.value) * 0.7;
  bird.blinkT -= realDt;
  if (bird.blinkT <= 0) {
    bird.blink = 0.12;
    bird.blinkT = 2 + Math.random() * 3;
  }
  if (bird.blink > 0) bird.blink -= realDt;
  if (bird.invuln > 0) bird.invuln -= dt;

  if (state === 'run' || state === 'attract') {
    for (const s of world.stars) {
      if (s.alive && (s.x - bird.x) ** 2 + (s.y - bird.y) ** 2 < (BIRD_R + 13) ** 2) {
        s.alive = false;
        if (state === 'run') {
          run.stars++;
          const pts = gain(SCORE.star);
          fx.popups.add(s.x, s.y - 14, `+${pts}`, { size: 18, color: '#ffc93c', life: 0.6 });
          gv.audio.play('coin', { pitch: 1.1 + Math.min(run.stars, 15) * 0.02 });
        }
        fx.particles.emit(s.x, s.y, { count: 10, colors: ['#ffc93c', '#fff6d8'], speed: [60, 200], shape: 'star', size: [3, 5], gravity: 120, life: [0.3, 0.6] });
      }
    }
    for (const s of world.shields) {
      if (s.alive && (s.x - bird.x) ** 2 + (s.y - bird.y) ** 2 < (BIRD_R + 18) ** 2) {
        s.alive = false;
        bird.shield = true;
        gv.audio.play('powerup');
        fx.particles.ring(s.x, s.y, { color: '#4cc3ff', size: 10, growth: 200 });
      }
    }
    if (state === 'run') {
      const shown = Math.floor(run.points);
      if (shown !== run.shownScore) {
        run.shownScore = shown;
        gv.hud('score', formatInt(shown), true);
      }
    }
    cameraX = bird.x - BIRD_X;
    world.generate(cameraX + view.width + 900);
    world.prune(cameraX - 200);
  }

  if (state === 'dying') {
    deathTimer -= realDt;
    if (deathTimer <= 0) finish();
  }
}

// ---------- Rendu ----------
const worldTop = () => clamp(view.height - WORLD_H - 10, 0, (view.height - WORLD_H) * 0.6);

function render() {
  const ctx = view.begin();
  const p = currentPalette();
  const top = worldTop();
  drawBackground(ctx, view, p, time, cameraX, top, scenery);

  ctx.save();
  fx.shake.apply(ctx, view.width / 2, view.height / 2);
  ctx.translate(-cameraX, top);
  const x0 = cameraX - 100;
  const x1 = cameraX + view.width + 100;
  for (const z of world.winds) if (z.x1 > x0 && z.x0 < x1) drawWind(ctx, z, time, top);
  // Chaque falaise garde les couleurs de son chapitre : on aperçoit le monde suivant avant la page
  for (const g of world.gates) if (g.x < x1 && g.x + g.w > x0) drawGate(ctx, g, gapAt(g, time), CHAPTERS[g.chapter], top, !!CHAPTERS[g.chapter].dark, time);
  drawGround(ctx, p, cameraX, view, top);
  for (const s of world.stars) if (s.alive && s.x > x0 && s.x < x1) drawStar(ctx, s, time);
  for (const s of world.shields) if (s.alive && s.x > x0 && s.x < x1) drawShieldBubble(ctx, s, time);
  if (!(bird.invuln > 0 && Math.floor(time * 20) % 2)) drawBird(ctx, bird, skin(), time);
  if (bird.shield) drawShieldBubble(ctx, bird, time, true);
  fx.particles.draw(ctx);
  ctx.restore();

  // Nuit : seule la lanterne de l'oiseau éclaire, plus les lanternes des falaises
  const dark = p.dark ?? 0;
  if (dark > 0.01) {
    const bx = bird.x - cameraX;
    const by = bird.y + top;
    const g = ctx.createRadialGradient(bx, by, 60, bx, by, 260);
    g.addColorStop(0, 'rgba(6,10,24,0)');
    g.addColorStop(1, `rgba(6,10,24,${0.72 * dark})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.save();
    ctx.translate(-cameraX, top);
    for (const gt of world.gates) if (CHAPTERS[gt.chapter].dark && gt.x < x1 && gt.x + gt.w > x0) drawLanternGlow(ctx, gt, gapAt(gt, time), time);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(-cameraX, top);
  fx.popups.draw(ctx);
  ctx.restore();
  drawPageTurn(ctx, view, pal.turn, '#fff6e8');
  fx.flash.draw(ctx, view.width, view.height);
  if (state === 'run' || state === 'dying') drawHud(ctx, p);
  if (state === 'run' && !run.flapped && !store.data.seenHint) drawHint(ctx, top);
}

function drawHud(ctx, p) {
  const m = 14;
  const chapterIdx = Math.floor(run.gates / GATE.perChapter);
  const ch = CHAPTERS[world.chapterOf(run.gates)];
  const inChapter = run.gates % GATE.perChapter;
  ctx.save();
  ctx.translate(m, m);
  const w = 196;
  ctx.fillStyle = 'rgba(11,12,20,0.72)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 46, 10);
  ctx.fill();
  ctx.fillStyle = '#f4efe4';
  ctx.font = '900 15px "Big Shoulders Display", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(`CHAPITRE ${chapterIdx + 1 + mode.chapter} · ${ch.name.toUpperCase()}`, 12, 8);
  // Une case par falaise du chapitre
  const cw = (w - 24 - (GATE.perChapter - 1) * 3) / GATE.perChapter;
  for (let i = 0; i < GATE.perChapter; i++) {
    ctx.fillStyle = i < inChapter ? '#ffc93c' : '#353b58';
    ctx.fillRect(12 + i * (cw + 3), 30, cw, 6);
  }
  ctx.restore();

  // Multiplicateur
  if (run.mult > 1 || run.chain > 0) {
    ctx.save();
    ctx.translate(m + w + 24, m + 23);
    ctx.fillStyle = 'rgba(11,12,20,0.72)';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3ee6a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const prog = (run.chain % SCORE.chainPerLevel) / SCORE.chainPerLevel;
    ctx.arc(0, 0, 17, -Math.PI / 2, -Math.PI / 2 + TAU * (run.mult >= SCORE.maxMult ? 1 : prog));
    ctx.stroke();
    ctx.fillStyle = run.mult > 1 ? '#3ee6a8' : '#8d93b3';
    ctx.font = '900 18px "Big Shoulders Display", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${run.mult}`, 0, 1);
    ctx.restore();
  }

  // Étoiles
  ctx.save();
  ctx.font = '700 13px Silkscreen, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const label = `${run.stars}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(11,12,20,0.6)';
  ctx.beginPath();
  ctx.roundRect(view.width - m - tw - 44, m, tw + 44, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 3.5 : 8;
    const a = -Math.PI / 2 + (i / 10) * TAU;
    ctx.lineTo(view.width - m - tw - 26 + Math.cos(a) * r, m + 15 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4efe4';
  ctx.fillText(label, view.width - m - 10, m + 16);
  ctx.restore();
}

function drawHint(ctx, top) {
  const a = 0.6 + 0.4 * Math.sin(time * 6);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = '900 22px "Big Shoulders Display", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff6e8';
  ctx.strokeStyle = '#2a1a14';
  ctx.lineWidth = 5;
  const text = matchMedia('(pointer: coarse)').matches ? 'TOUCHE POUR BATTRE DES AILES' : 'ESPACE POUR BATTRE DES AILES';
  const x = BIRD_X + 90;
  const y = top + bird.y - 50;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------- Atelier (écran d'accueil) ----------
function miniBird(s, locked) {
  return `<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M5 22l25-9 13 9-17 8z" fill="${s.wing}"/><path d="M5 22l25-9 13 9z" fill="${s.body}"/><path d="M30 13l13 9-10 1z" fill="${s.body}"/><path d="M15 19l11-18 4 14z" fill="${s.body}" stroke="${s.line}" stroke-opacity=".45" stroke-width="1.2" stroke-linejoin="round"/><path d="M43 22l6 1-6 2z" fill="#ff5a4e"/><circle cx="36" cy="19" r="1.6" fill="${s.line}"/>${locked ? '<rect width="48" height="40" fill="#0b0c14" opacity=".55"/>' : ''}</svg>`;
}

function renderAtelier() {
  const best = bestScore();
  gv.shell.startExtra.innerHTML = `
    <div class="pl-atelier">
      <div class="pl-row">
        <span class="pl-label" id="pl-mode-label">Mode</span>
        <div class="pl-modes" role="radiogroup" aria-labelledby="pl-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const locked = best < m.unlock;
              return `<button type="button" role="radio" class="pl-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}" ${locked ? 'aria-disabled="true"' : ''}>
                ${locked ? icon('lock') : m.id === 'tempete' ? icon('wave') : icon('play')}<span>${m.label}</span>
                ${locked ? `<small>${formatInt(m.unlock)} pts</small>` : m.id === 'tempete' ? '<small>chapitre 4, ×1,5</small>' : ''}
              </button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="pl-row">
        <span class="pl-label" id="pl-skin-label">Papier</span>
        <div class="pl-skins" role="radiogroup" aria-labelledby="pl-skin-label">
          ${SKINS.map((s) => {
            const locked = best < s.unlock;
            const label = locked ? `${s.name}, débloqué à ${formatInt(s.unlock)} points` : s.name;
            return `<button type="button" role="radio" class="pl-skin" data-skin="${s.id}" aria-checked="${store.data.skin === s.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}>${miniBird(s, locked)}${locked ? `<span class="pl-skin__lock">${icon('lock')}</span>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="pl-atelier__hint" id="pl-hint" aria-live="polite"></p>
    </div>`;
}

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    const t = b.dataset.skin ? SKINS.find((s) => s.id === b.dataset.skin) : MODES[b.dataset.mode];
    document.getElementById('pl-hint').textContent = `Atteins ${formatInt(t.unlock)} points pour débloquer ${b.dataset.skin ? `le papier ${t.name}` : 'le mode Tempête'}.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.skin) store.data.skin = b.dataset.skin;
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  store.save();
  gv.audio.play('select');
  renderAtelier();
  document.querySelector(b.dataset.skin ? `[data-skin="${b.dataset.skin}"]` : `[data-mode="${b.dataset.mode}"]`)?.focus();
});

// ---------- Démarrage ----------
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

window.__plume = {
  get state() { return state; },
  get run() { return run; },
  get bird() { return bird; },
  get world() { return world; },
  get frameMs() { return frameMs; },
  chapter: (i) => setChapter(i, true),
  immortal: (v = true) => (immortal = v),
};

state = 'attract';
resetWorld(21, 0);
gv.hud('best', formatInt(bestScore()));
renderAtelier();
document.fonts?.load('900 20px "Big Shoulders Display"').catch(() => {});
loop.start();
gv.showStart();
