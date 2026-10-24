// Bac à sable du moteur : un mini-jeu de 20 s qui exerce tout le socle partagé.
// Attrape les jetons (clic / tap) ; Espace déclenche une onde de choc avec hit-stop.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createCanvas } from '../../shared/js/engine/canvas.js';
import { createInput } from '../../shared/js/engine/input.js';
import { Particles } from '../../shared/js/engine/particles.js';
import { Shake, Flash, Popups } from '../../shared/js/engine/fx.js';
import { Spring, Tweens, Ease } from '../../shared/js/core/tween.js';
import { createRng } from '../../shared/js/core/rng.js';
import { TAU, dist, formatInt } from '../../shared/js/core/math.js';

const ROUND = Number(new URLSearchParams(location.search).get('round')) || 20;
const rng = createRng();
const stage = document.getElementById('stage');

const gv = bootGame('dev-sandbox', {
  game: {
    id: 'dev-sandbox',
    title: 'Bac à sable',
    category: 'arcade',
    description: 'Attrape un maximum de jetons en 20 secondes. Enchaîne-les vite pour monter le combo.',
    score: { label: 'Score', unit: '', higherIsBetter: true },
  },
  hud: [
    { id: 'time', label: 'Temps', value: String(ROUND) },
    { id: 'score', label: 'Score' },
  ],
  howTo: [
    { keys: ['icon:pointer', 'icon:touch'], text: 'Attrape les jetons' },
    { keys: ['Espace'], text: 'Onde de choc' },
  ],
  onStart: reset,
  onRestart: reset,
  onPause: () => loop.pause(),
  onResume: () => loop.resume(),
});

const view = createCanvas(stage, { mode: 'height', height: 540, minAspect: 0.5, maxAspect: 2.4 });
const input = createInput({ surface: stage, view, bindings: { tap: ['pointer'], blast: ['Space'] } });
const particles = new Particles();
const popups = new Popups();
const shake = new Shake();
const flash = new Flash();
const tweens = new Tweens();
const coins = [];
let score = 0;
let timeLeft = ROUND;
let combo = 0;
let comboTimer = 0;
let spawnTimer = 0;
let running = false;

const loop = createLoop({
  update,
  render,
  onAutoPause: () => gv.pause(),
});

function reset() {
  coins.length = 0;
  particles.clear();
  popups.clear();
  tweens.clear();
  score = 0;
  combo = 0;
  timeLeft = ROUND;
  spawnTimer = 0;
  running = true;
  gv.hud('score', 0);
  gv.hud('time', ROUND);
  gv.banner('GO !');
  gv.audio.play('go');
  loop.start();
  loop.resume();
}

function spawn() {
  const r = rng.range(22, 34);
  const c = {
    x: rng.range(r + 10, view.width - r - 10),
    y: rng.range(r + 10, view.height - r - 10),
    r,
    life: rng.range(1.6, 2.6),
    scale: new Spring(0, { stiffness: 320, damping: 12 }),
    wobble: rng.range(0, TAU),
  };
  c.scale.target = 1;
  coins.push(c);
}

function collect(c, i) {
  coins.splice(i, 1);
  combo = comboTimer > 0 ? combo + 1 : 1;
  comboTimer = 0.8;
  const mult = Math.min(8, 1 + Math.floor(combo / 3));
  const gain = 10 * mult;
  score += gain;
  gv.hud('score', formatInt(score), true);
  particles.emit(c.x, c.y, { count: 18, colors: ['#ffc93c', '#fff3c4', '#ff8a5b'], speed: [120, 380], size: [3, 7], gravity: 900 });
  particles.ring(c.x, c.y, { color: '#ffc93c', size: c.r * 0.6, growth: 240 });
  popups.add(c.x, c.y - c.r, `+${gain}`, { color: mult > 1 ? '#ffc93c' : '#f4efe4', size: 24 + mult * 3 });
  if (combo > 0 && combo % 5 === 0) {
    popups.add(view.width / 2, view.height * 0.28, `COMBO ×${combo}`, { size: 54, color: '#3ee6a8', rise: 40, life: 1 });
    gv.audio.play('combo', { pitch: 1 + combo * 0.03 });
    shake.add(0.25);
  }
  gv.audio.play('coin', { pitch: 1 + Math.min(combo, 12) * 0.04 });
  shake.add(0.12);
}

