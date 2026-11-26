// Pixel Quest — plateformes en trois mondes de dix niveaux, avec un éditeur dont les niveaux se
// partagent par un code. Sur chaque niveau, tu fais la course contre Robo : une IA qui a trouvé
// seule son chemin (voir engine.js) et dont le fantôme court à côté de toi. Il ne se trompe
// jamais, mais court un peu moins vite : une course propre le bat. Au bout de chaque monde,
// Robo-Boss, plus rapide, garde le passage.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { formatInt, TAU } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { H, DT, TILES, WORLDS, ROBO, parse, tile, spawn, step, solve, replay, enemyX, campaignLevel, encodeLevel, decodeLevel, inputsOf } from './engine.js';

const T = 32; // une tuile = 32 unités
const EDIT_W = 60;
const store = createStore('pixel-quest', {
  version: 1,
  defaults: { progress: {}, sel: { w: 1, n: 1 }, custom: null, shared: 0 },
});

const gv = bootGame('pixel-quest', {
  hud: [
    { id: 'level', label: 'Niveau' },
    { id: 'time', label: 'Temps' },
    { id: 'coins', label: 'Pièces' },
    { id: 'robo', label: 'Robo' },
  ],
  howTo: [
    { keys: ['←', '→'], text: 'Cours aux flèches (ou Q et D), saute avec Espace, ↑ ou Z. Sur téléphone, les boutons en bas de l’écran.' },
    { keys: ['icon:user'], text: 'Le fantôme de Robo court à côté de toi : arrive avant lui pour valider le niveau et ouvrir le suivant.' },
    { keys: ['icon:grid'], text: 'Crée tes niveaux dans l’éditeur et partage-les avec un code. Robo peut les essayer aussi.' },
  ],
  onStart: () => startLevel(),
  onRestart: () => startLevel(),
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
  formatScore: (n) => formatInt(n),
});

const stage = document.getElementById('stage');
const view = createCanvas(stage, { mode: 'stage', height: H * T, minWidth: (w, h) => (w > h ? 760 : 360) });
const fx = { particles: new Particles(300), popups: new Popups(12), shake: new Shake({ maxOffset: 6 }), flash: new Flash() };

let state = 'menu'; // menu | play | dead | won | editor
let current = { kind: 'campaign', w: 1, n: 1 };
let L = null;
let world = WORLDS[0];
let S = null; // le héros
let ghost = null; // { xs, ys, frames, bot }
let coins = new Set();
let deaths = 0;
let acc = 0;
let time = 0;
let deadT = 0;
let face = 1;
const anim = { run: 0, sx: 1, sy: 1, ground: true, blink: 0, blinkT: 2 };
const keys = { l: false, r: false, j: false };
let jumpQueued = false;
let autoInputs = null; // tests : commandes imposées image par image
let edit = null; // { rows: [[...]], tool, scroll }

const key = (w, n) => `${w}-${n}`;
const prog = (w, n) => store.data.progress[key(w, n)] ?? {};
const worldOpen = (w) => w === 1 || !!prog(w - 1, 10).done;
const levelOpen = (w, n) => worldOpen(w) && (n === 1 || !!prog(w, n - 1).done);
const secs = (f) => (f / 60).toFixed(2).replace('.', ',');

// ---------- Niveaux ----------
function startLevel() {
  closeEditor(false);
  if (current.kind === 'campaign') {
    const lv = campaignLevel(current.w, current.n);
    L = parse(lv.rows);
    world = WORLDS[current.w - 1];
    const r = replay(L, lv.sol);
    ghost = { ...r, bot: lv.sol.bot };
    gv.hud('level', `${current.w}-${current.n}`);
  } else {
    L = parse(current.rows);
    world = WORLDS[0];
    const sol = current.sol === undefined ? solve(L, ROBO) : current.sol;
    current.sol = sol;
    ghost = sol ? { ...replay(L, sol), bot: sol.bot } : null;
    gv.hud('level', 'Perso');
  }
  deaths = 0;
  autoInputs = null;
  respawn();
  state = 'play';
  showPad(true);
  if (ghost) gv.banner(current.kind === 'campaign' && current.n === 10 ? `Duel contre Robo-Boss : ${secs(ghost.frames)} s` : `Bats Robo : ${secs(ghost.frames)} s`, { color: current.n === 10 ? '#ff5fa2' : '#ffc93c' });
}

function respawn() {
  if (state === 'dead') autoInputs = null;
  S = spawn(L);
  coins = new Set();
  acc = 0;
  face = 1;
  Object.assign(anim, { run: 0, sx: 1, sy: 1, ground: true });
  jumpQueued = false;
  fx.particles.clear();
  gv.hud('time', '0,00');
  gv.hud('coins', `0/${L.coins.length}`);
  gv.hud('robo', ghost ? secs(ghost.frames) : '—');
}

function die(reason) {
  state = 'dead';
  deadT = 0.6;
  deaths++;
  const p = px(S.x + 0.35, S.y + 0.45);
  fx.particles.emit(p.x, p.y, { count: 26, colors: ['#d6dde8', '#ff3b5c', '#4cc3ff', '#ffc93c'], speed: [60, 260], gravity: 500, size: [3, 6], shape: 'square', life: [0.3, 0.8] });
  fx.shake.add(0.4);
  gv.audio.play(reason === 'vide' ? 'lose' : 'hit');
}

function win() {
  state = 'won';
  showPad(false);
  gv.audio.play('win');
  fx.flash.trigger('#ffffff', 0.3, 3);
  const p = px(S.x, S.y);
  fx.particles.emit(p.x, p.y, { count: 40, colors: ['#ffc93c', '#3ee6a8', '#4cc3ff', '#ff5fa2'], speed: [80, 300], gravity: 300, size: [3, 6], shape: 'square', life: [0.5, 1.2] });
  gv.after(700, finish);
}

