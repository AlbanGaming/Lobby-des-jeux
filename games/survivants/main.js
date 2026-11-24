// Survivants néon — tiens 10 minutes face à des vagues de plus en plus denses. Les armes tirent
// seules : toi, tu te places, tu ramasses l'XP et tu choisis tes améliorations. Une arme au
// maximum + son talent associé = évolution. En face, le Directeur : une IA qui observe ta façon
// de jouer (où tu fuis, quelles armes tu prends), adapte ses vagues pour te piéger, te nargue,
// puis vient t'affronter en personne à 10:00. Entre les parties, les éclats gagnés achètent des
// améliorations permanentes et débloquent des héros.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { createRng } from '../../shared/js/core/rng.js';
import { clamp, formatInt, TAU } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';

const RUN_TIME = 600; // le Directeur arrive à 10:00
const GUARD_TIME = 300; // le Gardien à 5:00
const MAX_ENEMIES = 260;
const CELL = 56;

// ---------- Catalogue ----------
const WEAPONS = {
  eclair: { name: 'Éclair', icon: 'bolt', color: '#4cc3ff', desc: 'Tire sur l’ennemi le plus proche.', pair: 'cadence', evo: 'Tempête', evoDesc: 'Cinq éclairs perçants, en rafale.' },
  orbe: { name: 'Orbes', icon: 'target', color: '#a68bff', desc: 'Des orbes tournent autour de toi.', pair: 'zone', evo: 'Anneau astral', evoDesc: 'Huit grands orbes, très loin.' },
  onde: { name: 'Onde', icon: 'wave', color: '#3ee6a8', desc: 'Une onde de choc repousse tout autour.', pair: 'armure', evo: 'Séisme', evoDesc: 'Une onde géante, presque sans pause.' },
  disque: { name: 'Disque', icon: 'restart', color: '#ffc93c', desc: 'Un disque part et revient en traversant tout.', pair: 'vitesse', evo: 'Tornade', evoDesc: 'Quatre disques en spirale.' },
  mines: { name: 'Mines', icon: 'flame', color: '#ff8a5b', desc: 'Pose des mines qui explosent au contact.', pair: 'puissance', evo: 'Nova', evoDesc: 'Des mines énormes, en grappes.' },
  pluie: { name: 'Foudre', icon: 'sparkle', color: '#ff5fa2', desc: 'La foudre frappe des ennemis au hasard.', pair: 'aimant', evo: 'Déluge', evoDesc: 'Huit frappes à chaque orage.' },
};
const PASSIVES = {
  puissance: { name: 'Puissance', icon: 'star', desc: '+10 % de dégâts.' },
  cadence: { name: 'Cadence', icon: 'clock', desc: 'Les armes rechargent 7 % plus vite.' },
  zone: { name: 'Zone', icon: 'grid', desc: '+10 % de taille d’effet.' },
  vitesse: { name: 'Vitesse', icon: 'forward', desc: '+8 % de vitesse de déplacement.' },
  aimant: { name: 'Aimant', icon: 'coin', desc: 'Attire l’XP de plus loin.' },
  armure: { name: 'Armure', icon: 'heart', desc: '+20 PV max, soigne 20 PV.' },
};
const HEROES = [
  { id: 'volt', name: 'Volt', color: '#4cc3ff', start: 'eclair', hp: 100, speed: 1, how: 'Disponible', unlock: () => true },
  { id: 'nova', name: 'Nova', color: '#3ee6a8', start: 'onde', hp: 130, speed: 0.92, how: 'Tiens 5 minutes', unlock: (s) => s.bestTime >= 300 },
  { id: 'prisme', name: 'Prisme', color: '#a68bff', start: 'orbe', hp: 100, speed: 1, zone: 0.15, how: '2 000 ennemis au total', unlock: (s) => s.totalKills >= 2000 },
  { id: 'spectre', name: 'Spectre', color: '#ff5fa2', start: 'disque', hp: 85, speed: 1.15, how: 'Bats le Directeur', unlock: (s) => s.wins >= 1 },
];
const UPGRADES = {
  force: { name: 'Force', desc: '+6 % de dégâts', max: 5, cost: (l) => 30 + l * 30 },
  vie: { name: 'Vitalité', desc: '+10 PV max', max: 5, cost: (l) => 25 + l * 25 },
  pas: { name: 'Agilité', desc: '+4 % de vitesse', max: 5, cost: (l) => 25 + l * 25 },
  attrait: { name: 'Attraction', desc: '+15 % de rayon d’aimant', max: 3, cost: (l) => 20 + l * 30 },
  relance: { name: 'Relance', desc: '+1 relance des choix par partie', max: 3, cost: (l) => 60 + l * 60 },
};
// Ennemis : apparition (secondes), PV, vitesse, dégâts, rayon, XP
const FOES = {
  blob: { from: 0, hp: 10, speed: 52, dmg: 8, r: 11, xp: 1, color: '#ff5fa2' },
  fleche: { from: 45, hp: 7, speed: 112, dmg: 6, r: 9, xp: 1, color: '#ffc93c' },
  tireur: { from: 120, hp: 16, speed: 60, dmg: 6, r: 12, xp: 3, color: '#4cc3ff', range: 230 },
  chargeur: { from: 180, hp: 26, speed: 48, dmg: 14, r: 13, xp: 3, color: '#ff8a5b' },
  tank: { from: 240, hp: 70, speed: 38, dmg: 16, r: 19, xp: 6, color: '#a68bff' },
};
const DIR_NAMES = ['l’est', 'le sud-est', 'le sud', 'le sud-ouest', 'l’ouest', 'le nord-ouest', 'le nord', 'le nord-est'];

const store = createStore('survivants', {
  version: 1,
  defaults: { hero: 'volt', shards: 0, up: { force: 0, vie: 0, pas: 0, attrait: 0, relance: 0 }, bestTime: 0, totalKills: 0, wins: 0, evolved: [] },
});
const params = new URLSearchParams(location.search);

const gv = bootGame('survivants', {
  hud: [
    { id: 'time', label: 'Temps' },
    { id: 'level', label: 'Niveau' },
    { id: 'kills', label: 'Ennemis' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['←', '→', '↑', '↓'], text: 'Déplace-toi aux flèches (ou ZQSD), ou avec un joystick : pose le doigt n’importe où et glisse.' },
    { keys: ['icon:bolt'], text: 'Tes armes tirent seules. Ramasse l’XP et choisis une amélioration à chaque niveau (touches 1, 2, 3).' },
    { keys: ['icon:sparkle'], text: 'Une arme au niveau 5 et son talent associé : elle évolue. Le Directeur t’attend à 10:00.' },
  ],
  onStart: startRun,
  onRestart: startRun,
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
  formatScore: (n) => formatInt(n),
});

const stage = document.getElementById('stage');
const view = createCanvas(stage, { mode: 'stage', height: 720, minWidth: (w, h) => (w > h ? 900 : 420) });
const fx = { particles: new Particles(900), popups: new Popups(40), shake: new Shake({ maxOffset: 9 }), flash: new Flash() };

// ---------- État ----------
let state = 'attract'; // attract | run | pick | dying | over
let rng = createRng(1);
let hero = HEROES[0];
const P = { x: 0, y: 0, vx: 0, vy: 0, face: 0, hp: 100, max: 100, inv: 0, speed: 150 };
let enemies = [];
let shots = []; // projectiles du joueur
let foeShots = []; // projectiles ennemis
let gems = [];
let mines = [];
let strikes = []; // éclairs de foudre (visuels)
let grid = new Map();
let weapons = {}; // id → { lv, cd, evolved }
let passives = {}; // id → lv
let run = {};
let time = 0;
let spawnAcc = 0;
let dieT = 0;
let autoplay = params.has('autoplay');
let keys = { up: false, down: false, left: false, right: false };
let stick = null; // { ox, oy, x, y, id } en coordonnées écran logiques
let choices = [];
const AI = { hist: new Array(8).fill(0), lastLook: 0, said: new Set(), intensity: 1, bias: null, plan: 'nuée', msg: null, msgT: 0 };

