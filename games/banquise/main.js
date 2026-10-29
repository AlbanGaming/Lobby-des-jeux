// Banquise — le pingouin glisse sur la glace et ne s'arrête qu'au premier obstacle. Rentre à
// l'igloo en un minimum de coups. Le bord, c'est l'eau ; la neige arrête, la glace fragile cède,
// les courants dévient. 40 niveaux en quatre mondes, et un niveau du jour.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Popups } from '../../shared/js/engine/fx.js';
import { dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { lerp, formatInt, TAU } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { WORLDS, parse, slide, solve, generate } from './levels.js';
import { SKINS, drawTile, drawPenguin, drawWater } from './draw.js';

const params = new URLSearchParams(location.search);
const FAST = params.has('fast');
const CELL_SPEED = FAST ? 80 : 13; // cases par seconde

const store = createStore('banquise', {
  version: 1,
  defaults: { mode: 'monde', world: 0, level: 0, stars: {}, fish: {}, skin: 'classique', falls: 0, daily: { day: '', best: 0, done: false, plays: 0 } },
});

const gv = bootGame('banquise', {
  hud: [
    { id: 'level', label: 'Niveau' },
    { id: 'moves', label: 'Coups' },
    { id: 'fish', label: 'Poissons' },
  ],
  howTo: [
    { keys: ['icon:touch', '←', '→'], text: 'Glisse du doigt ou utilise les flèches : le pingouin file jusqu’au premier obstacle.' },
    { keys: ['icon:home'], text: 'Rentre à l’igloo. Moins de coups qu’il n’en faut au mieux ? Impossible : vise le par pour 3 étoiles.' },
    { keys: ['icon:wave'], text: 'Le bord, c’est l’eau : plouf, et un coup de perdu. La glace fragile cède quand tu la quittes.' },
    { keys: ['Z'], text: 'Z ou le bouton retour annule le dernier coup.' },
  ],
  onStart: startGame,
  onRestart: startGame,
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
});

const stage = document.getElementById('stage');
const view = createCanvas(stage, { mode: 'fill' });
const pad = document.getElementById('pad');
const fx = { particles: new Particles(400), popups: new Popups(16), shake: new Shake({ maxOffset: 8 }) };

let DATA = null;
let lv = null; // niveau analysé
let par = 0;
let levelKey = '';
let state = 'idle'; // idle | play | anim | won
let pos = 0;
let broken = new Set();
let gotFish = new Set();
let history = [];
let anim = null;
let peng = { x: 0, y: 0, dir: 'down', squash: 1, sink: 0 };
let hintDir = null;
let time = 0;
const run = {};

const today = () => dayKey();
const totalStars = () => Object.values(store.data.stars).reduce((a, b) => a + b, 0);
const totalFish = () => Object.values(store.data.fish).reduce((a, b) => a + b, 0);
const worldOpen = (wi) => totalStars() >= WORLDS[wi].unlock;
const levelOpen = (wi, li) => worldOpen(wi) && (li === 0 || (store.data.stars[`${WORLDS[wi].id}-${li - 1}`] ?? 0) > 0);
const skin = () => SKINS.find((s) => s.id === store.data.skin) ?? SKINS[0];
const isDaily = () => store.data.mode === 'jour';
const label = (wi, li) => `${wi + 1}-${li + 1}`;
const starsFor = (moves) => (moves <= par ? 3 : moves <= par + 2 ? 2 : 1);

async function load() {
  DATA = await fetch('data/levels.json').then((r) => r.json());
}

let dailyCache = null;
function dailyLevel() {
  if (dailyCache?.day !== today()) dailyCache = { day: today(), lv: generate(dailySeed('banquise'), { ...WORLDS[3], size: [9, 10] }, 8) ?? DATA.worlds[3].levels[5] };
  return dailyCache.lv;
}

function loadLevel() {
  let src;
  if (isDaily()) {
    src = dailyLevel();
    levelKey = 'jour';
  } else {
    let { world: wi, level: li } = store.data;
    if (!levelOpen(wi, li)) {
      wi = 0;
      li = 0;
    }
    src = DATA.worlds[wi].levels[li];
    levelKey = `${WORLDS[wi].id}-${li}`;
    run.wi = wi;
    run.li = li;
  }
  lv = parse(src.rows);
  par = src.par;
  pos = lv.start;
  broken = new Set();
  gotFish = new Set();
  history = [];
  anim = null;
  hintDir = null;
  const p = cellXY(pos);
  peng = { x: p[0], y: p[1], dir: 'down', squash: 1, sink: 0 };
}

function startGame() {
  Object.assign(run, { moves: 0, falls: 0, hints: 0, done: false });
  loadLevel();
  state = 'play';
  fx.particles.clear();
  hud();
  pad.hidden = false;
}

const cellXY = (i) => [i % lv.w, (i / lv.w) | 0];
// Les effets sont en pixels : on convertit depuis les cases
const L = { tile: 48, ox: 0, oy: 0 };
function emitAt(cx, cy, o) {
  const t = L.tile;
  fx.particles.emit(cx * t, cy * t, { ...o, speed: o.speed.map((v) => v * t), gravity: (o.gravity ?? 0) * t, size: o.size.map((v) => v * t) });
}
const popAt = (cx, cy, text, o) => fx.popups.add(cx * L.tile, cy * L.tile, text, { ...o, size: o.size * L.tile, rise: o.rise * L.tile });

function hud() {
  gv.hud('level', isDaily() ? 'Jour' : label(run.wi, run.li));
  gv.hud('moves', `${run.moves} / ${par}`, true);
  gv.hud('fish', `${gotFish.size} / ${lv.fish.length}`);
}

// ---------- Coups ----------
function move(dir) {
  if (state !== 'play' || !gv.playing) return;
  const r = slide(lv, pos, dir, broken);
  peng.dir = dir;
  hintDir = null;
  if (r.result === 'none') {
    peng.squash = 0.82;
    gv.audio.play('tick', { volume: 0.4 });
    return;
  }
  history.push({ pos, broken, fish: new Set(gotFish) });
  run.moves++;
  anim = { path: r.path, t: 0, r, dir, out: r.out };
  state = 'anim';
  gv.audio.play('whoosh', { pitch: 1.3, volume: 0.45 });
  hud();
}

function undo() {
  if (state !== 'play' || !history.length) return;
  const h = history.pop();
  pos = h.pos;
  broken = h.broken;
  gotFish = h.fish;
  run.moves = Math.max(0, run.moves - 1);
  const p = cellXY(pos);
  peng.x = p[0];
  peng.y = p[1];
  gv.audio.play('back');
  hud();
}

function restart() {
  if (state !== 'play' && state !== 'anim') return;
  const keep = { falls: run.falls, hints: run.hints };
  loadLevel();
  Object.assign(run, { moves: 0, ...keep });
  state = 'play';
  gv.audio.play('back');
  hud();
}

function hint() {
  if (state !== 'play') return;
  const s = solve(lv, { from: pos, broken, limit: 30 });
  if (!s) {
    toast({ title: 'Impasse', text: 'D’ici, plus moyen d’arriver : annule ou recommence.', iconName: 'info' });
    return;
  }
  hintDir = s.path[0];
  run.hints++;
  gv.audio.play('powerup', { volume: 0.6 });
}

function endSlide() {
  const r = anim.r;
  anim = null;
  if (r.result === 'fall') {
    // Plouf : retour à la case de départ du coup, le coup reste compté
    run.falls++;
    store.data.falls++;
    gv.unlock('plouf');
    const at = r.out ?? cellXY(r.path[r.path.length - 1]);
    splash(at);
    popAt(at[0] + 0.5, at[1], 'Plouf !', { size: 0.7, color: '#4cc3ff', rise: 0.8 });
    gv.audio.play('pop', { pitch: 0.5 });
    fx.shake.add(0.2);
    const h = history[history.length - 1];
    pos = h.pos;
    broken = h.broken;
    gotFish = h.fish;
    const p = cellXY(pos);
    peng.x = p[0];
    peng.y = p[1];
    peng.sink = 1;
    state = 'play';
    store.save();
    hud();
    return;
  }
  for (const c of r.broken) if (!broken.has(c)) splash(cellXY(c), 6);
  broken = r.broken;
  pos = r.end;
  peng.squash = 1.25;
  if (r.result === 'win') return win();
  gv.audio.play('land', { volume: 0.6 });
  state = 'play';
  hud();
}

function win() {
  state = 'won';
  pad.hidden = true;
  const stars = Math.min(starsFor(run.moves), run.hints ? 2 : 3);
  const wiBonus = isDaily() ? 3 : run.wi;
  const points = 500 + stars * 250 + gotFish.size * 100 + Math.max(0, par * 2 - run.moves) * 20 + wiBonus * 200;
  run.stars = stars;
  run.points = points;
  gv.audio.play('win');
  const [x, y] = cellXY(lv.igloo);
  emitAt(x + 0.5, y + 0.5, { count: 50, colors: ['#ffc93c', '#ffffff', '#4cc3ff'], speed: [1.5, 6], gravity: 6, size: [0.06, 0.14], shape: 'star', life: [0.5, 1.1] });
  const before = { stars: totalStars(), fish: totalFish() };
  if (isDaily()) {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), best: 0, done: false, plays: 0 });
    d.plays++;
    d.done = true;
    d.best = Math.max(d.best, points);
    gv.unlock('du-jour');
  } else {
    store.data.stars = { ...store.data.stars, [levelKey]: Math.max(store.data.stars[levelKey] ?? 0, stars) };
    store.data.fish = { ...store.data.fish, [levelKey]: Math.max(store.data.fish[levelKey] ?? 0, gotFish.size) };
    // Niveau suivant
    if (run.li < 9) store.data.level = run.li + 1;
    else if (run.wi < WORLDS.length - 1 && worldOpen(run.wi + 1)) Object.assign(store.data, { world: run.wi + 1, level: 0 });
  }
  store.save();
  gv.unlock('premier');
  if (stars === 3) gv.unlock('trois-etoiles');
  WORLDS.forEach((w, wi) => {
    const ks = Array.from({ length: 10 }, (_, k) => store.data.stars[`${w.id}-${k}`] ?? 0);
    if (wi === 0 && ks.every((s) => s > 0)) gv.unlock('monde-1');
    if (ks.every((s) => s === 3)) gv.unlock('parfait');
    if (w.unlock > 0 && before.stars < w.unlock && totalStars() >= w.unlock) toast({ title: 'Nouveau monde !', text: `${w.name} est ouvert.`, iconName: 'star', tone: 'var(--mint)' });
  });
  if (WORLDS.every((_, wi) => worldOpen(wi))) gv.unlock('mondes');
  if (totalFish() >= 40) gv.unlock('pecheur');
  for (const s of SKINS) if (s.unlock > 0 && before.fish < s.unlock && totalFish() >= s.unlock) toast({ title: 'Nouveau look !', text: `${s.name} : choisis-le à l’accueil.`, iconName: 'sparkle', tone: 'var(--coin)' });
  gv.after(FAST ? 80 : 1100, () => finish());
}