function update(dt) {
  shake.update(dt);
  flash.update(dt);
  particles.update(dt);
  popups.update(dt);
  tweens.update(dt);
  for (const c of coins) {
    c.scale.update(dt);
    c.wobble += dt * 3;
  }

  if (running && gv.playing) {
    timeLeft -= dt;
    comboTimer -= dt;
    spawnTimer -= dt;
    if (spawnTimer <= 0 && coins.length < 7) {
      spawn();
      spawnTimer = Math.max(0.25, 0.75 - (ROUND - timeLeft) * 0.02);
    }
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.life -= dt;
      if (c.life <= 0) {
        particles.emit(c.x, c.y, { count: 6, color: '#4a5175', speed: [30, 90], gravity: 200 });
        coins.splice(i, 1);
      }
    }
    if (input.pressed('tap')) {
      const p = input.pointer;
      let hit = false;
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        const d = dist(p.x, p.y, c.x, c.y);
        if (d < c.r * 1.25) {
          collect(c, i);
          hit = true;
          break;
        }
        if (d < c.r * 1.9) {
          popups.add(c.x, c.y - c.r, 'PRESQUE !', { size: 18, color: '#4cc3ff', life: 0.6 });
          gv.audio.play('nearMiss');
        }
      }
      if (!hit) particles.emit(p.x, p.y, { count: 5, color: '#8d93b3', speed: [40, 110], gravity: 0, life: [0.2, 0.35] });
    }
    if (input.pressed('blast')) {
      loop.hitstop(0.08);
      shake.add(0.6);
      flash.trigger('#ffffff', 0.5);
      gv.audio.play('explode');
      particles.ring(view.width / 2, view.height / 2, { color: '#ff5a4e', size: 20, growth: 900, life: 0.5, lineWidth: 10 });
      for (let i = coins.length - 1; i >= 0; i--) collect(coins[i], i);
    }
    gv.hud('time', Math.max(0, Math.ceil(timeLeft)));
    if (timeLeft <= 0) {
      running = false;
      gv.audio.play('whoosh');
      tweens.wait(0.5, () =>
        gv.gameOver({
          score,
          stats: { score },
          extraStats: [{ label: 'Combo max', value: '—' }],
          nextUnlock: { label: 'Jeton doré', current: score, target: 1000 },
        }),
      );
    }
  }
  input.endFrame();
}

function render() {
  const ctx = view.begin();
  const { width: w, height: h } = view;
  ctx.fillStyle = '#11131f';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  shake.apply(ctx, w / 2, h / 2);

  // Trame de fond
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 20; x < w; x += 40) for (let y = 20; y < h; y += 40) ctx.fillRect(x - 1, y - 1, 2, 2);

  for (const c of coins) {
    const s = Math.max(0, c.scale.value);
    const fade = Math.min(1, c.life / 0.5);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(s * (1 + Math.sin(c.wobble) * 0.04), s * (1 - Math.sin(c.wobble) * 0.04));
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#c98f00';
    ctx.beginPath();
    ctx.arc(0, 4, c.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,29,0,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, c.r * 0.68, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  particles.draw(ctx);
  popups.draw(ctx);
  ctx.restore();
  flash.draw(ctx, w, h);

  // Barre de temps
  const p = Math.max(0, timeLeft / ROUND);
  ctx.fillStyle = '#05060b';
  ctx.fillRect(0, h - 6, w, 6);
  ctx.fillStyle = p < 0.25 ? '#ff5a4e' : '#3ee6a8';
  ctx.fillRect(0, h - 6, w * Ease.linear(p), 6);
}

loop.start();
gv.showStart();
