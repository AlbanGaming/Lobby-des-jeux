// Le Potager — sème, arrose, récolte, vends au marché ou livre les commandes. Les saisons tournent :
// hors saison, ça pousse lentement mais ça se vend cher. Agrandis le potager, adopte des poules,
// installe arroseur, étal, serre et aide jardinier. Le jardin continue (au ralenti) sans toi.

import { bootGame } from '../../shared/js/gameverse.js';
import { createLoop } from '../../shared/js/engine/loop.js';
import { createFxLayer, wiggle, squash } from '../../shared/js/engine/fx.js';
import { formatInt, formatShort, formatDuration } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import * as G from './garden.js';
import { cropSVG, eggSVG, henSVG } from './art.js';

const params = new URLSearchParams(location.search);
const OFFLINE_MIN = 60; // secondes d'absence avant le résumé

const store = createStore('potager', {
  version: 1,
  defaults: { ...G.createState(), sel: 'radis', tab: 'semer' },
});
const s = store.data;

const $ = (id) => document.getElementById(id);
const els = { plots: $('plots'), season: $('season'), seasonBar: $('seasonBar'), lvl: $('lvl'), xpBar: $('xpBar'), coop: $('coop'), tabs: $('tabs'), panels: { semer: $('tab-semer'), marche: $('tab-marche'), ameliorer: $('tab-ameliorer') }, msg: $('msg'), dlg: $('dlg') };

const gv = bootGame('potager', {
  hud: [
    { id: 'coins', label: 'Pièces' },
    { id: 'level', label: 'Niveau' },
    { id: 'best', label: 'Fortune' },
  ],
  howTo: [
    { keys: ['icon:pointer', 'icon:touch'], text: 'Choisis une graine, touche une parcelle vide pour semer. Touche une pousse pour l’arroser : elle grandit plus vite.' },
    { keys: ['icon:coin'], text: 'Récolte ce qui est mûr, puis vends le panier au marché ou livre une commande, mieux payée.' },
    { keys: ['icon:calendar'], text: 'Les saisons tournent : hors saison, ça pousse lentement mais ça se vend 50 % plus cher.' },
    { keys: ['icon:clock'], text: 'Le potager continue sans toi, au ralenti, jusqu’à six heures d’absence.' },
  ],
  startLabel: 'Ouvrir le potager',
  formatScore: (n) => `${formatShort(n)} pièces`,
  onStart: openGarden,
  onPause: () => save(),
  onResume: () => {
    lastWall = Date.now();
  },
});
const fx = createFxLayer(gv.stage);

let lastWall = Date.now();
let focusIdx = 0;
let uiAcc = 0;
let saveAcc = 0;
const session = { harvests: 0, orders: 0, seasons: 0, coins: 0 };
let opened = false;

const rng = Math.random;
const today = () => new Date().toDateString();

// ---------- Ouverture et absence ----------
function openGarden() {
  if (opened) return;
  opened = true;
  const gap = (Date.now() - (s.lastSeen ?? Date.now())) / 1000;
  lastWall = Date.now();
  if (gap >= OFFLINE_MIN) {
    const coinsBefore = s.coins;
    const r = G.offline(s, gap, rng);
    session.coins += Math.max(0, s.coins - coinsBefore);
    showOffline(r);
  }
  renderAll();
  save();
}

function showOffline(r) {
  const lines = [];
  if (r.ripe) lines.push(`${r.ripe} parcelle${r.ripe > 1 ? 's' : ''} mûre${r.ripe > 1 ? 's' : ''} t’attend${r.ripe > 1 ? 'ent' : ''}`);
  if (r.harvests) lines.push(`${formatInt(r.harvests)} récoltes faites par ton aide`);
  if (r.eggs > 0) lines.push(`${formatInt(r.eggs)} œufs pondus`);
  if (r.coins > 0) lines.push(`${formatInt(r.coins)} pièces gagnées à l’étal`);
  if (r.seasons >= 4) lines.push('Une année entière est passée au jardin');
  else if (r.seasons) lines.push(`${r.seasons} changement${r.seasons > 1 ? 's' : ''} de saison`);
  if (!lines.length) lines.push('Tout a poussé tranquillement.');
  $('dlgBody').innerHTML = `<p class="pg-dlg-lead">Tu es parti ${esc(formatDuration(r.seconds * 1000))}${r.capped ? ' (au-delà de 6 h, le jardin s’est endormi)' : ''}.</p><ul class="pg-dlg-list">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p class="pg-dlg-note">Sans toi, tout pousse deux fois moins vite.</p>`;
  if (!els.dlg.open) els.dlg.showModal();
}
els.dlg.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]') || e.target === els.dlg) els.dlg.close();
});

