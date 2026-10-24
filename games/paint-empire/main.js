// Paint Empire — atelier de peinture incrémental. Cliquer sur le chevalet peint la toile, coup de
// pinceau par coup de pinceau ; terminée, elle part vers une commande, un contrat de galerie, le
// stock… ou se vend selon sa rareté, et rejoint la galerie. Assistants (revenu passif), matériel,
// mouvements picturaux, collectionneur de passage, expositions (prestige) et gains hors ligne.
// La ville (town.js) : carte, clients et commandes chronométrées, contrats, bâtiments, réputation.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createFxLayer, squash, wiggle } from '../../shared/js/engine/fx.js';
import { createRng } from '../../shared/js/core/rng.js';
import { formatShort, formatInt, formatDuration, clamp } from '../../shared/js/core/math.js';
import { createStore, readJSON } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import * as E from './economy.js';
import { drawPainting, makeStrokes, paintingTitle, paintingFamily, seedFor } from './art.js';
import { createTown, TOWN_DEFAULTS } from './town.js';
import { rarityRank } from './orders.js';

const W = 320;
const H = 240;
const REVEAL_STROKES = 36;
const GALLERY_MAX = 18;
const CHEFS_MAX = 30;
const OFFLINE_MIN_MS = 60e3;
const PAINT_COLORS = ['#ff8a5b', '#ffc93c', '#4cc3ff', '#3ee6a8', '#a68bff', '#ff5a4e'];

// ---------- Sauvegarde ----------
function fromLegacy(l) {
  if (!l || typeof l !== 'object') return null;
  const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
  return {
    money: n(l.money),
    totalEarned: Math.max(n(l.totalEarnings), n(l.money)),
    runEarned: n(l.money),
    sold: Math.floor(n(l.paintingsSold)),
    clicks: Math.floor(n(l.totalClicks)),
    renown: Math.min(50, Math.floor(n(l.prestigePoints))),
    legacy: { money: n(l.money), totalEarnings: n(l.totalEarnings), sold: Math.floor(n(l.paintingsSold)) },
  };
}

const store = createStore('paint-empire', {
  version: 1,
  defaults: {
    money: 0,
    totalEarned: 0,
    runEarned: 0,
    sold: 0,
    runSold: 0,
    masterpieces: 0,
    runMasterpieces: 0,
    clicks: 0,
    renown: 0,
    tokens: 0,
    expos: 0,
    collectors: 0,
    assistants: {},
    tools: {},
    patrons: {},
    gallery: [],
    chefs: [],
    current: null,
    n: 0,
    runStyle: 0,
    lastSeen: 0,
    offlineBest: 0,
    legacy: null,
    legacyNoticed: false,
    // Chevalet : style (null = le dernier mouvement), format, couleur dominante (null = libre)
    easel: { style: null, format: 'moyen', family: null },
    ...structuredClone(TOWN_DEFAULTS),
  },
  // Première visite : on reprend la fortune et les ventes de l'ancien Paint Empire
  migrate: (data, from) => (from === -1 ? fromLegacy(readJSON('artEmpireSave')) ?? undefined : data),
});
const s = store.data;

const $ = (id) => document.getElementById(id);
const wrapEl = $('wrap');
const moneyEl = $('money');
const rateEl = $('rate');
const canvasBtn = $('canvasBtn');
const frameEl = $('frame');
const canvasEl = $('canvas');
const progressEl = $('progress');
const captionEl = $('caption');
const buffsEl = $('buffs');
const galleryEl = $('gallery');
const expoEl = $('expo');
const listEl = $('list');
const collectorEl = $('collector');
const dlg = $('dlg');
const easelCtlEl = $('easelCtl');
const noticeEl = $('notice');
const villeDot = $('villeDot');
const paneAtelier = $('paneAtelier');
const paneVille = $('paneVille');

const gv = bootGame('paint-empire', {
  hud: [
    { id: 'renown', label: 'Renommée' },
    { id: 'best', label: 'Fortune' },
  ],
  howTo: [
    { keys: ['icon:pointer', 'Espace'], text: 'Clique sur la toile pour peindre : terminée, elle se vend.' },
    { keys: ['icon:home'], text: 'Dans la ville, accepte les commandes des clients et livre-les avant la fin du chrono.' },
    { keys: ['icon:user'], text: 'Engage des assistants, ouvre des ateliers, signe avec les galeries.' },
    { keys: ['icon:starFill'], text: 'Expose pour gagner de la renommée : +5 % de revenus pour toujours.' },
  ],
  startLabel: 'Ouvrir l’atelier',
  formatScore: (n) => `${formatShort(n)} €`,
  onStart: openStudio,
  onPause: () => save(),
  onResume: () => {
    lastWall = Date.now();
  },
});
const fx = createFxLayer(gv.stage);
const rng = createRng(Date.now());

// ---------- État d'exécution ----------
let time = 0;
let lastWall = Date.now();
let autoAcc = 0;
let saveAcc = 0;
let uiAcc = 0;
let hudAcc = 0;
let tab = 'assistants';
let qty = 1;
let collectorIn = 40;
let collectorLeft = 0;
const buffs = { inspiration: 0, frenesie: 0 }; // fin (en temps de jeu)
let full = null; // toile complète hors écran
let strokes = [];
let revealed = 0;
const ctx = canvasEl.getContext('2d');