function finish() {
  const next = WORLDS.find((w) => w.unlock > totalStars());
  const starHtml = `<p class="bq-stars" aria-label="${run.stars} étoiles sur 3">${[0, 1, 2].map((k) => `<span class="${k < run.stars ? 'is-on' : ''}">${icon(k < run.stars ? 'starFill' : 'star')}</span>`).join('')}</p><p class="bq-why">${run.moves} coup${run.moves > 1 ? 's' : ''} · par ${par}${run.hints ? ' · indice utilisé (2 étoiles au plus)' : ''}</p>`;
  gv.gameOver({
    score: run.points,
    stats: { score: run.points, solved: 1, stars3: run.stars === 3 ? 1 : 0, fish: gotFish.size, daily: isDaily() ? 1 : 0 },
    extraStats: [
      { label: 'Coups', value: `${run.moves} (par ${par})` },
      { label: 'Poissons', value: `${gotFish.size} / ${lv.fish.length}` },
    ],
    kicker: isDaily() ? 'Niveau du jour' : `${WORLDS[run.wi].name} · ${label(run.wi, run.li)}`,
    title: run.stars === 3 ? 'Parfait, au coup près !' : 'Bien rentré !',
    extraHtml: starHtml,
    nextUnlock: next ? { label: `Monde ${next.name}`, current: totalStars(), target: next.unlock } : undefined,
  });
  renderOptions();
}