// ---------- Actions ----------
function tapPlot(i) {
  if (!gv.playing) return;
  const pl = s.plots[i];
  const el = plotEl(i);
  if (!pl.crop) {
    const C = G.CROPS[s.sel];
    if (!C || C.level > s.level) return setMsg('Choisis une graine dans l’onglet Semer.', 'warn');
    if (!G.plant(s, i, s.sel)) {
      wiggle(el, { amount: 5 });
      gv.audio.play('error');
      return setMsg(`Il faut ${C.seed} pièces pour semer ${C.name.toLowerCase()}.`, 'warn');
    }
    gv.audio.play('place', { pitch: 1.2 });
    fx.burstAt(el, { count: 8, colors: ['#8a6440', '#5a3a1a'], speed: [30, 100], gravity: 300, size: [2, 3], shape: 'square', life: [0.2, 0.4] });
    setMsg(`${C.name} semé${C.name.endsWith('e') ? 'e' : ''}.`);
  } else if (pl.p >= 1) {
    harvestAt(i);
  } else if (!s.up.arroseur && pl.wet <= 0) {
    G.water(s, i);
    gv.audio.play('whoosh', { pitch: 1.6, volume: 0.4 });
    fx.burstAt(el, { count: 12, colors: ['#4cc3ff', '#bfe9ff'], speed: [40, 120], angle: -Math.PI / 2, spread: 1.6, gravity: 500, size: [2, 4], shape: 'circle', life: [0.3, 0.5] });
    setMsg('Arrosé : ça pousse plus vite pendant 45 s.');
  } else {
    wiggle(el, { amount: 3 });
    setMsg(`${G.CROPS[pl.crop].name} : ${Math.round(pl.p * 100)} %${G.inSeason(pl.crop, s) || s.up.serre ? '' : ', hors saison'}.`);
  }
  renderPlot(i);
  renderHud();
}

function harvestAt(i, auto = false) {
  const events = [];
  const crop = G.harvest(s, i, events);
  if (!crop) return;
  session.harvests++;
  const el = plotEl(i);
  if (!auto) {
    gv.audio.play('pop', { pitch: 1 + Math.random() * 0.3 });
    fx.burstAt(el, { count: 14, colors: [G.CROPS[crop].color, '#8ccf6a', '#ffffff'], speed: [60, 200], gravity: 400, size: [2, 5], shape: 'circle', life: [0.3, 0.6] });
    fx.popupAt(el, `+1 ${G.CROPS[crop].name.toLowerCase()}`, { size: 16, color: '#fff8ec', rise: 34 });
    squash(el);
  }
  gv.unlock('premiere-recolte');
  if (crop === 'potiron') gv.unlock('potiron');
  if (s.stats.harvests >= 100) gv.unlock('cent-recoltes');
  if (s.stats.harvests >= 1000) gv.unlock('mille-recoltes');
  handleEvents(events);
  if (session.harvests % 25 === 0) report(5);
}

function sellAll() {
  const before = s.coins;
  const r = G.sellAll(s);
  if (!r.count) return setMsg('Le panier est vide.', 'warn');
  session.coins += s.coins - before;
  gv.audio.play('coin');
  fx.popupAt($('sellBtn') ?? els.tabs, `+${formatInt(r.v)}`, { size: 26, color: '#ffc93c', rise: 44 });
  setMsg(`${r.count} produit${r.count > 1 ? 's' : ''} vendu${r.count > 1 ? 's' : ''} pour ${formatInt(r.v)} pièces.`, 'good');
  checkMoney();
  renderAll();
}

