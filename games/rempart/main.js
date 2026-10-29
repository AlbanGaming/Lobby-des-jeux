// Rempart — défense de tours : les ennemis suivent le chemin jusqu'au rempart. Place et améliore
// des tours entre les vagues (arbalète, canon, givre, éclair). Quinze vagues par carte, un mode
// infini et une carte du jour. En portrait, la carte pivote : l'ennemi descend vers le rempart.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Popups } from '../../shared/js/engine/fx.js';
import { dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { formatInt, TAU } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { COLS, ROWS, WAVES, TOWERS, ENEMIES, MAPS, towerStats, upgradeCost, sellValue, createGame, step, startWave, canBuild, build, upgrade, sell } from './logic.js';
import { drawTower, drawEnemy, drawDecor, drawGate } from './draw.js';

const params = new URLSearchParams(location.search);
const FAST = params.has('fast');
const MODES = {
  campagne: { id: 'campagne', label: 'Campagne', hint: '15 vagues pour défendre chaque carte' },
  infini: { id: 'infini', label: 'Infini', hint: 'Les vagues ne s’arrêtent jamais', unlock: true },
  jour: { id: 'jour', label: 'Carte du jour', hint: 'Mêmes vagues pour tous, ennemis coriaces' },
};
const TYPES = Object.keys(TOWERS);

const store = createStore('rempart', {
  version: 1,
  defaults: { mode: 'campagne', map: 0, stars: {}, endless: {}, built: 0, kills: 0, speed: 1, daily: { day: '', won: false, best: 0, plays: 0 } },
});

const gv = bootGame('rempart', {
  hud: [
    { id: 'wave', label: 'Vague' },
    { id: 'lives', label: 'Vies' },
    { id: 'gold', label: 'Or' },
  ],
  howTo: [
    { keys: ['icon:pointer', 'icon:touch'], text: 'Touche une case libre pour construire, une tour pour l’améliorer ou la vendre.' },
    { keys: ['N'], text: 'Lance la vague suivante plus tôt : le temps gagné rapporte de l’or.' },
    { keys: ['F'], text: 'Accélère le jeu (×2). Au clavier : flèches, 1 à 4 pour construire, U améliore, V vend.' },
    { keys: ['icon:heartFill'], text: 'Chaque ennemi qui passe le rempart coûte des vies. Le seigneur de guerre en coûte cinq.' },
  ],
  onStart: startGame,
  onRestart: startGame,
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
});

const stage = document.getElementById('stage');
const view = createCanvas(stage, { mode: 'fill' });
const bar = document.getElementById('bar');
const fx = { particles: new Particles(600), popups: new Popups(24), shake: new Shake({ maxOffset: 6 }) };

let state = 'attract'; // attract | run | over
let mode = MODES.campagne;
let g = demoGame();
let sel = null; // { c, r } case choisie
let cursor = null;
let speed = 1;
let time = 0;
const run = {};

const today = () => dayKey();
const wins = () => MAPS.filter((m) => (store.data.stars[m.id] ?? 0) > 0).length;
const mapOpen = (i) => i === 0 || (store.data.stars[MAPS[i - 1].id] ?? 0) > 0;
const towerOpen = (type) => mode.id === 'jour' || TOWERS[type].unlock <= wins();
const modeOpen = (m) => !m.unlock || wins() > 0;
const totalStars = () => MAPS.reduce((s, m) => s + (store.data.stars[m.id] ?? 0), 0);

function demoGame() {
  const d = createGame({ mapIndex: 0, seed: 3 });
  for (const [t, c, r] of [['arbalete', 3, 3], ['canon', 5, 5], ['arbalete', 9, 6], ['givre', 11, 4], ['eclair', 7, 8]]) {
    d.gold = 999;
    build(d, t, c, r);
  }
  d.gold = 0;
  startWave(d);
  return d;
}

function startGame() {
  mode = MODES[store.data.mode] ?? MODES.campagne;
  if (!modeOpen(mode)) mode = MODES.campagne;
  let mapIndex = mapOpen(store.data.map) ? store.data.map : 0;
  let mix = null;
  if (mode.id === 'jour') {
    const s = dailySeed('rempart');
    mapIndex = s % MAPS.length;
    mix = (s % 997) + 1;
  }
  g = createGame({ mapIndex, seed: Date.now() % 1e6, endless: mode.id === 'infini', mix });
  state = 'run';
  sel = null;
  cursor = null;
  speed = store.data.speed ?? 1;
  Object.assign(run, { result: null, lostLives: 0 });
  fx.particles.clear();
  fx.popups.clear();
  hud();
  renderBar();
}

// ---------- Actions ----------
function tapCell(c, r) {
  if (state !== 'run') return;
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) {
    sel = null;
    return renderBar();
  }
  const t = g.towers.find((x) => x.c === c && x.r === r);
  if (t || canBuild(g, c, r)) {
    sel = sel && sel.c === c && sel.r === r ? null : { c, r };
    gv.audio.play(sel ? 'select' : 'back', { volume: 0.5 });
  } else {
    sel = null;
    gv.audio.play('tock', { volume: 0.4 });
  }
  renderBar();
}

