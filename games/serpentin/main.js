// Serpentin (jeu secret de la boutique) — un serpent néon sur une grille : mange les fruits pour
// grandir, enchaîne-les vite pour multiplier les points. Bonus : étoile (×2), sablier (ralenti),
// fantôme (traverse ton corps), ciseaux (raccourcit la queue). Modes classique, sans murs,
// labyrinthe et serpent du jour.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { createRng, dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { lerp, formatInt, TAU } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';

const W = 20;
const H = 20;
const START_LEN = 4;
const COMBO_WINDOW = 3; // secondes pour enchaîner deux fruits
const BONUS = {
  etoile: { name: 'Étoile', color: '#ffc93c', time: 8, text: 'Points ×2' },
  sablier: { name: 'Sablier', color: '#4cc3ff', time: 6, text: 'Ralenti' },
  fantome: { name: 'Fantôme', color: '#c49aff', time: 5, text: 'Traverse ton corps' },
  ciseaux: { name: 'Ciseaux', color: '#3ee6a8', time: 0, text: 'Queue raccourcie' },
};
const MODES = {
  classique: { id: 'classique', label: 'Classique', hint: 'Les murs sont mortels', unlock: 0 },
  libre: { id: 'libre', label: 'Sans murs', hint: 'On ressort de l’autre côté', unlock: 200 },
  labyrinthe: { id: 'labyrinthe', label: 'Labyrinthe', hint: 'Des blocs barrent le passage', unlock: 400 },
  jour: { id: 'jour', label: 'Serpent du jour', hint: 'Mêmes blocs et fruits pour tous', unlock: 0 },
};
const SKINS = [
  { id: 'menthe', name: 'Menthe', unlock: 0, head: '#3ee6a8', body: '#13996a' },
  { id: 'braise', name: 'Braise', unlock: 15, head: '#ff8a5b', body: '#c4532a' },
  { id: 'ciel', name: 'Ciel', unlock: 30, head: '#4cc3ff', body: '#1a7fb8' },
  { id: 'arcenciel', name: 'Arc-en-ciel', unlock: 50, head: '#ffffff', body: 'rainbow' },
];
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const params = new URLSearchParams(location.search);
const store = createStore('serpentin', {
  version: 1,
  defaults: { mode: 'classique', skin: 'menthe', bestLen: 0, bonuses: [], daily: { day: '', best: 0, plays: 0 } },
});

const gv = bootGame('serpentin', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'len', label: 'Longueur' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['←', '→', '↑', '↓'], text: 'Dirige le serpent aux flèches (ou ZQSD), ou en glissant le doigt.' },
    { keys: ['icon:bolt'], text: 'Enchaîne les fruits en moins de 3 secondes : le multiplicateur grimpe jusqu’à ×5.' },
    { keys: ['icon:star'], text: 'Bonus : étoile ×2, sablier ralentit, fantôme traverse ton corps, ciseaux raccourcit la queue.' },
  ],
  onStart: startRun,
  onRestart: startRun,
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
});

const stage = document.getElementById('stage');
const view = createCanvas(stage, { mode: 'fill' });
const fx = { particles: new Particles(500), popups: new Popups(20), shake: new Shake({ maxOffset: 8 }), flash: new Flash() };

let state = 'attract'; // attract | run | dying | over
let mode = MODES.classique;
let rng = createRng(1);
let snake = []; // [{x,y}] tête en premier
let prev = []; // positions au pas précédent (interpolation)
let dir = 'right';
let queue = []; // virages en attente
let food = null;
let bonus = null; // { type, x, y, ttl }
let blocks = new Set();
let grow = 0;
let acc = 0;
let time = 0;
let dieT = 0;
let autoplay = params.has('autoplay');
const active = { etoile: 0, sablier: 0, fantome: 0 };
const run = {};
const L = { cell: 20, ox: 0, oy: 0 };

const today = () => dayKey();
const key = (x, y) => y * W + x;
const skin = () => SKINS.find((s) => s.id === store.data.skin) ?? SKINS[0];
const modeOpen = (m) => (gv.best ?? 0) >= m.unlock;
const stepTime = () => Math.max(0.055, 0.15 - snake.length * 0.0018) * (active.sablier > 0 ? 1.7 : 1);