const hasHero = (h) => h.unlock(store.data);
const lvOf = (id) => weapons[id]?.lv ?? 0;
const plv = (id) => passives[id] ?? 0;
const dmgMul = () => (1 + plv('puissance') * 0.1) * (1 + store.data.up.force * 0.06);
const cdMul = () => Math.pow(0.93, plv('cadence'));
const areaMul = () => (1 + plv('zone') * 0.1) * (1 + (hero.zone ?? 0));
const magnet = () => 100 * (1 + plv('aimant') * 0.35) * (1 + store.data.up.attrait * 0.15);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// « Bats le Directeur » → « bats le Directeur » (en milieu de phrase)
const lcFirst = (s) => s[0].toLowerCase() + s.slice(1);
const xpNeed = (l) => Math.round(4 + l * 3 + Math.pow(l, 1.35));

// ---------- Partie ----------
function reset(seed) {
  rng = createRng(seed);
  enemies = [];
  shots = [];
  foeShots = [];
  gems = [];
  mines = [];
  strikes = [];
  weapons = {};
  passives = {};
  Object.assign(P, { x: 0, y: 0, vx: 0, vy: 0, face: 0, inv: 0 });
  P.max = hero.hp + store.data.up.vie * 10;
  P.hp = P.max;
  P.speed = 150 * hero.speed * (1 + store.data.up.pas * 0.04);
  weapons[hero.start] = { lv: 1, cd: 0.4, evolved: false };
  Object.assign(AI, { hist: new Array(8).fill(0), lastLook: 0, said: new Set(), intensity: 1, bias: null, plan: 'nuée', msg: null, msgT: 0 });
  time = 0;
  spawnAcc = 0;
}

function startRun() {
  hero = HEROES.find((h) => h.id === store.data.hero && hasHero(h)) ?? HEROES[0];
  reset(Number(params.get('seed')) || Math.floor(Math.random() * 1e9));
  state = 'run';
  run = { t: 0, kills: 0, level: 1, xp: 0, bosses: 0, win: false, rerolls: store.data.up.relance, evolved: 0, guard: false, boss: false };
  closePick();
  fx.particles.clear();
  fx.popups.clear();
  hud();
  gv.hud('best', formatInt(gv.best ?? 0));
  say('debut', 'Je suis le Directeur. Je vais t’observer… et apprendre.');
}

function hud() {
  gv.hud('time', mmss(run.t ?? 0));
  gv.hud('level', run.level ?? 1);
  gv.hud('kills', formatInt(run.kills ?? 0));
}

// ---------- IA : le Directeur ----------
function say(key, text) {
  if (key && AI.said.has(key)) return;
  if (key) AI.said.add(key);
  AI.msg = text;
  AI.msgT = 4.5;
  if (state === 'run') gv.audio.play('tick', { volume: 0.5 });
}

// Toutes les 20 s, il regarde où tu fuis et ce que tu joues, puis choisit son plan
function director(dt) {
  const sp = Math.hypot(P.vx, P.vy);
  if (sp > 20) {
    const b = Math.round(((Math.atan2(P.vy, P.vx) + TAU) % TAU) / (TAU / 8)) % 8;
    AI.hist[b] += dt;
  }
  if (run.t - AI.lastLook < 20) return;
  AI.lastLook = run.t;
  const total = AI.hist.reduce((a, b) => a + b, 0) || 1;
  const top = AI.hist.indexOf(Math.max(...AI.hist));
  AI.bias = AI.hist[top] / total > 0.3 ? top : null;
  AI.hist = AI.hist.map((v) => v * 0.4); // il oublie peu à peu
  const area = ['orbe', 'onde', 'mines', 'pluie'].reduce((s, w) => s + lvOf(w), 0);
  const single = ['eclair', 'disque'].reduce((s, w) => s + lvOf(w), 0);
  const prev = AI.plan;
  AI.plan = run.t < 120 ? 'nuée' : area > single + 1 ? 'blindés' : single > area + 1 ? 'nuée' : 'mêlée';
  // Il te trouve trop à l'aise ? Il accélère.
  const hpRatio = P.hp / P.max;
  AI.intensity = clamp(AI.intensity + (hpRatio > 0.8 ? 0.08 : hpRatio < 0.35 ? -0.08 : 0.03), 1, 1.8);
  if (AI.bias !== null && run.t > 30) say(`fuite-${AI.bias}`, `Tu fuis toujours vers ${DIR_NAMES[AI.bias]}. Je t’y attends.`);
  else if (AI.plan !== prev && AI.plan === 'blindés') say('blindes', 'Tes zones ne font rien contre le blindage. Voyons ça.');
  else if (AI.plan !== prev && AI.plan === 'nuée' && run.t > 100) say('nuee', 'Tu vises un ennemi à la fois ? J’en envoie cent.');
  else if (AI.intensity > 1.5) say('rapide', 'Trop facile pour toi ? Accélérons.');
}

function pickFoe() {
  const open = Object.keys(FOES).filter((id) => run.t >= FOES[id].from);
  const table = AI.plan === 'blindés' ? { blob: 2, fleche: 1, tireur: 3, chargeur: 3, tank: 4 } : AI.plan === 'nuée' ? { blob: 5, fleche: 5, tireur: 1, chargeur: 1, tank: 0.5 } : { blob: 4, fleche: 3, tireur: 2, chargeur: 2, tank: 1.5 };
  return rng.weighted(open, (id) => table[id]);
}

function spawnFoe(type, ang) {
  const f = FOES[type];
  const R = Math.hypot(view.width, view.height) / 2 + 40;
  // Embuscade : une partie des ennemis arrive là où tu as l'habitude de fuir
  const a = ang ?? (AI.bias !== null && rng.chance(0.45) ? (AI.bias * TAU) / 8 + rng.range(-0.5, 0.5) : rng.range(0, TAU));
  const scale = 1 + (run.t ?? 0) / 170;
  enemies.push({ type, x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R, hp: f.hp * scale, max: f.hp * scale, speed: f.speed * rng.range(0.9, 1.1), dmg: f.dmg, r: f.r, xp: f.xp, color: f.color, hit: 0, t: rng.range(0, 3), kb: 0, kx: 0, ky: 0, state: 0 });
}

function spawnBoss(kind) {
  const a = rng.range(0, TAU);
  const R = Math.min(view.width, view.height) / 2 + 60;
  const hp = kind === 'gardien' ? 1800 : 12000;
  enemies.push({ type: kind, boss: true, x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R, hp, max: hp, speed: kind === 'gardien' ? 64 : 70, dmg: kind === 'gardien' ? 22 : 18, r: kind === 'gardien' ? 34 : 44, xp: 0, color: kind === 'gardien' ? '#ffc93c' : '#ff3b5c', hit: 0, t: 0, kb: 0, kx: 0, ky: 0, state: 0, cd: 3, phase: 1 });
  gv.audio.play('powerup', { pitch: 0.5 });
  fx.flash.trigger(kind === 'gardien' ? '#ffc93c' : '#ff3b5c', 0.3, 3);
  if (kind === 'gardien') {
    gv.banner('Le Gardien arrive', { color: '#ffc93c' });
    say('gardien', 'Mon Gardien va tester ce que tu as appris.');
  } else {
    gv.banner('Le Directeur en personne', { color: '#ff3b5c' });
    say('boss', 'Assez joué. Je m’occupe de toi moi-même.');
  }
}

function spawning(dt) {
  if (run.t >= GUARD_TIME && !run.guard) {
    run.guard = true;
    spawnBoss('gardien');
  }
  if (run.t >= RUN_TIME && !run.boss) {
    run.boss = true;
    spawnBoss('directeur');
  }
  const bossOut = enemies.some((e) => e.type === 'directeur');
  const rate = (1.8 + run.t / 32) * AI.intensity * (bossOut ? 0.4 : 1);
  spawnAcc += dt * rate;
  while (spawnAcc >= 1 && enemies.length < MAX_ENEMIES) {
    spawnAcc -= 1;
    // De temps en temps, un groupe arrive d'un seul côté
    if (run.t > 60 && rng.chance(0.04)) {
      const a = AI.bias !== null ? (AI.bias * TAU) / 8 : rng.range(0, TAU);
      const type = pickFoe();
      for (let k = 0; k < 8; k++) spawnFoe(type, a + rng.range(-0.25, 0.25));
    } else spawnFoe(pickFoe());
  }
  if (spawnAcc > 3) spawnAcc = 3;
}

