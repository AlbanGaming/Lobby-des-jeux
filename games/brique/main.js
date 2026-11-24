// Brique-à-brac (jeu secret de la boutique) — un casse-briques néon : renvoie la balle avec la
// raquette, casse tout le mur pour passer au niveau suivant. Briques dures (deux coups), métal
// (incassable) et explosives (emportent leurs voisines). Bonus : raquette large, multi-balle,
// ralenti, balle de feu (traverse les briques) et vie. Modes classique, turbo et mur du jour.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { createRng, dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { clamp, formatInt, TAU } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';

// Repère logique : un terrain en portrait, centré dans l'écran
const FW = 360;
const FH = 560;
const COLS = 10;
const GAP = 4;
const SIDE = 12;
const BW = (FW - SIDE * 2 - GAP * (COLS - 1)) / COLS;
const BH = 14;
const TOP = 64;
const PADDLE_Y = FH - 42;
const PADDLE_H = 12;
const BALL_R = 6;
const LIVES = 3;
const ROW_COLORS = ['#ff5fa2', '#ff8a5b', '#ffc93c', '#3ee6a8', '#4cc3ff', '#a68bff', '#ff5fa2', '#ffc93c', '#3ee6a8'];
const BONUS = {
  large: { name: 'Raquette large', short: 'Large', color: '#3ee6a8', time: 12, weight: 3 },
  multi: { name: 'Multi-balle', short: 'Multi', color: '#4cc3ff', time: 0, weight: 3 },
  lent: { name: 'Ralenti', short: 'Lent', color: '#a68bff', time: 8, weight: 2 },
  feu: { name: 'Balle de feu', short: 'Feu', color: '#ff8a5b', time: 6, weight: 2 },
  vie: { name: 'Vie en plus', short: 'Vie', color: '#ff5fa2', time: 0, weight: 1 },
};
const MODES = {
  classique: { id: 'classique', label: 'Classique', hint: 'Trois vies, des murs de plus en plus durs', unlock: 0, speed: 1 },
  turbo: { id: 'turbo', label: 'Turbo', hint: 'La balle file un quart plus vite', unlock: 3000, speed: 1.25 },
  jour: { id: 'jour', label: 'Mur du jour', hint: 'Les mêmes murs pour tout le monde', unlock: 0, speed: 1 },
};

const params = new URLSearchParams(location.search);
const store = createStore('brique', {
  version: 1,
  defaults: { mode: 'classique', bestLevel: 0, bonuses: [], daily: { day: '', best: 0, plays: 0 } },
});

const gv = bootGame('brique', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'level', label: 'Niveau' },
    { id: 'lives', label: 'Vies' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['icon:pointer'], text: 'Déplace la raquette à la souris ou au doigt (ou aux flèches). Clic, tap ou Espace pour lancer la balle.' },
    { keys: ['icon:bolt'], text: 'Plus tu casses de briques sans toucher la raquette, plus elles rapportent (jusqu’à ×5).' },
    { keys: ['icon:star'], text: 'Attrape les bonus qui tombent : raquette large, multi-balle, ralenti, balle de feu et vie en plus.' },
  ],
  onStart: startRun,
  onRestart: startRun,
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
});

const stage = document.getElementById('stage');
const view = createCanvas(stage, { mode: 'contain', width: FW, height: FH });
const fx = { particles: new Particles(600), popups: new Popups(24), shake: new Shake({ maxOffset: 7 }), flash: new Flash() };

let state = 'attract'; // attract | run | dying | over
let mode = MODES.classique;
let rng = createRng(1);
let seed = 1;
let level = 1;
let bricks = [];
let balls = [];
let caps = []; // bonus qui tombent
const paddle = { x: FW / 2, w: 64, target: null };
const active = { large: 0, lent: 0, feu: 0 };
let keys = { left: false, right: false };
let time = 0;
let dieT = 0;
let stuckT = 0;
let autoplay = params.has('autoplay');
const run = {};

const today = () => dayKey();
const modeOpen = (m) => (gv.best ?? 0) >= m.unlock;
const breakable = () => bricks.filter((b) => b.type !== 'metal');
const speed = () => Math.min(560, (300 + (level - 1) * 12) * mode.speed * (active.lent > 0 ? 0.7 : 1));
const paddleW = () => (active.large > 0 ? 100 : 64);

