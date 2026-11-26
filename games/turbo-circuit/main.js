// Turbo circuit — course vue de dessus en trois tours contre cinq pilotes IA, chacun avec son
// caractère : Nitro fonce et freine tard, Prudence ne se rate jamais, Zigzag improvise, Bloqueur
// te ferme la porte, Chrono le champion prend la trajectoire parfaite. Les dérapages chargent le
// turbo ; les primes de course paient le garage ; trois coupes de quatre courses.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash } from '../../shared/js/engine/fx.js';
import { createRng } from '../../shared/js/core/rng.js';
import { clamp, formatInt, TAU } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { THEMES, CIRCUITS, PILOTS, LEVELS, CUPS, UPGRADES, ROAD, buildTrack, nearest } from './tracks.js';

const LAPS = 3;
const POINTS = [10, 6, 4, 3, 2, 1];
const PRIZE = [120, 80, 55, 35, 20, 10];
const BASE = { top: 520, acc: 360, brake: 720, turn: 2.7 };

const store = createStore('turbo-circuit', {
  version: 1,
  defaults: { mode: 'course', circuit: 'port', level: 'facile', cash: 0, upg: { moteur: 0, pneus: 0, turbo: 0 }, cups: {}, laps: {}, cup: null },
});
const params = new URLSearchParams(location.search);

const gv = bootGame('turbo-circuit', {
  hud: [
    { id: 'pos', label: 'Place' },
    { id: 'lap', label: 'Tour' },
    { id: 'time', label: 'Temps' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['↑', '←', '→', '↓'], text: 'Accélère, tourne, freine (ou ZQSD). Sur téléphone, la voiture accélère seule : touche à gauche ou à droite pour tourner.' },
    { keys: ['Espace'], text: 'Dérape dans les virages : la jauge de turbo se remplit. Maj ou T pour lancer le turbo.' },
    { keys: ['icon:trophy'], text: 'Cinq pilotes IA, cinq caractères. Bats Chrono, le champion, et remporte les trois coupes.' },
  ],
  onStart: () => startRace(),
  onRestart: () => startRace(),
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
  formatScore: (n) => formatInt(n),
});

const stage = document.getElementById('stage');
const view = createCanvas(stage, { mode: 'stage', height: 760, minWidth: (w, h) => (w > h ? 980 : 460) });
const fx = { particles: new Particles(600), shake: new Shake({ maxOffset: 8 }), flash: new Flash() };

let state = 'menu'; // menu | count | race | done
let T = null; // circuit construit
let theme = THEMES.vert;
let level = LEVELS.facile;
let cars = [];
let me = null;
let clock = 0;
let countT = 0;
let time = 0;
let rng = createRng(1);
let finishOrder = [];
let say = null; // { text, t }
let autoplay = params.has('autoplay');
const keys = { up: false, down: false, left: false, right: false, drift: false };
let turboQueued = false;
const touchy = matchMedia('(pointer: coarse)').matches;

const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0').replace('.', ',')}`;
const circuitOf = (id) => CIRCUITS.find((c) => c.id === id) ?? CIRCUITS[0];
const upg = () => store.data.upg;

// ---------- Course ----------
function makeCar(pilot, slot) {
  const back = 4 + Math.floor(slot / 2) * 3;
  const i = (T.N - back) % T.N;
  const side = slot % 2 ? 1 : -1;
  const x = T.xs[i] - T.ty[i] * side * 32;
  const y = T.ys[i] + T.tx[i] * side * 32;
  return { pilot, x, y, vx: 0, vy: 0, h: Math.atan2(T.ty[i], T.tx[i]), idx: i, lap: 0, half: false, prog: 0, done: false, finishT: 0, charge: 0, boostT: 0, drifting: false, steer: 0, offT: 0, wobble: rng.range(0, TAU), mistakeT: 0, turbos: 0, lapStart: 0, bestLap: Infinity, color: pilot ? pilot.color : '#ffffff' };
}