function finish() {
  const f = S.f;
  const beat = !!ghost && f < ghost.frames;
  const all = coins.size === L.coins.length;
  const camp = current.kind === 'campaign';
  const boss = camp && current.n === 10;
  let score = 200 + coins.size * 15 + (beat ? 300 : 0) + Math.max(0, Math.round(((ghost?.frames ?? f) * 1.3 - f) / 2));
  score = Math.max(50, score - deaths * 10);
  if (camp) {
    const k = key(current.w, current.n);
    const p = store.data.progress[k] ?? {};
    // Un niveau ne se valide qu'en arrivant avant Robo (ou Robo-Boss)
    p.done = p.done || beat;
    p.coins = p.coins || all;
    p.crown = p.crown || beat;
    p.best = Math.min(p.best ?? Infinity, f);
    store.data.progress[k] = p;
    store.save();
    if (beat) gv.unlock('premier-niveau');
    if (boss && beat) {
      gv.unlock('robo-boss');
      gv.unlock(`monde-${current.w}`);
    }
    if (current.w === 3 && !deaths) gv.unlock('sans-chute');
    const crowns = Object.values(store.data.progress).filter((x) => x.crown).length;
    if (crowns >= 10) gv.unlock('couronnes-10');
  }
  if (beat) gv.unlock('bats-robo');
  if (all && L.coins.length) gv.unlock('pieces');
  const next = camp ? nextLevel() : null;
  const extra = camp
    ? beat
      ? next
        ? `<button type="button" class="btn btn--primary btn--block" data-pq="next">${icon('forward')}Niveau ${next.w}-${next.n}</button>`
        : ''
      : `<p class="pq-over-hint">Arrive avant ${ghost.bot.name} pour valider le niveau${boss ? ' et ouvrir le monde suivant' : ''} : il lui a fallu ${secs(ghost.frames)} s, à toi ${secs(f)} s.</p>`
    : `<button type="button" class="btn btn--block" data-pq="editor">${icon('grid')}Retour à l’éditeur</button>`;
  gv.gameOver({
    score,
    stats: { score, world: camp ? current.w : 0, robo: beat ? 1 : 0, coins: all ? 1 : 0 },
    extraStats: [
      { label: 'Temps', value: `${secs(f)} s` },
      { label: ghost ? ghost.bot.name : 'Robo', value: ghost ? `${secs(ghost.frames)} s` : '—' },
      { label: 'Pièces', value: `${coins.size}/${L.coins.length}` },
      { label: 'Chutes', value: formatInt(deaths) },
    ],
    kicker: camp ? `${world.name} · niveau ${current.n}` : 'Niveau perso',
    title: !ghost ? 'Niveau terminé' : beat ? `Plus rapide que ${ghost.bot.name} : niveau validé !` : `${ghost.bot.name} a été plus rapide`,
    sound: beat || !ghost ? 'win' : 'lose',
    extraHtml: extra,
  });
  state = 'menu';
  renderOptions();
}

function nextLevel() {
  if (current.n < 10) return { w: current.w, n: current.n + 1 };
  if (current.w < 3) return { w: current.w + 1, n: 1 };
  return null;
}

// ---------- Boucle (pas fixe : la course est rejouable à l'identique) ----------
function update(dt, realDt) {
  time += realDt;
  fx.particles.update(realDt);
  fx.popups.update(realDt);
  fx.shake.update(realDt);
  fx.flash.update(realDt);
  if (state === 'dead') {
    deadT -= realDt;
    if (deadT <= 0) {
      respawn();
      state = 'play';
    }
    return;
  }
  // Retour en douceur de l'écrasement, clignement des yeux
  anim.sx += (1 - anim.sx) * Math.min(1, realDt * 12);
  anim.sy += (1 - anim.sy) * Math.min(1, realDt * 12);
  anim.blink -= realDt;
  anim.blinkT -= realDt;
  if (anim.blinkT <= 0) {
    anim.blink = 0.12;
    anim.blinkT = 2 + Math.random() * 3;
  }
  if (state !== 'play') return;
  acc += dt;
  while (acc >= DT && state === 'play') {
    acc -= DT;
    const inp = autoInputs ? autoInputs[S.f] ?? {} : { l: keys.l, r: keys.r, jp: jumpQueued, jh: keys.j || jumpQueued };
    jumpQueued = false;
    if (inp.r !== inp.l) face = inp.r ? 1 : -1;
    step(S, inp, L);
    animate();
    if (S.jumped) gv.audio.play('jump', { volume: 0.5 });
    if (S.sprung) gv.audio.play('powerup', { volume: 0.5, pitch: 1.4 });
    if (S.stomped >= 0) {
      gv.audio.play('pop');
      const p = px(enemyX(L, S.stomped, S.f) + 0.4, L.enemies[S.stomped].y + 0.4);
      fx.particles.emit(p.x, p.y, { count: 14, colors: ['#ff5fa2', '#ffffff'], speed: [40, 180], gravity: 400, size: [2, 5], shape: 'square', life: [0.3, 0.6] });
    }
    // Pièces
    L.coins.forEach((c, i) => {
      if (coins.has(i)) return;
      if (S.x + 0.7 > c.x + 0.2 && S.x < c.x + 0.8 && S.y + 0.9 > c.y + 0.2 && S.y < c.y + 0.8) {
        coins.add(i);
        gv.audio.play('coin', { volume: 0.5 });
        const p = px(c.x + 0.5, c.y + 0.5);
        fx.popups.add(p.x, p.y - 8, '+1', { size: 14, color: '#ffc93c', rise: 24, life: 0.5 });
        gv.hud('coins', `${coins.size}/${L.coins.length}`, true);
      }
    });
    if (S.f % 6 === 0) gv.hud('time', secs(S.f));
    if (ghost && S.f === ghost.frames) gv.audio.play('tick', { pitch: 0.7 });
    if (S.dead) return die(S.dead);
    if (S.won) return win();
  }
}

// Course, saut, atterrissage : la phase des jambes, l'écrasement et un peu de poussière
function animate() {
  anim.run += Math.abs(S.vx) * DT * 1.7;
  const feet = px(S.x + 0.35, S.y + 0.9);
  const dust = (n) => fx.particles.emit(feet.x, feet.y, { count: n, colors: [world.id === 3 ? '#ffffff' : 'rgba(232,226,208,0.8)'], speed: [20, 90], gravity: -40, size: [2, 4], shape: 'circle', life: [0.2, 0.4] });
  if (S.jumped) {
    anim.sx = 0.78;
    anim.sy = 1.24;
    dust(6);
  }
  if (S.ground && !anim.ground) {
    anim.sx = 1.28;
    anim.sy = 0.74;
    dust(8);
  }
  if (S.ground && Math.abs(S.vx) > 6 && Math.floor(anim.run) % 3 === 0 && Math.random() < 0.15) dust(1);
  anim.ground = S.ground;
}

// ---------- Rendu ----------
let cam = 0;
const top = () => (state === 'editor' ? edLayout().oy : Math.max(0, (view.height - H * T) / 2));
// Dans l'éditeur, le niveau tient entre la barre d'outils et la barre du bas (réduit s'il le faut)
function edLayout() {
  const tb = (edEl.querySelector('.pq-tools')?.offsetHeight ?? 0) / view.scale;
  const bb = (edEl.querySelector('.pq-edbar')?.offsetHeight ?? 0) / view.scale;
  const avail = view.height - tb - bb - 8;
  const k = Math.min(1, avail / (H * T));
  return { k, oy: tb + 4 + Math.max(0, (avail - H * T * k) / 2) };
}
const px = (x, y) => ({ x: x * T, y: y * T });