function deliver(k) {
  const o = s.orders[k];
  const events = [];
  if (!G.deliver(s, k, events)) return setMsg('Il manque des produits dans le panier.', 'warn');
  session.orders++;
  session.coins += o.reward;
  gv.audio.play('record');
  gv.banner('Commande livrée !', { color: '#ffc93c' });
  gv.unlock('commande');
  if (s.stats.orders >= 10) gv.unlock('dix-commandes');
  handleEvents(events);
  report(15);
  checkMoney();
  renderAll();
}

function buyPlot() {
  if (!G.buyPlot(s)) return setMsg('Pas assez de pièces pour une parcelle.', 'warn');
  gv.audio.play('powerup');
  if (s.plots.length >= G.MAX_PLOTS) gv.unlock('potager-complet');
  setMsg('Nouvelle parcelle !', 'good');
  renderAll();
  plotEl(s.plots.length - 1)?.classList.add('is-new');
}

function buyUpgrade(id) {
  const first = !s.up[id];
  if (!G.buyUpgrade(s, id)) return setMsg('Pas encore possible.', 'warn');
  gv.audio.play('achievement');
  gv.banner(G.UPGRADES[id].name, { color: '#3ee6a8' });
  if (id === 'poule' && first) gv.unlock('poulailler');
  if (id === 'serre') gv.unlock('serre');
  if (id === 'aide') gv.unlock('aide');
  renderAll();
}

function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'level') {
      gv.banner(`Niveau ${e.level}`, { color: '#ffc93c' });
      gv.audio.play('levelUp');
      const crops = Object.entries(G.CROPS).filter(([, c]) => c.level === e.level);
      const ups = Object.values(G.UPGRADES).filter((u) => u.level === e.level);
      const news = [...crops.map(([, c]) => c.name), ...ups.map((u) => u.name)];
      if (news.length) toast({ title: `Niveau ${e.level}`, text: `Nouveau : ${news.join(', ')}.`, iconName: 'sparkle', tone: 'var(--mint)' });
      report(10 + e.level * 5);
    } else if (e.type === 'season') {
      session.seasons++;
      document.body.dataset.season = e.season.id;
      gv.banner(e.season.name, { color: '#ffffff' });
      gv.audio.play('confirm');
      if (s.seasonsSeen >= 4) gv.unlock('annee');
      report(5);
    } else if (e.type === 'order') {
      gv.audio.play('pickup', { volume: 0.5 });
      if (s.tab !== 'marche') els.tabs.querySelector('[data-tab="marche"]').classList.add('is-ping');
    } else if (e.type === 'etal') {
      session.coins += e.v;
      fx.popupAt(els.tabs, `Étal +${formatInt(e.v)}`, { size: 18, color: '#ffc93c', rise: 30 });
      checkMoney();
    } else if (e.type === 'auto-harvest') {
      session.harvests++;
      if (s.stats.harvests >= 100) gv.unlock('cent-recoltes');
      if (s.stats.harvests >= 1000) gv.unlock('mille-recoltes');
    } else if (e.type === 'ripe') {
      plotEl(e.i)?.classList.add('is-ripe-pop');
    }
  }
}

function checkMoney() {
  if (s.total >= 10000) gv.unlock('riche');
}

function report(xp) {
  gv.meta.reportRun('potager', { score: 0, xp, stats: { harvest: session.harvests, orders: session.orders, seasons: session.seasons, coins: session.coins } });
  submitBest();
}
function submitBest() {
  gv.meta.submitBest('potager', Math.floor(s.total));
  gv.hud('best', formatShort(s.total));
}

// ---------- Rendu ----------
const plotEl = (i) => els.plots.children[i];
const stageOf = (pl) => (pl.p >= 1 ? 3 : pl.p >= 0.55 ? 2 : pl.p >= 0.15 ? 1 : 0);

function plotLabel(i) {
  const pl = s.plots[i];
  if (!pl.crop) return `Parcelle ${i + 1} : vide, semer ${G.CROPS[s.sel]?.name.toLowerCase() ?? ''}`;
  if (pl.p >= 1) return `Parcelle ${i + 1} : ${G.CROPS[pl.crop].name}, mûr, à récolter`;
  return `Parcelle ${i + 1} : ${G.CROPS[pl.crop].name}, ${Math.round(pl.p * 100)} %${pl.wet > 0 || s.up.arroseur ? ', arrosé' : ', à arroser'}`;
}