// ---------- Murs de briques ----------
function makeLevel(n) {
  const r = createRng(seed + n * 7919);
  const rows = Math.min(9, 4 + Math.floor(n * 0.8));
  const shape = n === 1 ? 0 : r.int(0, 4);
  const hardP = Math.min(0.45, 0.04 + n * 0.05);
  const metalP = n >= 3 ? Math.min(0.12, 0.02 * n) : 0;
  const out = [];
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < COLS / 2; c++) {
      let on = true;
      if (shape === 1) on = (row + c) % 2 === 0;
      else if (shape === 2) on = c >= Math.floor(row / 2) - 1; // pyramide inversée
      else if (shape === 3) on = r.chance(0.75);
      else if (shape === 4) on = row % 3 !== 2 || c % 2 === 0;
      if (!on) continue;
      const roll = r.next();
      const type = roll < metalP && row > 0 ? 'metal' : roll < metalP + 0.06 ? 'boom' : roll < metalP + 0.06 + hardP ? 'dur' : 'normal';
      for (const col of [c, COLS - 1 - c]) {
        out.push({ col, row, type, hp: type === 'dur' ? 2 : 1, x: SIDE + col * (BW + GAP), y: TOP + row * (BH + GAP), w: BW, h: BH, color: ROW_COLORS[row % ROW_COLORS.length], hitT: 0 });
      }
    }
  }
  // Toujours de quoi casser
  if (out.filter((b) => b.type !== 'metal').length < 10) return makeLevel(n + 100);
  return out;
}

function resetBall() {
  balls = [{ x: paddle.x, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, stuck: true, trail: [] }];
  stuckT = 0;
}

function loadLevel(n) {
  level = n;
  bricks = makeLevel(n);
  caps = [];
  Object.keys(active).forEach((k) => (active[k] = 0));
  resetBall();
  if (state === 'run') {
    run.levelLost = false;
    gv.hud('level', level, n > 1);
  }
}

function startRun() {
  mode = MODES[store.data.mode] ?? MODES.classique;
  if (!modeOpen(mode)) mode = MODES.classique;
  state = 'run';
  seed = mode.id === 'jour' ? dailySeed('brique') : Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
  rng = createRng(seed ^ 0x5bd1);
  Object.assign(run, { score: 0, lives: LIVES, bricks: 0, chain: 0, bestChain: 0, bonuses: new Set(), levelLost: false, perfect: 0 });
  paddle.x = FW / 2;
  paddle.target = null;
  fx.particles.clear();
  fx.popups.clear();
  loadLevel(1);
  gv.hud('score', 0);
  gv.hud('lives', run.lives);
  gv.hud('best', formatInt(gv.best ?? 0));
}

function launch() {
  for (const b of balls) {
    if (!b.stuck) continue;
    b.stuck = false;
    const a = (rng.next() - 0.5) * 0.6;
    b.vx = Math.sin(a) * speed();
    b.vy = -Math.cos(a) * speed();
    if (state === 'run') gv.audio.play('jump', { volume: 0.6 });
  }
}

// ---------- Collisions ----------
function hitBrick(br, ball) {
  const fire = active.feu > 0 && br.type !== 'metal';
  if (br.type === 'metal') {
    br.hitT = 0.15;
    gv.audio.play('tick', { volume: 0.5, throttle: 0.05 });
    return true;
  }
  br.hp -= fire ? 2 : 1;
  br.hitT = 0.15;
  if (br.hp > 0) {
    score(5, br);
    gv.audio.play('hit', { volume: 0.5, throttle: 0.04 });
    return true;
  }
  breakBrick(br);
  return !fire; // la balle de feu traverse
}