// ---------- Partie ----------
function setup(seed, m) {
  rng = createRng(seed);
  blocks = new Set();
  if (m.id === 'labyrinthe' || m.id === 'jour') {
    // Blocs symétriques, en laissant le centre libre pour démarrer
    const n = m.id === 'jour' ? 14 : 18;
    for (let k = 0; k < n; k++) {
      const x = rng.int(1, W / 2 - 1);
      const y = rng.int(1, H - 2);
      if (Math.abs(y - H / 2) < 3 && x > W / 2 - 7) continue;
      blocks.add(key(x, y));
      blocks.add(key(W - 1 - x, H - 1 - y));
    }
  }
  const cy = H / 2;
  snake = Array.from({ length: START_LEN }, (_, i) => ({ x: 6 - i, y: cy }));
  prev = snake.map((p) => ({ ...p }));
  dir = 'right';
  queue = [];
  grow = 0;
  acc = 0;
  bonus = null;
  Object.keys(active).forEach((k) => (active[k] = 0));
  placeFood();
}

function startRun() {
  mode = MODES[store.data.mode] ?? MODES.classique;
  if (!modeOpen(mode)) mode = MODES.classique;
  state = 'run';
  setup(mode.id === 'jour' ? dailySeed('serpentin') : Number(params.get('seed')) || Math.floor(Math.random() * 1e9), mode);
  Object.assign(run, { score: 0, fruits: 0, combo: 0, bestCombo: 0, lastFruit: -10, bonuses: new Set(), reason: '' });
  fx.particles.clear();
  fx.popups.clear();
  loop.timeScale = 1;
  gv.hud('score', 0);
  gv.hud('len', snake.length);
  gv.hud('best', formatInt(gv.best ?? 0));
}

function freeCell() {
  const busy = new Set(snake.map((p) => key(p.x, p.y)));
  for (let k = 0; k < 500; k++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, H - 1);
    const i = key(x, y);
    if (!busy.has(i) && !blocks.has(i) && !(food && food.x === x && food.y === y) && !(bonus && bonus.x === x && bonus.y === y)) return { x, y };
  }
  return null;
}
function placeFood() {
  food = freeCell();
  if (food) food.t = time;
}

function turn(d) {
  if (state !== 'run' && state !== 'attract') return;
  const last = queue.length ? queue[queue.length - 1] : dir;
  const [dx, dy] = DIRS[d];
  const [lx, ly] = DIRS[last];
  if (dx === -lx && dy === -ly) return; // pas de demi-tour sur place
  if (d === last) return;
  if (queue.length < 2) queue.push(d);
}

function stepSnake() {
  if (queue.length) dir = queue.shift();
  const [dx, dy] = DIRS[dir];
  let nx = snake[0].x + dx;
  let ny = snake[0].y + dy;
  const wrap = mode.id === 'libre' || state === 'attract';
  if (wrap) {
    nx = (nx + W) % W;
    ny = (ny + H) % H;
  }
  // Chaque anneau glisse de son ancienne case vers celle de l'anneau qui le précède
  const old = snake.map((p) => ({ ...p }));
  if (nx < 0 || ny < 0 || nx >= W || ny >= H) return die('Dans le mur !');
  if (blocks.has(key(nx, ny))) return die('Contre un bloc !');
  const tailFree = grow === 0;
  const body = snake.slice(0, tailFree ? -1 : snake.length);
  if (active.fantome <= 0 && body.some((p) => p.x === nx && p.y === ny)) return die('Mordu par ta queue !');
  snake.unshift({ x: nx, y: ny });
  prev = old;
  if (grow > 0) {
    grow--;
    prev.push({ ...old[old.length - 1] });
  } else snake.pop();
  if (food && nx === food.x && ny === food.y) eat();
  if (bonus && nx === bonus.x && ny === bonus.y) takeBonus();
}