function renderPlots() {
  const side = Math.ceil(Math.sqrt(s.plots.length));
  els.plots.style.setProperty('--side', side);
  els.plots.innerHTML = s.plots.map((_, i) => `<button type="button" class="pg-plot" data-i="${i}" tabindex="${i === focusIdx ? 0 : -1}"></button>`).join('');
  s.plots.forEach((_, i) => renderPlot(i, true));
}
function renderPlot(i, force = false) {
  const el = plotEl(i);
  if (!el) return;
  const pl = s.plots[i];
  const stage = pl.crop ? stageOf(pl) : -1;
  const wet = pl.crop && pl.p < 1 && (pl.wet > 0 || s.up.arroseur);
  const key = `${pl.crop}|${stage}|${wet}`;
  if (force || el.dataset.key !== key) {
    el.dataset.key = key;
    el.className = `pg-plot${pl.crop ? '' : ' is-empty'}${stage === 3 ? ' is-ripe' : ''}${wet ? ' is-wet' : ''}${pl.crop && !(G.inSeason(pl.crop, s) || s.up.serre) ? ' is-off' : ''}`;
    el.innerHTML = pl.crop ? `${cropSVG(pl.crop, stage)}${wet ? '<i class="pg-drop" aria-hidden="true"></i>' : ''}` : `<span class="pg-plus" aria-hidden="true">+</span>`;
  }
  el.style.setProperty('--p', pl.crop ? pl.p : 0);
  el.setAttribute('aria-label', plotLabel(i));
}

function renderHud() {
  gv.hud('coins', formatShort(s.coins));
  gv.hud('level', s.level);
  const se = G.season(s);
  els.season.textContent = se.name;
  els.seasonBar.style.setProperty('--t', 1 - G.seasonLeft(s) / G.SEASON_LEN);
  els.seasonBar.title = `${se.name} : encore ${Math.ceil(G.seasonLeft(s))} s`;
  els.lvl.textContent = `Jardinier niv. ${s.level}`;
  els.xpBar.style.setProperty('--t', s.xp / G.xpNeeded(s));
  document.body.dataset.season = se.id;
  // Poulailler
  els.coop.hidden = !s.up.poule;
  if (s.up.poule) els.coop.innerHTML = `<span class="pg-hens">${Array.from({ length: s.up.poule }, () => henSVG).join('')}</span><span><b>${formatInt(s.eggs)}</b> œuf${s.eggs > 1 ? 's' : ''} · ${G.EGG_PRICE} pièces pièce</span>`;
}

function renderTabs() {
  els.tabs.querySelectorAll('[data-tab]').forEach((b) => {
    const on = b.dataset.tab === s.tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on) b.classList.remove('is-ping');
  });
  for (const [id, p] of Object.entries(els.panels)) p.hidden = id !== s.tab;
  if (s.tab === 'semer') renderSeeds();
  if (s.tab === 'marche') renderMarket();
  if (s.tab === 'ameliorer') renderUpgrades();
}

function renderSeeds() {
  els.panels.semer.innerHTML = `<div class="pg-seeds" role="radiogroup" aria-label="Graine à semer">${Object.entries(G.CROPS)
    .map(([id, c]) => {
      const open = c.level <= s.level;
      const ins = G.inSeason(id, s);
      return `<button type="button" role="radio" class="pg-seed ${ins ? 'is-in' : ''}" data-seed="${id}" aria-checked="${s.sel === id}" ${open ? '' : 'aria-disabled="true"'} title="${esc(open ? `${c.name} : ${c.grow} s, se vend ${G.priceOf(id, s)} pièces${ins ? ' (de saison)' : ' (hors saison, ×1,5)'}` : `${c.name} : niveau ${c.level}`)}">${open ? cropSVG(id, 3) : `<span class="pg-lock">${icon('lock')}</span>`}<span class="pg-seed__name">${esc(c.name)}</span><small>${open ? `${c.seed} → ${G.priceOf(id, s)}` : `niv. ${c.level}`}</small>${open && ins ? '<em>de saison</em>' : ''}</button>`;
    })
    .join('')}</div><p class="pg-note">De saison : pousse vite. Hors saison : lent, mais 50 % plus cher.</p>`;
}