function startRace() {
  const s = store.data;
  // « Jouer » depuis le garage, ou sans coupe en cours : une course rapide
  if (s.mode === 'garage' || (s.mode === 'coupe' && !s.cup)) s.mode = 'course';
  let circuit;
  if (s.mode === 'coupe' && s.cup) {
    const cup = CUPS.find((c) => c.id === s.cup.id);
    circuit = circuitOf(cup.circuits[s.cup.race]);
    level = LEVELS[cup.level];
  } else {
    circuit = circuitOf(s.circuit);
    level = LEVELS[s.level];
  }
  T = buildTrack(circuit);
  theme = THEMES[T.theme];
  rng = createRng(Number(params.get('seed')) || Math.floor(Math.random() * 1e9));
  // Le joueur part 4e : il faut doubler
  const order = [PILOTS[4], PILOTS[0], PILOTS[1], null, PILOTS[3], PILOTS[2]];
  cars = order.map((p, slot) => makeCar(p, slot));
  me = cars.find((c) => !c.pilot);
  clock = 0;
  countT = 3.2;
  finishOrder = [];
  say = null;
  state = 'count';
  fx.particles.clear();
  showPad(true);
  gv.hud('lap', `1/${LAPS}`);
  gv.hud('time', fmt(0));
  gv.hud('pos', '4/6');
  gv.hud('best', formatInt(gv.best ?? 0));
}

// Physique commune au joueur et aux IA. ctl : { gas, brake, steer (-1..1), drift, turbo }
function drive(c, ctl, dt) {
  const isMe = c === me;
  const u = upg();
  const pil = c.pilot;
  const topMul = isMe ? 1 + u.moteur * 0.04 : pil.top * level.top;
  const gripMul = isMe ? 1 + u.pneus * 0.06 : pil.grip * level.grip;
  const near = nearest(T, c.x, c.y, c.idx);
  c.idx = near.i;
  const off = near.d > ROAD / 2;
  c.offT = off ? c.offT + dt : 0;
  if (c.boostT > 0) c.boostT -= dt;
  let top = BASE.top * topMul * (c.boostT > 0 ? 1.35 : 1) * (off ? 0.5 : 1);
  const fx0 = Math.cos(c.h);
  const fy0 = Math.sin(c.h);
  let fwd = c.vx * fx0 + c.vy * fy0;
  let lat = -c.vx * fy0 + c.vy * fx0;
  // Accélération, frein, marche arrière
  if (ctl.gas) fwd += BASE.acc * (c.boostT > 0 ? 1.6 : 1) * dt;
  else if (ctl.brake) fwd -= (fwd > 0 ? BASE.brake : BASE.acc * 0.6) * dt;
  else fwd *= 1 - 0.6 * dt;
  if (off) fwd *= 1 - 1.2 * dt;
  fwd = clamp(fwd, -150, top);
  // Direction : plus on va vite, plus le volant répond (jusqu'à un plafond)
  const speed = Math.abs(fwd);
  c.drifting = ctl.drift && speed > 220 && Math.abs(ctl.steer) > 0.3 && !off;
  const turn = BASE.turn * (c.drifting ? 1.4 : 1) * Math.min(1, speed / 170) * Math.sign(fwd || 1);
  c.h += ctl.steer * turn * dt;
  // Adhérence : la vitesse latérale s'efface vite, sauf en dérapage
  const keep = c.drifting ? 0.94 : 0.7 / gripMul ** 2;
  lat *= Math.pow(Math.min(0.97, keep), dt * 60);
  if (c.drifting) {
    fwd *= 1 - 0.25 * dt;
    c.charge = Math.min(3, c.charge + dt * 0.5 * (isMe ? 1 + u.turbo * 0.25 : 1));
  }
  if (ctl.turbo && c.charge >= 1 && c.boostT <= 0) {
    c.charge -= 1;
    c.boostT = 1.2 + (isMe ? u.turbo * 0.25 : 0);
    c.turbos++;
    if (isMe) {
      gv.audio.play('powerup', { pitch: 0.8 });
      fx.shake.add(0.15);
      if (c.turbos >= 5) gv.unlock('turbo-5');
    }
  }
  const fx1 = Math.cos(c.h);
  const fy1 = Math.sin(c.h);
  c.vx = fx1 * fwd - fy1 * lat;
  c.vy = fy1 * fwd + fx1 * lat;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.speed = fwd;
  // Tours : il faut passer par la moitié du circuit pour compter la ligne
  const i = c.idx;
  if (i > T.N * 0.4 && i < T.N * 0.6) c.half = true;
  if (c.prevIdx !== undefined && c.prevIdx > T.N * 0.85 && i < T.N * 0.15) {
    if (c.half) {
      c.half = false;
      lapDone(c);
    }
  }
  c.prevIdx = i;
  c.prog = c.lap * T.N + i;
  // Fumée et flammes
  if (c.drifting && Math.random() < 0.6) fx.particles.emit(c.x - fx1 * 16, c.y - fy1 * 16, { count: 1, colors: ['rgba(230,230,240,0.7)'], speed: [10, 40], gravity: 0, size: [6, 12], shape: 'circle', life: [0.3, 0.6] });
  if (c.boostT > 0 && Math.random() < 0.8) fx.particles.emit(c.x - fx1 * 20, c.y - fy1 * 20, { count: 1, colors: ['#ffc93c', '#ff6a2b'], speed: [20, 80], gravity: 0, size: [3, 6], shape: 'circle', life: [0.15, 0.3] });
  if (off && speed > 150 && Math.random() < 0.3) fx.particles.emit(c.x, c.y, { count: 1, colors: [theme.grass2], speed: [20, 60], gravity: 0, size: [3, 5], shape: 'square', life: [0.2, 0.4] });
}

