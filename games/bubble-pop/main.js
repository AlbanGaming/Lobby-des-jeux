// Bubble Pop — les bulles de même couleur s'agglutinent en montant ; en éclater une fait
// sauter toute sa grappe. Attendre la grosse grappe rapporte gros… si elle n'atteint pas la surface.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { createInput } from '../../shared/js/engine/input.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { Tweens, Ease } from '../../shared/js/core/tween.js';
import { createRng } from '../../shared/js/core/rng.js';
import { TAU, clamp, lerp, formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { WORLD_H, ROUND, FRENZY, COLORS, SCORE, MODES, STYLES, MUSIC } from './config.js';
import { createSim } from './sim.js';
import { createLagoon, drawLagoon, drawSurface, drawBubble, drawLinks, drawClusterHints, clearSpriteCache } from './draw.js';

const stage = document.getElementById('stage');
const params = new URLSearchParams(location.search);

const store = createStore('bubble-pop', {
  version: 1,
  defaults: { style: 'lagon', mode: 'chrono', runs: 0, totalPops: 0 },
});

const gv = bootGame('bubble-pop', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['icon:touch', 'icon:pointer'], text: 'Touche une bulle : toute sa grappe éclate.' },
    { keys: ['icon:wave'], text: 'Une bulle qui atteint la surface coûte 2 secondes.' },
    { keys: ['icon:bolt'], text: 'Bombe, horloge, prisme… mais jamais l’oursin !' },
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

const view = createCanvas(stage, { mode: 'stage', height: WORLD_H, minWidth: (w, h) => (w > h ? 880 : 380) });
const input = createInput({
  surface: stage,
  view,
  bindings: { tap: ['pointer'], pop: ['Space', 'Enter'], left: ['ArrowLeft', 'KeyA', 'KeyQ'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW', 'KeyZ'], down: ['ArrowDown', 'KeyS'] },
});
const fx = { particles: new Particles(900), popups: new Popups(40), shake: new Shake({ maxOffset: 12 }), flash: new Flash() };
const tweens = new Tweens();
const lagoon = createLagoon(4);
document.fonts?.ready.then(clearSpriteCache);

let rng = createRng(1);
let sim = createSim(rng);
let mode = MODES[store.data.mode] ?? MODES.chrono;
let state = 'attract'; // attract | run | ending | over
let time = 0;
let spawnAcc = 0;
let attractPop = 1.5;
let endTimer = 0;
let bestAtStart = 0;
let links = [];
let groups = new Map();
const queue = []; // éclatements en cascade : { b, at, i }
const run = {};
const cursor = { x: 0, y: 0, visible: false };

const style = () => STYLES.find((s) => s.id === store.data.style) ?? STYLES[0];
const bestScore = () => gv.best ?? 0;
const H = () => view.height; // la zone de jeu occupe tout l’écran, la surface est en haut
const zoneH = () => H() * 0.12;
const unlockedStyles = (best = bestScore()) => STYLES.filter((s) => best >= s.unlock);

function resetRun() {
  Object.assign(run, {
    points: 0,
    timeLeft: ROUND,
    elapsed: 0,
    lives: mode.lives ?? 0,
    combo: 0,
    lastHit: -10,
    pops: 0,
    maxChain: 0,
    justInTime: 0,
    escaped: 0,
    frenzy: false,
    shownScore: -1,
  });
}

function startRun() {
  mode = MODES[store.data.mode] ?? MODES.chrono;
  if (mode.unlock > bestScore()) mode = MODES.chrono;
  rng = createRng(Number(params.get('seed')) || Date.now());
  sim = createSim(rng);
  queue.length = 0;
  fx.particles.clear();
  fx.popups.clear();
  resetRun();
  // Des grappes déjà formées : on comprend le principe dès la première seconde
  for (let i = 0; i < 3; i++) sim.spawnPod(view.width, H(), { n: 3 + (i === 1 ? 1 : 0), y: H() * (0.45 + i * 0.16) });
  for (let i = 0; i < 4; i++) {
    sim.spawn(view.width, H(), { specialChance: 0 });
    sim.bubbles[sim.bubbles.length - 1].y = H() * (0.5 + i * 0.12);
  }
  state = 'run';
  bestAtStart = bestScore();
  loop.timeScale = 1;
  tweens.clear();
  input.reset();
  cursor.x = view.width / 2;
  cursor.y = H() / 2;
  gv.hud('score', 0);
  gv.hud('best', formatInt(bestAtStart));
  loop.resume();
}

// ---------- Éclatements ----------
function schedule(targets, origin) {
  targets.sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y));
  targets.forEach((b, i) => {
    b.popping = true;
    queue.push({ b, at: time + i * 0.035, i });
  });
}

function popEffect(b, i) {
  b.alive = false;
  const col = b.kind === 'color' ? COLORS[b.color] : { fill: '#f4efe4', deep: '#8d93b3' };
  fx.particles.ring(b.x, b.y, { color: col.fill, size: b.r * 0.6, growth: 180, life: 0.3, lineWidth: 4 });
  fx.particles.emit(b.x, b.y, { count: 9, colors: [col.fill, '#ffffff', col.deep], speed: [90, 260], size: [2, 5], gravity: 260, shape: 'circle', life: [0.25, 0.55] });
  gv.audio.play('pop', { pitch: 1 + Math.min(i, 14) * 0.06, throttle: 0.012 });
}

function gain(n, mult = 1) {
  const g = Math.round(n * run.combo * (run.frenzy ? 2 : 1) * mult);
  run.points += g;
  return g;
}

function bumpCombo() {
  if (time - run.lastHit < SCORE.comboWindow) {
    run.combo = Math.min(SCORE.maxCombo, run.combo + 1);
    if (run.combo >= 2) gv.audio.play('combo', { pitch: 1 + run.combo * 0.06 });
  } else run.combo = 1;
  run.lastHit = time;
  if (run.combo >= SCORE.maxCombo) gv.unlock('combo-8');
}

function breakCombo(x, y, label = 'Raté') {
  if (run.combo > 1) fx.popups.add(x, y - 20, label, { size: 16, color: '#8d93b3', life: 0.6, rise: 30 });
  run.combo = 0;
}

function penalty(seconds, x, y) {
  if (mode.id === 'zen') {
    run.lives--;
    fx.popups.add(x, y, '−1 ♥', { size: 24, color: '#ff5a4e', life: 0.9, rise: 30 });
  } else {
    run.timeLeft = Math.max(0, run.timeLeft - seconds);
    fx.popups.add(x, y, `−${seconds} s`, { size: 24, color: '#ff5a4e', life: 0.9, rise: 30 });
  }
}

function tap(x, y, touch) {
  const b = sim.at(x, y, touch ? 16 : 6);
  if (!b) {
    fx.particles.ring(x, y, { color: '#9ddcff', size: 4, growth: 90, life: 0.3, lineWidth: 2 });
    breakCombo(x, y);
    return;
  }
  if (b.kind === 'urchin') {
    b.popping = true;
    queue.push({ b, at: time, i: 0 });
    penalty(SCORE.urchinPenalty, b.x, b.y - 30);
    breakCombo(b.x, b.y, 'Aïe !');
    fx.particles.emit(b.x, b.y, { count: 18, colors: ['#ff5a4e', '#b8281f'], speed: [150, 380], shape: 'spark', gravity: 0, life: [0.3, 0.6] });
    fx.shake.add(0.45);
    fx.flash.trigger('#ff5a4e', 0.25, 3);
    gv.audio.play('error');
    return;
  }
  bumpCombo();
  let targets = [b];
  let label = null;
  if (b.kind === 'color') {
    const cl = sim.clusters();
    groups = cl.groups;
    targets = groups.get(b.cluster) ?? [b];
  } else if (b.kind === 'bomb') {
    targets = sim.bubbles.filter((o) => o.alive && !o.popping && Math.hypot(o.x - b.x, o.y - b.y) < 140);
    label = 'Boum !';
    fx.shake.add(0.5);
    loop.hitstop(0.06);
    fx.particles.ring(b.x, b.y, { color: '#ffc93c', size: 20, growth: 520, life: 0.4, lineWidth: 8 });
    gv.audio.play('explode', { pitch: 1.2, volume: 0.8 });
    const n = targets.filter((t) => t !== b).length;
    if (n >= 8) gv.unlock('bombe-8');
  } else if (b.kind === 'clock') {
    if (mode.id === 'zen') run.lives = Math.min(MODES.zen.lives, run.lives + 1);
    else run.timeLeft += SCORE.clockBonus;
    label = mode.id === 'zen' ? '+1 ♥' : `+${SCORE.clockBonus} s`;
    gv.audio.play('pickup');
  } else if (b.kind === 'prism') {
    const counts = new Map();
    for (const o of sim.bubbles) if (o.alive && !o.popping && o.kind === 'color') counts.set(o.color, (counts.get(o.color) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, c) => c[1] - a[1])[0];
    targets = [b, ...sim.bubbles.filter((o) => o.alive && !o.popping && o.kind === 'color' && top && o.color === top[0])];
    label = 'Prisme !';
    fx.flash.trigger('#ffffff', 0.25, 4);
    gv.audio.play('powerup');
  }
  // Les oursins pris dans une bombe sautent sans pénalité ; seules les bulles colorées comptent
  const counted = targets.filter((t) => t.kind === 'color').length || 1;
  const pts = gain(SCORE.base * counted * (1 + (counted - 1) * SCORE.chainBonus));
  run.pops += counted;
  run.maxChain = Math.max(run.maxChain, counted);
  schedule(targets, b);

  const big = counted >= 5;
  fx.popups.add(b.x, b.y - b.r - 6, `+${pts}`, { size: big ? 30 + Math.min(counted, 15) : 20, color: run.frenzy ? '#ff8a5b' : big ? '#ffc93c' : '#f4efe4', rise: 60 });
  if (big) {
    fx.popups.add(b.x, b.y - b.r - 44, `Grappe ×${counted}`, { size: 22, color: '#3ee6a8', rise: 50, life: 0.9 });
    fx.shake.add(Math.min(0.4, counted * 0.025));
  }
  if (label) fx.popups.add(b.x, b.y + b.r + 12, label, { size: 22, color: '#9ddcff', life: 0.8, rise: 20 });
  if (b.y < zoneH() + b.r && b.kind === 'color') {
    run.justInTime++;
    const bonus = gain(SCORE.justInTime);
    fx.popups.add(b.x, b.y + b.r + 16, `Juste à temps ! +${bonus}`, { size: 20, color: '#4cc3ff', life: 0.9, rise: 10 });
    gv.audio.play('nearMiss');
    if (run.justInTime >= 10) gv.unlock('juste-10');
  }
  if (counted >= 5) gv.unlock('grappe-5');
  if (counted >= 12) gv.unlock('grappe-12');
}

function endRun(reason) {
  if (state !== 'run') return;
  state = 'ending';
  endTimer = 1.1;
  gv.banner(reason, { color: '#9ddcff' });
  gv.audio.play('whoosh');
  // Les bulles restantes éclatent en feu d'artifice, sans points
  const rest = sim.bubbles.filter((b) => b.alive && !b.popping);
  schedule(rest, { x: view.width / 2, y: H() / 2 });
}

function finish() {
  state = 'over';
  const score = Math.floor(run.points);
  store.data.runs++;
  store.data.totalPops += run.pops;
  store.save();
  if (store.data.totalPops >= 1000) gv.unlock('bulles-1000');
  if (score >= 8000) gv.unlock('score-8000');
  if (mode.id === 'chrono' && run.escaped === 0 && run.pops >= 40) gv.unlock('etanche');
  const before = unlockedStyles(bestAtStart).length;
  const newBest = Math.max(bestAtStart, score);
  const next = [...STYLES, MODES.zen].filter((u) => u.unlock > newBest).sort((a, b) => a.unlock - b.unlock)[0];
  gv.gameOver({
    score,
    stats: { score, maxChain: run.maxChain, pops: run.pops, justInTime: run.justInTime },
    extraStats: [
      { label: 'Bulles', value: formatInt(run.pops) },
      { label: 'Grappe max', value: `×${run.maxChain}` },
      { label: 'Échappées', value: formatInt(run.escaped) },
    ],
    kicker: mode.id === 'zen' ? 'Mode Zen · partie terminée' : 'Temps écoulé',
    nextUnlock: next ? { label: next.lives ? 'Mode Zen' : `Bulles ${next.name}`, current: newBest, target: next.unlock } : undefined,
  });
  const unlocked = unlockedStyles(newBest);
  for (const s of unlocked.slice(before)) if (s.unlock > 0) toast({ title: 'Nouveau style !', text: `Bulles ${s.name} débloquées.`, iconName: 'sparkle', tone: 'var(--sky)' });
  if (bestAtStart < MODES.zen.unlock && newBest >= MODES.zen.unlock) toast({ title: 'Mode Zen débloqué', text: 'Pas de chrono : 5 cœurs, et le lagon s’agite.', iconName: 'heart', tone: 'var(--mint)' });
  if (unlocked.length === STYLES.length) gv.unlock('collection');
  gv.hud('best', formatInt(newBest));
  renderOptions();
}

// ---------- Boucle ----------
function update(dt, realDt) {
  time += realDt;
  tweens.update(realDt);
  fx.shake.update(realDt);
  fx.flash.update(realDt);
  fx.particles.update(dt);
  fx.popups.update(dt);

  // Entrées
  if (state === 'run' && gv.playing) {
    if (input.pressed('tap')) {
      cursor.visible = false;
      // Le pointeur est en coordonnées logiques, identiques à celles du jeu
      tap(input.pointer.x, input.pointer.y, input.pointer.type === 'touch');
    }
    const kx = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    const ky = (input.down('down') ? 1 : 0) - (input.down('up') ? 1 : 0);
    if (kx || ky) {
      cursor.visible = true;
      cursor.x = clamp(cursor.x + kx * 520 * realDt, 0, view.width);
      cursor.y = clamp(cursor.y + ky * 520 * realDt, 0, H());
    }
    if (input.pressed('pop')) {
      cursor.visible = true;
      tap(cursor.x, cursor.y, true);
    }
  }
  input.endFrame();
  if (state === 'run' && !gv.playing) return;

  // Apparitions
  const progress = mode.id === 'zen' ? clamp(run.elapsed / 150) : clamp(run.elapsed / ROUND);
  if (state === 'run' || state === 'attract') {
    // Cadence proportionnelle à la largeur : la densité de bulles reste la même sur tous les écrans
    const widthK = clamp(view.width / 520, 0.8, 2.1);
    const rate = (state === 'attract' ? 1.6 : lerp(1.5, 3.8, progress) * (run.frenzy ? 1.35 : 1)) * widthK;
    spawnAcc += dt * rate;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      const rise = state === 'attract' ? 1 : lerp(1, 1.75, progress);
      if (rng.chance(0.2)) {
        const n = rng.int(2, 3);
        sim.spawnPod(view.width, H(), { n, rise });
        spawnAcc -= n - 1;
      } else sim.spawn(view.width, H(), { rise, specialChance: state === 'attract' ? 0.05 : 0.12 });
    }
  }
  sim.step(dt, view.width);
  const cl = sim.clusters();
  links = cl.links;
  groups = cl.groups;

  // Cascade d'éclatements
  for (let k = queue.length - 1; k >= 0; k--) {
    const q = queue[k];
    if (time >= q.at) {
      popEffect(q.b, q.i);
      queue.splice(k, 1);
    }
  }

  // Bulles qui atteignent la surface
  for (const b of sim.bubbles) {
    if (!b.alive || b.popping || b.y + b.r > 0) continue;
    b.alive = false;
    if (state === 'run' && b.kind === 'color') {
      run.escaped++;
      penalty(SCORE.escapePenalty, b.x, 40);
      breakCombo(b.x, 60, 'Échappée');
      fx.particles.emit(b.x, 4, { count: 8, color: '#9ddcff', speed: [40, 120], angle: -Math.PI / 2, spread: 1.4, gravity: 300, shape: 'circle', life: [0.3, 0.5] });
      gv.audio.play('back', { pitch: 0.7 });
      fx.shake.add(0.12);
    }
  }
  sim.remove();

  if (state === 'attract') {
    attractPop -= dt;
    if (attractPop <= 0) {
      attractPop = 1.3;
      const biggest = [...groups.values()].sort((a, b) => b.length - a.length)[0];
      if (biggest) schedule([...biggest], biggest[0]);
    }
  }

  if (state === 'run') {
    run.elapsed += dt;
    if (mode.id === 'chrono') {
      run.timeLeft -= dt;
      if (!run.frenzy && run.timeLeft <= FRENZY) {
        run.frenzy = true;
        gv.banner('Frénésie !', { color: '#ff8a5b' });
        gv.audio.play('powerup');
        fx.flash.trigger('#ff8a5b', 0.2, 3);
      }
      if (run.timeLeft <= 5 && Math.ceil(run.timeLeft) !== Math.ceil(run.timeLeft + dt)) gv.audio.play('countdown');
      if (run.timeLeft <= 0) endRun('Temps écoulé !');
    } else if (run.lives <= 0) endRun('Plus de cœurs !');
    if (time - run.lastHit > SCORE.comboWindow && run.combo > 1) run.combo = 1;
    const shown = Math.floor(run.points);
    if (shown !== run.shownScore) {
      run.shownScore = shown;
      gv.hud('score', formatInt(shown), true);
    }
  }
  if (state === 'ending') {
    endTimer -= realDt;
    if (endTimer <= 0) finish();
  }
}