function doBuild(type) {
  if (!sel || state !== 'run' || !towerOpen(type)) return;
  const T = TOWERS[type];
  if (g.gold < T.cost) {
    gv.audio.play('error');
    flashGold();
    return;
  }
  const t = build(g, type, sel.c, sel.r);
  if (!t) return;
  store.data.built++;
  if (store.data.built >= 50) gv.unlock('batisseur');
  gv.audio.play('place');
  const [x, y] = toScreen(t.x, t.y);
  fx.particles.emit(x, y, { count: 16, colors: ['#d9cfbd', T.color, '#ffffff'], speed: [40, 160], gravity: 300, size: [2, 4], shape: 'square', life: [0.3, 0.6] });
  fx.shake.add(0.08);
  store.save();
  hud();
  renderBar();
}

function doUpgrade() {
  const t = selTower();
  if (!t) return;
  if (!upgrade(g, t)) {
    gv.audio.play('error');
    flashGold();
    return;
  }
  gv.audio.play('powerup');
  const [x, y] = toScreen(t.x, t.y);
  fx.particles.emit(x, y, { count: 20, colors: ['#ffc93c', '#fff3c4'], speed: [40, 200], gravity: -100, size: [2, 4], shape: 'star', life: [0.4, 0.8] });
  fx.popups.add(x, y - 20, `Niveau ${t.level}`, { size: 18, color: '#ffc93c', rise: 30 });
  hud();
  renderBar();
}

function doSell() {
  const t = selTower();
  if (!t) return;
  const v = sellValue(t);
  sell(g, t);
  const [x, y] = toScreen(t.x, t.y);
  fx.popups.add(x, y, `+${v}`, { size: 18, color: '#ffc93c', rise: 30 });
  gv.audio.play('coin');
  sel = null;
  hud();
  renderBar();
}

function nextWave() {
  if (state !== 'run' || g.phase !== 'build') return;
  const bonus = startWave(g);
  gv.banner(`Vague ${g.wave}${g.endless ? '' : ` / ${WAVES}`}`, { color: '#ff8a5b' });
  gv.audio.play('go');
  if (bonus) {
    const r = bar.getBoundingClientRect();
    fx.popups.add(view.width / 2, r.top - stage.getBoundingClientRect().top - 10, `+${bonus} or, en avance !`, { size: 18, color: '#ffc93c', rise: 30 });
  }
  hud();
  renderBar();
}

function toggleSpeed() {
  speed = speed === 1 ? 2 : 1;
  store.data.speed = speed;
  store.save();
  gv.audio.play('select', { volume: 0.5 });
  renderBar();
}

const selTower = () => (sel ? g.towers.find((t) => t.c === sel.c && t.r === sel.r) : null);
function flashGold() {
  const top = bar.getBoundingClientRect().top - stage.getBoundingClientRect().top;
  fx.popups.add(view.width / 2, top - 12, 'Pas assez d’or', { size: 18, color: '#ff9a90', rise: 24 });
}