function breakBrick(br, blast = false) {
  const i = bricks.indexOf(br);
  if (i < 0) return;
  bricks.splice(i, 1);
  const cx = br.x + br.w / 2;
  const cy = br.y + br.h / 2;
  fx.particles.emit(cx, cy, { count: blast ? 8 : 12, colors: [br.color, '#ffffff'], speed: [40, 200], gravity: 300, size: [2, 4], shape: 'square', life: [0.3, 0.7] });
  if (state === 'run') {
    run.bricks++;
    run.chain++;
    run.bestChain = Math.max(run.bestChain, run.chain);
    const mult = Math.min(5, 1 + Math.floor(run.chain / 3));
    score(10 * mult, br, mult, blast); // pas de chiffre par brique soufflée : illisible
    gv.unlock('premiere-brique');
    if (run.chain >= 10) gv.unlock('chaine-10');
  }
  gv.audio.play('pop', { pitch: 0.9 + Math.min(run.chain ?? 0, 12) * 0.04, throttle: 0.03 });
  // Un bonus tombe de temps en temps
  if (!blast && rng.chance(0.13)) {
    const types = Object.keys(BONUS);
    const type = rng.weighted(types, (t) => BONUS[t].weight);
    caps.push({ type, x: cx, y: cy });
  }
  if (br.type === 'boom') explode(br);
}

function explode(br) {
  const cx = br.x + br.w / 2;
  const cy = br.y + br.h / 2;
  fx.particles.ring(cx, cy, { color: '#ffc93c', size: 6, growth: 260, life: 0.35, lineWidth: 4 });
  fx.shake.add(0.35);
  gv.audio.play('explode', { volume: 0.6, throttle: 0.08 });
  for (const n of bricks.filter((o) => Math.abs(o.col - br.col) <= 1 && Math.abs(o.row - br.row) <= 1 && o.type !== 'metal')) breakBrick(n, true);
}

function score(pts, br, mult = 1, quiet = false) {
  if (state !== 'run') return;
  run.score += pts;
  if (pts >= 10 && !quiet) fx.popups.add(br.x + br.w / 2, br.y, mult > 1 ? `+${pts} ×${mult}` : `+${pts}`, { size: mult > 2 ? 18 : 14, color: mult > 2 ? '#ffc93c' : '#fff8ec', rise: 26, life: 0.6 });
  gv.hud('score', formatInt(run.score), true);
  if (run.score >= 5000) gv.unlock('score-5000');
}

function collideBall(b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  // Murs
  if (b.x < BALL_R) {
    b.x = BALL_R;
    b.vx = Math.abs(b.vx);
  } else if (b.x > FW - BALL_R) {
    b.x = FW - BALL_R;
    b.vx = -Math.abs(b.vx);
  }
  if (b.y < BALL_R) {
    b.y = BALL_R;
    b.vy = Math.abs(b.vy);
  }
  // Raquette : l'endroit touché donne l'angle de renvoi
  const pw = paddle.w;
  if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y - BALL_R <= PADDLE_Y + PADDLE_H && Math.abs(b.x - paddle.x) <= pw / 2 + BALL_R) {
    const t = clamp((b.x - paddle.x) / (pw / 2), -1, 1);
    const a = t * 1.05;
    const s = speed();
    b.vx = Math.sin(a) * s;
    b.vy = -Math.cos(a) * s;
    b.y = PADDLE_Y - BALL_R;
    if (state === 'run') {
      run.chain = 0;
      gv.audio.play('tock', { pitch: 0.9 + Math.abs(t) * 0.3, volume: 0.7 });
    }
    fx.particles.emit(b.x, PADDLE_Y, { count: 5, colors: ['#4cc3ff', '#ffffff'], speed: [30, 120], gravity: 200, size: [1.5, 3], shape: 'circle', life: [0.15, 0.35] });
    return;
  }
  // Briques : une seule par pas, rebond sur l'axe le moins enfoncé
  for (const br of bricks) {
    const nx = clamp(b.x, br.x, br.x + br.w);
    const ny = clamp(b.y, br.y, br.y + br.h);
    const dx = b.x - nx;
    const dy = b.y - ny;
    if (dx * dx + dy * dy > BALL_R * BALL_R) continue;
    const bounce = hitBrick(br, b);
    if (bounce) {
      const ox = Math.min(b.x + BALL_R - br.x, br.x + br.w - (b.x - BALL_R));
      const oy = Math.min(b.y + BALL_R - br.y, br.y + br.h - (b.y - BALL_R));
      if (ox < oy) {
        b.vx = b.x < br.x + br.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
        b.x += Math.sign(b.vx) * (ox + 0.5);
      } else {
        b.vy = b.y < br.y + br.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
        b.y += Math.sign(b.vy) * (oy + 0.5);
      }
    }
    break;
  }
}