function renderMarket() {
  const items = Object.entries(s.basket).filter(([, n]) => n > 0);
  const value = G.basketValue(s) + s.eggs * G.EGG_PRICE;
  els.panels.marche.innerHTML = `
    <div class="pg-basket">
      <h3>Panier</h3>
      ${items.length || s.eggs ? `<ul>${items.map(([c, n]) => `<li>${cropSVG(c, 3)}<span>${esc(G.CROPS[c].name)} × ${n}</span><b>${formatInt(G.priceOf(c, s) * n)}</b></li>`).join('')}${s.eggs ? `<li>${eggSVG}<span>Œufs × ${s.eggs}</span><b>${formatInt(s.eggs * G.EGG_PRICE)}</b></li>` : ''}</ul>` : '<p class="pg-note">Récolte des légumes pour remplir le panier.</p>'}
      <button type="button" class="btn btn--primary pg-sell" id="sellBtn" data-act="sell" ${value ? '' : 'disabled'}>${icon('coin')}Tout vendre · ${formatInt(value)}</button>
      ${s.up.etal ? `<p class="pg-note">L’étal vend tout seul dans ${Math.ceil(s.etalT)} s.</p>` : ''}
    </div>
    <div class="pg-orders">
      <h3>Commandes</h3>
      ${s.orders.length ? s.orders.map((o, k) => {
        const ok = G.canDeliver(s, o);
        return `<div class="pg-order ${ok ? 'is-ready' : ''}"><p class="pg-order__who">${esc(o.who)}</p><ul>${Object.entries(o.items).map(([c, n]) => `<li class="${(s.basket[c] ?? 0) >= n ? 'is-ok' : ''}">${cropSVG(c, 3)}${Math.min(s.basket[c] ?? 0, n)} / ${n}</li>`).join('')}</ul><button type="button" class="btn pg-deliver" data-deliver="${k}" ${ok ? '' : 'disabled'}>${icon('check')}Livrer · ${formatInt(o.reward)}</button></div>`;
      }).join('') : `<p class="pg-note">Une commande arrive dans ${Math.ceil(s.orderT)} s.</p>`}
    </div>`;
}

function renderUpgrades() {
  const pc = G.plotCost(s);
  const full = s.plots.length >= G.MAX_PLOTS;
  els.panels.ameliorer.innerHTML = `<div class="pg-ups">
    <button type="button" class="pg-up" data-act="plot" ${full ? 'disabled' : s.coins < pc ? 'aria-disabled="true"' : ''}><span class="pg-up__name">Nouvelle parcelle</span><small>${s.plots.length} / ${G.MAX_PLOTS} parcelles</small><b>${full ? 'Complet' : `${formatInt(pc)} pièces`}</b></button>
    ${Object.entries(G.UPGRADES).map(([id, u]) => {
      const lvl = s.up[id] ?? 0;
      const maxed = lvl >= u.max;
      const locked = u.level > s.level;
      const cost = G.upgradeCost(s, id);
      return `<button type="button" class="pg-up ${lvl ? 'is-owned' : ''}" data-up="${id}" ${maxed || locked ? 'disabled' : s.coins < cost ? 'aria-disabled="true"' : ''}><span class="pg-up__name">${locked ? icon('lock') : ''}${esc(u.name)}${u.max > 1 && lvl ? ` × ${lvl}` : ''}</span><small>${esc(locked ? `Niveau ${u.level} requis` : u.desc)}</small><b>${maxed ? 'Acquis' : locked ? `niv. ${u.level}` : `${formatInt(cost)} pièces`}</b></button>`;
    }).join('')}
  </div>`;
}

function renderAll() {
  if (els.plots.children.length !== s.plots.length) renderPlots();
  else s.plots.forEach((_, i) => renderPlot(i));
  renderHud();
  renderTabs();
  submitBest();
}