function lapDone(c) {
  const lapTime = clock - c.lapStart;
  c.lapStart = clock;
  c.bestLap = Math.min(c.bestLap, lapTime);
  c.lap++;
  if (c === me) {
    const best = store.data.laps[T.id];
    if (!best || lapTime < best) {
      store.data.laps[T.id] = lapTime;
      store.save();
    }
    if (c.lap < LAPS) {
      gv.hud('lap', `${c.lap + 1}/${LAPS}`, true);
      gv.banner(c.lap === LAPS - 1 ? 'Dernier tour !' : `Tour ${c.lap + 1}`, { color: '#ffc93c' });
      gv.audio.play('tick');
    }
  }
  if (c.lap >= LAPS && !c.done) {
    c.done = true;
    c.finishT = clock;
    finishOrder.push(c);
    if (c === me) finishRace();
  }
}

// ---------- IA ----------
// Profil neutre : la voiture du joueur quand elle roule seule (après l'arrivée, tests)
const SELF = { line: 1, grip: 1, top: 1, brakeLate: 1, turbo: 'ligne droite' };
const NEUTRAL = { top: 1, grip: 1, rubber: 0 };
function aiControl(c, dt) {
  const p = c.pilot ?? SELF;
  const lv = c.pilot ? level : NEUTRAL;
  const N = T.N;
  const speed = Math.max(0, c.speed ?? 0);
  // Point visé : devant, sur la trajectoire idéale (plus ou moins fidèlement)
  const look = 5 + Math.floor(speed / 45);
  const j = (c.idx + look) % N;
  let off = T.line[j] * p.line;
  if (p.wild) {
    off += Math.sin(clock * 1.3 + c.wobble) * 26;
    if (c.mistakeT <= 0 && rng.chance(dt * 0.12)) c.mistakeT = 0.7;
  }
  // Bloqueur : quand tu es juste derrière, il se met sur ta ligne
  if (p.blocks && me && !me.done) {
    const gap = c.prog - me.prog;
    if (gap > 0 && gap < 8) {
      const mi = me.idx;
      const lateral = (me.x - T.xs[mi]) * -T.ty[mi] + (me.y - T.ys[mi]) * T.tx[mi];
      off = clamp(lateral, -ROAD / 2 + 24, ROAD / 2 - 24);
    }
  }
  if (c.mistakeT > 0) {
    c.mistakeT -= dt;
    off += 60;
  }
  const tx = T.xs[j] - T.ty[j] * off;
  const ty = T.ys[j] + T.tx[j] * off;
  let d = Math.atan2(ty - c.y, tx - c.x) - c.h;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  const steer = clamp(d * 2.6, -1, 1);
  // Vitesse sûre d'après le virage le plus serré devant
  let k = 0;
  for (let s = 2; s < 14 + speed / 30; s++) k = Math.max(k, Math.abs(T.curv[(c.idx + s) % N]));
  const latMax = 620 * p.grip * lv.grip * p.brakeLate;
  const safe = k > 0 ? Math.sqrt(latMax / k) : 9999;
  // Léger élastique en facile : l'IA trop loin devant lève le pied, trop loin derrière accélère
  let rub = 1;
  if (lv.rubber && me) rub = 1 + clamp((me.prog - c.prog) / 40, -1, 1) * lv.rubber;
  const want = Math.min(BASE.top * p.top * lv.top * rub, safe);
  const straight = k < 0.0012;
  const turbo = c.charge >= 1 && (p.turbo === 'tôt' || (p.turbo === 'hasard' ? rng.chance(dt * 0.5) : straight && speed > 300));
  // Les IA chargent leur turbo en roulant (elles ne dérapent pas)
  c.charge = Math.min(3, c.charge + dt * 0.12 * (p.champion ? 1.2 : 1));
  return { gas: speed < want, brake: speed > want + 40, steer, drift: false, turbo };
}