function eat() {
  const p = center(food.x, food.y);
  grow += 1;
  if (state === 'run') {
    run.fruits++;
    run.combo = time - run.lastFruit <= COMBO_WINDOW ? Math.min(5, run.combo + 1) : 1;
    run.lastFruit = time;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    const pts = 10 * run.combo * (active.etoile > 0 ? 2 : 1);
    run.score += pts;
    gv.audio.play('coin', { pitch: 0.9 + run.combo * 0.08 });
    fx.popups.add(p.x, p.y - 10, run.combo > 1 ? `+${pts} ×${run.combo}` : `+${pts}`, { size: run.combo > 2 ? 22 : 17, color: run.combo > 2 ? '#ffc93c' : '#fff8ec', rise: 34 });
    gv.hud('score', formatInt(run.score), true);
    gv.hud('len', snake.length + grow, true);
    if (run.combo >= 5) gv.unlock('combo-5');
    const len = snake.length + grow;
    if (len >= 25) gv.unlock('long-25');
    if (len >= 50) gv.unlock('long-50');
    if (run.score >= 500) gv.unlock('score-500');
    gv.unlock('premier-fruit');
  }
  fx.particles.emit(p.x, p.y, { count: 16, colors: ['#ff5a4e', '#ffc93c', '#ffffff'], speed: [60, 220], gravity: 0, size: [2, 4], shape: 'circle', life: [0.2, 0.5] });
  placeFood();
  // De temps en temps, un bonus apparaît
  if (!bonus && run.fruits > 2 && rng.chance(0.28)) {
    const c = freeCell();
    if (c) bonus = { type: rng.pick(Object.keys(BONUS)), ...c, ttl: 7 };
  }
}

function takeBonus() {
  const b = BONUS[bonus.type];
  const p = center(bonus.x, bonus.y);
  if (bonus.type === 'ciseaux') {
    const cut = Math.min(3, snake.length - START_LEN);
    for (let k = 0; k < cut; k++) {
      const t = snake.pop();
      prev.pop();
      const q = center(t.x, t.y);
      fx.particles.emit(q.x, q.y, { count: 6, colors: [skin().head, '#ffffff'], speed: [40, 140], gravity: 0, size: [2, 4], shape: 'square', life: [0.2, 0.5] });
    }
  } else active[bonus.type] = b.time;
  if (state === 'run') {
    run.bonuses.add(bonus.type);
    store.data.bonuses = [...new Set([...store.data.bonuses, bonus.type])];
    store.save();
    if (store.data.bonuses.length >= 4) gv.unlock('bonus');
    gv.audio.play('powerup');
    gv.banner(b.text, { color: b.color });
    gv.hud('len', snake.length + grow);
  }
  fx.particles.ring(p.x, p.y, { color: b.color, size: 4, growth: 200, life: 0.4, lineWidth: 4 });
  bonus = null;
}

function die(reason) {
  if (state === 'attract') {
    setup(Math.floor(Math.random() * 1e6), MODES.libre);
    return;
  }
  state = 'dying';
  run.reason = reason;
  dieT = motion.reduced ? 0.6 : 1.2;
  fx.shake.add(0.6);
  fx.flash.trigger('#ff5a4e', 0.3, 4);
  gv.audio.play('explode');
  loop.hitstop(0.08);
  for (const s of snake) {
    const p = center(s.x, s.y);
    fx.particles.emit(p.x, p.y, { count: 4, colors: [skin().head, skin().body === 'rainbow' ? '#ff8fab' : skin().body, '#ffffff'], speed: [40, 260], gravity: 200, size: [2, 5], shape: 'square', life: [0.4, 1] });
  }
}

function finish() {
  state = 'over';
  const len = snake.length + grow;
  const before = store.data.bestLen;
  store.data.bestLen = Math.max(store.data.bestLen, len);
  if (mode.id === 'jour') {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), best: 0, plays: 0 });
    d.plays++;
    d.best = Math.max(d.best, run.score);
    gv.unlock('du-jour');
  }
  if (mode.id === 'libre') gv.unlock('sans-murs');
  store.save();
  for (const s of SKINS) if (s.unlock > 0 && before < s.unlock && store.data.bestLen >= s.unlock) toast({ title: 'Nouvelle couleur !', text: `Serpent ${s.name} : choisis-le à l’accueil.`, iconName: 'palette', tone: 'var(--mint)' });
  const nextMode = Object.values(MODES).find((m) => m.unlock > (gv.best ?? 0) && m.unlock > run.score);
  gv.gameOver({
    score: run.score,
    stats: { score: run.score, length: len, combo: run.bestCombo, daily: mode.id === 'jour' ? 1 : 0 },
    extraStats: [
      { label: 'Longueur', value: formatInt(len) },
      { label: 'Fruits', value: formatInt(run.fruits) },
      { label: 'Combo', value: `×${run.bestCombo}` },
    ],
    kicker: mode.label,
    title: run.reason,
    nextUnlock: nextMode ? { label: `Mode ${nextMode.label}`, current: Math.max(gv.best ?? 0, run.score), target: nextMode.unlock } : undefined,
  });
  gv.hud('best', formatInt(gv.best ?? 0));
  renderOptions();
}