// ---------- Armes ----------
function wstat(id) {
  const w = weapons[id];
  const l = w.lv;
  const e = w.evolved;
  const d = dmgMul();
  const z = areaMul();
  const c = cdMul();
  switch (id) {
    case 'eclair': return e ? { cd: 0.32 * c, dmg: 30 * d, n: 5, pierce: 3 } : { cd: (0.95 - l * 0.08) * c, dmg: (9 + l * 3) * d, n: l >= 5 ? 3 : l >= 3 ? 2 : 1, pierce: l >= 4 ? 2 : 1 };
    case 'orbe': return e ? { n: 8, rad: 110 * z, dmg: 26 * d, size: 13 * z } : { n: 1 + l, rad: (55 + l * 6) * z, dmg: (7 + l * 2.5) * d, size: (8 + l) * z };
    case 'onde': return e ? { cd: 1.1 * c, rad: 210 * z, dmg: 55 * d } : { cd: (3.1 - l * 0.25) * c, rad: (85 + l * 14) * z, dmg: (14 + l * 5) * d };
    case 'disque': return e ? { cd: 1.2 * c, dmg: 34 * d, n: 4, range: 260 * z } : { cd: (1.7 - l * 0.12) * c, dmg: (13 + l * 3.5) * d, n: l >= 4 ? 2 : 1, range: (190 + l * 12) * z };
    case 'mines': return e ? { cd: 0.5 * c, dmg: 70 * d, rad: 95 * z, n: 3 } : { cd: (1.3 - l * 0.11) * c, dmg: (24 + l * 7) * d, rad: (48 + l * 6) * z, n: 1 };
    case 'pluie': return e ? { cd: 0.9 * c, dmg: 45 * d, n: 8, rad: 40 * z } : { cd: (1.6 - l * 0.15) * c, dmg: (18 + l * 5) * d, n: Math.ceil(l * 0.8), rad: (28 + l * 2) * z };
    default: return {};
  }
}