function render() {
  const ctx = view.begin();
  const W = view.width;
  const VH = view.height;
  const lv = L ?? parse(campaignLevel(1, 1).rows);
  const lvW = state === 'editor' ? EDIT_W : lv.W;
  const wd = state === 'editor' ? WORLDS[0] : world;
  // Ciel
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, wd.sky[0]);
  g.addColorStop(1, wd.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, VH);
  // Caméra
  const want = state === 'editor' ? edit.scroll * T : (S ? S.x : 0) * T - W * 0.38;
  cam = state === 'editor' ? want : cam + (Math.max(0, Math.min(lvW * T - W, want)) - cam) * 0.2;
  if (lvW * T < W) cam = (lvW * T - W) / 2;
  decor(ctx, wd, W, VH);
  ctx.save();
  fx.shake.apply(ctx, W / 2, VH / 2);
  const ed = state === 'editor' ? edLayout() : { k: 1 };
  ctx.translate(0, top());
  ctx.scale(ed.k, ed.k);
  ctx.translate(-Math.round(cam), 0);
  const c0 = Math.max(0, Math.floor(cam / T) - 1);
  const c1 = Math.min(lvW, Math.ceil((cam + W / ed.k) / T) + 1);
  // Sous le niveau : la terre continue (sauf dans les cieux)
  if (!wd.sky3) {
    ctx.fillStyle = wd.ground;
    ctx.fillRect(cam - T, H * T, W / ed.k + 2 * T, view.height);
  }
  const rows = state === 'editor' ? edit.rows : null;
  for (let y = 0; y < H; y++) {
    for (let x = c0; x < c1; x++) {
      const t = rows ? rows[y][x] : tile(lv, x, y);
      if (t !== '.') drawTile(ctx, t, x, y, wd, rows);
    }
  }
  if (state === 'editor') {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let x = c0; x <= c1; x++) {
      ctx.beginPath();
      ctx.moveTo(x * T, 0);
      ctx.lineTo(x * T, H * T);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y++) {
      ctx.beginPath();
      ctx.moveTo(c0 * T, y * T);
      ctx.lineTo(c1 * T, y * T);
      ctx.stroke();
    }
  } else if (L) {
    // Pièces, drapeau, ennemis
    L.coins.forEach((c, i) => !coins.has(i) && drawCoin(ctx, c.x, c.y));
    drawFlag(ctx, L.flag, L.flagY ?? 10);
    const f = S ? S.f : 0;
    L.enemies.forEach((e, i) => {
      if (S && S.killed & (1 << i)) return;
      const ex = enemyX(L, i, f);
      drawEnemy(ctx, ex, e.y, ex >= enemyX(L, i, Math.max(0, f - 1)) ? 1 : -1);
    });
    // Fantôme de Robo
    if (ghost && S && (state === 'play' || state === 'dead' || state === 'won')) {
      const k = Math.min(S.f, ghost.xs.length - 1);
      const k0 = Math.max(0, k - 1);
      drawRobo(ctx, ghost.xs[k], ghost.ys[k], S.f >= ghost.frames, ghost.xs[k] * 3.2, ghost.xs[k] >= ghost.xs[k0] ? 1 : -1);
    }
    if (S && state !== 'dead') drawHero(ctx, S.x, S.y);
  }
  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  ctx.restore();
  // Écart avec Robo
  if (ghost && S && state === 'play') {
    const gap = ghost.xs[Math.min(S.f, ghost.xs.length - 1)] - S.x;
    const ahead = gap < 0;
    ctx.font = '800 13px Rubik, sans-serif';
    const txt = S.f >= ghost.frames ? `${ghost.bot.name} est arrivé !` : `${ghost.bot.name} ${ahead ? 'derrière' : 'devant'} : ${Math.abs(gap).toFixed(1).replace('.', ',')} m`;
    const tw = ctx.measureText(txt).width + 24;
    ctx.fillStyle = 'rgba(5,6,11,0.65)';
    ctx.beginPath();
    ctx.roundRect(10, 10, tw, 26, 13);
    ctx.fill();
    ctx.fillStyle = S.f >= ghost.frames ? '#ff5fa2' : ahead ? '#3ee6a8' : '#ffc93c';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, 22, 23.5);
  }
  fx.flash.draw(ctx, W, VH);
}