const fmt = (n) => `${formatShort(n)} €`;
const fmtRate = (n) => (n < 10 ? `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} €` : fmt(n));
const income = () => E.incomePerSecond(s) * (buffs.frenesie > time ? 3 : 1);
const styleOf = (i) => E.STYLES[clamp(i, 0, E.STYLES.length - 1)];
const rarityOf = (id) => E.RARITIES.find((r) => r.id === id) ?? E.RARITIES[0];

// ---------- Argent ----------
function earn(v) {
  if (!(v > 0)) return;
  s.money += v;
  s.totalEarned += v;
  s.runEarned += v;
  const idx = E.styleIndex(s.runEarned);
  if (idx > s.runStyle) unlockStyle(idx);
  if (s.totalEarned >= 1e6) gv.unlock('millionnaire');
  if (s.totalEarned >= 1e9) gv.unlock('milliard');
}

function unlockStyle(idx) {
  s.runStyle = idx;
  const st = styleOf(idx);
  gv.banner(`${st.name} !`, { color: '#ffc93c' });
  gv.audio.play('powerup');
  toast({ title: `Nouveau mouvement : ${st.name}`, text: `Tes toiles valent ×${String(st.mult).replace('.', ',')}. La prochaine sera dans ce style.`, iconName: 'palette', tone: 'var(--coin)' });
  if (idx >= E.STYLES.length - 1) gv.unlock('styles');
  // Chaque nouveau mouvement est une étape : XP, crédits et défi du jour
  report({ xp: 10 + idx * 10 });
  renderExpo();
  renderEasel();
}

function report({ xp, expo = 0, renown = 0, contract = 0 }) {
  gv.meta.reportRun('paint-empire', {
    score: 0,
    xp,
    stats: { expo, renown, contract, style: s.runStyle + 1, sold: s.runSold, masterpieces: s.runMasterpieces, orders: s.runOrders },
  });
  submitFortune();
}
function submitFortune() {
  gv.meta.submitBest('paint-empire', Math.floor(s.totalEarned));
  gv.hud('best', formatShort(s.totalEarned));
}

// ---------- Toile ----------
let holdUntil = 0;
let deferred = false;
// Réglages du chevalet appliqués à la prochaine toile
const easelStyle = () => (s.easel.style === null || s.easel.style > s.runStyle ? s.runStyle : s.easel.style);
const strokesOf = (c = s.current) => E.formatOf(c.format).strokes;
function newPainting(carry = 0, { hold = false, keepN = false } = {}) {
  if (!keepN) s.n++;
  const seed = seedFor(rng, s.easel.family);
  s.current = { style: easelStyle(), seed, done: carry, n: s.n, format: s.easel.format, family: paintingFamily(seed) };
  // Après une vente, la toile finie reste exposée un court instant
  if (hold && !motion.reduced) {
    holdUntil = performance.now() + 420;
    deferred = true;
  } else preparePainting();
}

function preparePainting() {
  deferred = false;
  const c = s.current;
  // Anciennes sauvegardes : toile sans format ni couleur
  c.format ??= 'moyen';
  c.family ??= paintingFamily(c.seed);
  frameEl.dataset.format = c.format;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvasEl.width = W * dpr;
  canvasEl.height = H * dpr;
  full = document.createElement('canvas');
  full.width = W * dpr;
  full.height = H * dpr;
  const fctx = full.getContext('2d');
  fctx.scale(dpr, dpr);
  drawPainting(fctx, W, H, { style: styleOf(c.style).id, seed: c.seed });
  strokes = makeStrokes(createRng(c.seed + 7), W, H, REVEAL_STROKES);
  // Toile vierge et esquisse au crayon
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.1;
  ctx.drawImage(full, 0, 0, W, H);
  ctx.globalAlpha = 1;
  revealed = 0;
  revealTo(c.done);
  renderCaption();
}