function splash([x, y], n = 18) {
  emitAt(x + 0.5, y + 0.5, { count: n, colors: ['#bfe9ff', '#ffffff', '#4cc3ff'], speed: [1, 4], angle: -Math.PI / 2, spread: 2.4, gravity: 9, size: [0.05, 0.12], shape: 'circle', life: [0.3, 0.7] });
}

// ---------- Boucle ----------
function update(dt, realDt) {
  time += realDt;
  fx.particles.update(realDt);
  fx.popups.update(realDt);
  fx.shake.update(realDt);
  peng.squash = lerp(peng.squash, 1, 1 - Math.pow(0.001, realDt));
  peng.sink = Math.max(0, peng.sink - realDt * 2.5);
  if (state === 'anim' && anim) {
    anim.t += dt * CELL_SPEED;
    const segs = anim.path.length - 1 + (anim.r.result === 'fall' && anim.out ? 1 : 0);
    const t = Math.min(anim.t, segs);
    const k = Math.floor(t);
    const a = anim.path[k] !== undefined ? cellXY(anim.path[k]) : anim.out;
    const b = anim.path[k + 1] !== undefined ? cellXY(anim.path[k + 1]) : anim.out ?? a;
    peng.x = lerp(a[0], b[0], t - k);
    peng.y = lerp(a[1], b[1], t - k);
    // Poissons ramassés au passage, direction donnée par les courants
    for (let j = 0; j <= Math.min(k, anim.path.length - 1); j++) {
      const c = anim.path[j];
      if (lv.fish.includes(c) && !gotFish.has(c)) {
        gotFish.add(c);
        const [fx0, fy0] = cellXY(c);
        emitAt(fx0 + 0.5, fy0 + 0.5, { count: 14, colors: ['#ff8a5b', '#ffc93c', '#ffffff'], speed: [1, 3.5], gravity: 4, size: [0.05, 0.1], shape: 'star', life: [0.3, 0.6] });
        popAt(fx0 + 0.5, fy0 + 0.2, '+1', { size: 0.6, color: '#ffc93c', rise: 0.7 });
        gv.audio.play('coin', { pitch: 1.2 });
        hud();
      }
    }
    if (Math.random() < 0.5) emitAt(peng.x + 0.5, peng.y + 0.8, { count: 1, colors: ['#ffffff', '#d6f3ff'], speed: [0.2, 0.8], gravity: 0, size: [0.03, 0.07], shape: 'circle', life: [0.2, 0.4] });
    if (b && a && (b[0] !== a[0] || b[1] !== a[1])) peng.dir = b[0] > a[0] ? 'right' : b[0] < a[0] ? 'left' : b[1] > a[1] ? 'down' : 'up';
    if (anim.t >= segs) endSlide();
  }
}