// Décor en plusieurs plans (parallaxe), propre à chaque monde
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function decor(ctx, wd, W, VH) {
  const base = top() + H * T;
  if (wd.deco === 'hill') {
    // Soleil, montagnes au loin, nuages, collines
    ctx.fillStyle = 'rgba(255,241,184,0.9)';
    ctx.beginPath();
    ctx.arc(W - 110, top() + 70, 34, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,241,184,0.25)';
    ctx.beginPath();
    ctx.arc(W - 110, top() + 70, 52, 0, TAU);
    ctx.fill();
    layer(ctx, W, 0.12, 300, (x, k) => {
      ctx.fillStyle = 'rgba(126,164,214,0.55)';
      ctx.beginPath();
      ctx.moveTo(x - 40, base - 70);
      ctx.lineTo(x + 110, base - 230 - hash(k) * 70);
      ctx.lineTo(x + 260, base - 70);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      const h = base - 230 - hash(k) * 70;
      ctx.beginPath();
      ctx.moveTo(x + 110, h);
      ctx.lineTo(x + 84, h + 36);
      ctx.lineTo(x + 136, h + 36);
      ctx.fill();
    });
    clouds(ctx, W, 0.06, top() + 40, 'rgba(255,255,255,0.85)');
    layer(ctx, W, 0.3, 240, (x, k) => {
      ctx.fillStyle = k % 2 ? '#7fd89a' : '#6ccb8a';
      ctx.beginPath();
      ctx.ellipse(x + 120, base - 30, 170, 110 + hash(k) * 40, 0, Math.PI, 0);
      ctx.fill();
    });
  } else if (wd.deco === 'crystal') {
    // Stalactites, cristaux qui luisent, poussière en suspension
    layer(ctx, W, 0.15, 90, (x, k) => {
      ctx.fillStyle = '#2a2044';
      ctx.beginPath();
      ctx.moveTo(x, top() + 50);
      ctx.lineTo(x + 22, top() + 50 + 50 + hash(k) * 70);
      ctx.lineTo(x + 44, top() + 50);
      ctx.fill();
    });
    layer(ctx, W, 0.35, 210, (x, k) => {
      const y = base - 60 - hash(k) * 120;
      const c = k % 3 ? '#a68bff' : '#4cc3ff';
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.18 + Math.sin(time * 2 + k) * 0.06;
      ctx.beginPath();
      ctx.arc(x + 30, y, 46, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.55;
      for (const [dx, h] of [[0, 46], [18, 64], [36, 40]]) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + 30);
        ctx.lineTo(x + dx + 8, y + 30 - h);
        ctx.lineTo(x + dx + 16, y + 30);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = 'rgba(196,176,255,0.5)';
    for (let k = 0; k < 24; k++) {
      const x = ((hash(k) * W * 1.3 - cam * 0.5 + time * 8 * (1 + hash(k + 9))) % (W + 40) + W + 40) % (W + 40) - 20;
      const y = top() + 40 + hash(k + 3) * H * T * 0.8 + Math.sin(time + k) * 6;
      ctx.fillRect(x, y, 2, 2);
    }
  } else {
    // Ciel de fin d'après-midi : grand soleil, bancs de nuages
    ctx.fillStyle = 'rgba(255,241,184,0.8)';
    ctx.beginPath();
    ctx.arc(W * 0.3, base - 40, 90, 0, TAU);
    ctx.fill();
    clouds(ctx, W, 0.08, top() + 70, 'rgba(255,255,255,0.55)');
    clouds(ctx, W, 0.2, base - 70, 'rgba(255,255,255,0.75)');
  }
}
// Un plan qui se répète tous les `gap` unités, décalé avec la caméra
function layer(ctx, W, k, gap, draw) {
  const off = cam * k;
  const first = Math.floor(off / gap) - 1;
  for (let i = first; i < first + W / gap + 3; i++) draw(i * gap - off, i);
}
function clouds(ctx, W, k, y, color) {
  ctx.fillStyle = color;
  layer(ctx, W, k, 260, (x, i) => {
    const yy = y + hash(i) * 50;
    const dx = time * 6;
    ctx.beginPath();
    ctx.arc(x + dx, yy, 20, 0, TAU);
    ctx.arc(x + 24 + dx, yy - 12, 28, 0, TAU);
    ctx.arc(x + 54 + dx, yy, 22, 0, TAU);
    ctx.arc(x + 30 + dx, yy + 6, 22, 0, TAU);
    ctx.fill();
  });
}

const solidAt = (rows, x, y) => {
  const t = rows ? rows[y]?.[x] : tile(L, x, y);
  return t === '#' || t === 'B';
};
function drawTile(ctx, t, x, y, wd, rows) {
  const X = x * T;
  const Y = y * T;
  if (t === '#') {
    const up = y > 0 && !solidAt(rows, x, y - 1);
    const left = !solidAt(rows, x - 1, y);
    const right = !solidAt(rows, x + 1, y);
    if (wd.id === 1) {
      ctx.fillStyle = '#6b4426';
      ctx.fillRect(X, Y, T + 0.6, T + 0.6); // léger chevauchement : pas de jointures visibles
      ctx.fillStyle = '#5a381f';
      for (let k = 0; k < 3; k++) {
        const h = hash(x * 13 + y * 7 + k);
        ctx.fillRect(X + 3 + h * 22, Y + 6 + hash(h * 99) * 20, 5, 4);
      }
      ctx.fillStyle = '#7d5230';
      ctx.fillRect(X + 4 + hash(x + y) * 18, Y + 18, 4, 3);
      if (up) {
        ctx.fillStyle = '#2fa85a';
        ctx.fillRect(X, Y, T, 10);
        ctx.fillStyle = '#3ee68a';
        ctx.fillRect(X, Y, T, 6);
        // Brins d'herbe et quelques fleurs
        ctx.fillStyle = '#3ee68a';
        for (let k = 0; k < 4; k++) {
          const bx = X + 3 + k * 8 + hash(x * 3 + k) * 3;
          ctx.beginPath();
          ctx.moveTo(bx, Y + 1);
          ctx.lineTo(bx + 2, Y - 5 - hash(x + k) * 3);
          ctx.lineTo(bx + 4, Y + 1);
          ctx.fill();
        }
        if (hash(x * 31) > 0.8) {
          ctx.fillStyle = hash(x) > 0.5 ? '#ffc93c' : '#ff8fb8';
          ctx.beginPath();
          ctx.arc(X + 16, Y - 4, 3, 0, TAU);
          ctx.fill();
        }
      }
    } else if (wd.id === 2) {
      ctx.fillStyle = '#3a3050';
      ctx.fillRect(X, Y, T + 0.6, T + 0.6);
      ctx.strokeStyle = '#2a2240';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X, Y + 16);
      ctx.lineTo(X + T, Y + 16);
      const o = y % 2 ? 0 : 16;
      ctx.moveTo(X + o + 1, Y);
      ctx.lineTo(X + o + 1, Y + 16);
      ctx.moveTo(X + ((o + 16) % 32) + 1, Y + 16);
      ctx.lineTo(X + ((o + 16) % 32) + 1, Y + T);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(X + 2, Y + 2, T - 4, 3);
      if (up) {
        ctx.fillStyle = '#7a5fd0';
        ctx.fillRect(X, Y, T, 6);
        ctx.fillStyle = '#a68bff';
        ctx.fillRect(X, Y, T, 3);
        if (hash(x * 17) > 0.82) {
          ctx.fillStyle = '#4cc3ff';
          ctx.beginPath();
          ctx.moveTo(X + 10, Y);
          ctx.lineTo(X + 14, Y - 12);
          ctx.lineTo(X + 18, Y);
          ctx.fill();
        }
      }
    } else {
      ctx.fillStyle = '#fdf8f0';
      ctx.fillRect(X, Y, T + 0.6, T + 0.6);
      ctx.fillStyle = '#efe3d0';
      ctx.fillRect(X, Y + T - 8, T, 8);
      ctx.fillStyle = 'rgba(255,201,160,0.35)';
      ctx.beginPath();
      ctx.arc(X + 8 + hash(x + y) * 16, Y + 14, 5, 0, TAU);
      ctx.fill();
      if (up) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(X + 8, Y + 2, 9, Math.PI, 0);
        ctx.arc(X + 24, Y + 2, 9, Math.PI, 0);
        ctx.fill();
      }
    }
    // Arêtes à nu, un peu plus sombres
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    if (left) ctx.fillRect(X, Y, 3, T);
    if (right) ctx.fillRect(X + T - 3, Y, 3, T);
  } else if (t === '=') {
    if (wd.sky3) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(X + 9, Y + 6, 8, 0, TAU);
      ctx.arc(X + 23, Y + 6, 8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,170,140,0.35)';
      ctx.fillRect(X + 2, Y + 10, T - 4, 3);
    } else {
      ctx.fillStyle = '#b87a40';
      ctx.fillRect(X, Y, T, 10);
      ctx.fillStyle = '#d99a58';
      ctx.fillRect(X, Y, T, 3);
      ctx.fillStyle = '#7a4a22';
      ctx.fillRect(X, Y + 10, T, 3);
      ctx.fillRect(X + 15, Y + 2, 2, 8);
      ctx.fillStyle = '#e8e2d0';
      ctx.fillRect(X + 5, Y + 5, 2, 2);
      ctx.fillRect(X + 25, Y + 5, 2, 2);
    }
  } else if (t === '^') {
    for (let k = 0; k < 3; k++) {
      const bx = X + k * 10 + 1;
      ctx.fillStyle = '#e8eef5';
      ctx.beginPath();
      ctx.moveTo(bx, Y + T);
      ctx.lineTo(bx + 5, Y + 11);
      ctx.lineTo(bx + 5, Y + T);
      ctx.fill();
      ctx.fillStyle = '#9aa5b8';
      ctx.beginPath();
      ctx.moveTo(bx + 5, Y + 11);
      ctx.lineTo(bx + 10, Y + T);
      ctx.lineTo(bx + 5, Y + T);
      ctx.fill();
    }
    ctx.fillStyle = '#5b6478';
    ctx.fillRect(X, Y + T - 3, T, 3);
  } else if (t === 'B') {
    ctx.fillStyle = '#c8243d';
    ctx.fillRect(X + 2, Y + 20, T - 4, 12);
    ctx.fillStyle = '#ff3b5c';
    ctx.fillRect(X + 2, Y + 20, T - 4, 4);
    ctx.strokeStyle = '#e8eef5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X + 8, Y + 20);
    ctx.lineTo(X + 24, Y + 16);
    ctx.lineTo(X + 8, Y + 12);
    ctx.lineTo(X + 24, Y + 8);
    ctx.stroke();
    ctx.fillStyle = '#ffc93c';
    ctx.fillRect(X + 3, Y + 3, T - 6, 5);
  } else if (rows) {
    // Dans l'éditeur : pièces, ennemis, départ et arrivée en place
    if (t === 'o') drawCoin(ctx, x, y);
    else if (t === 'E') drawEnemy(ctx, x + 0.1, y + 0.2, -1);
    else if (t === 'S') drawHero(ctx, x + 0.15, y + 0.1, true);
    else if (t === 'F') drawFlag(ctx, x, y);
  }
}