function nearest(x, y, max = 600, skip = null) {
  let best = null;
  let bd = max * max;
  for (const e of enemies) {
    if (skip && skip.has(e)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function fireWeapons(dt) {
  for (const [id, w] of Object.entries(weapons)) {
    if (id === 'orbe') continue; // les orbes sont permanentes
    w.cd -= dt;
    if (w.cd > 0) continue;
    const s = wstat(id);
    w.cd = s.cd;
    if (id === 'eclair') {
      const targets = new Set();
      for (let k = 0; k < s.n; k++) {
        const t = nearest(P.x, P.y, 520, targets) ?? nearest(P.x, P.y, 520);
        if (!t) break;
        targets.add(t);
        const a = Math.atan2(t.y - P.y, t.x - P.x);
        shots.push({ kind: 'eclair', x: P.x, y: P.y, vx: Math.cos(a) * 470, vy: Math.sin(a) * 470, dmg: s.dmg, pierce: s.pierce, life: 1.2, r: 5, hits: new Set(), color: w.evolved ? '#ffffff' : '#4cc3ff' });
      }
      if (targets.size) gv.audio.play('pop', { volume: 0.25, throttle: 0.08, pitch: 1.4 });
    } else if (id === 'onde') {
      fx.particles.ring(P.x, P.y, { color: '#3ee6a8', size: 10, growth: s.rad * 3, life: 0.32, lineWidth: 5 });
      for (const e of enemies) {
        const d = Math.hypot(e.x - P.x, e.y - P.y);
        if (d < s.rad + e.r) {
          damage(e, s.dmg);
          if (!e.boss) knock(e, P.x, P.y, 260);
        }
      }
      gv.audio.play('whoosh', { volume: 0.4, throttle: 0.2 });
    } else if (id === 'disque') {
      for (let k = 0; k < s.n; k++) {
        const a = P.face + (k * TAU) / s.n;
        shots.push({ kind: 'disque', x: P.x, y: P.y, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, dmg: s.dmg, pierce: 999, life: 99, r: 11, out: s.range, dist: 0, back: false, hits: new Map(), spin: w.evolved, color: '#ffc93c' });
      }
    } else if (id === 'mines') {
      for (let k = 0; k < s.n; k++) mines.push({ x: P.x + rng.range(-30, 30) * (k ? 1 : 0), y: P.y + rng.range(-30, 30) * (k ? 1 : 0), dmg: s.dmg, rad: s.rad, arm: 0.4, life: 12 });
    } else if (id === 'pluie') {
      const pool = enemies.filter((e) => Math.abs(e.x - P.x) < view.width / 2 && Math.abs(e.y - P.y) < view.height / 2);
      for (let k = 0; k < s.n && pool.length; k++) {
        const t = pool.splice(rng.int(0, pool.length - 1), 1)[0];
        strikes.push({ x: t.x, y: t.y, t: 0.25 });
        for (const e of enemies) if (Math.hypot(e.x - t.x, e.y - t.y) < s.rad + e.r) damage(e, s.dmg);
      }
      gv.audio.play('hit', { volume: 0.3, throttle: 0.15, pitch: 1.6 });
    }
  }
}

function knock(e, fromX, fromY, force) {
  const a = Math.atan2(e.y - fromY, e.x - fromX);
  e.kx = Math.cos(a) * force;
  e.ky = Math.sin(a) * force;
  e.kb = 0.18;
}

function damage(e, amount) {
  if (e.hp <= 0) return;
  e.hp -= amount;
  e.hit = 0.1;
  if (amount >= 8) fx.popups.add(e.x + rng.range(-6, 6), e.y - e.r, Math.round(amount), { size: e.boss ? 18 : 13, color: e.boss ? '#ffc93c' : '#fff8ec', rise: 24, life: 0.5 });
  if (e.hp <= 0) kill(e);
}

function kill(e) {
  e.dead = true;
  fx.particles.emit(e.x, e.y, { count: e.boss ? 60 : 7, colors: [e.color, '#ffffff'], speed: [40, e.boss ? 380 : 180], gravity: 0, size: [2, e.boss ? 6 : 4], shape: 'square', life: [0.25, e.boss ? 1.2 : 0.55] });
  if (state !== 'run' && state !== 'pick') return;
  run.kills++;
  if (run.kills === 100) gv.unlock('cent');
  if (run.kills === 1000) gv.unlock('mille');
  if (e.xp) gems.push({ x: e.x, y: e.y, v: e.xp, t: 0 });
  if (rng.chance(0.006)) gems.push({ x: e.x, y: e.y, v: 0, heal: true, t: 0 });
  gv.audio.play('pop', { volume: 0.3, throttle: 0.05, pitch: 0.8 + rng.next() * 0.4 });
  if (e.type === 'gardien') {
    run.bosses++;
    gv.unlock('gardien');
    fx.shake.add(0.8);
    say('gardien-mort', 'Intéressant. Tu apprends vite… moi aussi.');
    P.hp = Math.min(P.max, P.hp + 40);
    for (let k = 0; k < 12; k++) gems.push({ x: e.x + rng.range(-40, 40), y: e.y + rng.range(-40, 40), v: 5, t: 0 });
  }
  if (e.type === 'directeur') {
    run.bosses++;
    run.win = true;
    fx.shake.add(1);
    fx.flash.trigger('#ffffff', 0.5, 2);
    say(null, 'Impossible… Tu as battu la machine.');
    gv.unlock('victoire');
    gv.banner('Tu as battu le Directeur !', { color: '#ffc93c' });
    state = 'dying';
    dieT = 2.4;
  }
}

// ---------- Niveaux et choix ----------
function gainXp(v) {
  run.xp += v;
  let ups = 0;
  while (run.xp >= xpNeed(run.level)) {
    run.xp -= xpNeed(run.level);
    run.level++;
    ups++;
  }
  if (ups) {
    gv.hud('level', run.level, true);
    run.pending = (run.pending ?? 0) + ups;
    if (run.level >= 15) gv.unlock('niveau-15');
    if (state === 'run') openPick();
  }
}

function options() {
  const out = [];
  // Évolutions prêtes : toujours proposées
  for (const [id, w] of Object.entries(weapons)) if (w.lv >= 5 && !w.evolved && plv(WEAPONS[id].pair) > 0) out.push({ kind: 'evo', id });
  const pool = [];
  for (const id of Object.keys(WEAPONS)) {
    const w = weapons[id];
    if (w ? w.lv < 5 : Object.keys(weapons).length < 6) pool.push({ kind: 'weapon', id });
  }
  for (const id of Object.keys(PASSIVES)) {
    const l = plv(id);
    if (l ? l < 5 : Object.keys(passives).length < 6) pool.push({ kind: 'passive', id });
  }
  const shuffled = rng.shuffle(pool);
  while (out.length < 3 && shuffled.length) out.push(shuffled.pop());
  if (!out.length) out.push({ kind: 'soin' }, { kind: 'eclats' });
  return out.slice(0, 3);
}

function describe(o) {
  if (o.kind === 'evo') {
    const W = WEAPONS[o.id];
    return { icon: W.icon, color: '#ffc93c', name: W.evo, tag: 'Évolution', text: W.evoDesc };
  }
  if (o.kind === 'weapon') {
    const W = WEAPONS[o.id];
    const l = lvOf(o.id);
    return { icon: W.icon, color: W.color, name: W.name, tag: l ? `Niveau ${l + 1}` : 'Nouvelle arme', text: l ? `Plus de dégâts${l + 1 === 5 ? ', niveau max : évolue avec ' + PASSIVES[W.pair].name : ''}.` : W.desc };
  }
  if (o.kind === 'passive') {
    const S = PASSIVES[o.id];
    const l = plv(o.id);
    const evo = Object.entries(WEAPONS).find(([, w]) => w.pair === o.id);
    return { icon: S.icon, color: '#3ee6a8', name: S.name, tag: l ? `Niveau ${l + 1}` : 'Nouveau talent', text: `${S.desc}${evo ? ` Fait évoluer ${evo[1].name}.` : ''}` };
  }
  if (o.kind === 'soin') return { icon: 'heart', color: '#ff5fa2', name: 'Soin', tag: 'Bonus', text: 'Rends 40 PV.' };
  return { icon: 'coin', color: '#ffc93c', name: 'Éclats', tag: 'Bonus', text: '+25 éclats pour la suite.' };
}

const pickEl = document.createElement('div');
pickEl.className = 'sv-pick';
pickEl.hidden = true;
pickEl.setAttribute('role', 'dialog');
pickEl.setAttribute('aria-label', 'Choisis une amélioration');
stage.append(pickEl);

function openPick() {
  state = 'pick';
  choices = options();
  gv.audio.play('levelUp');
  renderPick();
  pickEl.hidden = false;
  pickEl.querySelector('[data-pick]')?.focus({ preventScroll: true });
  if (autoplay) setTimeout(() => state === 'pick' && choose(autoChoice()), 120);
}
// Pilote : évolution d'abord, puis renforcer ce qu'il a, puis les talents utiles
function autoChoice() {
  const score = (o) => (o.kind === 'evo' ? 100 : o.kind === 'weapon' && lvOf(o.id) ? 50 + lvOf(o.id) : o.kind === 'passive' ? 30 + (Object.values(WEAPONS).some((w) => w.pair === o.id && lvOf(Object.keys(WEAPONS).find((k) => WEAPONS[k] === w))) ? 15 : 0) : o.kind === 'weapon' && Object.keys(weapons).length < 3 ? 40 : 10);
  return choices.reduce((b, o, i) => (score(o) > score(choices[b]) ? i : b), 0);
}
function renderPick() {
  pickEl.innerHTML = `
    <p class="sv-pick__title">Niveau ${run.level}</p>
    <div class="sv-pick__list">${choices
      .map((o, i) => {
        const d = describe(o);
        return `<button type="button" class="sv-card ${o.kind === 'evo' ? 'is-evo' : ''}" data-pick="${i}" style="--c:${d.color}">
          <span class="sv-card__icon">${icon(d.icon)}</span>
          <span class="sv-card__tag">${esc(d.tag)}</span>
          <span class="sv-card__name">${esc(d.name)}</span>
          <span class="sv-card__text">${esc(d.text)}</span>
          <kbd>${i + 1}</kbd>
        </button>`;
      })
      .join('')}</div>
    ${run.rerolls ? `<button type="button" class="btn btn--ghost btn--sm" data-reroll>${icon('dice')}Relancer (${run.rerolls})</button>` : ''}`;
}
function closePick() {
  pickEl.hidden = true;
  pickEl.innerHTML = '';
}
function choose(i) {
  const o = choices[i];
  if (!o || state !== 'pick') return;
  if (o.kind === 'evo') {
    weapons[o.id].evolved = true;
    run.evolved++;
    gv.unlock('evolution');
    store.data.evolved = [...new Set([...store.data.evolved, o.id])];
    if (o.id === 'eclair' && plv('cadence')) say('evo', 'Une évolution… Je n’avais pas prévu ça.');
    gv.audio.play('achievement');
  } else if (o.kind === 'weapon') {
    if (weapons[o.id]) weapons[o.id].lv++;
    else weapons[o.id] = { lv: 1, cd: 0.3, evolved: false };
    if (Object.keys(weapons).length >= 6) gv.unlock('arsenal');
  } else if (o.kind === 'passive') {
    passives[o.id] = plv(o.id) + 1;
    if (o.id === 'armure') {
      P.max += 20;
      P.hp = Math.min(P.max, P.hp + 20);
    }
  } else if (o.kind === 'soin') P.hp = Math.min(P.max, P.hp + 40);
  else run.bonusShards = (run.bonusShards ?? 0) + 25;
  gv.audio.play('select');
  run.pending--;
  if (run.pending > 0) {
    choices = options();
    renderPick();
    pickEl.querySelector('[data-pick]')?.focus({ preventScroll: true });
    if (autoplay) setTimeout(() => state === 'pick' && choose(autoChoice()), 120);
    return;
  }
  closePick();
  state = 'run';
}
pickEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick], [data-reroll]');
  if (!b) return;
  if (b.hasAttribute('data-reroll')) {
    run.rerolls--;
    choices = options();
    gv.audio.play('whoosh');
    renderPick();
    return;
  }
  choose(Number(b.dataset.pick));
});

// ---------- Fin ----------
function scoreOf() {
  return Math.round(run.kills + Math.floor(run.t) * 2 + run.level * 10 + run.bosses * 500 + (run.win ? 2000 : 0));
}

function finish() {
  state = 'over';
  closePick();
  const sc = scoreOf();
  const shards = Math.floor(run.kills / 8) + Math.floor(run.t / 10) + run.bosses * 25 + (run.win ? 100 : 0) + (run.bonusShards ?? 0);
  const before = HEROES.filter(hasHero).map((h) => h.id);
  store.data.shards += shards;
  store.data.bestTime = Math.max(store.data.bestTime, Math.floor(run.t));
  store.data.totalKills += run.kills;
  if (run.win) store.data.wins++;
  store.save();
  for (const h of HEROES) if (!before.includes(h.id) && hasHero(h)) toast({ title: `Héros débloqué : ${h.name}`, text: 'Choisis-le à l’accueil.', iconName: 'user', tone: h.color });
  if (HEROES.every(hasHero)) gv.unlock('heros');
  const next = HEROES.find((h) => !hasHero(h));
  gv.gameOver({
    score: sc,
    stats: { score: sc, time: Math.floor(run.t), kills: run.kills, level: run.level, win: run.win ? 1 : 0 },
    extraStats: [
      { label: 'Temps', value: mmss(run.t) },
      { label: 'Ennemis', value: formatInt(run.kills) },
      { label: 'Niveau', value: formatInt(run.level) },
      { label: 'Éclats', value: `+${formatInt(shards)}` },
    ],
    kicker: hero.name,
    title: run.win ? 'Tu as battu le Directeur !' : run.t >= GUARD_TIME ? 'Le Directeur a gagné… cette fois' : 'Submergé par les vagues',
    sound: run.win ? 'win' : undefined,
    nextUnlock: next ? { label: `Héros ${next.name} (${lcFirst(next.how)})`, ...progressOf(next) } : undefined,
  });
  gv.hud('best', formatInt(gv.best ?? 0));
  renderOptions();
}
function progressOf(h) {
  if (h.id === 'nova') return { current: store.data.bestTime, target: 300 };
  if (h.id === 'prisme') return { current: store.data.totalKills, target: 2000 };
  return { current: store.data.wins, target: 1 };
}