function setMsg(text, tone = '') {
  els.msg.textContent = text;
  els.msg.dataset.tone = tone;
}

// ---------- Saisie ----------
els.plots.addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  focusIdx = Number(b.dataset.i);
  tapPlot(focusIdx);
});
els.plots.addEventListener('keydown', (e) => {
  const side = Math.ceil(Math.sqrt(s.plots.length));
  const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -side, ArrowDown: side }[e.key];
  if (d === undefined) return;
  e.preventDefault();
  const n = focusIdx + d;
  if (n < 0 || n >= s.plots.length) return;
  plotEl(focusIdx).tabIndex = -1;
  focusIdx = n;
  plotEl(n).tabIndex = 0;
  plotEl(n).focus();
});
els.tabs.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  s.tab = b.dataset.tab;
  gv.audio.play('select', { volume: 0.5 });
  renderTabs();
});
els.tabs.addEventListener('keydown', (e) => {
  const order = ['semer', 'marche', 'ameliorer'];
  const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (!d) return;
  s.tab = order[(order.indexOf(s.tab) + d + 3) % 3];
  renderTabs();
  els.tabs.querySelector(`[data-tab="${s.tab}"]`).focus();
});
document.querySelector('.pg-panel').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.seed) {
    if (b.getAttribute('aria-disabled') === 'true') return setMsg(`${G.CROPS[b.dataset.seed].name} : atteins le niveau ${G.CROPS[b.dataset.seed].level}.`, 'warn');
    s.sel = b.dataset.seed;
    gv.audio.play('select', { volume: 0.5 });
    renderSeeds();
    els.panels.semer.querySelector(`[data-seed="${s.sel}"]`)?.focus();
    setMsg(`Graine choisie : ${G.CROPS[s.sel].name.toLowerCase()}. Touche une parcelle vide.`);
  } else if (b.dataset.act === 'sell') sellAll();
  else if (b.dataset.deliver !== undefined) deliver(Number(b.dataset.deliver));
  else if (b.dataset.act === 'plot') buyPlot();
  else if (b.dataset.up) buyUpgrade(b.dataset.up);
});

// ---------- Sauvegarde ----------
function save() {
  s.lastSeen = Date.now();
  store.save();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else lastWall = Date.now();
});
window.addEventListener('pagehide', save);

// ---------- Boucle ----------
function update() {
  if (!opened || !gv.playing) {
    lastWall = Date.now();
    return;
  }
  const now = Date.now();
  let dt = (now - lastWall) / 1000;
  lastWall = now;
  if (dt <= 0) return;
  // Onglet gelé longtemps : on compte comme une absence
  if (dt >= OFFLINE_MIN) {
    const before = s.coins;
    const r = G.offline(s, dt, rng);
    session.coins += Math.max(0, s.coins - before);
    showOffline(r);
    renderAll();
    return;
  }
  dt = Math.min(dt, 5) * (params.has('speed') ? Number(params.get('speed')) : 1);
  const events = G.tick(s, dt, rng);
  handleEvents(events);
  for (const e of events) if (e.type === 'order' && s.tab === 'marche') renderMarket();
  uiAcc += dt;
  if (uiAcc >= 0.25) {
    uiAcc = 0;
    s.plots.forEach((_, i) => renderPlot(i));
    renderHud();
    if (s.tab !== 'semer' && !document.activeElement?.closest?.('.pg-panel')) renderTabs();
  }
  saveAcc += dt;
  if (saveAcc >= 5) {
    saveAcc = 0;
    save();
  }
}
const loop = createLoop({ update, render() {}, onAutoPause: () => save() });

window.__pg = {
  get s() { return s; },
  get session() { return session; },
  G,
  tick: (sec) => {
    const ev = [];
    for (let k = 0; k < sec; k++) G.tick(s, 1, rng, ev);
    handleEvents(ev);
    renderAll();
  },
  setCoins(n) {
    s.coins = n;
    renderAll();
  },
};

if (motion.reduced) document.body.classList.add('is-reduced');
renderAll();
gv.hud('best', formatShort(s.total));
document.querySelector('.pg-wrap').classList.add('is-ready');
loop.start();
gv.showStart();