// Garde la vitesse voulue et évite les trajectoires presque horizontales
function normalize(b) {
  const s = speed();
  let { vx, vy } = b;
  const len = Math.hypot(vx, vy) || 1;
  vx = (vx / len) * s;
  vy = (vy / len) * s;
  const minVy = s * 0.28;
  if (Math.abs(vy) < minVy) {
    vy = Math.sign(vy || -1) * minVy;
    vx = Math.sign(vx || 1) * Math.sqrt(s * s - vy * vy);
  }
  b.vx = vx;
  b.vy = vy;
}

function takeBonus(c) {
  const b = BONUS[c.type];
  if (c.type === 'multi') {
    const extra = [];
    for (const ball of balls.filter((x) => !x.stuck).slice(0, 3)) {
      for (const da of [-0.35, 0.35]) {
        const a = Math.atan2(ball.vx, -ball.vy) + da;
        extra.push({ x: ball.x, y: ball.y, vx: Math.sin(a) * speed(), vy: -Math.cos(a) * speed(), stuck: false, trail: [] });
      }
    }
    balls.push(...extra);
  } else if (c.type === 'vie') {
    if (state === 'run') {
      run.lives = Math.min(5, run.lives + 1);
      gv.hud('lives', run.lives, true);
    }
  } else active[c.type] = b.time;
  fx.particles.ring(c.x, PADDLE_Y, { color: b.color, size: 5, growth: 180, life: 0.35, lineWidth: 3 });
  if (state === 'run') {
    run.bonuses.add(c.type);
    store.data.bonuses = [...new Set([...store.data.bonuses, c.type])];
    store.save();
    if (store.data.bonuses.length >= Object.keys(BONUS).length) gv.unlock('bonus');
    gv.audio.play('powerup');
    gv.banner(b.name, { color: b.color });
  }
}

function loseBall() {
  if (state === 'attract') return resetBall();
  run.lives--;
  run.levelLost = true;
  run.chain = 0;
  gv.hud('lives', Math.max(0, run.lives), true);
  fx.shake.add(0.5);
  fx.flash.trigger('#ff5a4e', 0.25, 4);
  if (run.lives <= 0) {
    state = 'dying';
    dieT = motion.reduced ? 0.6 : 1.1;
    gv.audio.play('explode');
    loop.hitstop(0.08);
    return;
  }
  gv.audio.play('lose');
  Object.keys(active).forEach((k) => (active[k] = 0));
  caps = [];
  resetBall();
}

function clearLevel() {
  if (state === 'attract') return loadLevel(level + 1 > 3 ? 1 : level + 1);
  const bonus = 100 * level + 50 * run.lives;
  run.score += bonus;
  if (!run.levelLost) {
    run.perfect++;
    gv.unlock('parfait');
  }
  gv.hud('score', formatInt(run.score), true);
  gv.audio.play('levelUp');
  gv.banner(`Niveau ${level + 1} · +${bonus}`, { color: '#ffc93c' });
  fx.flash.trigger('#ffffff', 0.2, 3);
  if (level + 1 >= 3) gv.unlock('niveau-3');
  if (level + 1 >= 6) gv.unlock('niveau-6');
  loadLevel(level + 1);
}

function finish() {
  state = 'over';
  store.data.bestLevel = Math.max(store.data.bestLevel, level);
  if (mode.id === 'jour') {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), best: 0, plays: 0 });
    d.plays++;
    d.best = Math.max(d.best, run.score);
    gv.unlock('du-jour');
  }
  store.save();
  const next = Object.values(MODES).find((m) => m.unlock > (gv.best ?? 0) && m.unlock > run.score);
  gv.gameOver({
    score: run.score,
    stats: { score: run.score, level, chain: run.bestChain, bricks: run.bricks, daily: mode.id === 'jour' ? 1 : 0 },
    extraStats: [
      { label: 'Niveau', value: formatInt(level) },
      { label: 'Briques', value: formatInt(run.bricks) },
      { label: 'Plus longue série', value: formatInt(run.bestChain) },
    ],
    kicker: mode.label,
    title: level > 1 ? `Arrivé au niveau ${level}` : 'La balle t’a échappé',
    nextUnlock: next ? { label: `Mode ${next.label}`, current: Math.max(gv.best ?? 0, run.score), target: next.unlock } : undefined,
  });
  gv.hud('best', formatInt(gv.best ?? 0));
  renderOptions();
}