function render() {
  const ctx = view.begin();
  const top = 0;
  const danger = sim.bubbles.some((b) => b.alive && !b.popping && b.kind === 'color' && b.y - b.r < zoneH()) ? 1 : 0;
  ctx.save();
  fx.shake.apply(ctx, view.width / 2, view.height / 2);
  drawLagoon(ctx, view, time, lagoon, run.frenzy);
  ctx.translate(0, top);
  drawSurface(ctx, view, time, zoneH(), danger * (0.5 + 0.5 * Math.sin(time * 8)));
  drawLinks(ctx, links, style());
  const st = style();
  for (const b of sim.bubbles) {
    if (!b.alive) continue;
    const pulse = b.popping ? 0.25 : 0;
    drawBubble(ctx, b, st, time, pulse);
  }
  drawClusterHints(ctx, links, groups, time);
  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  if (cursor.visible && state === 'run') {
    ctx.strokeStyle = '#f4efe4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, 16, 0, TAU);
    ctx.moveTo(cursor.x - 24, cursor.y);
    ctx.lineTo(cursor.x - 10, cursor.y);
    ctx.moveTo(cursor.x + 10, cursor.y);
    ctx.lineTo(cursor.x + 24, cursor.y);
    ctx.stroke();
  }
  ctx.restore();
  fx.flash.draw(ctx, view.width, view.height);
  if (state === 'run' || state === 'ending') drawHud(ctx, top);
}