// ---------- Évènements de la simulation ----------
let lastFire = 0;
function onEvents(events) {
  for (const e of events) {
    if (e.type === 'kill') {
      const [x, y] = toScreen(e.e.x, e.e.y);
      const E = ENEMIES[e.e.type];
      fx.particles.emit(x, y, { count: e.e.type === 'boss' ? 60 : 10, colors: [E.color, '#ffffff'], speed: [40, e.e.type === 'boss' ? 320 : 160], gravity: 400, size: [2, 5], shape: 'square', life: [0.3, 0.7] });
      fx.popups.add(x, y - 10, `+${e.reward}`, { size: 15, color: '#ffc93c', rise: 26 });
      if (state === 'run') {
        store.data.kills++;
        gv.audio.play(e.e.type === 'boss' ? 'explode' : 'pop', { pitch: 0.9 + Math.random() * 0.4, volume: e.e.type === 'boss' ? 1 : 0.35 });
        if (e.e.type === 'boss') {
          gv.unlock('boss');
          fx.shake.add(0.4);
          gv.banner('Seigneur vaincu !', { color: '#ffc93c' });
        }
      }
    } else if (e.type === 'leak' && state === 'run') {
      run.lostLives += e.n;
      fx.shake.add(0.25);
      gv.audio.play('hit');
      const [x, y] = toScreen(e.e.x, e.e.y);
      fx.popups.add(x, y, `−${e.n}`, { size: 20, color: '#ff5d5d', rise: 30 });
    } else if (e.type === 'boom') {
      const [x, y] = toScreen(e.x, e.y);
      const col = e.kind === 'givre' ? '#bfe9ff' : '#ffb02e';
      fx.particles.ring(x, y, { color: col, size: 4, growth: e.r * L.tile * 3, life: 0.25, lineWidth: 3 });
      if (e.kind === 'canon') fx.particles.emit(x, y, { count: 8, colors: ['#6b6f80', '#ffb02e'], speed: [30, 120], gravity: 200, size: [2, 4], shape: 'circle', life: [0.2, 0.5] });
      if (state === 'run' && e.kind === 'canon') gv.audio.play('hit', { volume: 0.25, pitch: 0.7 });
    } else if ((e.type === 'fire' || e.type === 'zap') && state === 'run') {
      const now = performance.now();
      if (now - lastFire > 70) {
        lastFire = now;
        if (e.type === 'zap') gv.audio.tone({ type: 'sawtooth', freq: 900, to: 300, duration: 0.08, volume: 0.05 });
        else gv.audio.play('tick', { volume: 0.15, pitch: e.t.type === 'canon' ? 0.6 : 1.4 });
      }
    } else if (e.type === 'cleared' && state === 'run') {
      gv.audio.play('confirm');
      hud();
      renderBar();
    } else if (e.type === 'wave' && state === 'run') {
      gv.banner(`Vague ${e.n}${g.endless ? '' : ` / ${WAVES}`}`, { color: '#ff8a5b' });
      renderBar();
    } else if ((e.type === 'won' || e.type === 'lost') && state === 'run') {
      end(e.type);
    }
  }
}