// ---------- Pilote (démo et tests) ----------
function pilot() {
  let ax = 0;
  let ay = 0;
  for (const e of enemies) {
    const dx = P.x - e.x;
    const dy = P.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 200 * 200) continue;
    const w = (e.boss ? 4 : 1) / Math.max(400, d2);
    ax += dx * w;
    ay += dy * w;
  }
  for (const s of foeShots) {
    const dx = P.x - s.x;
    const dy = P.y - s.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 90 * 90) {
      ax += (dx / Math.max(100, d2)) * 2;
      ay += (dy / Math.max(100, d2)) * 2;
    }
  }
  const g = gems.reduce((b, x) => (!b || (x.x - P.x) ** 2 + (x.y - P.y) ** 2 < (b.x - P.x) ** 2 + (b.y - P.y) ** 2 ? x : b), null);
  if (g) {
    const d = Math.hypot(g.x - P.x, g.y - P.y) || 1;
    ax += ((g.x - P.x) / d) * 0.012;
    ay += ((g.y - P.y) / d) * 0.012;
  }
  // Tourne autour de l'origine pour ne pas s'enfuir à l'infini
  ax += -P.x * 0.00002 + Math.cos(time * 0.4) * 0.002;
  ay += -P.y * 0.00002 + Math.sin(time * 0.4) * 0.002;
  const n = Math.hypot(ax, ay);
  return n > 0.0005 ? { x: ax / n, y: ay / n } : { x: 0, y: 0 };
}

// ---------- Boucle ----------
function cellKey(x, y) {
  return (Math.floor(x / CELL) & 0xffff) * 65536 + (Math.floor(y / CELL) & 0xffff);
}
function buildGrid() {
  grid = new Map();
  for (const e of enemies) {
    const k = cellKey(e.x, e.y);
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(e);
  }
}
function near(x, y, r, fn) {
  const c0 = Math.floor((x - r) / CELL);
  const c1 = Math.floor((x + r) / CELL);
  const r0 = Math.floor((y - r) / CELL);
  const r1 = Math.floor((y + r) / CELL);
  for (let cx = c0; cx <= c1; cx++) {
    for (let cy = r0; cy <= r1; cy++) {
      const a = grid.get((cx & 0xffff) * 65536 + (cy & 0xffff));
      if (a) for (const e of a) if (!e.dead && fn(e) === false) return;
    }
  }
}

function update(dt, realDt) {
  time += dt;
  fx.particles.update(realDt);
  fx.popups.update(realDt);
  fx.shake.update(realDt);
  fx.flash.update(realDt);
  AI.msgT = Math.max(0, AI.msgT - realDt);
  for (const s of strikes) s.t -= realDt;
  strikes = strikes.filter((s) => s.t > 0);
  if (state === 'dying') {
    dieT -= realDt;
    if (dieT <= 0) finish();
    return;
  }
  if (state !== 'run' && state !== 'attract') return;
  const playing = state === 'run';
  if (playing) {
    const sec = Math.floor(run.t);
    run.t += dt;
    if (Math.floor(run.t) !== sec) gv.hud('time', mmss(run.t));
    if (run.t >= 60) gv.unlock('premiere-minute');
    if (run.t >= GUARD_TIME) gv.unlock('cinq-minutes');
    director(dt);
  }
  // Déplacement
  let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (stick) {
    const dx = stick.x - stick.ox;
    const dy = stick.y - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > 6) {
      mx = dx / Math.max(d, 40);
      my = dy / Math.max(d, 40);
    }
  }
  if (!playing || autoplay) {
    const a = pilot();
    mx = a.x;
    my = a.y;
  }
  const ml = Math.hypot(mx, my);
  if (ml > 1) {
    mx /= ml;
    my /= ml;
  }
  const sp = P.speed * (1 + plv('vitesse') * 0.08);
  P.vx = mx * sp;
  P.vy = my * sp;
  P.x += P.vx * dt;
  P.y += P.vy * dt;
  if (ml > 0.1) P.face = Math.atan2(my, mx);
  P.inv = Math.max(0, P.inv - dt);
  // Apparitions
  if (playing) spawning(dt);
  else if (enemies.length < 40 && rng.chance(dt * 3)) spawnFoe(rng.pick(['blob', 'blob', 'fleche']));
  buildGrid();
  // Ennemis
  for (const e of enemies) {
    e.t += dt;
    e.hit = Math.max(0, e.hit - dt);
    if (e.kb > 0) {
      e.kb -= dt;
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      continue;
    }
    const dx = P.x - e.x;
    const dy = P.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (e.type === 'tireur' && d < FOES.tireur.range) {
      // Garde ses distances et tire
      e.x -= (dx / d) * e.speed * 0.4 * dt;
      e.y -= (dy / d) * e.speed * 0.4 * dt;
      if (e.t > 2.2) {
        e.t = 0;
        foeShots.push({ x: e.x, y: e.y, vx: (dx / d) * 170, vy: (dy / d) * 170, r: 5, dmg: 8, life: 4, color: '#4cc3ff' });
      }
    } else if (e.type === 'chargeur' || e.type === 'gardien') {
      chargeAI(e, dx, dy, d, dt);
    } else if (e.type === 'directeur') {
      bossAI(e, dx, dy, d, dt);
    } else {
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
    }
    // Contact
    if (playing && P.inv <= 0 && d < e.r + 12) hurt(e.dmg);
  }
  // Ne pas s'empiler
  for (const e of enemies) {
    if (e.boss) continue;
    near(e.x, e.y, e.r * 2, (o) => {
      if (o === e || o.boss) return;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const d = Math.hypot(dx, dy);
      const min = e.r + o.r;
      if (d > 0 && d < min) {
        const push = (min - d) * 0.25;
        e.x += (dx / d) * push;
        e.y += (dy / d) * push;
      }
    });
  }
  // Armes
  fireWeapons(dt);
  if (weapons.orbe) {
    const s = wstat('orbe');
    for (let k = 0; k < s.n; k++) {
      const a = time * 3 + (k * TAU) / s.n;
      const ox = P.x + Math.cos(a) * s.rad;
      const oy = P.y + Math.sin(a) * s.rad;
      near(ox, oy, s.size + 20, (e) => {
        if (Math.hypot(e.x - ox, e.y - oy) < s.size + e.r && (e.orbT ?? 0) <= time) {
          e.orbT = time + 0.45;
          damage(e, s.dmg);
          if (!e.boss) knock(e, P.x, P.y, 120);
        }
      });
    }
  }
  for (const s of shots) {
    if (s.kind === 'disque') {
      // Part, puis revient vers toi
      s.dist += Math.hypot(s.vx, s.vy) * dt;
      if (!s.back && s.dist > s.out) s.back = true;
      if (s.back) {
        const dx = P.x - s.x;
        const dy = P.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        s.vx = (dx / d) * 420;
        s.vy = (dy / d) * 420;
        if (d < 18) s.life = 0;
      } else if (s.spin) {
        const a = Math.atan2(s.vy, s.vx) + dt * 2.4;
        s.vx = Math.cos(a) * 360;
        s.vy = Math.sin(a) * 360;
      }
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    near(s.x, s.y, s.r + 24, (e) => {
      if (Math.hypot(e.x - s.x, e.y - s.y) > s.r + e.r) return;
      if (s.kind === 'disque') {
        if ((s.hits.get(e) ?? 0) > time) return;
        s.hits.set(e, time + 0.35);
      } else {
        if (s.hits.has(e)) return;
        s.hits.add(e);
        s.pierce--;
      }
      damage(e, s.dmg);
      if (s.pierce <= 0) {
        s.life = 0;
        return false;
      }
    });
  }
  shots = shots.filter((s) => s.life > 0);
  for (const m of mines) {
    m.arm -= dt;
    m.life -= dt;
    if (m.arm > 0) continue;
    let boom = false;
    near(m.x, m.y, 30, (e) => {
      if (Math.hypot(e.x - m.x, e.y - m.y) < e.r + 14) {
        boom = true;
        return false;
      }
    });
    if (boom || m.life <= 0) {
      m.life = -1;
      fx.particles.ring(m.x, m.y, { color: '#ff8a5b', size: 8, growth: m.rad * 3.2, life: 0.3, lineWidth: 6 });
      fx.particles.emit(m.x, m.y, { count: 14, colors: ['#ff8a5b', '#ffc93c', '#ffffff'], speed: [60, 260], gravity: 0, size: [2, 5], shape: 'circle', life: [0.2, 0.5] });
      for (const e of enemies) if (Math.hypot(e.x - m.x, e.y - m.y) < m.rad + e.r) damage(e, m.dmg);
      fx.shake.add(0.12);
      gv.audio.play('explode', { volume: 0.35, throttle: 0.1 });
    }
  }
  mines = mines.filter((m) => m.life > 0);
  // Tirs ennemis
  for (const s of foeShots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (playing && P.inv <= 0 && Math.hypot(s.x - P.x, s.y - P.y) < s.r + 10) {
      s.life = 0;
      hurt(s.dmg);
    }
  }
  foeShots = foeShots.filter((s) => s.life > 0);
  // Les ennemis trop loin derrière reviennent devant
  for (const e of enemies) {
    if (e.boss) continue;
    if (Math.abs(e.x - P.x) > view.width * 1.1 || Math.abs(e.y - P.y) > view.height * 1.1) {
      const a = Math.atan2(P.vy || rng.range(-1, 1), P.vx || rng.range(-1, 1)) + rng.range(-0.8, 0.8);
      const R = Math.hypot(view.width, view.height) / 2 + 30;
      e.x = P.x + Math.cos(a) * R;
      e.y = P.y + Math.sin(a) * R;
    }
  }
  enemies = enemies.filter((e) => !e.dead);
  if (playing && run.kills !== run.shownKills) {
    run.shownKills = run.kills;
    gv.hud('kills', formatInt(run.kills));
  }
  // XP
  const mg = magnet();
  for (const g of gems) {
    const dx = P.x - g.x;
    const dy = P.y - g.y;
    const d = Math.hypot(dx, dy);
    if (d < mg || g.pull) {
      g.pull = true;
      const v = 380 + g.t * 400;
      g.t += dt;
      g.x += (dx / (d || 1)) * v * dt;
      g.y += (dy / (d || 1)) * v * dt;
    }
    if (d < 16) {
      g.taken = true;
      if (!playing) continue;
      if (g.heal) {
        P.hp = Math.min(P.max, P.hp + 30);
        fx.popups.add(P.x, P.y - 20, '+30 PV', { size: 15, color: '#3ee6a8', rise: 30 });
        gv.audio.play('powerup', { volume: 0.5 });
      } else {
        gainXp(g.v);
        gv.audio.play('coin', { volume: 0.18, throttle: 0.04, pitch: 1.2 + Math.min(1, g.v / 5) * 0.3 });
      }
    }
  }
  gems = gems.filter((g) => !g.taken);
  // Trop de cristaux au sol : les plus anciens fusionnent en un gros (rien n'est perdu)
  if (gems.length > 350) {
    const old = gems.splice(0, 60).filter((x) => !x.heal);
    if (old.length) gems.push({ x: old[0].x, y: old[0].y, v: old.reduce((s, x) => s + x.v, 0), t: 0 });
  }
}