// ---------- Pilote (démo et tests) : chemin le plus court vers le fruit ----------
function pilot() {
  const head = snake[0];
  const body = new Set(snake.slice(0, -1).map((p) => key(p.x, p.y)));
  const wrap = mode.id === 'libre' || state === 'attract';
  const target = food;
  if (!target) return;
  const seen = new Map([[key(head.x, head.y), null]]);
  const q = [head];
  while (q.length) {
    const c = q.shift();
    if (c.x === target.x && c.y === target.y) break;
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      let x = c.x + dx;
      let y = c.y + dy;
      if (wrap) {
        x = (x + W) % W;
        y = (y + H) % H;
      }
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = key(x, y);
      if (seen.has(k) || body.has(k) || blocks.has(k)) continue;
      seen.set(k, { from: c, d });
      q.push({ x, y });
    }
  }
  let k = key(target.x, target.y);
  if (!seen.has(k)) return;
  let first = null;
  while (seen.get(k)) {
    const s = seen.get(k);
    first = s.d;
    k = key(s.from.x, s.from.y);
  }
  if (first) {
    queue = [];
    const [dx, dy] = DIRS[first];
    const [lx, ly] = DIRS[dir];
    if (!(dx === -lx && dy === -ly)) queue.push(first);
  }
}

// ---------- Boucle ----------
function update(dt, realDt) {
  time += dt;
  fx.particles.update(realDt);
  fx.popups.update(realDt);
  fx.shake.update(realDt);
  fx.flash.update(realDt);
  if (state === 'run' || state === 'attract') {
    for (const k of Object.keys(active)) active[k] = Math.max(0, active[k] - dt);
    if (bonus) {
      bonus.ttl -= dt;
      if (bonus.ttl <= 0) bonus = null;
    }
    if (state === 'run' && run.combo && time - run.lastFruit > COMBO_WINDOW) run.combo = 0;
    acc += dt;
    const st = stepTime();
    while (acc >= st && (state === 'run' || state === 'attract')) {
      acc -= st;
      if (state === 'attract' || autoplay) pilot();
      stepSnake();
    }
  } else if (state === 'dying') {
    dieT -= realDt;
    if (dieT <= 0) finish();
  }
}

function measure() {
  const top = 8;
  L.cell = Math.floor(Math.min((view.width - 16) / W, (view.height - top - 12) / H));
  L.ox = Math.round((view.width - L.cell * W) / 2);
  L.oy = Math.round(top + (view.height - top - L.cell * H) / 2);
}
const center = (x, y) => ({ x: L.ox + (x + 0.5) * L.cell, y: L.oy + (y + 0.5) * L.cell });