function render() {
  const ctx = view.begin();
  drawWater(ctx, view.width, view.height, time);
  if (!lv) return;
  const padH = pad.hidden ? 0 : pad.offsetHeight + 12;
  const tile = Math.floor(Math.min((view.width - 24) / lv.w, (view.height - 24 - padH) / lv.h, 72));
  const ox = Math.round((view.width - tile * lv.w) / 2);
  const oy = Math.round((view.height - padH - tile * lv.h) / 2);
  ctx.save();
  fx.shake.apply(ctx, view.width / 2, view.height / 2);
  Object.assign(L, { tile, ox, oy });
  ctx.translate(ox, oy);
  ctx.save();
  ctx.scale(tile, tile);
  // Ombre portée de la banquise
  ctx.fillStyle = 'rgba(4,30,60,0.35)';
  ctx.fillRect(0.12, 0.18, lv.w, lv.h);
  for (let i = 0; i < lv.cells.length; i++) {
    const [x, y] = cellXY(i);
    drawTile(ctx, lv.cells[i], x, y, { broken: broken.has(i), fish: lv.fish.includes(i) && !gotFish.has(i), time, igloo: i === lv.igloo });
  }
  // Indice : une flèche depuis le pingouin
  if (hintDir && state === 'play') {
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[hintDir];
    const pulse = 0.5 + Math.sin(time * 8) * 0.12;
    ctx.save();
    ctx.translate(peng.x + 0.5 + dx * 0.9, peng.y + 0.5 + dy * 0.9);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = `rgba(62,230,168,${0.6 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(0.35, 0);
    ctx.lineTo(-0.2, -0.3);
    ctx.lineTo(-0.2, 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const winning = state === 'won';
  drawPenguin(ctx, skin(), peng.x, peng.y, peng.dir, { squash: peng.squash, sink: peng.sink, sliding: state === 'anim', time, hidden: winning });
  ctx.restore();
  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  ctx.restore();
}

// ---------- Saisie : clavier, glisser, boutons ----------
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', z: 'undo', Z: 'undo', Backspace: 'undo' };
document.addEventListener('keydown', (e) => {
  if (!gv.playing || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase?.()];
  if (!k) return;
  if (e.target.closest?.('button') && (e.key === 'Enter' || e.key === ' ')) return;
  e.preventDefault();
  if (k === 'undo') undo();
  else move(k);
});
let swipe = null;
view.canvas.addEventListener('pointerdown', (e) => {
  swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
});
view.canvas.addEventListener('pointerup', (e) => {
  if (!swipe || swipe.id !== e.pointerId) return;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
});
view.canvas.style.touchAction = 'none';

pad.innerHTML = `
  <button type="button" class="bq-tool" data-act="undo" aria-keyshortcuts="Z">${icon('back')}<span>Retour</span></button>
  <div class="bq-arrows" role="group" aria-label="Direction">
    <button type="button" class="bq-arrow" data-dir="left" aria-label="Gauche">${icon('chevronLeft')}</button>
    <button type="button" class="bq-arrow" data-dir="up" aria-label="Haut">${icon('chevronLeft')}</button>
    <button type="button" class="bq-arrow" data-dir="down" aria-label="Bas">${icon('chevronLeft')}</button>
    <button type="button" class="bq-arrow" data-dir="right" aria-label="Droite">${icon('chevronLeft')}</button>
  </div>
  <button type="button" class="bq-tool" data-act="hint">${icon('eye')}<span>Indice</span></button>
  <button type="button" class="bq-tool" data-act="restart">${icon('restart')}<span>Recommencer</span></button>`;
pad.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.dir) move(b.dataset.dir);
  else if (b.dataset.act === 'undo') undo();
  else if (b.dataset.act === 'hint') hint();
  else if (b.dataset.act === 'restart') restart();
});

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const dd = store.data.daily;
  const m = store.data.mode;
  const wi = store.data.world;
  gv.shell.startExtra.innerHTML = `
    <div class="bq-options">
      <div class="bq-row">
        <span class="bq-label" id="bq-mode-label">Mode</span>
        <div class="bq-modes" role="radiogroup" aria-labelledby="bq-mode-label">
          <button type="button" role="radio" class="bq-mode" data-mode="monde" aria-checked="${m === 'monde'}">${icon('grid')}<span>Mondes</span><small>${totalStars()} / ${WORLDS.length * 30} étoiles</small></button>
          <button type="button" role="radio" class="bq-mode" data-mode="jour" aria-checked="${m === 'jour'}">${icon('calendar')}<span>Niveau du jour</span><small>${dd.day === today() && dd.done ? `Réussi · ${formatInt(dd.best)} pts` : 'Le même pour tous'}</small></button>
        </div>
      </div>
      <div class="bq-row" ${m === 'jour' ? 'hidden' : ''}>
        <div class="bq-worlds" role="radiogroup" aria-label="Monde">
          ${WORLDS.map((w, i) => `<button type="button" role="radio" class="bq-world" data-world="${i}" aria-checked="${wi === i}" ${worldOpen(i) ? '' : 'aria-disabled="true"'}>${worldOpen(i) ? '' : icon('lock')}${esc(w.name)}</button>`).join('')}
        </div>
        <div class="bq-levels" role="radiogroup" aria-label="Niveau">
          ${Array.from({ length: 10 }, (_, li) => {
            const open = levelOpen(wi, li);
            const st = store.data.stars[`${WORLDS[wi].id}-${li}`] ?? 0;
            const name = `Niveau ${label(wi, li)}${open ? (st ? `, ${st} étoile${st > 1 ? 's' : ''}` : '') : ', verrouillé'}`;
            return `<button type="button" role="radio" class="bq-level" data-level="${li}" aria-checked="${open && store.data.level === li}" aria-label="${esc(name)}" title="${esc(name)}" ${open ? '' : 'aria-disabled="true"'}><b>${open ? li + 1 : icon('lock')}</b><span class="bq-mini">${[0, 1, 2].map((k) => `<i class="${k < st ? 'is-on' : ''}"></i>`).join('')}</span></button>`;
          }).join('')}
        </div>
      </div>
      <div class="bq-row">
        <span class="bq-label" id="bq-skin-label">Pingouin · ${totalFish()} poissons</span>
        <div class="bq-skins" role="radiogroup" aria-labelledby="bq-skin-label">
          ${SKINS.map((s) => {
            const locked = totalFish() < s.unlock;
            const name = locked ? `${s.name}, débloqué à ${s.unlock} poissons` : s.name;
            return `<button type="button" role="radio" class="bq-skin" data-skin="${s.id}" aria-checked="${store.data.skin === s.id}" aria-label="${esc(name)}" title="${esc(name)}" ${locked ? 'aria-disabled="true"' : ''}><canvas width="88" height="88" data-preview="${s.id}" aria-hidden="true"></canvas>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="bq-hint" id="bq-hint">${m === 'jour' ? 'Un niveau tiré du jour, avec tous les pièges.' : `${WORLDS[wi].name} : ${worldHint(wi)}`}</p>
    </div>`;
  for (const c of gv.shell.startExtra.querySelectorAll('[data-preview]')) {
    const k = c.getContext('2d');
    k.scale(88, 88);
    drawPenguin(k, SKINS.find((s) => s.id === c.dataset.preview), 0, 0, 'down', { squash: 1, sink: 0, time: 0 });
  }
}
const worldHint = (wi) => ['rochers et eau glacée.', 'la neige t’arrête net.', 'la glace fragile cède derrière toi.', 'les courants changent ta direction.'][wi];

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const hintEl = document.getElementById('bq-hint');
  if (b.getAttribute('aria-disabled') === 'true') {
    gv.audio.play('error');
    if (b.dataset.world) hintEl.textContent = `${WORLDS[b.dataset.world].name} s’ouvre à ${WORLDS[b.dataset.world].unlock} étoiles (tu en as ${totalStars()}).`;
    else if (b.dataset.level) hintEl.textContent = 'Réussis le niveau précédent pour ouvrir celui-ci.';
    else if (b.dataset.skin) hintEl.textContent = `Ramasse ${SKINS.find((s) => s.id === b.dataset.skin).unlock} poissons pour ce look.`;
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.world) Object.assign(store.data, { world: Number(b.dataset.world), level: 0 });
  if (b.dataset.level) store.data.level = Number(b.dataset.level);
  if (b.dataset.skin) store.data.skin = b.dataset.skin;
  store.save();
  gv.audio.play('select');
  renderOptions();
  preview();
  const key = ['mode', 'world', 'level', 'skin'].find((k) => b.dataset[k] !== undefined);
  gv.shell.startExtra.querySelector(`[data-${key}="${b.dataset[key]}"]`)?.focus();
});

// Derrière l'accueil : le niveau choisi
function preview() {
  Object.assign(run, { moves: 0, falls: 0, hints: 0 });
  loadLevel();
  state = 'idle';
  pad.hidden = true;
  hud();
}

// ---------- Démarrage ----------
const loop = createLoop({
  update,
  render,
  onAutoPause() {
    if (gv.playing) gv.pause();
  },
});

window.__bq = {
  get state() { return state; },
  get run() { return run; },
  get pos() { return pos; },
  get par() { return par; },
  get lv() { return lv; },
  get fish() { return gotFish.size; },
  move,
  solution: () => solve(lv, { from: pos, broken, limit: 30 })?.path ?? null,
  // Première direction qui fait tomber à l'eau (tests)
  fallDir: () => Object.keys({ up: 1, down: 1, left: 1, right: 1 }).find((d) => slide(lv, pos, d, broken).result === 'fall') ?? null,
};

await load();
if (motion.reduced) fx.shake.add = () => {};
preview();
renderOptions();
loop.start();
gv.showStart();