function drawHud(ctx, top) {
  const w = view.width;
  ctx.save();
  ctx.translate(0, top);
  // Chrono (ou cœurs) au centre, sous la surface
  // Le chrono vit dans la bande de surface : il ne cache jamais les grappes en jeu
  const cx = w / 2;
  const y = Math.max(26, zoneH() / 2 - 2);
  ctx.fillStyle = 'rgba(8,23,38,0.8)';
  ctx.beginPath();
  ctx.roundRect(cx - 86, y - 18, 172, 44, 12);
  ctx.fill();
  if (mode.id === 'chrono') {
    const t = Math.max(0, run.timeLeft);
    const low = t <= 10;
    ctx.fillStyle = low ? (Math.sin(time * 10) > 0 ? '#ff5a4e' : '#ff8a5b') : '#f4efe4';
    ctx.font = '900 26px "Big Shoulders Display", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, cx, y + 1);
    ctx.fillStyle = '#05060b';
    ctx.fillRect(cx - 74, y + 16, 148, 5);
    ctx.fillStyle = run.frenzy ? '#ff8a5b' : '#3ee6a8';
    ctx.fillRect(cx - 74, y + 16, 148 * clamp(t / ROUND), 5);
  } else {
    for (let i = 0; i < MODES.zen.lives; i++) {
      const hx = cx - 56 + i * 28;
      ctx.fillStyle = i < run.lives ? '#ff5a4e' : '#353b58';
      ctx.beginPath();
      ctx.moveTo(hx, y + 10);
      ctx.bezierCurveTo(hx - 13, y, hx - 9, y - 10, hx, y - 4);
      ctx.bezierCurveTo(hx + 9, y - 10, hx + 13, y, hx, y + 10);
      ctx.fill();
    }
  }
  // Combo
  if (run.combo > 1) {
    const k = clamp((SCORE.comboWindow - (time - run.lastHit)) / SCORE.comboWindow);
    ctx.save();
    ctx.translate(34, y + 4);
    ctx.fillStyle = 'rgba(8,23,38,0.72)';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3ee6a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 19, -Math.PI / 2, -Math.PI / 2 + TAU * k);
    ctx.stroke();
    ctx.fillStyle = '#3ee6a8';
    ctx.font = '900 19px "Big Shoulders Display", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${run.combo}`, 0, 1);
    ctx.restore();
  }
  if (run.frenzy) {
    ctx.fillStyle = '#ff8a5b';
    ctx.font = '900 15px "Big Shoulders Display", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FRÉNÉSIE · POINTS ×2', cx, y + 42);
  }
  ctx.restore();
}

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const best = bestScore();
  gv.shell.startExtra.innerHTML = `
    <div class="bp-options">
      <div class="bp-row">
        <span class="bp-label" id="bp-mode-label">Mode</span>
        <div class="bp-modes" role="radiogroup" aria-labelledby="bp-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const locked = best < m.unlock;
              return `<button type="button" role="radio" class="bp-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}" ${locked ? 'aria-disabled="true"' : ''}>
                ${locked ? icon('lock') : m.id === 'zen' ? icon('heart') : icon('clock')}<span>${m.label}</span>
                <small>${locked ? `${formatInt(m.unlock)} pts` : m.id === 'zen' ? '5 cœurs, sans chrono' : '60 secondes'}</small>
              </button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="bp-row">
        <span class="bp-label" id="bp-style-label">Style</span>
        <div class="bp-styles" role="radiogroup" aria-labelledby="bp-style-label">
          ${STYLES.map((s) => {
            const locked = best < s.unlock;
            const label = locked ? `${s.name}, débloqué à ${formatInt(s.unlock)} points` : s.name;
            return `<button type="button" role="radio" class="bp-style bp-style--${s.id}" data-style="${s.id}" aria-checked="${store.data.style === s.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span class="bp-style__ball"></span>${locked ? `<span class="bp-style__lock">${icon('lock')}</span>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="bp-hint" id="bp-hint" aria-live="polite"></p>
    </div>`;
}

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    const t = b.dataset.style ? STYLES.find((s) => s.id === b.dataset.style) : MODES[b.dataset.mode];
    document.getElementById('bp-hint').textContent = `Atteins ${formatInt(t.unlock)} points pour débloquer ${b.dataset.style ? `le style ${t.name}` : 'le mode Zen'}.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.style) store.data.style = b.dataset.style;
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  store.save();
  gv.audio.play('select');
  renderOptions();
  document.querySelector(b.dataset.style ? `[data-style="${b.dataset.style}"]` : `[data-mode="${b.dataset.mode}"]`)?.focus();
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

window.__bubble = {
  get state() { return state; },
  get run() { return run; },
  get sim() { return sim; },
  get frameMs() { return frameMs; },
  get groups() { return groups; },
  get cursor() { return cursor; },
  // Position écran (CSS) d'une bulle, pour simuler un tap réel
  screenOf(b) {
    const r = view.canvas.getBoundingClientRect();
    return { x: r.left + view.offsetX + b.x * view.scale, y: r.top + view.offsetY + b.y * view.scale };
  },
};

resetRun();
for (let i = 0; i < 12; i++) {
  sim.spawn(view.width, H(), { specialChance: 0 });
  sim.bubbles[sim.bubbles.length - 1].y = H() * (0.2 + i * 0.07);
}
gv.hud('best', formatInt(bestScore()));
renderOptions();
loop.start();
gv.showStart();