function end(result) {
  state = 'over';
  run.result = result;
  sel = null;
  const won = result === 'won';
  const isDaily = mode.id === 'jour';
  const stars = won ? 1 + (g.lives >= 10 ? 1 : 0) + (g.lives >= 20 ? 1 : 0) : 0;
  const points = Math.round(g.stats.earned * 2 + g.wave * 60 + (won ? 1000 + g.mapIndex * 500 + g.lives * 40 : 0));
  const before = wins();
  if (won && mode.id === 'campagne') {
    store.data.stars = { ...store.data.stars, [g.map.id]: Math.max(store.data.stars[g.map.id] ?? 0, stars) };
    if (g.mapIndex + 1 < MAPS.length) store.data.map = g.mapIndex + 1;
  }
  if (mode.id === 'infini') store.data.endless = { ...store.data.endless, [g.map.id]: Math.max(store.data.endless[g.map.id] ?? 0, g.wave) };
  if (isDaily) {
    const d = store.data.daily;
    if (d.day !== today()) Object.assign(d, { day: today(), won: false, best: 0, plays: 0 });
    d.plays++;
    d.won ||= won;
    d.best = Math.max(d.best, points);
    if (won) gv.unlock('du-jour');
  }
  store.save();
  if (won) {
    gv.unlock('premiere-victoire');
    if (g.lives >= 20) gv.unlock('sans-fuite');
  }
  if (wins() === MAPS.length) gv.unlock('toutes-cartes');
  if (MAPS.every((m) => store.data.stars[m.id] === 3)) gv.unlock('maitre');
  if (mode.id === 'infini' && g.wave >= 30) gv.unlock('infini-30');
  if (wins() > before) {
    const t = Object.values(TOWERS).find((x) => x.unlock === wins());
    if (t) toast({ title: 'Nouvelle tour !', text: `${t.name} : ${t.desc.toLowerCase()}.`, iconName: 'blocks', tone: 'var(--mint)' });
    if (before === 0) toast({ title: 'Mode Infini ouvert', text: 'Tiens le plus longtemps possible.', iconName: 'sparkle', tone: 'var(--coin)' });
  }
  if (won) gv.audio.play('win');
  const starHtml = won ? `<p class="rp-stars" aria-label="${stars} étoiles sur 3">${[0, 1, 2].map((k) => `<span class="${k < stars ? 'is-on' : ''}">${icon(k < stars ? 'starFill' : 'star')}</span>`).join('')}</p><p class="rp-why">${g.lives} vie${g.lives > 1 ? 's' : ''} sur 20${stars < 3 ? ' · garde les 20 vies pour 3 étoiles' : ''}</p>` : '';
  const nextMap = MAPS.find((m, i) => !mapOpen(i));
  gv.gameOver({
    score: points,
    stats: { score: points, waves: won ? g.wave : g.wave - 1, kills: g.stats.kills, win: won ? 1 : 0, daily: isDaily ? 1 : 0 },
    extraStats: [
      { label: 'Vagues', value: `${won ? g.wave : g.wave - 1}${g.endless ? '' : ` / ${WAVES}`}` },
      { label: 'Ennemis', value: formatInt(g.stats.kills) },
      { label: 'Tours', value: formatInt(g.towers.length) },
    ],
    kicker: `${mode.label} · ${g.map.name}`,
    title: won ? 'Le rempart a tenu !' : mode.id === 'infini' ? `Tombé à la vague ${g.wave}` : 'Le rempart est tombé',
    extraHtml: starHtml,
    nextUnlock: nextMap ? { label: `Carte ${nextMap.name}`, current: wins(), target: MAPS.indexOf(nextMap) } : undefined,
  });
  renderBar();
  renderOptions();
}

// ---------- Affichage du bas : construire, améliorer, vagues, vitesse ----------
function hud() {
  gv.hud('wave', g.endless ? `${g.wave}` : `${g.wave}/${WAVES}`);
  gv.hud('lives', g.lives, true);
  gv.hud('gold', formatInt(g.gold), true);
}

let barHtml = '';
function renderBar() {
  if (state !== 'run') {
    bar.hidden = true;
    barHtml = '';
    return;
  }
  bar.hidden = false;
  const t = selTower();
  let panel = '';
  if (t) {
    const s = towerStats(t);
    const up = upgradeCost(t);
    panel = `<div class="rp-panel" role="group" aria-label="${esc(TOWERS[t.type].name)}">
      <span class="rp-panel__name">${esc(TOWERS[t.type].name)} <b>niv. ${t.level}</b></span>
      <span class="rp-panel__stats">${Math.round(s.dmg)} dégâts · portée ${s.range.toFixed(1)}</span>
      <button type="button" class="rp-act" data-act="up" ${up === null ? 'disabled' : g.gold < up ? 'aria-disabled="true"' : ''}>${icon('plus')}${up === null ? 'Max' : `Améliorer ${up}`}</button>
      <button type="button" class="rp-act rp-act--sell" data-act="sell">${icon('coin')}Vendre ${sellValue(t)}</button>
    </div>`;
  } else if (sel) {
    panel = `<div class="rp-build" role="group" aria-label="Construire">${TYPES.map((type, k) => {
      const T = TOWERS[type];
      const open = towerOpen(type);
      const cant = g.gold < T.cost;
      return `<button type="button" class="rp-tower" data-build="${type}" aria-keyshortcuts="${k + 1}" ${open ? (cant ? 'aria-disabled="true"' : '') : 'disabled'} title="${esc(open ? `${T.name} : ${T.desc}` : `${T.name} : gagne ${T.unlock} carte${T.unlock > 1 ? 's' : ''} pour la débloquer`)}"><canvas width="64" height="64" data-preview="${type}" aria-hidden="true"></canvas><span>${open ? esc(T.name) : icon('lock')}</span><b>${T.cost}</b></button>`;
    }).join('')}</div>`;
  }
  const canCall = g.phase === 'build';
  const html = `
    ${panel || `<p class="rp-tip">${g.wave === 0 ? 'Touche une case d’herbe pour construire une tour.' : g.phase === 'build' ? `Vague suivante dans ${Math.ceil(g.countdown)} s` : `${g.enemies.length + g.queue.length} ennemis en route`}</p>`}
    <div class="rp-controls">
      <button type="button" class="rp-act rp-act--wave" data-act="wave" aria-keyshortcuts="N" ${canCall ? '' : 'disabled'}>${icon('play')}${g.wave === 0 ? 'Lancer' : 'Vague'}</button>
      <button type="button" class="rp-act" data-act="speed" aria-keyshortcuts="F" aria-pressed="${speed === 2}">${icon('forward')}×${speed}</button>
    </div>`;
  // Pas de rendu inutile : on garde le focus clavier et les aperçus
  if (html === barHtml) return;
  barHtml = html;
  bar.innerHTML = html;
  for (const c of bar.querySelectorAll('[data-preview]')) {
    const k = c.getContext('2d');
    k.scale(64, 64);
    drawTower(k, { type: c.dataset.preview, x: 0.5, y: 0.55, level: 1, angle: -Math.PI / 4, flash: 0 }, 0);
  }
}
bar.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.build) doBuild(b.dataset.build);
  else if (b.dataset.act === 'up') doUpgrade();
  else if (b.dataset.act === 'sell') doSell();
  else if (b.dataset.act === 'wave') nextWave();
  else if (b.dataset.act === 'speed') toggleSpeed();
});

