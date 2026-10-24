// Volt Rush — rendu : ciel, villes en parallaxe, toits, obstacles, boulons et Volt.

import { createRng } from '../../shared/js/core/rng.js';
import { TAU, clamp, lerp } from '../../shared/js/core/math.js';
import { mixHex } from '../../shared/js/core/color.js';
import { SKY, WORLD_H, PLAYER } from './config.js';

/** Palette du ciel interpolée selon la distance parcourue (m). */
export function skyPalette(meters) {
  let i = 0;
  while (i < SKY.length - 2 && meters > SKY[i + 1].at) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const t = clamp((meters - a.at) / (b.at - a.at));
  const out = { t: (i + t) / (SKY.length - 1) };
  for (const k of ['top', 'mid', 'low', 'far', 'near']) out[k] = mixHex(a[k], b[k], t);
  out.star = lerp(a.star, b.star, t);
  out.facade = mixHex('#1c1230', '#0d1022', out.t);
  out.facadeDark = mixHex('#130b22', '#080a16', out.t);
  out.rim = mixHex('#ff8a5b', '#4cc3ff', out.t);
  out.window = out.t < 0.5 ? '#ffc93c' : '#ffd36b';
  return out;
}

// ---------- Décors de fond (générés une fois) ----------
export function createBackdrop(seed = 7) {
  const rng = createRng(seed);
  const layer = (tileW, minH, maxH, minW, maxW, windows) => {
    const blocks = [];
    let x = 0;
    while (x < tileW) {
      const w = rng.range(minW, maxW);
      const h = rng.range(minH, maxH);
      const lights = [];
      if (windows) {
        for (let wy = 14; wy < h - 10; wy += 16) for (let wx = 6; wx < w - 8; wx += 12) if (rng.chance(0.18)) lights.push([wx, wy]);
      }
      blocks.push({ x, w, h, roof: rng.pick(['flat', 'flat', 'spire', 'step', 'dish']), lights });
      x += w + rng.range(-4, 10);
    }
    return { tileW: x, blocks };
  };
  const stars = Array.from({ length: 70 }, () => ({ x: rng.next(), y: rng.next() * 0.75, s: rng.chance(0.15) ? 2 : 1, tw: rng.range(0, TAU) }));
  // Bandes de nuages étirées, façon coucher de soleil
  const clouds = Array.from({ length: 9 }, () => ({ x: rng.range(0, 1800), y: rng.range(0.08, 0.62), w: rng.range(120, 320), h: rng.range(6, 14), depth: rng.range(0.03, 0.09) }));
  return { far: layer(1400, 70, 170, 40, 90, false), near: layer(1600, 60, 140, 50, 110, true), stars, clouds };
}