function myControl() {
  if (autoplay) {
    const c = aiControl(me, 1 / 60);
    return c;
  }
  const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const out = { gas: keys.up || (touchy && !keys.down), brake: keys.down, steer, drift: keys.drift, turbo: turboQueued };
  turboQueued = false;
  return out;
}

function collide() {
  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      const A = cars[a];
      const B = cars[b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 30) {
        const push = (30 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        A.x -= nx * push;
        A.y -= ny * push;
        B.x += nx * push;
        B.y += ny * push;
        const rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rel < 0) {
          A.vx += nx * rel * 0.5;
          A.vy += ny * rel * 0.5;
          B.vx -= nx * rel * 0.5;
          B.vy -= ny * rel * 0.5;
          if ((A === me || B === me) && rel < -80) {
            gv.audio.play('hit', { volume: 0.4, throttle: 0.2 });
            fx.shake.add(0.15);
          }
        }
      }
    }
  }
}

function ranking() {
  const done = finishOrder.slice();
  const rest = cars.filter((c) => !c.done).sort((a, b) => b.prog - a.prog);
  return [...done, ...rest];
}

// ---------- Fin de course ----------
function finishRace() {
  state = 'done';
  showPad(false);
  const rank = ranking();
  const pos = rank.indexOf(me);
  const win = pos === 0;
  const chrono = cars.find((c) => c.pilot?.champion);
  const beatChrono = rank.indexOf(me) < rank.indexOf(chrono);
  gv.audio.play(win ? 'win' : pos < 3 ? 'achievement' : 'gameOver');
  if (win) fx.flash.trigger('#ffc93c', 0.3, 2);
  const s = store.data;
  const prize = Math.round(PRIZE[pos] * level.mult);
  s.cash += prize;
  gv.unlock('premiere-course');
  if (pos < 3) gv.unlock('podium');
  if (win) gv.unlock('victoire');
  if (win && level === LEVELS.expert) gv.unlock('expert');
  if (beatChrono) gv.unlock('chrono');
  const score = Math.round(((6 - pos) * 100 + (beatChrono ? 100 : 0)) * level.mult);
  // Coupe : points, course suivante ou classement final
  let cupHtml = '';
  let cupLine = '';
  if (s.mode === 'coupe' && s.cup) {
    const cup = CUPS.find((c) => c.id === s.cup.id);
    rank.forEach((c, i) => {
      const k = c.pilot ? c.pilot.id : 'toi';
      s.cup.points[k] = (s.cup.points[k] ?? 0) + POINTS[i];
    });
    s.cup.race++;
    const table = Object.entries(s.cup.points).sort((a, b) => b[1] - a[1]);
    const last = s.cup.race >= cup.circuits.length;
    const myRank = table.findIndex(([k]) => k === 'toi');
    if (last) {
      cupLine = myRank === 0 ? `Tu remportes la ${cup.name} ! +${cup.prize} de prime.` : `${cup.name} terminée : ${myRank + 1}e au classement.`;
      if (myRank === 0) {
        s.cups[cup.id] = true;
        s.cash += cup.prize;
        gv.unlock(`coupe-${cup.id}`);
      }
    }
    cupHtml = `<div class="tc-table"><p class="tc-table__title">${esc(cup.name)} · ${last ? 'classement final' : `après ${s.cup.race} course${s.cup.race > 1 ? 's' : ''} sur ${cup.circuits.length}`}</p><ol>${table
      .map(([k, pts]) => `<li class="${k === 'toi' ? 'is-me' : ''}"><span>${k === 'toi' ? 'Toi' : esc(PILOTS.find((p) => p.id === k).name)}</span><b>${pts} pts</b></li>`)
      .join('')}</ol>${last ? `<p class="tc-table__end">${esc(cupLine)}</p>` : `<button type="button" class="btn btn--primary btn--block" data-tc="next">${icon('forward')}Course suivante : ${esc(circuitOf(cup.circuits[s.cup.race]).name)}</button>`}</div>`;
    if (last) s.cup = null;
  }
  store.save();
  if (Object.values(s.upg).some((v) => v >= 3)) gv.unlock('garage');
  const results = `<ol class="tc-results">${rank
    .map((c, i) => `<li class="${c === me ? 'is-me' : ''}"><span class="tc-dot" style="background:${c.color}"></span><span>${i + 1}. ${c === me ? 'Toi' : esc(c.pilot.name)}</span><b>${c.done ? fmt(c.finishT) : 'en course'}</b></li>`)
    .join('')}</ol>`;
  const loser = rank[pos + 1]?.pilot;
  say = loser ? { text: loser.says.lose, t: 4 } : null;
  gv.gameOver({
    score,
    stats: { score, pos: pos + 1, win: win ? 1 : 0, podium: pos < 3 ? 1 : 0, chrono: beatChrono ? 1 : 0 },
    extraStats: [
      { label: 'Place', value: `${pos + 1}e / 6` },
      { label: 'Temps', value: fmt(me.finishT) },
      { label: 'Meilleur tour', value: fmt(me.bestLap) },
      { label: 'Prime', value: `+${prize}` },
    ],
    kicker: `${T.name} · ${level.name}`,
    title: win ? 'Victoire !' : pos < 3 ? `Sur le podium, ${pos + 1}e` : `${pos + 1}e place`,
    sound: win ? 'win' : undefined,
    extraHtml: results + cupHtml,
  });
  renderOptions();
}