// ---------- Repère : cases → écran (en portrait, la carte pivote) ----------
const L = { tile: 40, ox: 0, oy: 0, portrait: false };
function measure() {
  const cw = view.width;
  const barH = bar.hidden ? 0 : bar.offsetHeight + 8;
  const ch = view.height - barH;
  L.portrait = cw < ch * 0.85;
  const gw = L.portrait ? ROWS : COLS;
  const gh = L.portrait ? COLS : ROWS;
  L.tile = Math.floor(Math.min((cw - 16) / gw, (ch - 16) / gh));
  L.ox = Math.round((cw - gw * L.tile) / 2);
  L.oy = Math.round((ch - gh * L.tile) / 2);
}
// Case (x, y) → coordonnées écran en cases (avant mise à l'échelle)
const P = (x, y) => (L.portrait ? [ROWS - y, x] : [x, y]);
const toScreen = (x, y) => {
  const [X, Y] = P(x, y);
  return [L.ox + X * L.tile, L.oy + Y * L.tile];
};
function fromScreen(px, py) {
  const X = (px - L.ox) / L.tile;
  const Y = (py - L.oy) / L.tile;
  return L.portrait ? [Y, ROWS - X] : [X, Y];
}

// ---------- Saisie ----------
view.canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'run' || !gv.playing) return;
  const r = view.canvas.getBoundingClientRect();
  const [x, y] = fromScreen(e.clientX - r.left, e.clientY - r.top);
  cursor = null;
  tapCell(Math.floor(x), Math.floor(y));
});
document.addEventListener('keydown', (e) => {
  if (state !== 'run' || !gv.playing || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const dir = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k];
  if (dir) {
    e.preventDefault();
    // En portrait, les flèches suivent l'écran
    const [dx, dy] = L.portrait ? [dir[1], -dir[0]] : dir;
    const c0 = cursor ?? sel ?? { c: 2, r: 2 };
    cursor = { c: Math.max(0, Math.min(COLS - 1, c0.c + dx)), r: Math.max(0, Math.min(ROWS - 1, c0.r + dy)) };
    sel = cursor;
    gv.audio.play('hover', { volume: 0.3 });
    return renderBar();
  }
  const n = ['1', '2', '3', '4'].indexOf(k);
  if (n >= 0) return doBuild(TYPES[n]);
  if (k === 'u') doUpgrade();
  else if (k === 'v') doSell();
  else if (k === 'n') nextWave();
  else if (k === 'f') toggleSpeed();
});