// Chargeur et Gardien : s'arrêtent, préviennent, puis foncent tout droit
function chargeAI(e, dx, dy, d, dt) {
  const boss = e.type === 'gardien';
  if (e.state === 0) {
    e.x += (dx / d) * e.speed * dt;
    e.y += (dy / d) * e.speed * dt;
    if (e.t > (boss ? 3 : 2.6) && d < (boss ? 480 : 300)) {
      e.state = 1;
      e.t = 0;
      e.cx = dx / d;
      e.cy = dy / d;
    }
  } else if (e.state === 1) {
    if (e.t > (boss ? 0.7 : 0.55)) {
      e.state = 2;
      e.t = 0;
      if (boss) gv.audio.play('whoosh', { pitch: 0.6 });
    }
  } else {
    const v = boss ? 420 : 330;
    e.x += e.cx * v * dt;
    e.y += e.cy * v * dt;
    if (e.t > (boss ? 0.8 : 0.6)) {
      e.state = 0;
      e.t = 0;
    }
  }
}

// Le Directeur : tourne autour de toi en tirant des anneaux, puis invoque et charge
function bossAI(e, dx, dy, d, dt) {
  e.phase = e.hp > e.max * 0.66 ? 1 : e.hp > e.max * 0.33 ? 2 : 3;
  if (e.phase !== e.lastPhase) {
    e.lastPhase = e.phase;
    if (e.phase === 2) say('p2', 'Tu crois gagner ? Voici mes renforts.');
    if (e.phase === 3) say('p3', 'Analyse terminée. Je connais tous tes mouvements.');
  }
  const want = 230;
  const a = Math.atan2(-dy, -dx) + dt * 0.6;
  const tx = P.x + Math.cos(a) * want;
  const ty = P.y + Math.sin(a) * want;
  e.x += (tx - e.x) * Math.min(1, dt * 1.6);
  e.y += (ty - e.y) * Math.min(1, dt * 1.6);
  e.cd -= dt;
  if (e.cd > 0) return;
  e.cd = e.phase === 3 ? 1.15 : e.phase === 2 ? 1.8 : 2.3;
  const n = e.phase === 3 ? 18 : 12;
  const off = rng.range(0, TAU);
  for (let k = 0; k < n; k++) {
    const aa = off + (k * TAU) / n;
    foeShots.push({ x: e.x, y: e.y, vx: Math.cos(aa) * 175, vy: Math.sin(aa) * 175, r: 6, dmg: 10, life: 5, color: '#ff3b5c' });
  }
  // Tir visé sur ta direction habituelle de fuite
  const lead = AI.bias !== null ? (AI.bias * TAU) / 8 : Math.atan2(P.vy, P.vx);
  const ax = P.x + Math.cos(lead) * 90 - e.x;
  const ay = P.y + Math.sin(lead) * 90 - e.y;
  for (const s of [-0.12, 0, 0.12]) {
    const aa = Math.atan2(ay, ax) + s;
    foeShots.push({ x: e.x, y: e.y, vx: Math.cos(aa) * 240, vy: Math.sin(aa) * 240, r: 7, dmg: 12, life: 4, color: '#ffc93c' });
  }
  if (e.phase >= 2 && rng.chance(0.5)) for (let k = 0; k < 8; k++) spawnFoe('fleche', Math.atan2(P.y - e.y, P.x - e.x) + Math.PI + rng.range(-0.6, 0.6));
  gv.audio.play('hit', { pitch: 0.5, volume: 0.4 });
}

function hurt(n) {
  if (state !== 'run') return;
  P.hp -= n;
  P.inv = 0.5;
  fx.shake.add(0.25);
  fx.flash.trigger('#ff3b5c', 0.18, 6);
  gv.audio.play('hit', { volume: 0.6, throttle: 0.1 });
  if (P.hp <= 0) {
    P.hp = 0;
    state = 'dying';
    dieT = motion.reduced ? 0.8 : 1.5;
    gv.audio.play('explode');
    loop.hitstop(0.12);
    fx.particles.emit(P.x, P.y, { count: 50, colors: [hero.color, '#ffffff'], speed: [60, 340], gravity: 0, size: [2, 6], shape: 'square', life: [0.4, 1.2] });
    say(null, run.t < GUARD_TIME ? 'Prévisible. Reviens quand tu auras appris.' : 'J’ai gagné cette manche. Tu te rapproches.');
  }
}