// ---------- Boucle ----------
let lastRank = [];
function update(dt, realDt) {
  time += realDt;
  fx.particles.update(realDt);
  fx.shake.update(realDt);
  fx.flash.update(realDt);
  if (say) say.t -= realDt;
  if (state === 'count') {
    const before = Math.ceil(countT);
    countT -= dt;
    if (Math.ceil(countT) !== before && countT > 0) gv.audio.play('countdown');
    if (countT <= 0) {
      state = 'race';
      gv.audio.play('go');
    }
    return;
  }
  if (state !== 'race' && state !== 'done') return;
  // Pas fixe pour une physique stable
  const steps = Math.ceil(dt / (1 / 120));
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    if (state === 'race') clock += h;
    for (const c of cars) {
      if (c === me && state === 'done') {
        drive(c, aiControl(c, h), h); // après l'arrivée, la voiture finit son tour seule
        continue;
      }
      const ctl = c === me ? myControl() : aiControl(c, h);
      drive(c, ctl, h);
    }
    collide();
  }
  if (state !== 'race') return;
  gv.hud('time', fmt(clock));
  const rank = ranking();
  const pos = rank.indexOf(me);
  gv.hud('pos', `${pos + 1}/6`);
  // Dépassements : les pilotes réagissent
  if (lastRank.length) {
    const was = lastRank.indexOf(me);
    if (pos < was) {
      const passed = lastRank[pos]?.pilot;
      if (passed && (!say || say.t < 1)) say = { text: passed.says.pass, t: 3 };
      gv.audio.play('nearMiss', { volume: 0.5, throttle: 0.5 });
    }
  }
  lastRank = rank;
}

// ---------- Rendu ----------
function render() {
  const ctx = view.begin();
  const W = view.width;
  const H = view.height;
  ctx.fillStyle = theme.grass;
  ctx.fillRect(0, 0, W, H);
  if (!T) {
    T = buildTrack(circuitOf(store.data.circuit));
    theme = THEMES[T.theme];
  }
  const focus = me ?? { x: T.xs[0], y: T.ys[0], vx: 0, vy: 0 };
  const camX = focus.x + (focus.vx ?? 0) * 0.25 - W / 2;
  const camY = focus.y + (focus.vy ?? 0) * 0.25 - H / 2;
  ctx.save();
  fx.shake.apply(ctx, W / 2, H / 2);
  // Herbe à motifs
  ctx.fillStyle = theme.grass2;
  const g = 80;
  for (let x = -((camX % g) + g) % g - g; x < W + g; x += g) for (let y = -((camY % g) + g) % g - g; y < H + g; y += g) if ((Math.floor((x + camX) / g) + Math.floor((y + camY) / g)) % 2 === 0) ctx.fillRect(x, y, g, g);
  ctx.translate(-camX, -camY);
  // Route
  const path = roadPath();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#e8e2d0';
  ctx.lineWidth = ROAD + 16;
  ctx.stroke(path);
  ctx.strokeStyle = '#ff3b5c';
  ctx.setLineDash([26, 26]);
  ctx.stroke(path);
  ctx.setLineDash([]);
  ctx.strokeStyle = theme.road;
  ctx.lineWidth = ROAD;
  ctx.stroke(path);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.setLineDash([30, 40]);
  ctx.stroke(path);
  ctx.setLineDash([]);
  // Ligne d'arrivée en damier
  const sx = T.xs[0];
  const sy = T.ys[0];
  const nx = -T.ty[0];
  const ny = T.tx[0];
  for (let k = -5; k < 5; k++) {
    for (let r = 0; r < 2; r++) {
      ctx.fillStyle = (k + r) % 2 ? '#ffffff' : '#1b1626';
      const bx = sx + nx * k * 15 + T.tx[0] * r * 10;
      const by = sy + ny * k * 15 + T.ty[0] * r * 10;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.atan2(T.ty[0], T.tx[0]));
      ctx.fillRect(0, 0, 10, 15);
      ctx.restore();
    }
  }
  // Décor
  for (const d of T.deco) {
    if (d.x < camX - 60 || d.x > camX + W + 60 || d.y < camY - 60 || d.y > camY + H + 60) continue;
    if (theme.lights) {
      ctx.fillStyle = d.k > 0.5 ? theme.deco : theme.deco2;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 5, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(d.x + 6, d.y + 6, d.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = d.k > 0.85 ? theme.deco2 : theme.deco;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
    }
  }
  fx.particles.draw(ctx);
  for (const c of cars) drawCar(ctx, c);
  ctx.restore();
  if (me) hudCanvas(ctx, W, H);
  fx.flash.draw(ctx, W, H);
}