// ---------- Pilote (démo et tests) : vise l'endroit où tombera la balle la plus basse ----------
function landingX(b) {
  if (b.vy <= 0) return b.x;
  const t = (PADDLE_Y - BALL_R - b.y) / b.vy;
  const span = FW - BALL_R * 2;
  let x = b.x - BALL_R + b.vx * t;
  x = ((x % (span * 2)) + span * 2) % (span * 2);
  return BALL_R + (x > span ? span * 2 - x : x);
}
function pilot() {
  const live = balls.filter((b) => !b.stuck);
  if (!live.length) return;
  const down = live.filter((b) => b.vy > 0).sort((a, b) => b.y - a.y)[0] ?? live[0];
  // Léger décalage pour varier les angles
  paddle.target = landingX(down) + Math.sin(time * 1.3) * paddle.w * 0.25;
}

// ---------- Boucle ----------
function update(dt, realDt) {
  time += dt;
  fx.particles.update(realDt);
  fx.popups.update(realDt);
  fx.shake.update(realDt);
  fx.flash.update(realDt);
  for (const br of bricks) br.hitT = Math.max(0, br.hitT - realDt);
  if (state === 'dying') {
    dieT -= realDt;
    if (dieT <= 0) finish();
    return;
  }
  if (state !== 'run' && state !== 'attract') return;
  for (const k of Object.keys(active)) active[k] = Math.max(0, active[k] - dt);
  // Raquette
  paddle.w += (paddleW() - paddle.w) * Math.min(1, dt * 10);
  if (state === 'attract' || autoplay) pilot();
  const kdir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (kdir) {
    paddle.target = null;
    paddle.x += kdir * 520 * dt;
  } else if (paddle.target !== null) {
    paddle.x += (paddle.target - paddle.x) * Math.min(1, dt * 22);
  }
  paddle.x = clamp(paddle.x, paddle.w / 2, FW - paddle.w / 2);
  // Balles
  if (balls.some((b) => b.stuck)) {
    stuckT += dt;
    if (state === 'attract' || autoplay ? stuckT > 0.6 : false) launch();
  }
  for (const b of balls) {
    if (b.stuck) {
      b.x = paddle.x;
      b.y = PADDLE_Y - BALL_R - 1;
      continue;
    }
    normalize(b);
    const steps = Math.max(1, Math.ceil((speed() * dt) / (BALL_R * 0.7)));
    for (let s = 0; s < steps; s++) collideBall(b, dt / steps);
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 7) b.trail.shift();
  }
  const before = balls.length;
  balls = balls.filter((b) => b.y < FH + BALL_R * 2);
  if (before && !balls.length) loseBall();
  // Bonus qui tombent
  for (const c of caps) c.y += 130 * dt;
  caps = caps.filter((c) => {
    if (c.y > PADDLE_Y - 8 && c.y < PADDLE_Y + PADDLE_H + 8 && Math.abs(c.x - paddle.x) < paddle.w / 2 + 12) {
      takeBonus(c);
      return false;
    }
    return c.y < FH + 20;
  });
  if ((state === 'run' || state === 'attract') && !breakable().length) clearLevel();
}