function drawCoin(ctx, x, y) {
  const cx = x * T + T / 2;
  const cy = y * T + T / 2 + Math.sin(time * 3 + x) * 2;
  const s = Math.max(0.2, Math.abs(Math.cos(time * 3.5 + x * 0.7)));
  ctx.fillStyle = 'rgba(255,201,60,0.22)';
  ctx.beginPath();
  ctx.arc(cx, cy, 15, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c98f00';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 10 * s, 11, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 8 * s, 9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff1b8';
  ctx.fillRect(cx - 1.5 * s, cy - 5, 3 * s, 10);
  // Petit éclat de temps en temps
  const k = (time * 0.7 + x * 0.37) % 1;
  if (k < 0.12) {
    ctx.fillStyle = '#ffffff';
    const r = Math.sin((k / 0.12) * Math.PI) * 5;
    ctx.fillRect(cx + 5 - r / 2, cy - 7, r, 1.5);
    ctx.fillRect(cx + 5 - 0.75, cy - 7 - r / 2 + 0.75, 1.5, r);
  }
}

function drawFlag(ctx, x, y) {
  const px = x * T + 14;
  const base = (y + 1) * T;
  ctx.fillStyle = '#8d96aa';
  ctx.fillRect(px - 6, base - 6, 16, 6);
  ctx.fillStyle = '#e8eef5';
  ctx.fillRect(px, base - 3.2 * T, 4, 3.2 * T - 6);
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.arc(px + 2, base - 3.2 * T, 5, 0, TAU);
  ctx.fill();
  // Fanion qui ondule, aux couleurs du chevalier
  const fy = base - 3.1 * T + 4;
  ctx.fillStyle = '#ff3b5c';
  ctx.beginPath();
  ctx.moveTo(px + 4, fy);
  for (let k = 0; k <= 6; k++) ctx.lineTo(px + 4 + k * 6, fy + Math.sin(time * 6 - k * 0.8) * 3 + k * 0.6);
  for (let k = 6; k >= 0; k--) ctx.lineTo(px + 4 + k * 6, fy + 20 + Math.sin(time * 6 - k * 0.8) * 3 - k * 0.6);
  ctx.fill();
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.arc(px + 20, fy + 10 + Math.sin(time * 6 - 2.2) * 3, 4, 0, TAU);
  ctx.fill();
}

// Ennemi : une gelée qui rebondit en avançant, les yeux tournés vers où elle va
function drawEnemy(ctx, x, y, dir = -1) {
  const colors = { 1: ['#ff5fa2', '#c8246e'], 2: ['#a68bff', '#6b4fd0'], 3: ['#4cc3ff', '#1a7fb8'] }[world.id];
  const cx = x * T + 0.4 * T;
  const fy = (y + 0.8) * T;
  const bounce = Math.abs(Math.sin(time * 7 + x));
  const sy = 0.85 + bounce * 0.25;
  const sx = 1.15 - bounce * 0.2;
  const w = 13 * sx;
  const h = 22 * sy;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, fy, 12, 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.moveTo(cx - w, fy);
  ctx.quadraticCurveTo(cx - w - 2, fy - h, cx, fy - h);
  ctx.quadraticCurveTo(cx + w + 2, fy - h, cx + w, fy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.moveTo(cx - w + 2, fy - 3);
  ctx.quadraticCurveTo(cx - w, fy - h + 2, cx, fy - h + 2);
  ctx.quadraticCurveTo(cx + w, fy - h + 2, cx + w - 2, fy - 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.4, fy - h * 0.7, 3, 4, -0.4, 0, TAU);
  ctx.fill();
  for (const ex of [-4, 4]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + ex + dir, fy - h * 0.55, 3.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1b1626';
    ctx.beginPath();
    ctx.arc(cx + ex + dir * 2.2, fy - h * 0.55, 1.8, 0, TAU);
    ctx.fill();
  }
}

// ---------- Le chevalier ----------
// anim : phase de course, écrasement (sx, sy), clignement ; le tout autour des pieds
function drawHero(ctx, x, y, still = false) {
  const X = x * T;
  const Y = y * T;
  const cx = X + 0.35 * T;
  const fy = Y + 0.9 * T;
  const moving = !still && S && Math.abs(S.vx) > 0.5;
  const ground = still || !S || S.ground;
  const run = still ? 0 : anim.run;
  ctx.save();
  ctx.translate(cx, fy);
  ctx.scale((still ? 1 : face) * anim.sx, anim.sy);
  // Ombre
  if (ground) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 2.5, 0, 0, TAU);
    ctx.fill();
  }
  // Cape qui flotte derrière
  const wave = Math.sin(time * 10) * 1.5 + (moving ? 5 : 1) + (!ground ? 3 : 0);
  ctx.fillStyle = '#c8243d';
  ctx.beginPath();
  ctx.moveTo(-4, -20);
  ctx.quadraticCurveTo(-10 - wave, -14, -11 - wave * 1.3, -5 + (!ground && S?.vy < 0 ? 3 : 0));
  ctx.lineTo(-2, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff3b5c';
  ctx.beginPath();
  ctx.moveTo(-4, -20);
  ctx.quadraticCurveTo(-8 - wave * 0.8, -15, -8 - wave, -7);
  ctx.lineTo(-2, -9);
  ctx.closePath();
  ctx.fill();
  // Jambes : pas alternés au sol, repliées en l'air
  ctx.fillStyle = '#4a3a5a';
  if (ground && moving) {
    const a = Math.sin(run) * 3.5;
    const lift = (p) => Math.max(0, Math.sin(run + p)) * 2.5;
    ctx.fillRect(-6 + a, -7 - lift(0), 5, 7);
    ctx.fillRect(1 - a, -7 - lift(Math.PI), 5, 7);
  } else if (!ground) {
    ctx.fillRect(-6, -8, 5, 6);
    ctx.fillRect(2, -6, 5, 5);
  } else {
    ctx.fillRect(-5, -7, 5, 7);
    ctx.fillRect(1, -7, 5, 7);
  }
  // Corps : armure, tabard bleu, ceinture
  ctx.fillStyle = '#aab3c5';
  ctx.beginPath();
  ctx.roundRect(-7, -21, 14, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#d6dde8';
  ctx.beginPath();
  ctx.roundRect(-7, -21, 12, 13, 4);
  ctx.fill();
  ctx.fillStyle = '#4cc3ff';
  ctx.fillRect(-2.5, -20, 5, 12);
  ctx.fillStyle = '#ffc93c';
  ctx.fillRect(-1, -17, 2, 2);
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(-7, -10, 14, 2.5);
  // Bras et épée : balancée en courant, levée en l'air
  const swing = !ground ? -1.1 : moving ? -0.5 + Math.sin(run) * 0.35 : -0.25;
  ctx.save();
  ctx.translate(4, -15);
  ctx.rotate(swing);
  ctx.fillStyle = '#e8eef5';
  ctx.fillRect(4, -1.5, 13, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4, -1.5, 13, 1);
  ctx.fillStyle = '#ffc93c';
  ctx.fillRect(3, -4, 2.5, 8);
  ctx.fillStyle = '#8d96aa';
  ctx.beginPath();
  ctx.arc(1, 0, 3, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Casque, visière, regard
  ctx.fillStyle = '#aab3c5';
  ctx.beginPath();
  ctx.roundRect(-7, -33, 14, 13, 5);
  ctx.fill();
  ctx.fillStyle = '#e8eef5';
  ctx.beginPath();
  ctx.roundRect(-7, -33, 13, 12, 5);
  ctx.fill();
  ctx.fillStyle = '#1b1626';
  ctx.fillRect(-1, -29, 8, 4);
  ctx.fillStyle = '#ffc93c';
  const blink = anim.blink > 0;
  ctx.fillRect(3, blink ? -27.5 : -28.5, 2.4, blink ? 0.8 : 2.4);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(-5, -31, 3, 2);
  // Plumet qui ondule
  const pw = Math.sin(time * 8) * 1.5 + (moving ? 2.5 : 0);
  ctx.strokeStyle = '#ffc93c';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -33);
  ctx.quadraticCurveTo(-3, -39, -8 - pw, -37 + pw * 0.3);
  ctx.stroke();
  ctx.restore();
}

// Robo : un petit robot coureur, en fantôme
function drawRobo(ctx, x, y, done, run, dir) {
  const cx = x * T + 0.35 * T;
  const fy = y * T + 0.9 * T;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.translate(cx, fy);
  ctx.scale(dir, 1);
  ctx.fillStyle = '#8d96aa';
  const a = Math.sin(run) * 3.5;
  ctx.fillRect(-6 + a, -7, 5, 7);
  ctx.fillRect(1 - a, -7, 5, 7);
  ctx.fillStyle = '#c9d2e3';
  ctx.beginPath();
  ctx.roundRect(-8, -24, 16, 18, 5);
  ctx.fill();
  ctx.fillStyle = '#1b1626';
  ctx.beginPath();
  ctx.roundRect(-5, -21, 11, 7, 3);
  ctx.fill();
  ctx.fillStyle = done ? '#ff5fa2' : '#3ee6a8';
  ctx.fillRect(-3, -19, 3, 3);
  ctx.fillRect(2, -19, 3, 3);
  ctx.strokeStyle = '#c9d2e3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(2, -30);
  ctx.stroke();
  ctx.fillStyle = done ? '#ff5fa2' : '#3ee6a8';
  ctx.beginPath();
  ctx.arc(2, -31, 2.2, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 0.85;
  ctx.font = '800 9px Rubik, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ROBO', cx, fy - 36);
  ctx.globalAlpha = 1;
}

// ---------- Commandes ----------
const KEYS = { ArrowLeft: 'l', q: 'l', a: 'l', ArrowRight: 'r', d: 'r', ArrowUp: 'j', z: 'j', w: 'j', ' ': 'j' };
document.addEventListener('keydown', (e) => {
  if (!gv.playing || state === 'editor' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
  if (!k) return;
  e.preventDefault();
  if (k === 'j' && !keys.j && !e.repeat) jumpQueued = true;
  keys[k] = true;
});
document.addEventListener('keyup', (e) => {
  const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
  if (k) keys[k] = false;
});
window.addEventListener('blur', () => Object.assign(keys, { l: false, r: false, j: false }));

// Boutons tactiles (plusieurs doigts à la fois)
const pad = document.createElement('div');
pad.className = 'pq-pad';
pad.hidden = true;
pad.innerHTML = `<div class="pq-pad__dirs"><button type="button" data-k="l" aria-label="Gauche">${icon('back')}</button><button type="button" data-k="r" aria-label="Droite">${icon('forward')}</button></div><button type="button" class="pq-pad__jump" data-k="j" aria-label="Sauter">Saut</button>`;
stage.append(pad);
const touchy = matchMedia('(pointer: coarse)').matches;
function showPad(on) {
  pad.hidden = !(on && touchy);
}
for (const b of pad.querySelectorAll('[data-k]')) {
  const k = b.dataset.k;
  const down = (e) => {
    e.preventDefault();
    if (k === 'j' && !keys.j) jumpQueued = true;
    keys[k] = true;
    b.classList.add('is-down');
  };
  const up = () => {
    keys[k] = false;
    b.classList.remove('is-down');
  };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
}

// ---------- Éditeur ----------
const TOOLS = [
  ['#', 'Sol', 'blocks'],
  ['=', 'Plate-forme', 'minus'],
  ['^', 'Pics', 'flame'],
  ['o', 'Pièce', 'coin'],
  ['B', 'Ressort', 'bolt'],
  ['E', 'Ennemi', 'target'],
  ['S', 'Départ', 'user'],
  ['F', 'Arrivée', 'trophy'],
  ['.', 'Gomme', 'trash'],
];
const edEl = document.createElement('div');
edEl.className = 'pq-editor';
edEl.hidden = true;
stage.append(edEl);

function blankLevel() {
  const rows = Array.from({ length: H }, (_, y) => (y >= 12 ? '#'.repeat(EDIT_W) : '.'.repeat(EDIT_W)).split(''));
  rows[11][2] = 'S';
  rows[11][EDIT_W - 4] = 'F';
  return rows;
}
function openEditor(rows) {
  gv.shell.hideScreens();
  state = 'editor';
  showPad(false);
  const saved = rows ?? store.data.custom;
  edit = { rows: (saved ?? blankLevel().map((r) => r.join(''))).map((r) => r.split('')), tool: '#', scroll: 0, msg: 'Touche la grille pour poser la tuile choisie.' };
  edEl.hidden = false;
  renderEditor();
}
function closeEditor(save = true) {
  if (!edit) return;
  if (save) saveEditor();
  edEl.hidden = true;
  edit = null;
}
function saveEditor() {
  store.data.custom = edit.rows.map((r) => r.join(''));
  store.save();
}
function renderEditor() {
  const maxScroll = Math.max(0, EDIT_W - Math.floor(view.width / edLayout().k / T));
  edEl.innerHTML = `
    <div class="pq-tools" role="radiogroup" aria-label="Tuiles">
      ${TOOLS.map(([t, name, ic]) => `<button type="button" role="radio" class="pq-tool" data-tool="${t === '.' ? 'vide' : t}" aria-checked="${edit.tool === t}" title="${name}">${icon(ic)}<span>${name}</span></button>`).join('')}
    </div>
    <div class="pq-edbar">
      <label class="pq-scroll"><span class="sr-only">Défiler le niveau</span><input type="range" min="0" max="${maxScroll}" value="${edit.scroll}" data-scroll></label>
      <p class="pq-edmsg" role="status">${esc(edit.msg)}</p>
      <div class="pq-edbtns">
        <button type="button" class="btn btn--sm btn--primary" data-ed="test">${icon('play')}Tester</button>
        <button type="button" class="btn btn--sm" data-ed="robo">${icon('user')}Robo essaie</button>
        <button type="button" class="btn btn--sm" data-ed="share">${icon('share')}Code</button>
        <button type="button" class="btn btn--sm" data-ed="load">${icon('upload')}Charger</button>
        <button type="button" class="btn btn--sm btn--ghost" data-ed="clear">${icon('trash')}Vider</button>
        <button type="button" class="btn btn--sm btn--ghost" data-ed="quit">${icon('back')}Quitter</button>
      </div>
    </div>
    <div class="pq-codebox" hidden>
      <textarea class="input" rows="3" spellcheck="false" aria-label="Code du niveau" data-code></textarea>
      <div class="pq-edbtns"><button type="button" class="btn btn--sm btn--primary" data-ed="codego"></button><button type="button" class="btn btn--sm btn--ghost" data-ed="codeclose">Fermer</button></div>
    </div>`;
}
const edRows = () => edit.rows.map((r) => r.join(''));
function paint(e) {
  const p = view.toLogical(e.clientX, e.clientY);
  const { k, oy } = edLayout();
  const x = Math.floor((p.x / k + cam) / T);
  const y = Math.floor((p.y - oy) / k / T);
  if (x < 0 || x >= EDIT_W || y < 0 || y >= H) return;
  const t = edit.tool;
  if (edit.rows[y][x] === t) return;
  // Un seul départ et une seule arrivée
  if (t === 'S' || t === 'F') for (const r of edit.rows) for (let i = 0; i < r.length; i++) if (r[i] === t) r[i] = '.';
  edit.rows[y][x] = t;
  gv.audio.play('place', { volume: 0.4, throttle: 0.04 });
}
let painting = false;
view.canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'editor') return;
  painting = true;
  view.canvas.setPointerCapture?.(e.pointerId);
  paint(e);
});
view.canvas.addEventListener('pointermove', (e) => state === 'editor' && painting && paint(e));
view.canvas.addEventListener('pointerup', () => {
  if (painting && edit) saveEditor();
  painting = false;
});
view.canvas.style.touchAction = 'none';