// ---------- Rendu ----------
function render() {
  const ctx = view.begin();
  const W = view.width;
  const H = view.height;
  ctx.fillStyle = '#08060f';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  fx.shake.apply(ctx, W / 2, H / 2);
  const camX = P.x - W / 2;
  const camY = P.y - H / 2;
  // Sol quadrillé
  ctx.strokeStyle = 'rgba(166,139,255,0.08)';
  ctx.lineWidth = 1;
  const g = 64;
  for (let x = -((camX % g) + g) % g; x < W; x += g) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = -((camY % g) + g) % g; y < H; y += g) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.translate(-camX, -camY);
  // Mines
  for (const m of mines) {
    ctx.fillStyle = m.arm > 0 ? 'rgba(255,138,91,0.4)' : '#ff8a5b';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,138,91,${0.25 + Math.sin(time * 8) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 11, 0, TAU);
    ctx.stroke();
  }
  // XP
  for (const gm of gems) {
    const c = gm.heal ? '#3ee6a8' : gm.v >= 5 ? '#ffc93c' : gm.v >= 3 ? '#a68bff' : '#4cc3ff';
    const s = gm.heal ? 7 : 4 + Math.min(gm.v, 5) * 0.6;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(gm.x, gm.y - s);
    ctx.lineTo(gm.x + s * 0.7, gm.y);
    ctx.lineTo(gm.x, gm.y + s);
    ctx.lineTo(gm.x - s * 0.7, gm.y);
    ctx.closePath();
    ctx.fill();
  }
  // Ennemis
  for (const e of enemies) drawFoe(ctx, e);
  // Tirs
  for (const s of foeShots) {
    glow(ctx, s.x, s.y, s.r * 2.6, s.color);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  for (const s of shots) {
    if (s.kind === 'disque') {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(time * 14);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = (k * TAU) / 3;
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, s.r, a, a + 0.9);
      }
      ctx.fill();
      ctx.restore();
    } else {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
      ctx.stroke();
    }
  }
  // Orbes
  if (weapons.orbe) {
    const s = wstat('orbe');
    for (let k = 0; k < s.n; k++) {
      const a = time * 3 + (k * TAU) / s.n;
      const ox = P.x + Math.cos(a) * s.rad;
      const oy = P.y + Math.sin(a) * s.rad;
      glow(ctx, ox, oy, s.size * 2.4, '#a68bff');
      ctx.fillStyle = weapons.orbe.evolved ? '#ffffff' : '#c4b0ff';
      ctx.beginPath();
      ctx.arc(ox, oy, s.size, 0, TAU);
      ctx.fill();
    }
  }
  // Foudre
  for (const s of strikes) {
    ctx.strokeStyle = `rgba(255,95,162,${s.t * 4})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x + 10, s.y - 220);
    ctx.lineTo(s.x - 8, s.y - 120);
    ctx.lineTo(s.x + 6, s.y - 60);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
  }
  // Joueur
  if (state !== 'over' && !(state === 'dying' && P.hp <= 0)) drawHero(ctx);
  fx.particles.draw(ctx);
  fx.popups.draw(ctx);
  ctx.restore();
  // Interface sur l'écran
  if (state === 'run' || state === 'pick' || state === 'dying') {
    // Barre d'XP en haut
    const need = xpNeed(run.level);
    ctx.fillStyle = 'rgba(5,6,11,0.7)';
    ctx.fillRect(0, 0, W, 8);
    ctx.fillStyle = '#4cc3ff';
    ctx.fillRect(0, 0, W * clamp(run.xp / need), 8);
    // PV du boss
    const boss = enemies.find((e) => e.boss);
    if (boss) {
      const bw = Math.min(420, W - 40);
      const bx = (W - bw) / 2;
      ctx.fillStyle = 'rgba(5,6,11,0.8)';
      ctx.beginPath();
      ctx.roundRect(bx - 4, 18, bw + 8, 26, 8);
      ctx.fill();
      ctx.fillStyle = boss.color;
      ctx.fillRect(bx, 34, bw * clamp(boss.hp / boss.max), 6);
      ctx.fillStyle = '#fff8ec';
      ctx.font = '800 11px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(boss.type === 'gardien' ? 'LE GARDIEN' : `LE DIRECTEUR · PHASE ${boss.phase}`, W / 2, 30);
    }
  }
  if (AI.msgT > 0 && AI.msg) drawTaunt(ctx, W);
  if (stick && state === 'run') {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fff8ec';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(stick.ox, stick.oy, 40, 0, TAU);
    ctx.stroke();
    const dx = stick.x - stick.ox;
    const dy = stick.y - stick.oy;
    const d = Math.min(40, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    ctx.fillStyle = '#fff8ec';
    ctx.beginPath();
    ctx.arc(stick.ox + Math.cos(a) * d, stick.oy + Math.sin(a) * d, 16, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  fx.flash.draw(ctx, W, H);
}

function drawHero(ctx) {
  const blink = P.inv > 0 && Math.floor(time * 20) % 2;
  glow(ctx, P.x, P.y, 34, hero.color);
  if (!blink) {
    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.rotate(P.face);
    ctx.fillStyle = hero.color;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * TAU) / 6;
      ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#08060f';
    ctx.beginPath();
    ctx.arc(5, 0, 3.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  if (state === 'run' || state === 'pick') {
    ctx.fillStyle = 'rgba(5,6,11,0.8)';
    ctx.fillRect(P.x - 18, P.y + 19, 36, 5);
    ctx.fillStyle = P.hp / P.max > 0.35 ? '#3ee6a8' : '#ff3b5c';
    ctx.fillRect(P.x - 18, P.y + 19, 36 * clamp(P.hp / P.max), 5);
  }
}

function drawFoe(ctx, e) {
  const c = e.hit > 0 ? '#ffffff' : e.color;
  ctx.fillStyle = c;
  if (e.boss) {
    glow(ctx, e.x, e.y, e.r * 2.4, e.color);
    ctx.fillStyle = c; // la lueur a changé la couleur de remplissage
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(time * (e.type === 'directeur' ? 0.8 : 0.3));
    ctx.beginPath();
    const n = e.type === 'directeur' ? 8 : 6;
    for (let k = 0; k < n * 2; k++) {
      const a = (k * TAU) / (n * 2);
      const r = k % 2 ? e.r * 0.78 : e.r;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // L'œil du Directeur suit le joueur
    const a = Math.atan2(P.y - e.y, P.x - e.x);
    ctx.fillStyle = '#08060f';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = e.type === 'directeur' ? '#ff3b5c' : '#ffc93c';
    ctx.beginPath();
    ctx.arc(e.x + Math.cos(a) * e.r * 0.18, e.y + Math.sin(a) * e.r * 0.18, e.r * 0.18, 0, TAU);
    ctx.fill();
    if (e.state === 1) {
      ctx.strokeStyle = 'rgba(255,201,60,0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.cx * 420, e.y + e.cy * 420);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    return;
  }
  const wob = Math.sin(e.t * 8) * 1.2;
  ctx.beginPath();
  if (e.type === 'fleche') {
    const a = Math.atan2(P.y - e.y, P.x - e.x);
    ctx.moveTo(e.x + Math.cos(a) * e.r * 1.3, e.y + Math.sin(a) * e.r * 1.3);
    ctx.lineTo(e.x + Math.cos(a + 2.4) * e.r, e.y + Math.sin(a + 2.4) * e.r);
    ctx.lineTo(e.x + Math.cos(a - 2.4) * e.r, e.y + Math.sin(a - 2.4) * e.r);
  } else if (e.type === 'tank') {
    ctx.roundRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2, 6);
  } else if (e.type === 'tireur') {
    ctx.moveTo(e.x, e.y - e.r);
    ctx.lineTo(e.x + e.r, e.y);
    ctx.lineTo(e.x, e.y + e.r);
    ctx.lineTo(e.x - e.r, e.y);
  } else if (e.type === 'chargeur') {
    for (let k = 0; k < 5; k++) {
      const a = (k * TAU) / 5 - Math.PI / 2;
      ctx.lineTo(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
    }
  } else ctx.arc(e.x, e.y, e.r + wob, 0, TAU);
  ctx.closePath();
  ctx.fill();
  if (e.type === 'chargeur' && e.state === 1) {
    ctx.strokeStyle = 'rgba(255,138,91,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + e.cx * 200, e.y + e.cy * 200);
    ctx.stroke();
  }
  ctx.fillStyle = '#08060f';
  ctx.beginPath();
  ctx.arc(e.x - 3, e.y - 2, 1.8, 0, TAU);
  ctx.arc(e.x + 3, e.y - 2, 1.8, 0, TAU);
  ctx.fill();
  if (e.type === 'tank' && e.hp < e.max) {
    ctx.fillStyle = 'rgba(5,6,11,0.8)';
    ctx.fillRect(e.x - e.r, e.y - e.r - 7, e.r * 2, 3);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - e.r, e.y - e.r - 7, e.r * 2 * clamp(e.hp / e.max), 3);
  }
}

function drawTaunt(ctx, W) {
  const a = Math.min(1, AI.msgT * 2);
  ctx.globalAlpha = a;
  ctx.font = '700 13px Rubik, sans-serif';
  const tw = Math.min(W - 40, ctx.measureText(AI.msg).width + 70);
  const x = (W - tw) / 2;
  const y = enemies.some((e) => e.boss) ? 54 : 20;
  ctx.fillStyle = 'rgba(20,4,10,0.88)';
  ctx.beginPath();
  ctx.roundRect(x, y, tw, 40, 12);
  ctx.fill();
  ctx.strokeStyle = '#ff3b5c';
  ctx.lineWidth = 2;
  ctx.stroke();
  // L'œil
  ctx.fillStyle = '#ff3b5c';
  ctx.beginPath();
  ctx.ellipse(x + 24, y + 20, 11, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#08060f';
  ctx.beginPath();
  ctx.arc(x + 24 + Math.sin(time * 2) * 3, y + 20, 3.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd6de';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let text = AI.msg;
  while (ctx.measureText(text).width > tw - 56 && text.length > 4) text = text.slice(0, -2);
  ctx.fillText(text === AI.msg ? text : text + '…', x + 44, y + 20.5);
  ctx.globalAlpha = 1;
}

function glow(ctx, x, y, r, color) {
  const n = parseInt(color.slice(1), 16);
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},0.35)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---------- Saisie ----------
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'up', w: 'up', s: 'down', q: 'left', a: 'left', d: 'right' };
document.addEventListener('keydown', (e) => {
  if (!gv.playing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (state === 'pick' && ['1', '2', '3'].includes(e.key)) {
    e.preventDefault();
    choose(Number(e.key) - 1);
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
window.addEventListener('blur', () => {
  keys = { up: false, down: false, left: false, right: false };
  stick = null;
});
// Joystick : pose le doigt (ou clique) n'importe où, puis glisse
view.canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'run') return;
  const p = view.toLogical(e.clientX, e.clientY);
  stick = { ox: p.x, oy: p.y, x: p.x, y: p.y, id: e.pointerId };
  view.canvas.setPointerCapture?.(e.pointerId);
});
view.canvas.addEventListener('pointermove', (e) => {
  if (!stick || stick.id !== e.pointerId) return;
  const p = view.toLogical(e.clientX, e.clientY);
  stick.x = p.x;
  stick.y = p.y;
});
const release = (e) => {
  if (stick && stick.id === e.pointerId) stick = null;
};
view.canvas.addEventListener('pointerup', release);
view.canvas.addEventListener('pointercancel', release);
view.canvas.style.touchAction = 'none';

// ---------- Accueil : héros et améliorations ----------
function renderOptions() {
  const s = store.data;
  gv.shell.startExtra.innerHTML = `
    <div class="sv-options">
      <span class="sv-label" id="sv-hero-label">Héros</span>
      <div class="sv-heroes" role="radiogroup" aria-labelledby="sv-hero-label">
        ${HEROES.map((h) => {
          const open = hasHero(h);
          return `<button type="button" role="radio" class="sv-hero" data-hero="${h.id}" aria-checked="${s.hero === h.id && open}" ${open ? '' : 'aria-disabled="true"'} style="--c:${h.color}">
            <span class="sv-hero__dot">${open ? '' : icon('lock')}</span><span>${h.name}</span><small>${esc(open ? WEAPONS[h.start].name : h.how)}</small></button>`;
        }).join('')}
      </div>
      <span class="sv-label">Améliorations · <strong class="sv-shards">${icon('sparkle')}${formatInt(s.shards)} éclats</strong></span>
      <div class="sv-ups">
        ${Object.entries(UPGRADES)
          .map(([id, u]) => {
            const l = s.up[id];
            const max = l >= u.max;
            const cost = u.cost(l);
            return `<button type="button" class="sv-up" data-up="${id}" ${max || s.shards < cost ? 'aria-disabled="true"' : ''}>
              <span class="sv-up__name">${u.name} <em>${l}/${u.max}</em></span><small>${u.desc}</small><b>${max ? 'Max' : `${formatInt(cost)} ${icon('sparkle')}`}</b></button>`;
          })
          .join('')}
      </div>
      <p class="sv-hint" id="sv-hint">${s.wins ? `Directeur battu ${s.wins} fois. Il apprend aussi…` : 'Le Directeur t’attend à 10:00. Tiens bon.'}</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('[data-hero], [data-up]');
  if (!b) return;
  const hint = document.getElementById('sv-hint');
  if (b.dataset.hero) {
    const h = HEROES.find((x) => x.id === b.dataset.hero);
    if (!hasHero(h)) {
      hint.textContent = `${h.name} : ${lcFirst(h.how)} pour le débloquer.`;
      gv.audio.play('error');
      return;
    }
    store.data.hero = h.id;
  } else {
    const id = b.dataset.up;
    const u = UPGRADES[id];
    const l = store.data.up[id];
    if (l >= u.max || store.data.shards < u.cost(l)) {
      hint.textContent = l >= u.max ? `${u.name} est déjà au maximum.` : 'Pas assez d’éclats : joue pour en gagner.';
      gv.audio.play('error');
      return;
    }
    store.data.shards -= u.cost(l);
    store.data.up[id]++;
    gv.audio.play('powerup');
  }
  store.save();
  gv.audio.play('select');
  renderOptions();
  gv.shell.startExtra.querySelector(b.dataset.hero ? `[data-hero="${b.dataset.hero}"]` : `[data-up="${b.dataset.up}"]`)?.focus();
});

