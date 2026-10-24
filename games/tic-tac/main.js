// Tic Tac — un bouton, une aiguille : touche quand elle traverse la zone. À chaque réussite
// l'aiguille repart dans l'autre sens, un peu plus vite. Toutes les 8 réussites, l'aiguille
// des heures avance et une nouveauté entre en jeu (remontoir, cloches, zones mobiles…).

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { createInput } from '../../shared/js/engine/input.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { Spring } from '../../shared/js/core/tween.js';
import { createRng, dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { TAU, clamp, lerp, formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { DIFF, SCORE, CHRONO, FEATURES, MODES, DIALS, MUSIC } from './config.js';
import { difficulty, hourOf, hasFeature, hourLabel, distanceTo, judge, multOf, pointsFor } from './logic.js';
import { createWorkshop, drawWorkshop, drawClock, makeCracks } from './draw.js';

const stage = document.getElementById('stage');
const params = new URLSearchParams(location.search);

const store = createStore('tic-tac', {
  version: 1,
  defaults: { mode: 'classique', dial: 'atelier', bells: 0, games: 0, daily: { day: '', best: 0, plays: 0 } },
});

const gv = bootGame('tic-tac', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'combo', label: 'Multi' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['Espace', 'icon:touch'], text: 'Touche quand l’aiguille traverse la zone verte.' },
    { keys: ['icon:target'], text: 'Au centre doré : coup pile, le multiplicateur grimpe.' },
    { keys: ['icon:clock'], text: 'Toutes les 8 réussites, une heure passe et le cadran se corse.' },
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

const view = createCanvas(stage, { mode: 'fill' });
const input = createInput({ surface: stage, view, bindings: { tap: ['pointer', 'Space', 'Enter'] } });
const fx = { particles: new Particles(600), popups: new Popups(30), shake: new Shake({ maxOffset: 14 }), flash: new Flash() };
const squash = new Spring(1, { stiffness: 340, damping: 13 });
const gears = createWorkshop();

let state = 'attract'; // attract | run | ending | over
let mode = MODES.classique;
let rng = createRng(1);
let time = 0;
let endTimer = 0;
let autoplay = false;
let cracks = [];
let targets = [];
let trail = [];
let handColor = null;
const hand = { a: 0, dir: 1, speed: DIFF.speed0 };
const hourHand = { a: TAU / 12, target: TAU / 12 };
const run = {};

const dial = () => DIALS.find((d) => d.id === store.data.dial) ?? DIALS[0];
const best = () => gv.best ?? 0;
const today = () => dayKey();

function geo() {
  const w = view.width;
  const h = view.height;
  const R = Math.min(w * 0.4, h * 0.33, 290);
  return { cx: w / 2, cy: h * 0.54, R };
}
// Point du cadran (coordonnées écran) à l'angle a et au rayon k·R
function rimPoint(a, k = 0.79) {
  const { cx, cy, R } = geo();
  return { x: cx + Math.sin(a) * R * k, y: cy - Math.cos(a) * R * k };
}

function resetRun() {
  Object.assign(run, {
    points: 0,
    hits: 0,
    combo: 0,
    mult: 1,
    perfects: 0,
    perfectStreak: 0,
    bestPerfectStreak: 0,
    bells: 0,
    limits: 0,
    shield: false,
    saved: 0,
    hour: 1,
    timeLeft: CHRONO.time,
    misses: 0,
    lockUntil: 0,
    reason: '',
    near: false,
    shown: -1,
  });
}

function startRun() {
  mode = MODES[store.data.mode] ?? MODES.classique;
  if (mode.unlock > best()) mode = MODES.classique;
  rng = mode.id === 'jour' ? createRng(dailySeed('tic-tac')) : createRng(Number(params.get('seed')) || Date.now());
  resetRun();
  hand.a = 0;
  hand.dir = 1;
  hand.speed = difficulty(0).speed;
  hourHand.target = TAU / 12;
  targets = [];
  trail = [];
  cracks = [];
  handColor = null;
  fx.particles.clear();
  fx.popups.clear();
  spawnMain();
  state = 'run';
  loop.timeScale = 1;
  input.reset();
  // La touche qui lance la partie ne compte pas comme un coup
  run.lockUntil = time + 0.3;
  gv.hud('score', 0);
  gv.hud('combo', '×1');
  gv.hud('best', formatInt(best()));
  loop.resume();
}

// ---------- Cibles ----------
function spawnMain() {
  const { half, perfect, speed } = difficulty(run.hits ?? 0);
  // Plus l'aiguille va vite, plus la zone apparaît loin : le temps de réaction reste correct
  const min = Math.min(2.1, Math.max(DIFF.spawnMin, speed * 0.42));
  const dist = rng.range(min, Math.max(min + 0.4, DIFF.spawnMax));
  const hour = run.hour ?? 1;
  const live = state === 'run';
  const t = {
    kind: 'main',
    center: hand.a + hand.dir * dist,
    half,
    perfect,
    born: time,
    d: dist,
    drift: live && hasFeature(hour, 'drift') && rng.chance(0.35) ? rng.sign() * rng.range(0.15, 0.32) : 0,
    blink: live && hasFeature(hour, 'blink') && rng.chance(0.3),
  };
  targets.push(t);
  // Bonus facultatifs, placés entre l'aiguille et la zone
  if (!live || dist < 1.5) return;
  const bonusHalf = Math.max(0.09, half * 0.45);
  const room = dist - half - bonusHalf - 0.12;
  if (room < 0.5) return;
  let kind = null;
  if (hasFeature(hour, 'key') && !run.shield && !targets.some((x) => x.kind === 'key' && !x.dead) && rng.chance(0.1)) kind = 'key';
  else if (hasFeature(hour, 'bell') && rng.chance(0.3)) kind = 'bell';
  if (!kind) return;
  const bd = rng.range(0.45, room);
  targets.push({ kind, center: hand.a + hand.dir * bd, half: bonusHalf, perfect: bonusHalf * 0.4, born: time, d: bd, drift: 0, blink: false });
}

// ---------- Touches ----------
function tap() {
  const j = judge(targets, hand.a, hand.dir);
  if (state === 'attract') return j && demoHit(j.target);
  if (!j) return fail('early');
  hit(j);
}

// Démonstration de l'accueil : rien n'est compté, rien n'est débloqué
function demoHit(t) {
  t.dead = true;
  t.deadAt = time;
  const p = rimPoint(hand.a);
  fx.particles.ring(p.x, p.y, { color: '#ffc93c', size: geo().R * 0.05, growth: 300, life: 0.3, lineWidth: 5 });
  squash.kick(1);
  hand.dir *= -1;
  spawnMain();
}

function hit({ target: t, quality }) {
  t.dead = true;
  t.deadAt = time;
  const p = rimPoint(hand.a);
  // Direction du mouvement à l'écran (dérivée de (sin a, −cos a))
  const tangent = hand.a + (hand.dir > 0 ? 0 : Math.PI);
  if (t.kind === 'main') {
    run.hits++;
    run.combo += quality === 'perfect' ? 2 : 1;
    const prevMult = run.mult;
    run.mult = multOf(run.combo);
    if (quality === 'perfect') {
      run.perfects++;
      run.perfectStreak++;
      run.bestPerfectStreak = Math.max(run.bestPerfectStreak, run.perfectStreak);
    } else run.perfectStreak = 0;
    if (quality === 'limit') run.limits++;
    const pts = pointsFor('main', quality, prevMult);
    run.points += pts;
    effectsFor(quality, p, tangent, pts);
    if (run.mult > prevMult) {
      fx.popups.add(geo().cx, geo().cy + geo().R * 0.62, `Multi ×${run.mult}`, { size: 26, color: '#ffc93c', rise: 30, life: 0.9 });
      gv.audio.play('combo', { pitch: 0.9 + run.mult * 0.08 });
      if (run.mult >= SCORE.multMax) gv.unlock('mult-5');
    }
    if (run.perfectStreak >= 10) gv.unlock('pile-10');
    if (run.perfectStreak >= 25) gv.unlock('horloger');
    // L'aiguille repart dans l'autre sens, un peu plus vite
    hand.dir *= -1;
    hand.speed = difficulty(run.hits).speed;
    const h = hourOf(run.hits);
    if (h > run.hour) hourUp(h);
    spawnMain();
  } else if (t.kind === 'bell') {
    const pts = pointsFor('bell', quality, run.mult);
    run.points += pts;
    run.bells++;
    store.data.bells++;
    if (store.data.bells >= 25) gv.unlock('cloches');
    fx.popups.add(p.x, p.y - 20, `Ding ! +${pts}`, { size: 24, color: '#ffc93c', rise: 50 });
    fx.particles.emit(p.x, p.y, { count: 16, colors: ['#ffc93c', '#fff3c4'], speed: [80, 240], size: [2, 5], gravity: 300, shape: 'star', life: [0.4, 0.8] });
    chime(1568, 0.14);
    chime(2093, 0.1, 0.08);
  } else {
    run.shield = true;
    run.points += pointsFor('key', quality, run.mult);
    fx.popups.add(p.x, p.y - 20, 'Remontoir !', { size: 24, color: '#4cc3ff', rise: 50 });
    fx.particles.ring(p.x, p.y, { color: '#4cc3ff', size: 10, growth: 260, life: 0.35, lineWidth: 5 });
    gv.audio.play('powerup');
  }
  gv.hud('combo', `×${run.mult}`, t.kind === 'main');
}

function effectsFor(quality, p, tangent, pts) {
  const { R } = geo();
  const perfect = quality === 'perfect';
  // « Tic » puis « tac » : les coups alternent de timbre, et montent avec le multiplicateur
  const pitch = 0.9 + Math.min(run.combo, 40) * 0.012;
  gv.audio.play(run.hits % 2 ? 'tick' : 'tock', { pitch: pitch * 1.4, volume: 1.4 });
  fx.particles.ring(p.x, p.y, { color: perfect ? '#ffc93c' : '#3ee6a8', size: R * 0.05, growth: perfect ? 420 : 260, life: 0.32, lineWidth: perfect ? 6 : 4 });
  fx.particles.emit(p.x, p.y, {
    count: perfect ? 22 : 12,
    colors: perfect ? ['#ffc93c', '#fff3c4', '#ffffff'] : ['#3ee6a8', '#f4efe4'],
    speed: [120, perfect ? 420 : 280],
    angle: tangent,
    spread: 1.6,
    gravity: 200,
    shape: 'spark',
    life: [0.25, 0.55],
  });
  if (perfect) {
    loop.hitstop(0.06);
    fx.shake.add(0.18);
    fx.flash.trigger('#fff3c4', 0.18, 6);
    squash.kick(1.6);
    gv.audio.play('perfect', { pitch: 0.95 + run.mult * 0.05 });
    fx.popups.add(p.x, p.y - 24, `Pile ! +${pts}`, { size: 30, color: '#ffc93c', rise: 60 });
  } else if (quality === 'limit') {
    loop.hitstop(0.03);
    fx.shake.add(0.1);
    squash.kick(0.8);
    gv.audio.play('nearMiss');
    fx.popups.add(p.x, p.y - 24, `Limite ! +${pts}`, { size: 24, color: '#ff8a5b', rise: 50 });
  } else {
    loop.hitstop(0.025);
    fx.shake.add(0.06);
    squash.kick(0.9);
    fx.popups.add(p.x, p.y - 20, `+${pts}`, { size: 22, color: '#f4efe4', rise: 45 });
  }
}

function hourUp(h) {
  run.hour = h;
  hourHand.target = (h / 12) * TAU;
  const bonus = SCORE.hourBonus * (h - 1);
  run.points += bonus;
  gv.banner(h === 12 ? 'Midi !' : h === 24 ? 'Minuit !' : hourLabel(h), { color: '#ffc93c' });
  const feat = FEATURES.find((f) => f.hour === h);
  const { cx, cy, R } = geo();
  fx.popups.add(cx, cy + R * 1.32, feat ? feat.text : `Bonus d’heure +${bonus}`, { size: 22, color: feat ? '#4cc3ff' : '#ffc93c', rise: 16, life: 2 });
  // Carillon : autant de coups que d'heures (jusqu'à trois)
  for (let i = 0; i < Math.min(3, h); i++) chime(1046, 0.16, i * 0.22);
  fx.particles.emit(cx, cy - R, { count: 30, colors: ['#ffc93c', '#3ee6a8', '#f4efe4'], speed: [150, 420], size: [3, 6], gravity: 500, shape: 'star', life: [0.6, 1.1] });
  if (h >= 2) gv.unlock('premiere-heure');
  if (h >= 12) gv.unlock('midi');
  if (h >= 24) gv.unlock('minuit');
}

function chime(freq, volume, delay = 0) {
  gv.audio.tone({ type: 'sine', freq, duration: 0.7, volume, delay });
  gv.audio.tone({ type: 'sine', freq: freq * 2.01, duration: 0.4, volume: volume * 0.35, delay });
}

function fail(kind) {
  if (state !== 'run') return;
  const main = targets.find((t) => t.kind === 'main' && !t.dead);
  const p = rimPoint(hand.a);
  if (mode.id === 'chrono') {
    run.misses++;
    run.combo = 0;
    run.mult = 1;
    run.perfectStreak = 0;
    run.timeLeft -= CHRONO.penalty;
    fx.popups.add(p.x, p.y - 20, `−${CHRONO.penalty} s`, { size: 28, color: '#ff5a4e', rise: 50 });
    fx.shake.add(0.35);
    fx.flash.trigger('#ff5a4e', 0.2, 4);
    gv.audio.play('error');
    gv.hud('combo', '×1');
    if (kind === 'late' && main) replaceMain(main);
    return;
  }
  if (run.shield) {
    // Le remontoir sauve la partie : l'aiguille recule et la zone revient devant
    run.shield = false;
    run.saved++;
    gv.unlock('remontoir');
    hand.a -= hand.dir * 0.5;
    if (kind === 'late' && main) replaceMain(main);
    fx.flash.trigger('#4cc3ff', 0.3, 3);
    fx.shake.add(0.25);
    fx.popups.add(geo().cx, geo().cy - geo().R * 1.3, 'Sauvé par le remontoir !', { size: 24, color: '#4cc3ff', rise: 20, life: 1.4 });
    gv.audio.play('powerup');
    run.lockUntil = time + 0.2;
    return;
  }
  // À un cheveu : la touche est arrivée juste avant la zone
  if (kind === 'early' && main) run.near = main.d > 0 && main.d - main.half - DIFF.grace < 0.08;
  endRun(kind === 'early' ? (run.near ? 'À un cheveu !' : 'Trop tôt !') : 'Trop tard !');
}

function replaceMain(main) {
  main.dead = true;
  main.deadAt = time;
  spawnMain();
}

function endRun(reason) {
  if (state !== 'run') return;
  state = 'ending';
  run.reason = reason;
  endTimer = motion.reduced ? 0.5 : 0.95;
  loop.timeScale = 0.25;
  handColor = '#11131f';
  const { R } = geo();
  const tip = rimPoint(hand.a, 0.86);
  const { cx, cy } = geo();
  cracks = makeCracks(rng, (tip.x - cx) / R, (tip.y - cy) / R);
  fx.shake.add(0.7);
  fx.flash.trigger('#ff5a4e', 0.35, 3);
  fx.particles.emit(tip.x, tip.y, { count: 26, colors: ['#ffffff', '#cfe8ff', '#8d93b3'], speed: [100, 380], size: [2, 5], gravity: 700, shape: 'square', life: [0.4, 0.9] });
  gv.audio.play('hit');
}

function finish() {
  state = 'over';
  loop.timeScale = 1;
  const beforeBest = best();
  store.data.games++;
  let dailyLine = '';
  if (mode.id === 'jour') {
    const dd = store.data.daily;
    if (dd.day !== today()) Object.assign(dd, { day: today(), best: 0, plays: 0 });
    dd.plays++;
    dd.best = Math.max(dd.best, run.points);
    gv.unlock('du-jour');
    dailyLine = `Meilleur score du jour : ${formatInt(dd.best)} (${dd.plays} essai${dd.plays > 1 ? 's' : ''})`;
  }
  store.save();
  if (mode.id === 'chrono' && run.points >= 1000) gv.unlock('chrono-1000');
  const next = [...DIALS.map((d) => ({ label: `Cadran ${d.name}`, unlock: d.unlock })), { label: 'Mode Chrono', unlock: MODES.chrono.unlock }]
    .filter((u) => u.unlock > Math.max(beforeBest, run.points))
    .sort((a, b) => a.unlock - b.unlock)[0];
  gv.gameOver({
    score: run.points,
    stats: { score: run.points, hour: run.hour, perfects: run.perfects, daily: mode.id === 'jour' ? 1 : 0 },
    extraStats: [
      { label: 'Heure', value: hourLabel(run.hour) },
      { label: 'Coups pile', value: String(run.perfects) },
    ],
    kicker: `${mode.label} · ${run.hits} réussite${run.hits > 1 ? 's' : ''}`,
    title: run.reason,
    nextUnlock: next ? { label: next.label, current: Math.max(beforeBest, run.points), target: next.unlock } : undefined,
    extraHtml: dailyLine ? `<p class="tt-daily">${esc(dailyLine)}</p>` : '',
  });
  const after = best();
  for (const d of DIALS) if (d.unlock > 0 && beforeBest < d.unlock && after >= d.unlock) toast({ title: 'Nouveau cadran !', text: `Cadran ${d.name} débloqué.`, iconName: 'clock', tone: 'var(--mint)' });
  if (beforeBest < MODES.chrono.unlock && after >= MODES.chrono.unlock) toast({ title: 'Mode Chrono débloqué', text: '60 secondes pour marquer un maximum.', iconName: 'hourglass', tone: 'var(--mint)' });
  if (DIALS.every((d) => after >= d.unlock)) gv.unlock('collection');
  gv.hud('best', formatInt(after));
  renderOptions();
}

// ---------- Boucle ----------
function update(dt, realDt) {
  time += dt;
  fx.shake.update(realDt);
  fx.flash.update(realDt);
  fx.particles.update(dt);
  fx.popups.update(dt);
  squash.update(realDt);
  hourHand.a = lerp(hourHand.a, hourHand.target, 1 - Math.pow(0.002, realDt));

  if (state === 'attract' || state === 'run' || state === 'ending') {
    const wobble = state === 'run' && hasFeature(run.hour, 'wobble') ? 1 + 0.22 * Math.sin(time * 2.4) : 1;
    const step = hand.speed * wobble * dt;
    hand.a += hand.dir * step;
    trail.push(hand.a);
    if (trail.length > 6) trail.shift();
    for (const t of targets) {
      if (t.dead) continue;
      if (t.drift) t.center += t.drift * dt;
      t.d = distanceTo(t, hand.a, hand.dir);
    }

    if (state === 'attract' || (state === 'run' && autoplay)) {
      // Pilote automatique (démonstration de l'accueil, tests) : touche au passage du centre
      const main = targets.find((t) => t.kind === 'main' && !t.dead);
      if (main && main.d <= step * 0.5 + main.perfect * 0.5 && main.d >= -main.half) tap();
    } else if (state === 'run' && input.pressed('tap') && time >= run.lockUntil) tap();

    if (state === 'run') {
      for (const t of targets) {
        if (t.dead || t.d >= -(t.half + DIFF.grace)) continue;
        if (t.kind === 'main') {
          fail('late');
          break;
        }
        t.dead = true;
        t.deadAt = time;
      }
      if (mode.id === 'chrono') {
        const before = Math.ceil(run.timeLeft);
        run.timeLeft -= dt;
        if (run.timeLeft <= 5 && Math.ceil(run.timeLeft) !== before && run.timeLeft > 0) gv.audio.play('countdown');
        if (run.timeLeft <= 0) {
          run.timeLeft = 0;
          endRun('Temps écoulé');
        }
      }
      const shown = Math.floor(run.points);
      if (shown !== run.shown) {
        run.shown = shown;
        gv.hud('score', formatInt(shown), true);
      }
    }
    targets = targets.filter((t) => !t.dead || time - t.deadAt < 0.3);
  }
  if (state === 'ending') {
    endTimer -= realDt;
    if (endTimer <= 0) finish();
  }
  input.endFrame();
}

function render() {
  const ctx = view.begin();
  ctx.save();
  fx.shake.apply(ctx, view.width / 2, view.height / 2);
  const fever = state === 'run' && run.mult >= SCORE.multMax ? 1 : 0;
  drawWorkshop(ctx, view, time, gears, fever);
  const g = geo();
  const main = targets.find((t) => t.kind === 'main' && !t.dead);
  const danger = state === 'run' && main && main.d < 0 ? clamp(-main.d / (main.half + DIFF.grace)) : 0;
  drawClock(ctx, g, {
    dial: dial(),
    hand: hand.a,
    dir: hand.dir,
    hourAngle: hourHand.a,
    targets,
    time,
    hits: run.hits ?? 0,
    mult: run.mult ?? 1,
    hourText: hourLabel(run.hour ?? 1),
    cracks,
    squash: clamp(squash.value, 0.96, 1.05),
    shield: !!run.shield,
    fever,
    danger,
    chrono: mode.id === 'chrono' && state !== 'attract' ? { left: run.timeLeft, total: CHRONO.time } : null,
    trail,
    handColor,
  });
  if (mode.id === 'chrono' && state !== 'attract') {
    const t = Math.max(0, run.timeLeft);
    ctx.fillStyle = t <= 10 ? '#ff5a4e' : '#f4efe4';
    ctx.font = `900 ${Math.round(g.R * 0.2)}px "Big Shoulders Display", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`0:${String(Math.ceil(t)).padStart(2, '0')}`, g.cx, g.cy - g.R * 1.45);
  }
  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  ctx.restore();
  fx.flash.draw(ctx, view.width, view.height);
}

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const b = best();
  const dd = store.data.daily;
  gv.shell.startExtra.innerHTML = `
    <div class="tt-options">
      <div class="tt-row">
        <span class="tt-label" id="tt-mode-label">Mode</span>
        <div class="tt-modes" role="radiogroup" aria-labelledby="tt-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const locked = b < m.unlock;
              const sub = locked ? `${formatInt(m.unlock)} pts` : m.id === 'jour' && dd.day === today() ? `Meilleur du jour : ${formatInt(dd.best)}` : m.hint;
              return `<button type="button" role="radio" class="tt-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}" ${locked ? 'aria-disabled="true"' : ''}>
                ${locked ? icon('lock') : icon({ classique: 'target', chrono: 'hourglass', jour: 'calendar' }[m.id])}<span>${m.label}</span><small>${esc(sub)}</small>
              </button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="tt-row">
        <span class="tt-label" id="tt-dial-label">Cadran</span>
        <div class="tt-dials" role="radiogroup" aria-labelledby="tt-dial-label">
          ${DIALS.map((d) => {
            const locked = b < d.unlock;
            const label = locked ? `${d.name}, débloqué à ${formatInt(d.unlock)} points` : d.name;
            return `<button type="button" role="radio" class="tt-dial" data-dial="${d.id}" style="--c1:${d.bezel};--c2:${d.face};--c3:${d.hand}" aria-checked="${store.data.dial === d.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span></span>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="tt-hint" id="tt-hint" aria-live="polite"></p>
    </div>`;
}

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    const u = b.dataset.mode ? MODES[b.dataset.mode].unlock : DIALS.find((d) => d.id === b.dataset.dial).unlock;
    document.getElementById('tt-hint').textContent = `Atteins ${formatInt(u)} points pour le débloquer.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.dial) store.data.dial = b.dataset.dial;
  store.save();
  gv.audio.play('select');
  renderOptions();
  gv.shell.startExtra.querySelector(b.dataset.mode ? `[data-mode="${b.dataset.mode}"]` : `[data-dial="${b.dataset.dial}"]`)?.focus();
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

window.__tictac = {
  get state() { return state; },
  get run() { return run; },
  get hand() { return hand; },
  get targets() { return targets; },
  get frameMs() { return frameMs; },
  get mode() { return mode; },
  set autoplay(v) { autoplay = v; },
  get autoplay() { return autoplay; },
};

resetRun();
// Accueil : démonstration en pilote automatique
spawnMain();
gv.hud('best', formatInt(best()));
gv.hud('combo', '×1');
renderOptions();
loop.start();
gv.showStart();