function revealTo(done) {
  if (deferred) return;
  const target = Math.min(strokes.length, Math.floor((done / strokesOf()) * strokes.length));
  for (; revealed < target; revealed++) {
    const st = strokes[revealed];
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(st.cx, st.cy, st.rx, st.ry, st.a, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(full, 0, 0, W, H);
    ctx.restore();
  }
  progressEl.style.transform = `scaleX(${clamp(done / strokesOf())})`;
}

function addStrokes(k) {
  s.current.done += k;
  // Gros pinceaux : un clic peut terminer plusieurs toiles, le surplus passe à la suivante
  let sales = 0;
  while (s.current.done >= strokesOf() && sales < 20) {
    const carry = s.current.done - strokesOf();
    sell();
    sales++;
    newPainting(carry, { hold: true });
  }
  if (s.current.done >= strokesOf()) s.current.done = strokesOf() - 1;
  revealTo(s.current.done);
}

function paint(x, y) {
  if (!gv.playing) return;
  s.clicks++;
  const k = E.strokesPerClick(s) * (buffs.inspiration > time ? 5 : 1);
  addStrokes(k);
  squash(frameEl, { scaleX: 1.03, scaleY: 0.97, duration: 140 });
  gv.audio.play('step', { pitch: 1.4 + Math.random() * 0.5, volume: 1.5, throttle: 0.02 });
  const c = x === undefined ? fx.centerOf(canvasBtn) : { x, y };
  fx.burst(c.x, c.y, { count: 5, colors: PAINT_COLORS, speed: [60, 200], size: [2, 5], gravity: 600, shape: 'circle', life: [0.3, 0.6] });
}

function sell() {
  const c = s.current;
  // Le tirage vient de la graine : une toile garde toujours la même rareté…
  let rarity = E.rollRarity(s, createRng(c.seed + 99).next());
  // …sauf avec un objet rare offert par un client
  if (s.inventory.toile > 0) {
    s.inventory.toile--;
    rarity = E.RARITIES[Math.max(2, rarityRank(rarity.id))];
  } else if (s.inventory.pigment > 0) {
    s.inventory.pigment--;
    rarity = E.RARITIES[Math.min(3, rarityRank(rarity.id) + 1)];
  }
  const value = E.paintingValue(s, rarity, c.style, c.format);
  const routed = town.route({ style: c.style, format: c.format, family: c.family, rarity: rarity.id }, 'hand');
  if (!routed) earn(value);
  s.sold++;
  s.runSold++;
  const entry = { style: c.style, seed: c.seed, rarity: rarity.id, value: routed?.kind === 'contract' ? routed.pay : value, n: c.n, format: c.format, to: routed?.kind ?? 'vente' };
  s.gallery = [entry, ...s.gallery].slice(0, GALLERY_MAX);
  if (rarity.id === 'chef') {
    s.masterpieces++;
    s.runMasterpieces++;
    s.chefs = [entry, ...s.chefs].slice(0, CHEFS_MAX);
    gv.unlock('chef-doeuvre');
  }
  gv.unlock('premiere-toile');
  if (s.sold >= 100) gv.unlock('cent-toiles');
  if (s.sold >= 1000) gv.unlock('mille-toiles');
  saleEffects(rarity, value, routed);
  renderGallery(true);
}

function saleEffects(rarity, value, routed = null) {
  // Le cadre complet le temps d'un éclair : la toile finie
  ctx.drawImage(full, 0, 0, W, H);
  frameEl.dataset.rarity = rarity.id;
  frameEl.classList.remove('is-sold');
  void frameEl.offsetWidth;
  frameEl.classList.add('is-sold');
  const big = rarity.id === 'chef' || rarity.id === 'remarquable';
  // Où part la toile : commande, contrat, réserve ou marché
  const label = !routed
    ? `+${fmt(value)}`
    : routed.kind === 'order'
      ? `Pour ${E.clientOf(routed.order.client).name} · ${routed.done}/${routed.count}`
      : routed.kind === 'contract'
        ? `${E.clientOf(routed.contract.gallery).name} · +${fmt(routed.pay)}`
        : 'En réserve';
  fx.popupAt(canvasBtn, label, { size: routed ? 26 : big ? 40 : 30, color: routed?.kind === 'order' ? '#3ee6a8' : rarity.id === 'commune' ? '#ffc93c' : rarity.color, rise: 70 });
  fx.burstAt(canvasBtn, { count: big ? 50 : 14, colors: rarity.id === 'commune' ? ['#ffc93c', '#fff3c4'] : [rarity.color, '#ffffff', '#ffc93c'], speed: [120, big ? 520 : 300], size: [3, big ? 8 : 5], gravity: 700, shape: big ? 'star' : 'square', life: [0.4, 1] });
  if (rarity.id === 'chef') {
    gv.banner('Chef-d’œuvre !', { color: '#ffc93c' });
    gv.audio.play('record');
    fx.addShake(0.4);
  } else if (rarity.id === 'remarquable') {
    gv.banner('Toile remarquable', { color: '#c4b2ff' });
    gv.audio.play('perfect');
    fx.addShake(0.2);
  } else gv.audio.play(rarity.id === 'belle' ? 'combo' : 'coin', { pitch: 0.95 + Math.random() * 0.1 });
}

// ---------- Collectionneur ----------
function showCollector() {
  collectorLeft = 12;
  collectorEl.style.left = `${8 + rng.range(0, 70)}%`;
  collectorEl.style.top = `${18 + rng.range(0, 55)}%`;
  collectorEl.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="50" rx="22" ry="6" fill="#11131f"/><path d="M18 50V20a14 6 0 0 1 28 0v30z" fill="#11131f"/><rect x="18" y="38" width="28" height="7" fill="#ff5a4e"/><ellipse cx="32" cy="20" rx="14" ry="6" fill="#2b2d42"/><circle cx="47" cy="16" r="9" fill="#ffc93c" stroke="#11131f" stroke-width="3"/><path d="M47 11v6M47 20v1" stroke="#11131f" stroke-width="3" stroke-linecap="round"/></svg>`;
  collectorEl.hidden = false;
  gv.audio.play('pickup', { pitch: 1.3 });
}
function hideCollector() {
  collectorEl.hidden = true;
  collectorLeft = 0;
  collectorIn = E.collectorDelay(s, rng.next());
}
function seizeCollector() {
  if (collectorEl.hidden || !gv.playing) return;
  s.collectors++;
  if (s.collectors >= 10) gv.unlock('collectionneur');
  const roll = rng.next();
  fx.burstAt(collectorEl, { count: 30, colors: ['#ffc93c', '#fff3c4', '#ff5a4e'], speed: [150, 420], size: [3, 7], gravity: 600, shape: 'star', life: [0.5, 1] });
  if (roll < 0.5) {
    const v = Math.max(income() * 90, E.paintingValue(s, E.RARITIES[0], s.runStyle) * 4);
    earn(v);
    fx.popupAt(collectorEl, `Achat comptant +${fmt(v)}`, { size: 26, color: '#ffc93c', rise: 50 });
    gv.audio.play('coin');
  } else if (roll < 0.75) {
    buffs.inspiration = time + 15;
    fx.popupAt(collectorEl, 'Inspiration : pinceau ×5 !', { size: 26, color: '#4cc3ff', rise: 50 });
    gv.audio.play('powerup');
  } else {
    buffs.frenesie = time + 30;
    fx.popupAt(collectorEl, 'Ruée des acheteurs : revenus ×3 !', { size: 26, color: '#3ee6a8', rise: 50 });
    gv.audio.play('powerup');
  }
  hideCollector();
  renderBuffs();
}

// ---------- Achats ----------
function buyAssistant(id) {
  const a = E.ASSISTANTS.find((x) => x.id === id);
  const owned = s.assistants[id] ?? 0;
  const n = qty === 'max' ? E.maxAffordable(a, owned, s.money) : qty;
  const cost = E.bulkCost(a, owned, n);
  if (n <= 0 || cost > s.money) return deny(id);
  s.money -= cost;
  s.assistants[id] = owned + n;
  const crossed = E.MILESTONES.filter((m) => owned < m && owned + n >= m);
  gv.audio.play(crossed.length ? 'combo' : 'place', { pitch: 1.1 });
  if (crossed.length) toast({ title: `${a.name} : palier ${crossed.at(-1)}`, text: 'Production doublée !', iconName: 'sparkle', tone: 'var(--mint)', duration: 2400 });
  if (id === 'musee') gv.unlock('musee');
  afterPurchase(id);
}
function buyTool(id) {
  const t = E.TOOLS.find((x) => x.id === id);
  const lvl = s.tools[id] ?? 0;
  const cost = E.toolCost(t, lvl);
  if (lvl >= t.max || cost > s.money) return deny(id);
  s.money -= cost;
  s.tools[id] = lvl + 1;
  gv.audio.play('powerup');
  afterPurchase(id);
}
function buyPatron(id) {
  const p = E.PATRONS.find((x) => x.id === id);
  const lvl = s.patrons[id] ?? 0;
  const cost = E.patronCost(p, lvl);
  if (lvl >= p.max || cost > s.tokens) return deny(id);
  s.tokens -= cost;
  s.patrons[id] = lvl + 1;
  gv.audio.play('achievement');
  afterPurchase(id);
}
function deny(id) {
  wiggle(listEl.querySelector(`[data-buy="${id}"]`), { amount: 5 });
  gv.audio.play('error');
}
function afterPurchase(id) {
  const btn = listEl.querySelector(`[data-buy="${id}"]`);
  renderList();
  const fresh = listEl.querySelector(`[data-buy="${id}"]`) ?? btn;
  if (fresh) {
    squash(fresh.closest('.pe-item') ?? fresh, { scaleX: 1.03, scaleY: 0.97, duration: 180 });
    fx.burstAt(fresh, { count: 10, colors: ['#3ee6a8', '#ffc93c'], speed: [80, 220], size: [2, 4], gravity: 300, shape: 'spark', life: [0.3, 0.6] });
    fresh.focus({ preventScroll: true });
  }
  renderPurse();
  save();
}

// ---------- Exposition (prestige) ----------
function askExpo() {
  const gain = E.renownFor(s.runEarned);
  if (gain < 1 || !gv.playing) return;
  openDialog(
    'Organiser une exposition ?',
    `<p class="pe-dlg-lead">Ta rétrospective rapporte <b>+${formatInt(gain)} ★ de renommée</b> et <b>${formatInt(gain)} jeton${gain > 1 ? 's' : ''}</b> de mécène.</p>
     <ul class="pe-dlg-list">
       <li>${icon('check')}Tu gardes : renommée (+${formatInt(Math.round(E.RENOWN_BONUS * 100))} % de revenus par étoile), jetons, mécènes, réputation, quartiers, contrats, galerie et chefs-d’œuvre.</li>
       <li>${icon('restart')}Tu repars de ton garage : argent, assistants, matériel, mouvements, bâtiments, stock. Les commandes en cours sont annulées sans pénalité.</li>
     </ul>
     <div class="pe-dlg-actions"><button class="btn btn--ghost" type="button" data-close>Pas encore</button><button class="btn btn--primary" type="button" data-expo>${icon('starFill')}Exposer</button></div>`,
  );
}
function doExpo() {
  const gain = E.renownFor(s.runEarned);
  if (gain < 1) return;
  closeDialog();
  s.renown += gain;
  s.tokens += gain;
  s.expos++;
  gv.unlock('exposition');
  if (s.renown >= 25) gv.unlock('renommee-25');
  report({ xp: Math.min(400, 40 + gain * 10), expo: 1, renown: gain });
  Object.assign(s, { money: E.startMoney(s), runEarned: 0, runSold: 0, runMasterpieces: 0, runStyle: 0, assistants: {}, tools: {} });
  town.afterExpo();
  buffs.inspiration = 0;
  buffs.frenesie = 0;
  newPainting();
  gv.banner(`Exposition réussie : +${gain} ★`, { color: '#ffc93c' });
  gv.audio.play('levelUp');
  fx.burstAt(canvasBtn, { count: 70, colors: ['#ffc93c', '#ff8a5b', '#4cc3ff', '#3ee6a8', '#a68bff'], speed: [200, 600], size: [3, 8], gravity: 700, shape: 'star', life: [0.6, 1.3] });
  if (s.expos === 1) toast({ title: 'Les mécènes s’intéressent à toi', text: 'Dépense tes jetons dans l’onglet Mécènes.', iconName: 'crown', tone: 'var(--coin)' });
  gv.hud('renown', `${formatInt(s.renown)} ★`, true);
  renderAll();
  save();
}

// ---------- Hors ligne ----------
function handleGap(ms) {
  if (ms < OFFLINE_MIN_MS) {
    earn(income() * (ms / 1000));
    return;
  }
  town.offline(Math.min(ms, E.offlineCapMs(s)));
  const off = E.offlineGain(s, ms);
  if (off.gain <= 0) return;
  s.offlineBest = Math.max(s.offlineBest, off.ms);
  if (off.ms >= 8 * 3600e3) gv.unlock('insomniaque');
  openDialog(
    'Bon retour à l’atelier',
    `<p class="pe-dlg-lead">Pendant ton absence (${esc(formatDuration(off.ms))}${off.capped ? ', plafond atteint' : ''}), tes assistants ont gagné</p>
     <p class="pe-dlg-big">${esc(fmt(off.gain))}</p>
     <p class="pe-dlg-note">${formatInt(Math.round(E.offlineRate(s) * 100))} % de ton revenu habituel, jusqu’à ${formatInt(E.offlineCapMs(s) / 3600e3)} h d’absence. Les mécènes peuvent améliorer les deux.${s.orders.active.length ? ' Tes commandes en cours t’ont attendu.' : ''}</p>
     <div class="pe-dlg-actions"><button class="btn btn--primary" type="button" data-collect>${icon('coin')}Encaisser</button></div>`,
    () => collectOffline(off.gain),
  );
}
let pendingOffline = null;
function collectOffline(gain) {
  if (pendingOffline === null) return;
  pendingOffline = null;
  earn(gain);
  fx.popupAt(moneyEl, `+${fmt(gain)}`, { size: 34, color: '#ffc93c', rise: 50 });
  gv.audio.play('coin');
  renderAll();
  save();
}

// ---------- Boîte de dialogue ----------
let onDialogClose = null;
function openDialog(title, html, onClose = null) {
  $('dlgTitle').textContent = title;
  $('dlgBody').innerHTML = html;
  onDialogClose = onClose;
  if (onClose) pendingOffline = true;
  if (!dlg.open) dlg.showModal();
}
function closeDialog() {
  if (dlg.open) dlg.close();
}
dlg.addEventListener('close', () => {
  const fn = onDialogClose;
  onDialogClose = null;
  fn?.();
});
// Échap ferme la boîte de dialogue, sans mettre le jeu en pause
dlg.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') e.stopPropagation();
});
dlg.addEventListener('click', (e) => {
  if (e.target.closest('[data-collect]')) {
    // Encaissé tout de suite (l'évènement « close » n'arrive qu'après coup)
    const fn = onDialogClose;
    onDialogClose = null;
    fn?.();
    closeDialog();
  } else if (e.target.closest('[data-close]')) closeDialog();
  else if (e.target.closest('[data-expo]')) doExpo();
});

// ---------- Rendu ----------
function renderPurse() {
  moneyEl.textContent = fmt(s.money);
  const inc = income();
  rateEl.innerHTML = `${esc(fmtRate(inc))} par seconde${buffs.frenesie > time ? ' <b>×3</b>' : ''}${s.renown ? ` · ${icon('starFill')} +${formatInt(Math.round(s.renown * E.RENOWN_BONUS * 100))} %` : ''}`;
}

function renderCaption() {
  const c = s.current;
  captionEl.innerHTML = `« ${esc(paintingTitle(c.seed))} » · ${esc(styleOf(c.style).name)} · n°${formatInt(c.n)}`;
}

function renderBuffs() {
  const out = [];
  if (buffs.inspiration > time) out.push(`<span class="pe-buff pe-buff--ins">${icon('sparkle')}Inspiration ×5 · ${Math.ceil(buffs.inspiration - time)} s</span>`);
  if (buffs.frenesie > time) out.push(`<span class="pe-buff pe-buff--fre">${icon('flame')}Revenus ×3 · ${Math.ceil(buffs.frenesie - time)} s</span>`);
  buffsEl.innerHTML = out.join('');
}

function renderGallery(fresh = false) {
  if (!s.gallery.length) {
    galleryEl.innerHTML = '<p class="pe-empty">Ta galerie est vide. Peins ta première toile !</p>';
    return;
  }
  galleryEl.innerHTML = s.gallery
    .slice(0, 8)
    .map((g, i) => `<button type="button" class="pe-thumb ${fresh && i === 0 ? 'is-new' : ''}" data-rarity="${g.rarity}" data-g="${i}" aria-label="${esc(`« ${paintingTitle(g.seed)} », ${rarityOf(g.rarity).name}, vendue ${fmt(g.value)}`)}"><canvas width="96" height="72"></canvas></button>`)
    .join('');
  galleryEl.querySelectorAll('canvas').forEach((cv, i) => {
    const g = s.gallery[i];
    const c2 = cv.getContext('2d');
    c2.scale(96 / W, 72 / H);
    drawPainting(c2, W, H, { style: styleOf(g.style).id, seed: g.seed });
  });
}

function viewPainting(g) {
  const r = rarityOf(g.rarity);
  openDialog(
    `« ${paintingTitle(g.seed)} »`,
    `<div class="pe-view" data-rarity="${g.rarity}"><canvas width="${W * 2}" height="${H * 2}"></canvas></div>
     <p class="pe-dlg-lead"><b style="color:${r.color}">${esc(r.name)}</b> · ${esc(styleOf(g.style).name)} · n°${formatInt(g.n)} · ${g.to === 'order' ? 'livrée à un client' : g.to === 'contract' ? `pour une galerie, ${esc(fmt(g.value))}` : g.to === 'stock' ? 'mise en réserve' : `vendue ${esc(fmt(g.value))}`}</p>
     <p class="pe-dlg-note">${formatInt(s.masterpieces)} chef${s.masterpieces > 1 ? 's' : ''}-d’œuvre peint${s.masterpieces > 1 ? 's' : ''} au total.</p>
     <div class="pe-dlg-actions"><button class="btn btn--ghost" type="button" data-close>Fermer</button></div>`,
  );
  const cv = $('dlgBody').querySelector('canvas');
  const c2 = cv.getContext('2d');
  c2.scale(2, 2);
  drawPainting(c2, W, H, { style: styleOf(g.style).id, seed: g.seed });
}

// Construit une fois, puis mis à jour en place : le bouton n'est jamais remplacé sous le doigt
expoEl.innerHTML = `
  <div class="pe-expo__top">
    <span class="pe-expo__title">${icon('starFill')}Exposition</span>
    <button class="btn btn--sm btn--ghost" type="button" data-act="expo" disabled>Pas encore prêt</button>
  </div>
  <div class="meter pe-expo__meter"><span class="meter__fill"></span></div>
  <p class="pe-expo__hint"></p>`;
const expoBtn = expoEl.querySelector('[data-act="expo"]');
const expoMeter = expoEl.querySelector('.meter');
const expoHint = expoEl.querySelector('.pe-expo__hint');
const setText = (el, t) => el.textContent !== t && (el.textContent = t);

function renderExpo() {
  const gain = E.renownFor(s.runEarned);
  const target = E.nextRenownAt(s.runEarned);
  const prev = gain ? gain ** 2 * 1e6 : 0;
  const k = clamp((s.runEarned - prev) / (target - prev));
  expoBtn.disabled = !gain;
  expoBtn.classList.toggle('btn--primary', !!gain);
  expoBtn.classList.toggle('btn--ghost', !gain);
  setText(expoBtn, gain ? `Exposer · +${formatInt(gain)} ★` : 'Pas encore prêt');
  expoMeter.style.setProperty('--value', k.toFixed(3));
  const hint = gain ? `Prochaine étoile à ${fmt(target)} gagnés.` : `Gagne ${fmt(target)} depuis la dernière exposition pour ta première étoile.`;
  setText(expoHint, s.renown ? `${hint} Renommée : ${formatInt(s.renown)} ★` : hint);
}

function rowsAssistants() {
  const highest = E.ASSISTANTS.reduce((k, a, i) => ((s.assistants[a.id] ?? 0) > 0 || s.runEarned >= a.base * 0.5 ? i : k), 0);
  return E.ASSISTANTS.slice(0, highest + 2)
    .map((a, i) => {
      const owned = s.assistants[a.id] ?? 0;
      const hidden = i > highest;
      if (hidden) return `<div class="pe-item is-mystery"><span class="pe-badge">?</span><div class="pe-item__body"><b>???</b><small>Gagne un peu plus pour découvrir ce talent.</small></div></div>`;
      const n = qty === 'max' ? Math.max(1, E.maxAffordable(a, owned, s.money)) : qty;
      const cost = E.bulkCost(a, owned, n);
      const each = E.assistantRate(a, 1, s.renown) * E.milestoneMult(owned);
      const nm = E.nextMilestone(owned);
      const prevM = [...E.MILESTONES].reverse().find((m) => m <= owned) ?? 0;
      const mk = nm ? (owned - prevM) / (nm - prevM) : 1;
      return `<div class="pe-item">
        <span class="pe-badge" style="--h:${i * 42}">${esc(a.name[0])}<em>${formatInt(owned)}</em></span>
        <div class="pe-item__body">
          <b>${esc(a.name)}</b>
          <small>${esc(a.desc)}</small>
          <small class="pe-item__rate">${esc(fmtRate(each))}/s chacun${owned ? ` · total ${esc(fmtRate(E.assistantRate(a, owned, s.renown)))}/s` : ''}</small>
          ${nm ? `<span class="pe-mile" title="Palier ${nm} : production ×2"><i style="width:${(mk * 100).toFixed(0)}%"></i><span>Palier ${nm} · ×2</span></span>` : ''}
        </div>
        <button class="pe-buy" type="button" data-buy="${a.id}" data-kind="assistant" data-cost="${cost}">${qty === 'max' || qty > 1 ? `<small>×${formatInt(n)}</small>` : ''}${esc(fmt(cost))}</button>
      </div>`;
    })
    .join('');
}

function rowsTools() {
  return E.TOOLS.map((t) => {
    const lvl = s.tools[t.id] ?? 0;
    const maxed = lvl >= t.max;
    const cost = E.toolCost(t, lvl);
    return `<div class="pe-item">
      <span class="pe-badge pe-badge--tool">${icon({ pinceaux: 'sparkle', pigments: 'palette', toiles: 'image', chevalet: 'clock' }[t.id])}<em>${lvl}</em></span>
      <div class="pe-item__body"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small><small class="pe-item__rate">Niveau ${lvl} / ${t.max}</small></div>
      <button class="pe-buy" type="button" data-buy="${t.id}" data-kind="tool" data-cost="${maxed ? '' : cost}" ${maxed ? 'disabled' : ''}>${maxed ? 'Au max' : esc(fmt(cost))}</button>
    </div>`;
  }).join('');
}

function rowsPatrons() {
  if (!s.expos) return `<div class="pe-locked">${icon('lock')}<p>Les mécènes ne s’intéressent qu’aux artistes exposés. Organise ta première exposition pour les rencontrer.</p></div>`;
  return `<p class="pe-tokens">${icon('crown')}${formatInt(s.tokens)} jeton${s.tokens > 1 ? 's' : ''} de mécène</p>${E.PATRONS.map((p) => {
    const lvl = s.patrons[p.id] ?? 0;
    const maxed = lvl >= p.max;
    const cost = E.patronCost(p, lvl);
    return `<div class="pe-item">
      <span class="pe-badge pe-badge--patron">${icon('crown')}<em>${lvl}</em></span>
      <div class="pe-item__body"><b>${esc(p.name)}</b><small>${esc(p.desc)}</small><small class="pe-item__rate">Niveau ${lvl} / ${p.max}</small></div>
      <button class="pe-buy" type="button" data-buy="${p.id}" data-kind="patron" data-cost="${maxed ? '' : cost}" data-token ${maxed ? 'disabled' : ''}>${maxed ? 'Au max' : `${formatInt(cost)} ${icon('crown')}`}</button>
    </div>`;
  }).join('')}`;
}

function renderList() {
  const scroll = listEl.scrollTop;
  listEl.innerHTML = tab === 'assistants' ? rowsAssistants() : tab === 'tools' ? rowsTools() : rowsPatrons();
  listEl.scrollTop = scroll;
  document.querySelector('.pe-qty').hidden = tab !== 'assistants';
  refreshAffordable();
}

// Mise à jour légère, plusieurs fois par seconde : ce qu'on peut se payer
function refreshAffordable() {
  for (const b of listEl.querySelectorAll('[data-buy]')) {
    if (b.dataset.cost === '') continue;
    const cost = Number(b.dataset.cost);
    const can = b.hasAttribute('data-token') ? s.tokens >= cost : s.money >= cost;
    b.classList.toggle('is-ok', can);
    b.setAttribute('aria-disabled', String(!can));
  }
}

function renderAll() {
  renderPurse();
  renderExpo();
  renderList();
  renderGallery();
  renderBuffs();
  renderEasel();
  town.refresh(true);
  gv.hud('renown', `${formatInt(s.renown)} ★`);
  gv.hud('best', formatShort(s.totalEarned));
}

// ---------- Chevalet : style, format, couleur dominante ----------
function renderEasel() {
  const st = s.easel;
  const styles = E.STYLES.slice(0, s.runStyle + 1);
  easelCtlEl.innerHTML = `
    <label class="pe-ctl"><span>Style</span>
      <select data-easel="style">
        <option value="" ${st.style === null ? 'selected' : ''}>Le dernier (${esc(styleOf(s.runStyle).name)})</option>
        ${styles.map((x, i) => `<option value="${i}" ${st.style === i ? 'selected' : ''}>${esc(x.name)} · ×${String(x.mult).replace('.', ',')}</option>`).join('')}
      </select></label>
    <span class="pe-ctl"><span id="pe-fmt-label">Format</span>
      <span class="pe-seg" role="radiogroup" aria-labelledby="pe-fmt-label">${E.FORMATS.map((f) => `<button type="button" role="radio" data-format="${f.id}" aria-checked="${st.format === f.id}" title="${esc(`${f.name} : ${f.strokes} coups, valeur ×${String(f.mult).replace('.', ',')}`)}">${esc(f.name)}</button>`).join('')}</span></span>
    <span class="pe-ctl"><span id="pe-fam-label">Couleur</span>
      <span class="pe-swatches" role="radiogroup" aria-labelledby="pe-fam-label">
        <button type="button" role="radio" class="pe-sw pe-sw--free" data-family="" aria-checked="${st.family === null}" aria-label="Libre" title="Libre"></button>
        ${E.FAMILIES.map((f) => `<button type="button" role="radio" class="pe-sw" data-family="${f.id}" style="--sw:${f.swatch}" aria-checked="${st.family === f.id}" aria-label="${esc(f.name)}" title="${esc(f.name)}"></button>`).join('')}
      </span></span>`;
}
// Un réglage changé s'applique tout de suite si la toile n'est pas commencée
function applyEasel() {
  if (s.current.done === 0) newPainting(0, { keepN: true });
  renderEasel();
  renderCaption();
}
easelCtlEl.addEventListener('change', (e) => {
  if (e.target.dataset.easel === 'style') {
    s.easel.style = e.target.value === '' ? null : Number(e.target.value);
    applyEasel();
  }
});
easelCtlEl.addEventListener('click', (e) => {
  const f = e.target.closest('[data-format]');
  const c = e.target.closest('[data-family]');
  if (f) s.easel.format = f.dataset.format;
  else if (c) s.easel.family = c.dataset.family || null;
  else return;
  gv.audio.play('select');
  applyEasel();
  easelCtlEl.querySelector(f ? `[data-format="${s.easel.format}"]` : `[data-family="${s.easel.family ?? ''}"]`)?.focus();
});

// ---------- Vues : atelier et ville ----------
let view = 'atelier';
function setView(v) {
  view = v;
  paneAtelier.hidden = v !== 'atelier';
  paneVille.hidden = v !== 'ville';
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  wrapEl.dataset.view = v;
  if (v === 'ville') town.renderMap();
  town.refresh(true);
  gv.audio.play('select');
}
document.querySelector('.pe-switch').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (b) setView(b.dataset.view);
});

// Message discret sous l'en-tête (pas de notification qui masquerait le jeu)
let noticeTimer = 0;
function notify(text) {
  noticeEl.textContent = text;
  noticeEl.classList.add('is-on');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => noticeEl.classList.remove('is-on'), 4200);
}

const town = createTown({
  s,
  gv,
  fx,
  rng,
  earn,
  save: () => save(),
  report,
  notify,
  els: { strip: $('strip'), map: $('map'), board: $('board') },
  view: () => view,
  narrow: () => innerWidth < 860,
  showVille: () => setView('ville'),
  onChange: () => {
    villeDot.hidden = !s.orders.offers.length;
    villeDot.textContent = s.orders.offers.length || '';
  },
});

// ---------- Évènements ----------
canvasBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const r = gv.stage.getBoundingClientRect();
  paint(e.clientX - r.left, e.clientY - r.top);
});
// Clavier : Entrée / Espace sur le bouton de la toile
canvasBtn.addEventListener('click', (e) => {
  if (e.detail === 0) paint();
});
window.addEventListener('keydown', (e) => {
  if (!gv.playing || e.repeat || dlg.open) return;
  if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    paint();
  }
});
collectorEl.addEventListener('click', seizeCollector);
galleryEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-g]');
  if (b) viewPainting(s.gallery[Number(b.dataset.g)]);
});
expoEl.addEventListener('click', (e) => {
  if (e.target.closest('[data-act="expo"]')) askExpo();
});
listEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-buy]');
  if (!b || b.disabled || !gv.playing) return;
  const kind = b.dataset.kind;
  if (kind === 'assistant') buyAssistant(b.dataset.buy);
  else if (kind === 'tool') buyTool(b.dataset.buy);
  else buyPatron(b.dataset.buy);
});
document.querySelector('.pe-tabs').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  const q = e.target.closest('[data-qty]');
  if (t) {
    tab = t.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    listEl.scrollTop = 0;
    renderList();
    gv.audio.play('select');
  } else if (q) {
    qty = q.dataset.qty === 'max' ? 'max' : Number(q.dataset.qty);
    document.querySelectorAll('[data-qty]').forEach((x) => x.setAttribute('aria-pressed', String(x === q)));
    renderList();
    gv.audio.play('select');
  }
});

// ---------- Sauvegarde ----------
function save() {
  s.lastSeen = Date.now();
  store.save();
  submitFortune();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});
window.addEventListener('pagehide', save);

// ---------- Boucle ----------
let assistantsShown = -1;
function update(dt) {
  const now = Date.now();
  const gap = now - lastWall;
  lastWall = now;
  if (deferred && performance.now() >= holdUntil) preparePainting();
  if (!gv.playing) return;
  // Onglet en arrière-plan : le temps réel écoulé est crédité au retour
  if (gap > 2000) handleGap(gap);
  time += dt;
  earn(income() * dt);
  town.tick(dt);
  autoAcc += E.autoStrokes(s) * dt;
  if (autoAcc >= 1) {
    const k = Math.floor(autoAcc);
    autoAcc -= k;
    addStrokes(k);
  }
  if (collectorLeft > 0) {
    collectorLeft -= dt;
    if (collectorLeft <= 0) hideCollector();
  } else {
    collectorIn -= dt;
    if (collectorIn <= 0) showCollector();
  }
  uiAcc += dt;
  if (uiAcc >= 0.1) {
    uiAcc = 0;
    renderPurse();
    refreshAffordable();
    town.refresh();
    if (buffs.inspiration || buffs.frenesie) renderBuffs();
    // De nouveaux talents se dévoilent quand la fortune grimpe
    const shown = E.ASSISTANTS.reduce((k, a, i) => ((s.assistants[a.id] ?? 0) > 0 || s.runEarned >= a.base * 0.5 ? i : k), 0);
    if (tab === 'assistants' && shown !== assistantsShown) {
      assistantsShown = shown;
      renderList();
    }
    renderExpo();
  }
  hudAcc += dt;
  if (hudAcc >= 1) {
    hudAcc = 0;
    gv.hud('best', formatShort(s.totalEarned));
  }
  saveAcc += dt;
  if (saveAcc >= 5) {
    saveAcc = 0;
    save();
  }
}

const loop = createLoop({
  update,
  onAutoPause() {
    save();
  },
});

// ---------- Ouverture ----------
let opened = false;
function openStudio() {
  lastWall = Date.now();
  if (!opened) {
    opened = true;
    const away = s.lastSeen ? Date.now() - s.lastSeen : 0;
    if (away >= OFFLINE_MIN_MS && E.incomePerSecond(s) > 0) handleGap(away);
  }
  canvasBtn.focus({ preventScroll: true });
}

window.__pe = {
  get state() { return s; },
  get buffs() { return buffs; },
  get time() { return time; },
  paint: (n = 1) => { for (let i = 0; i < n; i++) paint(); },
  earn: (v) => earn(v),
  showCollector,
  town,
  setView,
  // Avance le temps de la ville (tests) sans attendre
  advance(sec) {
    for (let t = 0; t < sec; t += 0.5) town.tick(Math.min(0.5, sec - t));
    town.refresh(true);
  },
};

if (!s.current) newPainting();
else preparePainting();
renderAll();
wrapEl.classList.add('is-ready');
submitFortune();
loop.start();
gv.showStart();

if (s.legacy && !s.legacyNoticed) {
  s.legacyNoticed = true;
  store.save();
  toast({ title: 'Progression reprise', text: `Ta fortune (${fmt(s.legacy.totalEarnings || s.legacy.money)}) et tes ${formatInt(s.legacy.sold)} toiles vendues de l’ancien Paint Empire sont conservées.`, iconName: 'download', tone: 'var(--mint)' });
}