// ---------- Démarrage ----------
let frameMs = 0;
const loop = createLoop({
  update(dt, realDt) {
    const t0 = performance.now();
    update(Math.min(dt, 1 / 20), Math.min(realDt, 1 / 20));
    frameMs = frameMs * 0.95 + (performance.now() - t0) * 0.05;
  },
  render,
  onAutoPause() {
    if ((state === 'run' || state === 'pick') && gv.playing) gv.pause();
  },
});

window.__sv = {
  get state() { return state; },
  get run() { return run; },
  get player() { return P; },
  get enemies() { return enemies; },
  get weapons() { return weapons; },
  get passives() { return passives; },
  get choices() { return choices; },
  get ai() { return AI; },
  get frameMs() { return frameMs; },
  get store() { return store.data; },
  set autoplay(v) { autoplay = v; },
  choose,
  // Tests : avancer l'horloge, gagner de l'XP, donner une arme, blesser, faire venir un boss
  setTime(t) { run.t = t; AI.lastLook = t - 21; },
  xp(n) { gainXp(n); },
  give(id, lv = 1) { weapons[id] = { lv, cd: 0.2, evolved: false }; },
  givePassive(id, lv = 1) { passives[id] = lv; },
  hurt(n) { P.inv = 0; hurt(n); },
  boss(kind) { spawnBoss(kind); },
  speed(k) { loop.timeScale = k; },
  killBoss() { const b = enemies.find((e) => e.type === 'directeur') ?? enemies.find((e) => e.boss); if (b) damage(b, b.hp + 1); },
  flee(dx, dy, sec) { P.vx = dx * 150; P.vy = dy * 150; director(sec); },
};

reset(3);
renderOptions();
gv.hud('best', formatInt(gv.best ?? 0));
gv.hud('time', '0:00');
gv.hud('level', 1);
gv.hud('kills', 0);
loop.start();
gv.showStart();