// ---------- Boucle ----------
let barTick = 0;
function update(dt, realDt) {
  time += realDt;
  const steps = state === 'run' ? speed : 1;
  for (let s = 0; s < steps; s++) {
    const events = step(g, dt);
    if (state === 'run') onEvents(events);
    else onEvents(events.filter((e) => e.type === 'kill' || e.type === 'boom'));
  }
  if (state === 'attract' && (g.phase === 'build' || g.phase === 'lost' || g.phase === 'won')) {
    if (g.phase === 'build') startWave(g);
    else g = demoGame();
  }
  if (state === 'run') {
    hud();
    barTick -= realDt;
    if (barTick <= 0) {
      barTick = 0.5;
      if (!sel) renderBar();
    }
  }
  fx.particles.update(realDt);
  fx.popups.update(realDt);
  fx.shake.update(realDt);
}

function render() {
  measure();
  const ctx = view.begin();
  ctx.fillStyle = '#1b2a1b';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.save();
  fx.shake.apply(ctx, view.width / 2, view.height / 2);
  ctx.translate(L.ox, L.oy);
  ctx.save();
  ctx.scale(L.tile, L.tile);
  const m = g.map;
  // Sol en damier
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const [X, Y] = P(c, r);
      const XX = L.portrait ? X - 1 : X;
      ctx.fillStyle = m.ground[(c + r) % 2];
      ctx.fillRect(XX, Y, 1.02, 1.02);
    }
  }
  // Chemin
  const pts = m.path.map(([x, y]) => P(x + 0.5, y + 0.5));
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.92;
  stroke(ctx, pts, 0.06);
  ctx.strokeStyle = m.id === 'volcan' ? '#2e2424' : m.id === 'marais' ? '#7a6a4a' : '#c9a66b';
  ctx.lineWidth = 0.8;
  stroke(ctx, pts);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.06;
  ctx.setLineDash([0.18, 0.3]);
  stroke(ctx, pts);
  ctx.setLineDash([]);
  // Décor
  for (const i of g.blocked) {
    const [X, Y] = P(i % COLS, (i / COLS) | 0);
    drawDecor(ctx, m.decor, L.portrait ? X - 1 : X, Y, time, i);
  }
  // Rempart (sortie)
  const exit = m.path[m.path.length - 1];
  const [ex, ey] = P(Math.min(COLS - 1, exit[0]) + 0.5, exit[1] + 0.5);
  drawGate(ctx, ex, ey, L.portrait, g.lives);
  // Case choisie et portée
  const t = selTower();
  if (sel) {
    const [X, Y] = P(sel.c + 0.5, sel.r + 0.5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.06;
    ctx.strokeRect(X - 0.48, Y - 0.48, 0.96, 0.96);
    const range = t ? towerStats(t).range : TOWERS.arbalete.range;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.arc(X, Y, range, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  // Tours, ennemis, tirs
  for (const tw of g.towers) {
    const [X, Y] = P(tw.x, tw.y);
    drawTower(ctx, { ...tw, x: X, y: Y, angle: L.portrait ? tw.angle + Math.PI / 2 : tw.angle }, time);
  }
  const ordered = [...g.enemies].sort((a, b) => a.y - b.y);
  for (const e of ordered) {
    const [X, Y] = P(e.x, e.y);
    drawEnemy(ctx, e, X, Y, time);
  }
  for (const s of g.shots) {
    const [X, Y] = P(s.x, s.y);
    if (s.type === 'arbalete') {
      const [TX, TY] = P(s.tx, s.ty);
      const a = Math.atan2(TY - Y, TX - X);
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(X - Math.cos(a) * 0.22, Y - Math.sin(a) * 0.22);
      ctx.lineTo(X, Y);
      ctx.stroke();
    } else {
      // Boulet en cloche : il monte puis redescend
      const total = Math.hypot(s.tx - s.sx, s.ty - s.sy) || 1;
      const done = Math.min(1, Math.hypot(s.x - s.sx, s.y - s.sy) / total);
      const lift = s.type === 'canon' ? Math.sin(done * Math.PI) * 0.5 : 0;
      ctx.fillStyle = s.type === 'canon' ? '#2b2d42' : '#bfe9ff';
      ctx.beginPath();
      ctx.arc(X, Y - lift, s.type === 'canon' ? 0.11 : 0.08, 0, TAU);
      ctx.fill();
    }
  }
  for (const b of g.bolts) {
    const p = b.pts.map(([x, y]) => P(x, y));
    ctx.strokeStyle = `rgba(255,236,150,${b.life * 5})`;
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    p.forEach(([x, y], k) => {
      const j = k && k < p.length ? Math.sin(time * 90 + k) * 0.08 : 0;
      ctx.lineTo(x + j, y - j);
    });
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${b.life * 5})`;
    ctx.lineWidth = 0.03;
    ctx.stroke();
  }
  ctx.restore();
  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  ctx.restore();
}

function stroke(ctx, pts, off = 0) {
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y + off) : ctx.moveTo(x, y + off)));
  ctx.stroke();
}

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const dd = store.data.daily;
  const m = store.data.mode;
  gv.shell.startExtra.innerHTML = `
    <div class="rp-options">
      <div class="rp-row">
        <span class="rp-label" id="rp-mode-label">Mode</span>
        <div class="rp-modes" role="radiogroup" aria-labelledby="rp-mode-label">
          ${Object.values(MODES)
            .map((md) => {
              const open = modeOpen(md);
              const sub = !open ? 'Gagne une carte pour l’ouvrir' : md.id === 'jour' && dd.day === today() ? `${dd.won ? 'Tenue' : 'Pas encore tenue'} · ${dd.plays} essai${dd.plays > 1 ? 's' : ''}` : md.hint;
              return `<button type="button" role="radio" class="rp-mode" data-mode="${md.id}" aria-checked="${m === md.id}" ${open ? '' : 'aria-disabled="true"'}>${icon(open ? { campagne: 'crown', infini: 'sparkle', jour: 'calendar' }[md.id] : 'lock')}<span>${md.label}</span><small>${esc(sub)}</small></button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="rp-row" ${m === 'jour' ? 'hidden' : ''}>
        <span class="rp-label">Carte · ${totalStars()} / ${MAPS.length * 3} étoiles</span>
        <div class="rp-maps" role="radiogroup" aria-label="Carte">
          ${MAPS.map((mp, i) => {
            const open = mapOpen(i);
            const st = store.data.stars[mp.id] ?? 0;
            const best = store.data.endless[mp.id];
            const label = open ? `${mp.name}${st ? `, ${st} étoile${st > 1 ? 's' : ''}` : ''}` : `${mp.name}, verrouillée`;
            return `<button type="button" role="radio" class="rp-map" data-map="${i}" style="--g1:${mp.ground[0]};--g2:${mp.ground[1]}" aria-checked="${open && store.data.map === i}" aria-label="${esc(label)}" ${open ? '' : 'aria-disabled="true"'}><span class="rp-map__name">${open ? '' : icon('lock')}${esc(mp.name)}</span><span class="rp-mini">${[0, 1, 2].map((k) => `<i class="${k < st ? 'is-on' : ''}"></i>`).join('')}</span>${m === 'infini' && best ? `<small>record : vague ${best}</small>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="rp-hint" id="rp-hint">${m === 'jour' ? 'Une carte et des vagues tirées du jour : toutes les tours sont permises.' : `Tours : ${Object.values(TOWERS).map((t) => (t.unlock <= wins() ? t.name : `${t.name} (${t.unlock} carte${t.unlock > 1 ? 's' : ''})`)).join(', ')}.`}</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    document.getElementById('rp-hint').textContent = b.dataset.map ? `Gagne la carte ${MAPS[b.dataset.map - 1].name} pour ouvrir celle-ci.` : 'Gagne une première carte pour ouvrir ce mode.';
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.map) store.data.map = Number(b.dataset.map);
  store.save();
  gv.audio.play('select');
  renderOptions();
  const key = b.dataset.mode ? 'mode' : 'map';
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

window.__rp = {
  get state() { return state; },
  get g() { return g; },
  get sel() { return sel; },
  get frameMs() { return frameMs; },
  toScreen,
  // Avance la simulation (tests)
  advance(sec) {
    for (let k = 0; k < sec * 30; k++) onEvents(step(g, 1 / 30));
    hud();
    renderBar();
  },
  setGold(n) {
    g.gold = n;
    hud();
    renderBar();
  },
};

if (motion.reduced) fx.shake.add = () => {};
bar.hidden = true;
renderOptions();
gv.hud('wave', '0');
loop.start();
gv.showStart();