let pathCache = null;
function roadPath() {
  if (pathCache?.T === T) return pathCache.p;
  const p = new Path2D();
  p.moveTo(T.xs[0], T.ys[0]);
  for (let i = 1; i < T.N; i++) p.lineTo(T.xs[i], T.ys[i]);
  p.closePath();
  pathCache = { T, p };
  return p;
}

function drawCar(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.h + (c.drifting ? Math.sign(c.steer ?? 0) * 0.15 : 0));
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-15, -8, 34, 20);
  ctx.fillStyle = '#1b1626';
  ctx.fillRect(-12, -11, 9, 4);
  ctx.fillRect(-12, 7, 9, 4);
  ctx.fillRect(7, -11, 9, 4);
  ctx.fillRect(7, 7, 9, 4);
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.roundRect(-17, -9, 34, 18, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(11,10,20,0.75)';
  ctx.fillRect(1, -6, 7, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-14, -2, 10, 4);
  if (c === me) {
    ctx.strokeStyle = '#ffc93c';
    ctx.lineWidth = 2;
    ctx.strokeRect(-19, -11, 38, 22);
  }
  ctx.restore();
  // Nom des pilotes
  if (c.pilot) {
    ctx.font = '800 11px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(5,6,11,0.6)';
    const w = ctx.measureText(c.pilot.name).width + 10;
    ctx.fillRect(c.x - w / 2, c.y - 34, w, 15);
    ctx.fillStyle = c.color;
    ctx.fillText(c.pilot.name, c.x, c.y - 23);
  }
}