function render() {
  const ctx = view.begin();
  // Fond sur tout l'écran, au-delà du terrain
  const ex = view.offsetX / view.scale;
  const ey = view.offsetY / view.scale;
  ctx.fillStyle = '#070912';
  ctx.fillRect(-ex, -ey, FW + ex * 2, FH + ey * 2);
  ctx.save();
  fx.shake.apply(ctx, FW / 2, FH / 2);
  // Terrain
  ctx.fillStyle = '#0d1020';
  ctx.fillRect(0, 0, FW, FH);
  ctx.strokeStyle = 'rgba(76,195,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = 20; x < FW; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FH);
    ctx.stroke();
  }
  ctx.strokeStyle = '#4cc3ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1.5, FH);
  ctx.lineTo(1.5, 1.5);
  ctx.lineTo(FW - 1.5, 1.5);
  ctx.lineTo(FW - 1.5, FH);
  ctx.stroke();
  // Briques
  for (const br of bricks) drawBrick(ctx, br);
  // Bonus qui tombent
  for (const c of caps) {
    const b = BONUS[c.type];
    glow(ctx, c.x, c.y, 20, b.color);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(c.x - 15, c.y - 7, 30, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#0d1020';
    ctx.font = '900 9px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.short.toUpperCase(), c.x, c.y + 0.5);
  }
  // Raquette
  const px = paddle.x - paddle.w / 2;
  glow(ctx, paddle.x, PADDLE_Y + PADDLE_H / 2, paddle.w * 0.7, active.large > 0 ? '#3ee6a8' : '#4cc3ff');
  const pg = ctx.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H);
  pg.addColorStop(0, active.large > 0 ? '#7ff5c8' : '#8edcff');
  pg.addColorStop(1, active.large > 0 ? '#13996a' : '#1a7fb8');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.roundRect(px, PADDLE_Y, paddle.w, PADDLE_H, PADDLE_H / 2);
  ctx.fill();
  // Balles et leur traînée
  const fire = active.feu > 0;
  for (const b of balls) {
    b.trail.forEach((p, i) => {
      ctx.globalAlpha = ((i + 1) / b.trail.length) * 0.35;
      ctx.fillStyle = fire ? '#ff8a5b' : '#4cc3ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R * (0.4 + (i / b.trail.length) * 0.5), 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    glow(ctx, b.x, b.y, BALL_R * 3.2, fire ? '#ff8a5b' : '#ffffff');
    ctx.fillStyle = fire ? '#ffd29a' : '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, TAU);
    ctx.fill();
  }
  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  ctx.restore();
  // Bonus actifs et série
  let bx = 8;
  for (const [type, t] of Object.entries(active)) {
    if (t <= 0) continue;
    ctx.fillStyle = 'rgba(5,6,11,0.75)';
    ctx.beginPath();
    ctx.roundRect(bx, FH - 22, 64, 18, 9);
    ctx.fill();
    ctx.fillStyle = BONUS[type].color;
    ctx.font = '800 10px Rubik, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${BONUS[type].short} ${Math.ceil(t)}`, bx + 9, FH - 12.5);
    bx += 70;
  }
  if (state === 'run' && run.chain >= 3) {
    ctx.fillStyle = '#ffc93c';
    ctx.font = '900 18px "Big Shoulders Display", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Série ${run.chain} · ×${Math.min(5, 1 + Math.floor(run.chain / 3))}`, FW - 10, FH - 10);
  }
  if (state === 'run' && balls.some((b) => b.stuck) && !autoplay) {
    ctx.globalAlpha = 0.6 + Math.sin(time * 5) * 0.3;
    ctx.fillStyle = '#fff8ec';
    ctx.font = '800 13px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Touche ou Espace pour lancer', FW / 2, PADDLE_Y - 40);
    ctx.globalAlpha = 1;
  }
  fx.flash.draw(ctx, FW, FH);
}