function render() {
  measure();
  const ctx = view.begin();
  const c = L.cell;
  ctx.fillStyle = '#070912';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.save();
  fx.shake.apply(ctx, view.width / 2, view.height / 2);
  // Plateau
  ctx.fillStyle = '#0d1020';
  ctx.fillRect(L.ox, L.oy, c * W, c * H);
  ctx.fillStyle = 'rgba(76,195,255,0.07)';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 2) ctx.fillRect(L.ox + x * c, L.oy + y * c, c, c);
  const wall = mode.id === 'libre' || state === 'attract' ? 'rgba(76,195,255,0.25)' : '#ff5fa2';
  ctx.strokeStyle = wall;
  ctx.lineWidth = 3;
  ctx.setLineDash(mode.id === 'libre' || state === 'attract' ? [8, 8] : []);
  ctx.strokeRect(L.ox - 2, L.oy - 2, c * W + 4, c * H + 4);
  ctx.setLineDash([]);
  // Blocs
  for (const i of blocks) {
    const x = L.ox + (i % W) * c;
    const y = L.oy + Math.floor(i / W) * c;
    ctx.fillStyle = '#35195a';
    ctx.fillRect(x + 1, y + 1, c - 2, c - 2);
    ctx.strokeStyle = '#a68bff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, c - 4, c - 4);
  }
  // Fruit
  if (food) {
    const p = center(food.x, food.y);
    const s = c * 0.36 * (1 + Math.sin(time * 6) * 0.08);
    glow(ctx, p.x, p.y, c * 0.9, '255,90,78');
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.arc(p.x, p.y + 1, s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3ee6a8';
    ctx.beginPath();
    ctx.ellipse(p.x + s * 0.35, p.y - s * 0.9, s * 0.45, s * 0.22, -0.6, 0, TAU);
    ctx.fill();
  }
  // Bonus
  if (bonus) {
    const b = BONUS[bonus.type];
    const p = center(bonus.x, bonus.y);
    const blink = bonus.ttl < 2 && Math.floor(time * 8) % 2;
    if (!blink) {
      glow(ctx, p.x, p.y, c, hexRgb(b.color));
      ctx.fillStyle = b.color;
      drawBonus(ctx, bonus.type, p.x, p.y, c * 0.38, time);
    }
  }
  // Serpent, interpolé entre deux pas
  const k = state === 'run' || state === 'attract' ? Math.min(1, acc / stepTime()) : 1;
  const sk = skin();
  const ghost = active.fantome > 0;
  for (let i = snake.length - 1; i >= 0; i--) {
    const a = prev[i] ?? snake[i];
    const b = snake[i];
    // Pas d'interpolation à travers les bords (sans murs)
    const jump = Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1;
    const x = jump ? b.x : lerp(a.x, b.x, k);
    const y = jump ? b.y : lerp(a.y, b.y, k);
    const px = L.ox + (x + 0.5) * c;
    const py = L.oy + (y + 0.5) * c;
    const t = i / Math.max(1, snake.length - 1);
    const col = sk.body === 'rainbow' ? `hsl(${(i * 18 + time * 120) % 360} 90% 60%)` : i === 0 ? sk.head : mix(sk.head, sk.body, t);
    ctx.globalAlpha = ghost ? 0.45 + Math.sin(time * 12) * 0.15 : 1;
    if (i === 0) glow(ctx, px, py, c * 1.1, sk.body === 'rainbow' ? '255,255,255' : hexRgb(sk.head));
    ctx.fillStyle = col;
    const r = c * (i === 0 ? 0.46 : 0.42 - t * 0.12);
    ctx.beginPath();
    ctx.roundRect(px - r, py - r, r * 2, r * 2, r * 0.6);
    ctx.fill();
    if (i === 0) {
      // Yeux tournés vers la direction
      const [dx, dy] = DIRS[queue[0] ?? dir];
      ctx.fillStyle = '#0d1020';
      for (const s of [-1, 1]) {
        const ex = px + dx * r * 0.35 + -dy * s * r * 0.4;
        const ey = py + dy * r * 0.35 + dx * s * r * 0.4;
        ctx.beginPath();
        ctx.arc(ex, ey, r * 0.18, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  ctx.restore();
  // Bonus actifs
  let bx = L.ox + 6;
  for (const [type, t] of Object.entries(active)) {
    if (t <= 0) continue;
    ctx.fillStyle = 'rgba(5,6,11,0.7)';
    ctx.beginPath();
    ctx.roundRect(bx, L.oy + 6, 74, 22, 11);
    ctx.fill();
    ctx.fillStyle = BONUS[type].color;
    ctx.font = '800 12px Rubik, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${BONUS[type].name} ${Math.ceil(t)}`, bx + 10, L.oy + 21);
    bx += 80;
  }
  if (state === 'run' && run.combo > 1) {
    ctx.fillStyle = '#ffc93c';
    ctx.font = '900 20px "Big Shoulders Display", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`×${run.combo}`, L.ox + c * W - 8, L.oy + 24);
  }
  fx.flash.draw(ctx, view.width, view.height);
}

function drawBonus(ctx, type, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 3) * 0.2);
  ctx.beginPath();
  if (type === 'etoile') {
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? s * 0.45 : s;
      const a = (k / 10) * TAU - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.fill();
  } else if (type === 'sablier') {
    ctx.moveTo(-s * 0.7, -s);
    ctx.lineTo(s * 0.7, -s);
    ctx.lineTo(-s * 0.7, s);
    ctx.lineTo(s * 0.7, s);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'fantome') {
    ctx.arc(0, -s * 0.1, s * 0.8, Math.PI, 0);
    ctx.lineTo(s * 0.8, s);
    ctx.lineTo(s * 0.3, s * 0.7);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.3, s * 0.7);
    ctx.lineTo(-s * 0.8, s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0d1020';
    ctx.beginPath();
    ctx.arc(-s * 0.3, -s * 0.15, s * 0.14, 0, TAU);
    ctx.arc(s * 0.3, -s * 0.15, s * 0.14, 0, TAU);
    ctx.fill();
  } else {
    ctx.lineWidth = s * 0.25;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.arc(-s * 0.4, s * 0.5, s * 0.35, 0, TAU);
    ctx.moveTo(s * 0.75, s * 0.5);
    ctx.arc(s * 0.4, s * 0.5, s * 0.35, 0, TAU);
    ctx.moveTo(-s * 0.2, s * 0.2);
    ctx.lineTo(s * 0.5, -s);
    ctx.moveTo(s * 0.2, s * 0.2);
    ctx.lineTo(-s * 0.5, -s);
    ctx.stroke();
  }
  ctx.restore();
}

function glow(ctx, x, y, r, rgb) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},0.35)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
const hexRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ---------- Saisie ----------
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'up', w: 'up', s: 'down', q: 'left', a: 'left', d: 'right' };
document.addEventListener('keydown', (e) => {
  if (state !== 'run' || !gv.playing || e.ctrlKey || e.metaKey || e.altKey) return;
  const d = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
  if (!d) return;
  e.preventDefault();
  turn(d);
});
let swipe = null;
view.canvas.addEventListener('pointerdown', (e) => {
  swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
});
view.canvas.addEventListener('pointermove', (e) => {
  if (!swipe || swipe.id !== e.pointerId || state !== 'run') return;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
  turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  // On peut enchaîner les virages sans relever le doigt
  swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
});
view.canvas.addEventListener('pointerup', () => (swipe = null));
view.canvas.style.touchAction = 'none';

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const dd = store.data.daily;
  gv.shell.startExtra.innerHTML = `
    <div class="sp-options">
      <div class="sp-row">
        <span class="sp-label" id="sp-mode-label">Mode</span>
        <div class="sp-modes" role="radiogroup" aria-labelledby="sp-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const open = modeOpen(m);
              const sub = !open ? `Marque ${m.unlock} points` : m.id === 'jour' && dd.day === today() ? `Meilleur : ${formatInt(dd.best)} · ${dd.plays} essai${dd.plays > 1 ? 's' : ''}` : m.hint;
              return `<button type="button" role="radio" class="sp-mode" data-mode="${m.id}" aria-checked="${store.data.mode === m.id}" ${open ? '' : 'aria-disabled="true"'}>${icon(open ? { classique: 'grid', libre: 'restart', labyrinthe: 'blocks', jour: 'calendar' }[m.id] : 'lock')}<span>${m.label}</span><small>${esc(sub)}</small></button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="sp-row">
        <span class="sp-label" id="sp-skin-label">Couleur · record ${store.data.bestLen} cases</span>
        <div class="sp-skins" role="radiogroup" aria-labelledby="sp-skin-label">
          ${SKINS.map((s) => {
            const locked = store.data.bestLen < s.unlock;
            const label = locked ? `${s.name}, débloqué à ${s.unlock} de longueur` : s.name;
            const bg = s.body === 'rainbow' ? 'linear-gradient(90deg,#ff5a4e,#ffc93c,#3ee6a8,#4cc3ff,#a68bff)' : `linear-gradient(90deg,${s.head},${s.body})`;
            return `<button type="button" role="radio" class="sp-skin" data-skin="${s.id}" aria-checked="${store.data.skin === s.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span style="background:${bg}"></span>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="sp-hint" id="sp-hint">Merci d’avoir débloqué ce jeu secret !</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    const m = MODES[b.dataset.mode];
    const s = SKINS.find((x) => x.id === b.dataset.skin);
    document.getElementById('sp-hint').textContent = m ? `Marque ${m.unlock} points pour ouvrir ce mode.` : `Atteins ${s.unlock} cases de long pour cette couleur.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.skin) store.data.skin = b.dataset.skin;
  store.save();
  gv.audio.play('select');
  renderOptions();
  gv.shell.startExtra.querySelector(b.dataset.mode ? `[data-mode="${b.dataset.mode}"]` : `[data-skin="${b.dataset.skin}"]`)?.focus();
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

window.__sp = {
  get state() { return state; },
  get run() { return run; },
  get snake() { return snake; },
  get food() { return food; },
  get dir() { return dir; },
  get active() { return active; },
  get blocks() { return blocks; },
  get frameMs() { return frameMs; },
  set autoplay(v) { autoplay = v; },
  turn,
  // Pose un bonus juste devant la tête (tests)
  bonusAhead(type) {
    const [dx, dy] = DIRS[dir];
    bonus = { type, x: snake[0].x + dx, y: snake[0].y + dy, ttl: 7 };
  },
};

setup(5, MODES.libre);
Object.assign(run, { score: 0, combo: 0 });
renderOptions();
gv.hud('best', formatInt(gv.best ?? 0));
loop.start();
gv.showStart();