/** `base` = ordonnée écran du bas de la bande jouable (les décors s'y accrochent). */
export function drawSky(ctx, view, pal, time, backdrop, base, cameraX) {
  const { width: w, height: h } = view;
  const g = ctx.createLinearGradient(0, 0, 0, base);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.62, pal.mid);
  g.addColorStop(1, pal.low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const skyH = base - WORLD_H * 0.4;

  // Étoiles
  if (pal.star > 0.05) {
    ctx.fillStyle = '#f4efe4';
    for (const s of backdrop.stars) {
      ctx.globalAlpha = pal.star * (0.55 + 0.45 * Math.sin(time * 2 + s.tw));
      ctx.fillRect(s.x * w, s.y * skyH, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  // Nuages en parallaxe lente, teintés par le soleil couchant puis la nuit
  ctx.fillStyle = pal.low;
  for (const c of backdrop.clouds) {
    const span = 1800;
    const x = ((((c.x - cameraX * c.depth) % span) + span) % span) - 300;
    if (x > w) continue;
    ctx.globalAlpha = 0.16 + c.depth * 2;
    ctx.beginPath();
    ctx.roundRect(x, c.y * skyH, c.w, c.h, c.h / 2);
    ctx.roundRect(x + c.w * 0.25, c.y * skyH - c.h * 0.7, c.w * 0.45, c.h, c.h / 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Soleil qui se couche, puis lune
  const horizon = base - WORLD_H * 0.42;
  const sunY = lerp(horizon - 60, horizon + 120, clamp(pal.t * 1.6));
  if (pal.t < 0.75) {
    ctx.globalAlpha = 1 - clamp((pal.t - 0.45) / 0.3);
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.arc(w * 0.72, sunY, 70, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff8a5b';
    ctx.globalAlpha *= 0.35;
    ctx.beginPath();
    ctx.arc(w * 0.72, sunY, 70, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (pal.t > 0.4) {
    const a = clamp((pal.t - 0.4) / 0.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    const my = Math.max(70, base - WORLD_H * 0.8) + (1 - a) * 40;
    ctx.arc(w * 0.3, my, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.top;
    ctx.beginPath();
    ctx.arc(w * 0.3 + 11, my - 6, 22, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawLayer(ctx, layer, offset, baseY, color, lightColor, lightAlpha, viewW) {
  const start = -((offset % layer.tileW) + layer.tileW) % layer.tileW;
  ctx.fillStyle = color;
  for (let tx = start; tx < viewW; tx += layer.tileW) {
    for (const b of layer.blocks) {
      const x = tx + b.x;
      if (x > viewW || x + b.w < 0) continue;
      const y = baseY - b.h;
      ctx.fillRect(x, y, b.w, b.h + 400);
      if (b.roof === 'spire') ctx.fillRect(x + b.w / 2 - 2, y - 22, 4, 22);
      else if (b.roof === 'step') ctx.fillRect(x + b.w * 0.2, y - 12, b.w * 0.6, 12);
      else if (b.roof === 'dish') {
        ctx.beginPath();
        ctx.arc(x + b.w * 0.7, y - 6, 8, Math.PI, TAU);
        ctx.fill();
      }
    }
  }
  if (lightAlpha > 0) {
    ctx.fillStyle = lightColor;
    ctx.globalAlpha = lightAlpha;
    for (let tx = start; tx < viewW; tx += layer.tileW) {
      for (const b of layer.blocks) {
        const x = tx + b.x;
        if (x > viewW || x + b.w < 0) continue;
        const y = baseY - b.h;
        for (const [lx, ly] of b.lights) ctx.fillRect(x + lx, y + ly, 5, 7);
      }
    }
    ctx.globalAlpha = 1;
  }
}

export function drawSkylines(ctx, view, pal, cameraX, backdrop, base) {
  const bottom = base;
  drawLayer(ctx, backdrop.far, cameraX * 0.12, bottom - WORLD_H * 0.42, pal.far, pal.window, 0, view.width);
  drawLayer(ctx, backdrop.near, cameraX * 0.32, bottom - WORLD_H * 0.24, pal.near, pal.window, 0.22, view.width);
}

// ---------- Toits jouables ----------
/** `depth` = ordonnée monde du bas de l'écran (les façades descendent jusque-là). */
export function drawRoof(ctx, roof, pal, x0, x1, depth = WORLD_H) {
  const { x, w, y } = roof;
  const left = Math.max(x, x0);
  const right = Math.min(x + w, x1);
  if (right <= left) return;
  // Façade
  ctx.fillStyle = pal.facade;
  ctx.fillRect(x, y, w, depth - y + 4);
  ctx.fillStyle = pal.facadeDark;
  ctx.fillRect(x, y + 14, 6, depth - y);
  ctx.fillRect(x + w - 6, y + 14, 6, depth - y);
  // Fenêtres : grille déterministe par immeuble
  let s = roof.seed;
  const next = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  ctx.fillStyle = pal.window;
  for (let wy = y + 30; wy < depth; wy += 28) {
    for (let wx = x + 18; wx < x + w - 22; wx += 24) {
      const lit = next() < 0.32;
      if (!lit || wx + 12 < left || wx > right) continue;
      ctx.globalAlpha = 0.35 + next() * 0.4;
      ctx.fillRect(wx, wy, 10, 14);
    }
  }
  ctx.globalAlpha = 1;
  // Rebord du toit
  ctx.fillStyle = '#0b0c14';
  ctx.fillRect(x - 3, y, w + 6, 10);
  ctx.fillStyle = pal.rim;
  ctx.fillRect(x - 3, y, w + 6, 3);
}

export function drawDecor(ctx, d, pal) {
  ctx.fillStyle = pal.facadeDark;
  const { x, y, s } = d;
  switch (d.kind) {
    case 'vent':
      ctx.fillRect(x, y - 16 * s, 26 * s, 16 * s);
      ctx.fillRect(x - 2, y - 18 * s, 30 * s, 4);
      break;
    case 'antenna':
      ctx.fillRect(x, y - 54 * s, 3, 54 * s);
      ctx.fillRect(x - 10 * s, y - 44 * s, 23 * s, 3);
      ctx.fillRect(x - 6 * s, y - 34 * s, 15 * s, 3);
      ctx.fillStyle = '#ff5a4e';
      ctx.fillRect(x - 1, y - 58 * s, 5, 5);
      break;
    case 'tank':
      ctx.fillRect(x, y - 40 * s, 34 * s, 28 * s);
      ctx.fillRect(x + 4, y - 12 * s, 4, 12 * s);
      ctx.fillRect(x + 26 * s, y - 12 * s, 4, 12 * s);
      ctx.beginPath();
      ctx.moveTo(x - 2, y - 40 * s);
      ctx.lineTo(x + 17 * s, y - 52 * s);
      ctx.lineTo(x + 36 * s, y - 40 * s);
      ctx.fill();
      break;
    case 'sign':
      ctx.fillRect(x, y - 30 * s, 4, 30 * s);
      ctx.fillRect(x + 30 * s, y - 30 * s, 4, 30 * s);
      ctx.fillRect(x - 4, y - 52 * s, 42 * s, 24 * s);
      ctx.fillStyle = pal.rim;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x + 2, y - 46 * s, 30 * s, 4);
      ctx.fillRect(x + 2, y - 38 * s, 20 * s, 4);
      ctx.globalAlpha = 1;
      break;
  }
}

// ---------- Obstacles ----------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawCrate(ctx, x, y, w, h) {
  ctx.fillStyle = '#05060b';
  roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 5);
  ctx.fill();
  ctx.fillStyle = '#b8281f';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = '#ff5a4e';
  roundRect(ctx, x, y, w, h - 5, 4);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 4, y + 4, w - 8, h - 13);
  ctx.clip();
  ctx.strokeStyle = '#ffc93c';
  ctx.lineWidth = 4;
  for (let i = -h; i < w + h; i += 11) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSolid(ctx, s, time) {
  if (s.kind === 'crate') drawCrate(ctx, s.x, s.y, s.w, s.h);
  else if (s.kind === 'stack') {
    drawCrate(ctx, s.x, s.y + s.h / 2, s.w, s.h / 2);
    drawCrate(ctx, s.x + 2, s.y, s.w - 4, s.h / 2 - 1);
  } else {
    // Relais électrique : colonne grillagée avec voyant clignotant
    ctx.fillStyle = '#05060b';
    roundRect(ctx, s.x - 2, s.y - 2, s.w + 4, s.h + 4, 5);
    ctx.fill();
    ctx.fillStyle = '#353b58';
    roundRect(ctx, s.x, s.y, s.w, s.h, 4);
    ctx.fill();
    ctx.fillStyle = '#252a40';
    for (let yy = s.y + 10; yy < s.y + s.h - 6; yy += 9) ctx.fillRect(s.x + 5, yy, s.w - 10, 4);
    ctx.fillStyle = '#4a5175';
    ctx.fillRect(s.x - 4, s.y, s.w + 8, 6);
    const on = Math.sin(time * 8 + s.x) > 0;
    ctx.fillStyle = on ? '#ff5a4e' : '#5a1a16';
    ctx.beginPath();
    ctx.arc(s.x + s.w / 2, s.y - 5, 4, 0, TAU);
    ctx.fill();
  }
}

export function drawDrone(ctx, d, time, roofY) {
  const bob = Math.sin(time * 5 + d.phase) * 3;
  const cx = d.x + d.w / 2;
  const cy = d.y + d.h / 2 + bob;
  // Ombre au sol : annonce le danger
  if (roofY !== undefined) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, roofY - 1, 16 - bob, 3, 0, 0, TAU);
    ctx.fill();
  }
  // Hélices
  const blade = 9 + Math.sin(time * 60 + d.phase) * 7;
  ctx.fillStyle = '#c4c7dc';
  ctx.fillRect(cx - 14 - blade / 2, cy - 12, blade, 2.5);
  ctx.fillRect(cx + 14 - blade / 2, cy - 12, blade, 2.5);
  ctx.fillStyle = '#05060b';
  ctx.fillRect(cx - 15, cy - 11, 2, 6);
  ctx.fillRect(cx + 13, cy - 11, 2, 6);
  // Corps
  ctx.fillStyle = '#05060b';
  roundRect(ctx, cx - 19, cy - 8, 38, 17, 8);
  ctx.fill();
  ctx.fillStyle = '#4a5175';
  roundRect(ctx, cx - 17, cy - 6, 34, 13, 6);
  ctx.fill();
  // Œil rouge qui scanne
  const eye = Math.sin(time * 3 + d.phase) * 7;
  ctx.fillStyle = '#ff5a4e';
  ctx.beginPath();
  ctx.arc(cx + eye, cy, 3.5, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(cx + eye, cy, 8, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- Boulons et batteries ----------
export function drawPickup(ctx, p, time) {
  const spin = Math.cos(time * 4 + p.phase);
  const bob = Math.sin(time * 3 + p.phase) * 2;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  if (p.kind === 'battery') {
    const pulse = 1 + Math.sin(time * 6) * 0.08;
    ctx.strokeStyle = '#3ee6a8';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 20 * pulse, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#05060b';
    roundRect(ctx, -10, -15, 20, 30, 5);
    ctx.fill();
    ctx.fillStyle = '#3ee6a8';
    roundRect(ctx, -8, -13, 16, 26, 4);
    ctx.fill();
    ctx.fillStyle = '#05060b';
    ctx.fillRect(-4, -18, 8, 4);
    ctx.fillStyle = '#032a1c';
    ctx.fillRect(-1.5, -6, 3, 12);
    ctx.fillRect(-6, -1.5, 12, 3);
  } else {
    // Scintillement ponctuel (plutôt qu'un halo qui salit le décor)
    const tw = Math.sin(time * 3.2 + p.phase * 2);
    if (tw > 0.8) {
      const k = (tw - 0.8) * 5;
      ctx.fillStyle = '#fff6d8';
      ctx.globalAlpha = k;
      ctx.fillRect(7, -12 - k * 3, 2, 8 + k * 6);
      ctx.fillRect(4 - k * 3, -9, 8 + k * 6, 2);
      ctx.globalAlpha = 1;
    }
    ctx.scale(1.3 * Math.max(0.25, Math.abs(spin)), 1.3);
    ctx.fillStyle = '#c98f00';
    boltPath(ctx, 0, 1.5);
    ctx.fill();
    ctx.fillStyle = spin > 0 ? '#ffc93c' : '#ffdf7a';
    boltPath(ctx, 0, 0);
    ctx.fill();
  }
  ctx.restore();
}

function boltPath(ctx, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(dx + 2, dy - 10);
  ctx.lineTo(dx - 6, dy + 1);
  ctx.lineTo(dx - 0.5, dy + 1);
  ctx.lineTo(dx - 2.5, dy + 10);
  ctx.lineTo(dx + 6, dy - 2);
  ctx.lineTo(dx + 0.5, dy - 2);
  ctx.closePath();
}

// ---------- Volt ----------
/**
 * p = { x, y (pieds), sx, sy, rot, run, sliding, onGround, blink, mood: 'run'|'surge'|'dead'|'jump' }
 */
export function drawVolt(ctx, p, skin, time) {
  const w = PLAYER.w;
  ctx.save();
  // Écrasement autour des pieds, rotation autour du centre du corps
  ctx.translate(p.x + w / 2, p.y);
  ctx.scale(p.sx, p.sy);
  if (p.rot) {
    ctx.translate(0, -20);
    ctx.rotate(p.rot);
    ctx.translate(0, 20);
  }
  if (p.sliding) ctx.rotate(-0.32);

  // Jambes
  ctx.strokeStyle = skin.deep;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (p.onGround && !p.sliding) {
    const a = Math.sin(p.run) * 8;
    ctx.moveTo(-7, -9);
    ctx.lineTo(-7 + a, -1);
    ctx.moveTo(7, -9);
    ctx.lineTo(7 - a, -1);
  } else if (p.sliding) {
    ctx.moveTo(-4, -8);
    ctx.lineTo(10, -3);
    ctx.moveTo(6, -8);
    ctx.lineTo(18, -4);
  } else {
    ctx.moveTo(-7, -9);
    ctx.lineTo(-10, -3);
    ctx.moveTo(7, -9);
    ctx.lineTo(11, -5);
  }
  ctx.stroke();

  // Antenne et étincelle
  ctx.strokeStyle = '#11131f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.lineTo(4, -48);
  ctx.stroke();
  const spark = p.mood === 'surge' ? 1 : 0.55 + 0.45 * Math.sin(time * 14);
  ctx.fillStyle = p.mood === 'surge' ? '#4cc3ff' : skin.eye;
  ctx.globalAlpha = spark;
  ctx.beginPath();
  ctx.arc(4.5, -50, p.mood === 'surge' ? 5 : 3.5, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Halo de Surcharge
  if (p.mood === 'surge' || skin.glow) {
    ctx.strokeStyle = p.mood === 'surge' ? '#4cc3ff' : skin.glow;
    ctx.globalAlpha = p.mood === 'surge' ? 0.55 + 0.45 * Math.sin(time * 30) : 0.5;
    ctx.lineWidth = 3;
    roundRect(ctx, -20, -42, 40, 36, 13);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Bras
  const arm = p.onGround ? Math.sin(p.run + Math.PI) * 4 : -6;
  ctx.fillStyle = skin.deep;
  roundRect(ctx, -23, -25 + arm * 0.5, 9, 6, 3);
  ctx.fill();
  roundRect(ctx, 14, -27 - arm * 0.5, 10, 6, 3);
  ctx.fill();

  // Corps
  ctx.fillStyle = skin.deep;
  roundRect(ctx, -17, -36, 34, 29, 10);
  ctx.fill();
  ctx.fillStyle = skin.body;
  roundRect(ctx, -17, -39, 34, 29, 10);
  ctx.fill();
  if (skin.shine) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-6, -30, 7, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
  }

  // Écran et yeux
  ctx.fillStyle = '#11131f';
  roundRect(ctx, -12, -34, 25, 16, 5);
  ctx.fill();
  ctx.fillStyle = p.mood === 'surge' ? '#4cc3ff' : skin.eye;
  ctx.strokeStyle = ctx.fillStyle;
  if (p.mood === 'dead') {
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (const ex of [-5, 6]) {
      ctx.moveTo(ex - 3, -29);
      ctx.lineTo(ex + 3, -23);
      ctx.moveTo(ex + 3, -29);
      ctx.lineTo(ex - 3, -23);
    }
    ctx.stroke();
  } else if (p.mood === 'surge' || p.mood === 'happy') {
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-8, -24);
    ctx.quadraticCurveTo(-5, -30, -2, -24);
    ctx.moveTo(3, -24);
    ctx.quadraticCurveTo(6, -30, 9, -24);
    ctx.stroke();
  } else {
    const eh = p.blink > 0 ? 1.5 : p.mood === 'jump' ? 8 : 7;
    roundRect(ctx, -7, -30 + (7 - eh) / 2, 4, eh, 2);
    ctx.fill();
    roundRect(ctx, 4, -30 + (7 - eh) / 2, 4, eh, 2);
    ctx.fill();
  }
  ctx.restore();
}