edEl.addEventListener('input', (e) => {
  if (e.target.matches('[data-scroll]')) edit.scroll = Number(e.target.value);
});
edEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tool) {
    edit.tool = b.dataset.tool === 'vide' ? '.' : b.dataset.tool;
    gv.audio.play('tick');
    for (const x of edEl.querySelectorAll('[data-tool]')) x.setAttribute('aria-checked', String(x === b));
    return;
  }
  const act = b.dataset.ed;
  const msg = (t) => {
    edit.msg = t;
    edEl.querySelector('.pq-edmsg').textContent = t;
  };
  const rows = edRows();
  const flat = rows.join('');
  if (act === 'test' || act === 'robo') {
    if (!flat.includes('S') || !flat.includes('F')) return msg('Place un départ et une arrivée d’abord.');
    const sol = solve(parse(rows), ROBO, 90);
    if (act === 'robo') {
      gv.audio.play(sol ? 'achievement' : 'error');
      return msg(sol ? `Robo finit ton niveau en ${secs(sol.frames)} s. À toi de faire mieux !` : 'Robo n’arrive pas au bout : vérifie que ton niveau est faisable.');
    }
    saveEditor();
    current = { kind: 'custom', rows, sol };
    gv.restart();
    return;
  }
  if (act === 'share' || act === 'load') {
    const box = edEl.querySelector('.pq-codebox');
    box.hidden = false;
    const ta = box.querySelector('[data-code]');
    const go = box.querySelector('[data-ed="codego"]');
    if (act === 'share') {
      if (!flat.includes('S') || !flat.includes('F')) return msg('Place un départ et une arrivée d’abord.');
      ta.value = encodeLevel(rows);
      ta.readOnly = true;
      ta.select();
      go.textContent = 'Copier';
      go.dataset.mode = 'copy';
      store.data.shared++;
      store.save();
      gv.unlock('createur');
    } else {
      ta.value = '';
      ta.readOnly = false;
      ta.focus();
      go.textContent = 'Charger ce niveau';
      go.dataset.mode = 'load';
    }
    return;
  }
  if (act === 'codego') {
    const ta = edEl.querySelector('[data-code]');
    if (b.dataset.mode === 'copy') {
      navigator.clipboard?.writeText(ta.value).then(() => msg('Code copié : envoie-le à tes amis !'), () => msg('Sélectionne le code et copie-le.'));
      return;
    }
    try {
      const r = decodeLevel(ta.value);
      edit.rows = r.map((x) => x.split(''));
      edit.scroll = 0;
      saveEditor();
      renderEditor();
      msg('Niveau chargé !');
    } catch (err) {
      msg(err.message);
      gv.audio.play('error');
    }
    return;
  }
  if (act === 'codeclose') edEl.querySelector('.pq-codebox').hidden = true;
  if (act === 'clear') {
    edit.rows = blankLevel();
    saveEditor();
    renderEditor();
  }
  if (act === 'quit') {
    closeEditor();
    state = 'menu';
    renderOptions();
    gv.showStart();
  }
});