function drawBrick(ctx, br) {
  const lift = br.hitT > 0 ? 1.5 : 0;
  const x = br.x;
  const y = br.y - lift;
  if (br.type === 'metal') {
    const g = ctx.createLinearGradient(x, y, x, y + br.h);
    g.addColorStop(0, '#c9d2e3');
    g.addColorStop(1, '#5b6478');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, br.w, br.h, 3);
    ctx.fill();
    ctx.fillStyle = '#2a3042';
    for (const sx of [x + 4, x + br.w - 4]) {
      ctx.beginPath();
      ctx.arc(sx, y + br.h / 2, 1.6, 0, TAU);
      ctx.fill();
    }
    return;
  }
  const col = br.type === 'boom' ? '#ffc93c' : br.color;
  ctx.fillStyle = br.type === 'dur' && br.hp > 1 ? shade(col) : col;
  ctx.globalAlpha = br.type === 'dur' && br.hp === 1 ? 0.75 : 1;
  ctx.beginPath();
  ctx.roundRect(x, y, br.w, br.h, 3);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x + 3, y + 2, br.w - 6, 2);
  if (br.type === 'dur') {
    ctx.strokeStyle = br.hp > 1 ? '#fff8ec' : 'rgba(255,248,236,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 2, y + 2, br.w - 4, br.h - 4);
  }
  if (br.type === 'boom') {
    ctx.fillStyle = '#2b1012';
    ctx.beginPath();
    ctx.arc(x + br.w / 2, y + br.h / 2 + 1, 3.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#2b1012';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + br.w / 2 + 2, y + br.h / 2 - 2);
    ctx.lineTo(x + br.w / 2 + 5, y + 2);
    ctx.stroke();
  }
  if (br.hitT > 0) {
    ctx.fillStyle = `rgba(255,255,255,${br.hitT * 3})`;
    ctx.beginPath();
    ctx.roundRect(x, y, br.w, br.h, 3);
    ctx.fill();
  }
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, 0.35));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
const hexA = (h, a) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
// Version plus sombre d'une couleur (briques dures intactes)
const shade = (h) => {
  const n = parseInt(h.slice(1), 16);
  const ch = (s) => Math.round(((n >> s) & 255) * 0.6);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// ---------- Saisie ----------
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', q: 'left', a: 'left', d: 'right' };
document.addEventListener('keydown', (e) => {
  if (state !== 'run' || !gv.playing || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
  if (k) {
    e.preventDefault();
    keys[k] = true;
  } else if (e.key === ' ' || e.key === 'ArrowUp') {
    e.preventDefault();
    launch();
  }
});
document.addEventListener('keyup', (e) => {
  const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
  if (k) keys[k] = false;
});
window.addEventListener('blur', () => (keys = { left: false, right: false }));
const aim = (e) => {
  if (state !== 'run' || !gv.playing || autoplay) return;
  paddle.target = view.toLogical(e.clientX, e.clientY).x;
};
view.canvas.addEventListener('pointermove', aim);
view.canvas.addEventListener('pointerdown', (e) => {
  aim(e);
  if (state === 'run' && gv.playing) launch();
});
view.canvas.style.touchAction = 'none';

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const dd = store.data.daily;
  gv.shell.startExtra.innerHTML = `
    <div class="bq-options">
      <span class="bq-label" id="bq-mode-label">Mode · meilleur niveau ${store.data.bestLevel || '—'}</span>
      <div class="bq-modes" role="radiogroup" aria-labelledby="bq-mode-label">
        ${Object.values(MODES)
          .map((m) => {
            const open = modeOpen(m);
            const sub = !open ? `Marque ${formatInt(m.unlock)} points` : m.id === 'jour' && dd.day === today() ? `Meilleur : ${formatInt(dd.best)} · ${dd.plays} essai${dd.plays > 1 ? 's' : ''}` : m.hint;
            return `<button type="button" role="radio" class="bq-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}" ${open ? '' : 'aria-disabled="true"'}>${icon(open ? { classique: 'grid', turbo: 'bolt', jour: 'calendar' }[m.id] : 'lock')}<span>${m.label}</span><small>${esc(sub)}</small></button>`;
          })
          .join('')}
      </div>
      <p class="bq-hint" id="bq-hint">Merci d’avoir débloqué ce jeu secret !</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    document.getElementById('bq-hint').textContent = `Marque ${formatInt(MODES[b.dataset.mode].unlock)} points pour ouvrir ce mode.`;
    gv.audio.play('error');
    return;
  }
  store.data.mode = b.dataset.mode;
  store.save();
  gv.audio.play('select');
  renderOptions();
  gv.shell.startExtra.querySelector(`[data-mode="${b.dataset.mode}"]`)?.focus();
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

window.__bq = {
  get state() { return state; },
  get run() { return run; },
  get level() { return level; },
  get balls() { return balls; },
  get bricks() { return bricks; },
  get caps() { return caps; },
  get paddle() { return paddle; },
  get active() { return active; },
  get frameMs() { return frameMs; },
  set autoplay(v) { autoplay = v; },
  launch,
  // Tests : vide le mur (le métal reste), fait tomber un bonus sur la raquette, perd la balle
  clearWall() { bricks = bricks.filter((b) => b.type === 'metal'); },
  dropBonus(type) { caps.push({ type, x: paddle.x, y: PADDLE_Y - 30 }); },
  dropBall() { for (const b of balls) { b.stuck = false; b.x = 4; b.y = FH + 40; } },
  layout: (n, s) => { seed = s; return makeLevel(n).map((b) => `${b.col},${b.row},${b.type}`); },
};

seed = 7;
loadLevel(1);
renderOptions();
gv.hud('best', formatInt(gv.best ?? 0));
gv.hud('level', 1);
gv.hud('lives', LIVES);
loop.start();
gv.showStart();