function hudCanvas(ctx, W, H) {
  // Jauge de turbo
  // Sur téléphone, en haut à gauche : les boutons occupent le bas de l'écran
  const bw = 240;
  const bx = touchy ? 24 : (W - bw) / 2;
  const by = touchy ? 92 : H - 46;
  const seg = bw / 3;
  ctx.fillStyle = 'rgba(5,6,11,0.65)';
  ctx.beginPath();
  ctx.roundRect(bx - 8, by - 22, bw + 16, 40, 10);
  ctx.fill();
  for (let k = 0; k < 3; k++) {
    const fill = clamp(me.charge - k, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx + k * seg, by, seg - 6, 10);
    ctx.fillStyle = fill >= 1 ? '#ffc93c' : '#ff8a5b';
    ctx.fillRect(bx + k * seg, by, (seg - 6) * fill, 10);
  }
  ctx.fillStyle = me.boostT > 0 ? '#ffc93c' : '#fff8ec';
  ctx.font = '800 11px Rubik, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(me.boostT > 0 ? 'TURBO !' : `${Math.round(Math.abs(me.speed ?? 0) * 0.36)} km/h`, bx, by - 6);
  ctx.textAlign = 'right';
  ctx.fillText(me.charge >= 1 ? (touchy ? 'TURBO prêt' : 'Maj : turbo') : 'Dérape pour charger', bx + bw, by - 6);
  // Mini-carte
  const box = T.box;
  const s = 120 / Math.max(box.maxX - box.minX, box.maxY - box.minY);
  const mx = W - 140;
  const my = 16;
  ctx.fillStyle = 'rgba(5,6,11,0.55)';
  ctx.beginPath();
  ctx.roundRect(mx - 10, my - 10, 140, 140, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < T.N; i += 3) {
    const x = mx + (T.xs[i] - box.minX) * s;
    const y = my + (T.ys[i] - box.minY) * s;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  for (const c of cars) {
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(mx + (c.x - box.minX) * s, my + (c.y - box.minY) * s, c === me ? 5 : 3.5, 0, TAU);
    ctx.fill();
  }
  // Compte à rebours
  if (state === 'count') {
    const n = Math.ceil(countT);
    ctx.font = '900 110px "Big Shoulders Display", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#05060b';
    ctx.fillText(n > 0 ? n : 'Partez !', W / 2 + 4, H / 2 + 4);
    ctx.fillStyle = n === 1 ? '#3ee6a8' : '#ffc93c';
    ctx.fillText(n > 0 ? n : 'Partez !', W / 2, H / 2);
    ctx.textBaseline = 'alphabetic';
  }
  // Les pilotes parlent
  if (say && say.t > 0) {
    ctx.globalAlpha = Math.min(1, say.t * 2);
    ctx.font = '700 13px Rubik, sans-serif';
    const tw = Math.min(W - 180, ctx.measureText(say.text).width + 28);
    ctx.fillStyle = 'rgba(5,6,11,0.8)';
    ctx.beginPath();
    ctx.roundRect(16, 16, tw, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#fff8ec';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(say.text, 30, 33, tw - 28);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }
}

// ---------- Commandes ----------
const KEYS = { ArrowUp: 'up', z: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', q: 'left', a: 'left', ArrowRight: 'right', d: 'right', ' ': 'drift' };
document.addEventListener('keydown', (e) => {
  if (!gv.playing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Shift' || e.key === 't' || e.key === 'T') {
    turboQueued = true;
    return;
  }
  const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
  if (!k) return;
  e.preventDefault();
  keys[k] = true;
});
document.addEventListener('keyup', (e) => {
  const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
  if (k) keys[k] = false;
});
window.addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

const pad = document.createElement('div');
pad.className = 'tc-pad';
pad.hidden = true;
pad.innerHTML = `<div class="tc-pad__steer"><button type="button" data-k="left" aria-label="Tourner à gauche">${icon('back')}</button><button type="button" data-k="right" aria-label="Tourner à droite">${icon('forward')}</button></div>
  <div class="tc-pad__act"><button type="button" data-k="turbo" class="tc-turbo" aria-label="Turbo">Turbo</button><button type="button" data-k="drift" aria-label="Déraper">Dérapage</button><button type="button" data-k="down" aria-label="Freiner">Frein</button></div>`;
stage.append(pad);
function showPad(on) {
  pad.hidden = !(on && touchy);
}
for (const b of pad.querySelectorAll('[data-k]')) {
  const k = b.dataset.k;
  const down = (e) => {
    e.preventDefault();
    if (k === 'turbo') turboQueued = true;
    else keys[k] = true;
    b.classList.add('is-down');
  };
  const up = () => {
    if (k !== 'turbo') keys[k] = false;
    b.classList.remove('is-down');
  };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tc="next"]');
  if (b) gv.restart();
});

// ---------- Accueil : course rapide, coupes, garage ----------
function renderOptions() {
  const s = store.data;
  const tab = s.mode;
  const cupOpen = (i) => i === 0 || !!s.cups[CUPS[i - 1].id];
  gv.shell.startExtra.innerHTML = `
    <div class="tc-options">
      <div class="tc-tabs" role="tablist" aria-label="Mode">
        ${[['course', 'Course rapide', 'gamepad'], ['coupe', 'Coupes', 'trophy'], ['garage', 'Garage', 'sliders']].map(([id, label, ic]) => `<button type="button" role="tab" class="tc-tab" data-mode="${id}" aria-selected="${tab === id}">${icon(ic)}${label}</button>`).join('')}
      </div>
      ${
        tab === 'course'
          ? `<div class="tc-circuits">${CIRCUITS.map((c) => `<button type="button" class="tc-circuit" data-circuit="${c.id}" aria-pressed="${s.circuit === c.id}" style="--g:${THEMES[c.theme].grass};--r:${THEMES[c.theme].road}"><span>${esc(c.name)}</span><small>${s.laps[c.id] ? `Meilleur tour ${fmt(s.laps[c.id])}` : 'Pas encore couru'}</small></button>`).join('')}</div>
            <div class="tc-levels" role="radiogroup" aria-label="Difficulté">${Object.entries(LEVELS).map(([id, l]) => `<button type="button" role="radio" class="tc-level" data-level="${id}" aria-checked="${s.level === id}">${l.name}</button>`).join('')}</div>`
          : tab === 'coupe'
            ? `${s.cup ? `<p class="tc-hint">${esc(CUPS.find((c) => c.id === s.cup.id).name)} en cours : course ${s.cup.race + 1} sur 4. « Jouer » lance la suivante.</p>` : ''}
              <div class="tc-cups">${CUPS.map((c, i) => `<button type="button" class="tc-cup" data-cup="${c.id}" style="--c:${c.color}" ${cupOpen(i) ? '' : 'aria-disabled="true"'}>${icon(cupOpen(i) ? 'trophy' : 'lock')}<span>${esc(c.name)}</span><small>${LEVELS[c.level].name} · ${c.circuits.length} courses${s.cups[c.id] ? ' · gagnée' : ''}</small></button>`).join('')}</div>`
            : `<p class="tc-cash">${icon('coin')}${formatInt(s.cash)} de primes</p>
              <div class="tc-garage">${Object.entries(UPGRADES).map(([id, u]) => {
                const lv = s.upg[id];
                const cost = u.costs[lv];
                return `<button type="button" class="tc-upg" data-upg="${id}" ${cost === undefined || s.cash < cost ? 'aria-disabled="true"' : ''}><span>${u.name} <em>${'●'.repeat(lv)}${'○'.repeat(3 - lv)}</em></span><small>${u.desc}</small><b>${cost === undefined ? 'Max' : `${formatInt(cost)}`}</b></button>`;
              }).join('')}</div>`
      }
      <p class="tc-hint" id="tc-hint">${tab === 'garage' ? 'Les primes se gagnent en course : plus tu finis haut, plus elles sont grosses.' : 'Cinq pilotes IA t’attendent. Chrono est le plus rapide.'}</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const s = store.data;
  const hint = () => document.getElementById('tc-hint');
  if (b.dataset.mode) s.mode = b.dataset.mode === 'garage' ? 'garage' : b.dataset.mode;
  if (b.dataset.circuit) s.circuit = b.dataset.circuit;
  if (b.dataset.level) s.level = b.dataset.level;
  if (b.dataset.cup) {
    const i = CUPS.findIndex((c) => c.id === b.dataset.cup);
    if (b.getAttribute('aria-disabled') === 'true') {
      hint().textContent = `Gagne la ${CUPS[i - 1].name} pour ouvrir celle-ci.`;
      return gv.audio.play('error');
    }
    s.cup = { id: b.dataset.cup, race: 0, points: {} };
    store.save();
    gv.start();
    return;
  }
  if (b.dataset.upg) {
    const u = UPGRADES[b.dataset.upg];
    const lv = s.upg[b.dataset.upg];
    const cost = u.costs[lv];
    if (cost === undefined || s.cash < cost) {
      hint().textContent = cost === undefined ? `${u.name} est déjà au maximum.` : 'Pas assez de primes : cours pour en gagner.';
      return gv.audio.play('error');
    }
    s.cash -= cost;
    s.upg[b.dataset.upg]++;
    gv.audio.play('powerup');
    if (s.upg[b.dataset.upg] >= 3) gv.unlock('garage');
  }
  store.save();
  gv.audio.play('select');
  renderOptions();
});

// ---------- Démarrage ----------
let frameMs = 0;
const loop = createLoop({
  update(dt, realDt) {
    const t0 = performance.now();
    update(Math.min(dt, 0.05), Math.min(realDt, 0.05));
    frameMs = frameMs * 0.95 + (performance.now() - t0) * 0.05;
  },
  render,
  onAutoPause() {
    if ((state === 'race' || state === 'count') && gv.playing) gv.pause();
  },
});

window.__tc = {
  get state() { return state; },
  get me() { return me; },
  get cars() { return cars; },
  get T() { return T; },
  get clock() { return clock; },
  get store() { return store.data; },
  set autoplay(v) { autoplay = v; },
  rank: () => ranking().map((c) => (c === me ? 'toi' : c.pilot.id)),
  // Tests : avancer la course, finir le dernier tour
  skipCount() { countT = 0.01; },
  lastLap() { for (const c of cars) { c.lap = LAPS - 1; c.lapStart = clock; } },
  finishNow(place) {
    const others = cars.filter((c) => c !== me);
    for (let i = 0; i < place; i++) {
      const c = others[i];
      c.done = true;
      c.finishT = clock;
      c.lap = LAPS;
      finishOrder.push(c);
    }
    me.lap = LAPS;
    me.done = true;
    me.finishT = clock + 1;
    me.bestLap = 30;
    finishOrder.push(me);
    finishRace();
  },
  speed(k) { loop.timeScale = k; },
};
renderOptions();
gv.hud('pos', '—');
gv.hud('lap', `0/${LAPS}`);
gv.hud('time', fmt(0));
gv.hud('best', formatInt(gv.best ?? 0));
loop.start();
gv.showStart();