// Fin de partie : niveau suivant, retour à l'éditeur
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pq]');
  if (!b) return;
  if (b.dataset.pq === 'next') {
    const nx = nextLevel();
    if (!nx) return;
    current = { kind: 'campaign', ...nx };
    store.data.sel = nx;
    store.save();
    gv.restart();
  } else if (b.dataset.pq === 'editor') openEditor(current.rows);
});

// ---------- Accueil : mondes et niveaux ----------
function renderOptions() {
  const sel = store.data.sel;
  gv.shell.startExtra.innerHTML = `
    <div class="pq-options">
      ${WORLDS.map((wd) => {
        const open = worldOpen(wd.id);
        return `<div class="pq-world ${open ? '' : 'is-locked'}" style="--a:${wd.top};--b:${wd.sky[0]}">
          <p class="pq-world__name">${open ? '' : icon('lock')}Monde ${wd.id} · ${esc(wd.name)}</p>
          <div class="pq-levels">${Array.from({ length: 10 }, (_, i) => {
            const n = i + 1;
            const p = prog(wd.id, n);
            const ok = levelOpen(wd.id, n);
            const on = sel.w === wd.id && sel.n === n;
            const label = `Niveau ${wd.id}-${n}${n === 10 ? ', duel contre Robo-Boss' : ''}${p.done ? ', terminé' : ''}${p.crown ? ', Robo battu' : ''}${p.coins ? ', toutes les pièces' : ''}${ok ? '' : ', verrouillé'}`;
            return `<button type="button" class="pq-lv ${p.done ? 'is-done' : ''} ${n === 10 ? 'is-boss' : ''}" data-lv="${wd.id}-${n}" aria-pressed="${on}" aria-label="${label}" ${ok ? '' : 'aria-disabled="true"'}>${n === 10 ? icon('crown') : n}${p.crown ? '<i class="pq-crown"></i>' : ''}${p.coins ? '<i class="pq-coin"></i>' : ''}</button>`;
          }).join('')}</div>
        </div>`;
      }).join('')}
      <div class="pq-row">
        <button type="button" class="btn btn--sm" data-open-editor>${icon('grid')}Éditeur de niveaux</button>
        <button type="button" class="btn btn--sm btn--ghost" data-play-code>${icon('upload')}Jouer un code</button>
      </div>
      <div class="pq-playcode" hidden>
        <textarea class="input" rows="2" spellcheck="false" aria-label="Code d’un niveau" placeholder="PQ1.…"></textarea>
        <button type="button" class="btn btn--sm btn--primary" data-play-code-go>Jouer ce niveau</button>
      </div>
      <p class="pq-hint" id="pq-hint">Niveau choisi : ${sel.w}-${sel.n}. Arrive avant Robo pour valider chaque niveau.</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const hint = document.getElementById('pq-hint');
  if (b.dataset.lv) {
    const [w, n] = b.dataset.lv.split('-').map(Number);
    if (!levelOpen(w, n)) {
      hint.textContent = worldOpen(w) ? 'Bats Robo sur le niveau précédent pour ouvrir celui-ci.' : `Bats Robo-Boss au bout du monde ${w - 1} pour ouvrir ce monde.`;
      gv.audio.play('error');
      return;
    }
    store.data.sel = { w, n };
    store.save();
    current = { kind: 'campaign', w, n };
    gv.audio.play('select');
    renderOptions();
    gv.shell.startExtra.querySelector(`[data-lv="${w}-${n}"]`)?.focus();
    return;
  }
  if (b.hasAttribute('data-open-editor')) return openEditor();
  if (b.hasAttribute('data-play-code')) {
    const box = gv.shell.startExtra.querySelector('.pq-playcode');
    box.hidden = false;
    box.querySelector('textarea').focus();
    return;
  }
  if (b.hasAttribute('data-play-code-go')) {
    try {
      const rows = decodeLevel(gv.shell.startExtra.querySelector('.pq-playcode textarea').value);
      current = { kind: 'custom', rows };
      gv.start();
    } catch (err) {
      hint.textContent = err.message;
      gv.audio.play('error');
    }
  }
});

// ---------- Démarrage ----------
let frameMs = 0;
const loop = createLoop({
  update(dt, realDt) {
    const t0 = performance.now();
    update(Math.min(dt, 0.1), Math.min(realDt, 0.1));
    frameMs = frameMs * 0.95 + (performance.now() - t0) * 0.05;
  },
  render,
  onAutoPause() {
    if (state === 'play' && gv.playing) gv.pause();
  },
});

window.__pq = {
  get state() { return state; },
  get S() { return S; },
  get L() { return L; },
  get ghost() { return ghost; },
  get coins() { return coins.size; },
  get deaths() { return deaths; },
  get edit() { return edit; },
  get frameMs() { return frameMs; },
  get progress() { return store.data.progress; },
  // Tests : le héros rejoue une course trouvée par le solveur à sa vitesse à lui
  autoplay() {
    const sol = solve(L, { name: 'test', every: 6, acts: 'RJSN', speed: 1, beam: 120 });
    respawn();
    autoInputs = sol ? inputsOf(sol) : null;
    return !!sol;
  },
  manual() { autoInputs = null; },
  select(w, n) { current = { kind: 'campaign', w, n }; store.data.sel = { w, n }; },
  teleportToFlag() { S.x = L.flag - 0.3; S.y = 3; },
  kill() { S.dead = 'vide'; die('vide'); },
};

current = { kind: 'campaign', ...store.data.sel };
L = parse(campaignLevel(current.w, current.n).rows);
world = WORLDS[current.w - 1];
renderOptions();
gv.hud('level', `${current.w}-${current.n}`);
gv.hud('time', '0,00');
gv.hud('coins', '—');
gv.hud('robo', '—');
loop.start();
gv.showStart();
