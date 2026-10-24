// Paint Empire — la ville : clients et commandes, contrats de galeries, bâtiments, réputation,
// festivals, carte et tableau de commandes. main.js lui confie chaque toile terminée (route()).

import { formatShort, formatInt, formatDuration, clamp } from '../../shared/js/core/math.js';
import { esc, toast } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { squash } from '../../shared/js/engine/fx.js';
import * as E from './economy.js';
import * as O from './orders.js';
import { paintingFamily } from './art.js';
import { renderCity, bubbleSvg, spotInfo } from './city.js';

const MAX_OFFERS = 3;
const VEX_SECONDS = 300;
const FESTIVAL_EVERY = [480, 840];
const FESTIVAL_LENGTH = 120;

const fmt = (n) => `${formatShort(n)} €`;
const clock = (sec) => {
  const t = Math.max(0, Math.ceil(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const RARITY_LABEL = { belle: 'Belle toile ou mieux', remarquable: 'Remarquable ou mieux', chef: 'Chef-d’œuvre' };

export const TOWN_DEFAULTS = {
  rep: 0,
  districts: ['lilas'],
  buildings: {},
  stock: [],
  inventory: { pigment: 0, toile: 0, plan: 0 },
  autoAssign: true,
  orders: { offers: [], active: [], nextOffer: 10, first: true },
  loyal: [],
  vexed: {},
  contracts: [],
  proposals: {},
  galleryCold: {},
  trophies: 0,
  festival: { next: 600, left: 0 },
  ordersDone: 0,
  ordersFailed: 0,
  runOrders: 0,
  extremis: 0,
};

/**
 * ctx : { s, gv, fx, rng, earn, save, report, openDialog, closeDialog, els: { strip, map, board, viewBtn }, view() }
 */
export function createTown(ctx) {
  const { s, gv, fx, rng } = ctx;
  let assistAcc = 0;
  let tickSec = -1;
  let selected = null;
  let mapKey = '';
  let stripKey = '';
  let boardKey = '';

  const maxStyle = () => s.runStyle;
  const festivalOn = () => s.festival.left > 0;
  const blockedStyles = () => s.contracts.map((c) => c.style);
  const canGiant = () => E.atelierCount(s) >= 2 && (s.buildings.entrepot ?? 0) > 0;
  const clientsOpen = () => E.CLIENTS.filter((c) => c.kind !== 'galerie' && E.districtOpen(s, c.district));
  const activeSlots = () => E.orderSlots(s);

  // ---------- Commandes : offres ----------
  function spawnOffer({ clientId, type, steps } = {}) {
    if (s.orders.offers.length >= MAX_OFFERS && !clientId) return null;
    const busy = new Set([...s.orders.offers.map((o) => o.client), ...s.orders.active.map((o) => o.client)]);
    const pool = clientsOpen().filter((c) => !busy.has(c.id) && !(s.vexed[c.id] > 0));
    const client = clientId ? E.clientOf(clientId) : pool.length ? rng.weighted(pool.map((c) => ({ c, weight: s.loyal.includes(c.id) ? 2 : 1 }))).c : null;
    if (!client) return null;
    const offer = O.makeOffer(rng, client, { s, maxStyle: maxStyle(), blockedStyles: blockedStyles(), festival: festivalOn() && !type, loyal: new Set(s.loyal), canGiant: canGiant() }, type);
    if (steps) offer.steps = steps.map((st) => ({ delivered: 0, left: st.duration, ...st }));
    s.orders.offers.push(offer);
    gv.audio.play('pickup', { pitch: 1.5, volume: 0.7 });
    refresh();
    return offer;
  }

  function accept(id) {
    const i = s.orders.offers.findIndex((o) => o.id === id);
    if (i < 0) return false;
    const offer = s.orders.offers[i];
    if (s.orders.active.length >= activeSlots()) {
      ctx.notify(`Pas de place : ${activeSlots()} commande${activeSlots() > 1 ? 's' : ''} à la fois. Un nouvel atelier en ajoute une.`);
      gv.audio.play('error');
      return false;
    }
    if (offer.type === 'geante' && !canGiant()) {
      ctx.notify('Commande géante : il faut deux ateliers et l’entrepôt.');
      gv.audio.play('error');
      return false;
    }
    s.orders.offers.splice(i, 1);
    s.orders.active.push(offer);
    gv.audio.play('confirm');
    if (s.autoAssign) deliverFromStock(offer);
    refresh(true);
    ctx.save();
    return true;
  }

  function refuse(id) {
    s.orders.offers = s.orders.offers.filter((o) => o.id !== id);
    gv.audio.play('back');
    refresh(true);
  }

  // ---------- Toiles : attribution ----------
  /** Toile terminée (main ou assistant) : contrat, commande, stock… ou rien (vendue sur le marché). */
  function route(p, source) {
    const ct = s.contracts.find((c) => c.style === p.style);
    if (ct) {
      ct.delivered++;
      const premium = E.paintingValue(s, E.RARITIES.find((r) => r.id === p.rarity) ?? E.RARITIES[0], p.style, p.format) * (source === 'hand' ? 1.2 : 0.2);
      ctx.earn(premium);
      if (ct.delivered >= ct.volume) finishContract(ct, true);
      return { kind: 'contract', contract: ct, pay: premium };
    }
    if (s.autoAssign) {
      const order = matchOrder(p);
      if (order) return deliver(order, p);
    } else if (matchOrder(p) && s.stock.length < E.stockCapacity(s)) {
      s.stock.push(p);
      return { kind: 'stock' };
    }
    if (source === 'assistant' && s.stock.length < E.stockCapacity(s)) {
      s.stock.push(p);
      return { kind: 'stock' };
    }
    return null;
  }

  function matchOrder(p) {
    return [...s.orders.active]
      .sort((a, b) => a.steps[a.stage].left - b.steps[b.stage].left)
      .find((o) => {
        const st = o.steps[o.stage];
        return st.delivered < st.count && O.matches(p, st.c);
      });
  }

  function deliver(order, p) {
    const st = order.steps[order.stage];
    st.delivered++;
    const res = { kind: 'order', order, done: st.delivered, count: st.count };
    if (st.delivered >= st.count) completeStep(order);
    else refresh();
    return res;
  }

  function deliverFromStock(order) {
    let n = 0;
    for (let i = 0; i < s.stock.length && s.orders.active.includes(order); ) {
      const st = order.steps[order.stage];
      if (st.delivered < st.count && O.matches(s.stock[i], st.c)) {
        const [p] = s.stock.splice(i, 1);
        deliver(order, p);
        n++;
      } else i++;
    }
    if (n) fx.popupAt(cardOf(order.id) ?? ctx.els.strip, `${n} toile${n > 1 ? 's' : ''} du stock`, { size: 20, color: '#3ee6a8', rise: 30 });
    return n;
  }

  function completeStep(order) {
    const idx = order.stage;
    const st = order.steps[idx];
    const last = idx === order.steps.length - 1;
    const reward = O.stepReward(s, order, idx, maxStyle(), { festival: festivalOn() });
    const ratio = st.left / st.duration;
    const early = ratio > 0.5;
    const extremis = st.left <= Math.max(5, st.duration * 0.1);
    const money = reward.money * (early ? 1.25 : 1) * (extremis ? 1.1 : 1);
    ctx.earn(money);
    const client = E.clientOf(order.client);
    const card = cardOf(order.id) ?? ctx.els.strip;
    fx.popupAt(card, `+${fmt(money)}`, { size: 30, color: '#ffc93c', rise: 60 });
    fx.burstAt(card, { count: extremis ? 60 : 24, colors: ['#ffc93c', '#3ee6a8', '#fff3c4'], speed: [140, extremis ? 520 : 320], size: [3, 7], gravity: 600, shape: 'star', life: [0.5, 1.1] });
    if (!last) {
      order.stage++;
      gv.banner(`Étape ${idx + 1} / ${order.steps.length} livrée`, { color: '#3ee6a8' });
      gv.audio.play('combo');
      if (s.autoAssign) deliverFromStock(order);
      refresh(true);
      return;
    }
    s.orders.active = s.orders.active.filter((o) => o !== order);
    addRep(reward.rep);
    s.ordersDone++;
    s.runOrders++;
    ctx.report({ xp: 4 + Math.min(40, order.steps.reduce((n, x) => n + x.count, 0)) });
    gv.unlock('premiere-commande');
    if (s.ordersDone >= 50) gv.unlock('commandes-50');
    if (order.type === 'geante') gv.unlock('geante');
    if (order.type === 'chaine') gv.unlock('chaine');
    if (extremis) {
      s.extremis++;
      gv.unlock('in-extremis');
      gv.banner('In extremis !', { color: '#ff8a5b' });
      gv.audio.play('record');
      fx.addShake(0.45);
    } else {
      gv.banner(early ? 'En avance !' : 'Commande honorée', { color: early ? '#3ee6a8' : '#ffc93c' });
      gv.audio.play('win');
    }
    // Objet rare, client fidèle
    const item = O.rollItem(rng, order);
    if (item) {
      s.inventory[item] = (s.inventory[item] ?? 0) + 1;
      toast({ title: O.ITEMS[item].name, text: `Cadeau de ${client.name}`, iconName: 'sparkle', tone: 'var(--grape)' });
    }
    if (!s.loyal.includes(client.id) && s.rep >= 15 && rng.chance(0.2)) {
      s.loyal.push(client.id);
      gv.unlock('client-fidele');
      toast({ title: `${client.name} devient fidèle`, text: 'Ses commandes paieront 30 % de plus.', iconName: 'heartFill', tone: 'var(--coin)' });
    }
    ctx.save();
    refresh(true);
  }

  function fail(order) {
    const pen = O.failurePenalty(s, order, maxStyle());
    const client = E.clientOf(order.client);
    s.orders.active = s.orders.active.filter((o) => o !== order);
    s.money = Math.max(0, s.money - pen.money);
    s.rep = Math.max(0, s.rep - pen.rep);
    s.vexed[client.id] = pen.cooldown;
    s.ordersFailed++;
    gv.banner(`${client.name} est déçu·e`, { color: '#ff5a4e' });
    gv.audio.play('lose');
    fx.addShake(0.3);
    ctx.notify(`Commande ratée : −${formatInt(pen.rep)} de réputation${pen.money >= 1 ? `, −${fmt(pen.money)}` : ''}. ${client.name} ne reviendra pas tout de suite.`);
    ctx.save();
    refresh(true);
  }

  // ---------- Réputation, quartiers ----------
  function addRep(n) {
    if (!n) return;
    s.rep += n;
    if (s.rep >= 1200) gv.unlock('legende');
    for (const d of E.DISTRICTS) {
      if (s.rep >= d.rep && !s.districts.includes(d.id)) {
        s.districts.push(d.id);
        gv.banner(`Nouveau quartier : ${d.name}`, { color: '#ffc93c' });
        toast({ title: d.name, text: 'De nouveaux clients et de nouveaux bâtiments sur la carte.', iconName: 'home', tone: 'var(--mint)' });
        if (s.districts.length === E.DISTRICTS.length) gv.unlock('ville');
        mapKey = '';
      }
    }
  }

  // ---------- Bâtiments ----------
  function buildingCost(id) {
    const base = id === 'entrepot' ? E.warehouseCost(s.buildings.entrepot ?? 0) : E.ATELIERS.find((b) => b.id === id)?.cost ?? 0;
    return s.inventory.plan > 0 ? Math.ceil(base * 0.7) : base;
  }
  function buy(id) {
    const info = spotInfo(id);
    const district = info.building?.district;
    if (!E.districtOpen(s, district)) return false;
    if (id !== 'entrepot' && s.buildings[id]) return false;
    if (id === 'entrepot' && (s.buildings.entrepot ?? 0) >= E.WAREHOUSE.max) return false;
    const cost = buildingCost(id);
    if (s.money < cost) {
      gv.audio.play('error');
      ctx.notify(`Il manque ${fmt(cost - s.money)}.`);
      return false;
    }
    s.money -= cost;
    if (s.inventory.plan > 0) s.inventory.plan--;
    s.buildings[id] = id === 'entrepot' ? (s.buildings.entrepot ?? 0) + 1 : true;
    gv.audio.play('levelUp');
    gv.banner(id === 'entrepot' ? `Entrepôt niveau ${s.buildings.entrepot}` : `${info.name} ouvert !`, { color: '#ffc93c' });
    mapKey = '';
    ctx.save();
    refresh(true);
    const g = ctx.els.map.querySelector(`[data-b="${id}"]`);
    if (g) fx.burstAt(g, { count: 40, colors: ['#ffc93c', '#ff8a5b', '#3ee6a8'], speed: [150, 420], size: [3, 7], gravity: 600, shape: 'star', life: [0.5, 1] });
    return true;
  }

  // ---------- Contrats de galeries ----------
  const maxContracts = () => (s.rep >= 500 ? 2 : 1);
  function proposalFor(id) {
    const gal = E.clientOf(id);
    if (!gal || gal.kind !== 'galerie' || !E.districtOpen(s, gal.district)) return null;
    if (s.galleryCold[id] > 0 || s.contracts.some((c) => c.gallery === id)) return null;
    const p = s.proposals[id];
    if (p && p.style <= maxStyle()) return p;
    s.proposals[id] = O.makeContract(rng, gal, s, maxStyle());
    return s.proposals[id];
  }
  function sign(id) {
    const p = proposalFor(id);
    if (!p) return false;
    if (s.contracts.length >= maxContracts()) {
      ctx.notify(`Un seul contrat à la fois pour l’instant${s.rep < 500 ? ' (deux à 500 de réputation)' : ''}.`);
      gv.audio.play('error');
      return false;
    }
    if (s.contracts.some((c) => c.style === p.style)) {
      ctx.notify('Exclusivité : tu as déjà un contrat pour ce style.');
      gv.audio.play('error');
      return false;
    }
    s.contracts.push({ ...p });
    delete s.proposals[id];
    // Exclusivité : les offres qui demandent ce style disparaissent
    s.orders.offers = s.orders.offers.filter((o) => !o.steps.some((st) => st.c.style === p.style));
    gv.audio.play('achievement');
    gv.banner(`Contrat signé : ${E.clientOf(id).name}`, { color: '#ffc93c' });
    ctx.save();
    refresh(true);
    return true;
  }
  function breakContract(id) {
    const ct = s.contracts.find((c) => c.gallery === id);
    if (!ct) return;
    const pen = O.contractBreakPenalty(s);
    s.rep = Math.max(0, s.rep - pen.rep);
    s.galleryCold[id] = pen.cooldown;
    s.contracts = s.contracts.filter((c) => c !== ct);
    gv.banner('Contrat rompu', { color: '#ff5a4e' });
    gv.audio.play('lose');
    ctx.notify(`−${pen.rep} de réputation. ${E.clientOf(id).name} ne veut plus te voir pendant ${formatDuration(pen.cooldown * 1000)}.`);
    ctx.save();
    refresh(true);
  }
  function finishContract(ct, ok) {
    s.contracts = s.contracts.filter((c) => c !== ct);
    const gal = E.clientOf(ct.gallery);
    if (ok) {
      const r = O.contractReward(s, ct);
      ctx.earn(r.money);
      addRep(r.rep);
      s.trophies = Math.min(10, s.trophies + 1);
      gv.unlock('contrat');
      gv.banner(`Contrat rempli : ${gal.name}`, { color: '#ffc93c' });
      gv.audio.play('record');
      toast({ title: 'Trophée de galerie', text: `+${fmt(r.money)} et +2 % de revenus pour toujours.`, iconName: 'trophy', tone: 'var(--coin)' });
      ctx.report?.({ xp: 60 + ct.hours * 30, contract: 1 });
    } else {
      s.rep = Math.max(0, s.rep - 40);
      s.galleryCold[ct.gallery] = 1800;
      gv.banner(`Contrat manqué : ${gal.name}`, { color: '#ff5a4e' });
      gv.audio.play('lose');
      ctx.notify(`Volume non atteint (${formatInt(ct.delivered)} / ${formatInt(ct.volume)}) : −40 de réputation.`);
    }
    ctx.save();
    refresh(true);
  }

  // ---------- Temps ----------
  function tick(dt) {
    // Offres
    s.orders.nextOffer -= dt;
    if (s.orders.nextOffer <= 0) {
      if (s.orders.first && !festivalOn() && !s.orders.offers.length && !s.orders.active.length) {
        // Première commande, toute simple : la voisine veut deux petites toiles
        spawnOffer({ clientId: 'roux', type: 'normale', steps: [{ c: { format: 'petit' }, count: 2, duration: 180 }] });
        s.orders.first = false;
      } else spawnOffer();
      s.orders.nextOffer = festivalOn() ? 12 : rng.range(28, 55);
    }
    for (const o of s.orders.offers) o.expiresIn -= dt;
    const expired = s.orders.offers.filter((o) => o.expiresIn <= 0);
    if (expired.length) {
      s.orders.offers = s.orders.offers.filter((o) => o.expiresIn > 0);
      refresh(true);
    }
    // Commandes en cours : chrono, tension
    let urgent = Infinity;
    for (const o of [...s.orders.active]) {
      const st = o.steps[o.stage];
      st.left -= dt;
      urgent = Math.min(urgent, st.left);
      if (st.left <= 0) fail(o);
    }
    if (urgent <= 10) {
      const rate = urgent <= 5 ? 2 : 1;
      const k = Math.floor(urgent * rate);
      if (k !== tickSec) {
        tickSec = k;
        gv.audio.play('tick', { pitch: urgent <= 5 ? 1.5 : 1.2 });
      }
    }
    // Production des assistants : une par une, ou par lots quand l'atelier tourne à plein
    assistAcc += E.assistantPaintingRate(s) * dt;
    const made = Math.floor(assistAcc);
    assistAcc -= made;
    if (made > 20) produceBulk(made);
    else
      for (let i = 0; i < made; i++) {
        const p = { style: s.runStyle, format: 'moyen', family: paintingFamily(rng.int(1, 2 ** 31 - 1)), rarity: E.rollRarity(s, rng.next()).id };
        route(p, 'assistant');
      }
    // Contrats
    for (const ct of [...s.contracts]) {
      ct.elapsed += dt;
      if (ct.elapsed >= ct.total) finishContract(ct, ct.delivered >= ct.volume);
    }
    // Clients fâchés, galeries froides
    for (const k of Object.keys(s.vexed)) if ((s.vexed[k] -= dt) <= 0) delete s.vexed[k];
    for (const k of Object.keys(s.galleryCold)) if ((s.galleryCold[k] -= dt) <= 0) delete s.galleryCold[k];
    // Festival
    if (festivalOn()) {
      s.festival.left -= dt;
      if (s.festival.left <= 0) {
        s.festival.left = 0;
        s.festival.next = rng.range(...FESTIVAL_EVERY);
        mapKey = '';
      }
    } else if ((s.festival.next -= dt) <= 0) startFestival();
  }

  /** Beaucoup de toiles d'un coup : réparties selon la probabilité qu'elles conviennent. */
  function produceBulk(n) {
    const ct = s.contracts.find((c) => c.style === s.runStyle);
    if (ct) {
      // Exclusivité : tout le style du moment part à la galerie
      const k = Math.min(n, ct.volume - ct.delivered);
      ct.delivered += k;
      ctx.earn(E.paintingValue(s, E.RARITIES[0], ct.style) * 0.2 * k);
      if (ct.delivered >= ct.volume) finishContract(ct, true);
      return;
    }
    let left = n;
    if (s.autoAssign) {
      for (const o of [...s.orders.active].sort((a, b) => a.steps[a.stage].left - b.steps[b.stage].left)) {
        const st = o.steps[o.stage];
        const c = st.c;
        const styleOk = c.style === undefined || c.style === null || c.style === s.runStyle;
        const formatOk = !c.format || c.format === 'moyen';
        if (!styleOk || !formatOk) continue;
        const p = (c.family ? (c.family === 'rouge' || c.family === 'brume' ? 0.2 : 0.1) : 1) * O.pAtLeast(s, c.rarity);
        const k = Math.min(st.count - st.delivered, Math.round(left * p));
        if (k <= 0) continue;
        st.delivered += k;
        left -= k;
        if (st.delivered >= st.count) completeStep(o);
      }
    }
    const room = Math.min(left, E.stockCapacity(s) - s.stock.length);
    for (let i = 0; i < room; i++) s.stock.push({ style: s.runStyle, format: 'moyen', family: paintingFamily(rng.int(1, 2 ** 31 - 1)), rarity: E.rollRarity(s, rng.next()).id });
  }

  function startFestival() {
    s.festival.left = FESTIVAL_LENGTH;
    s.orders.nextOffer = 2;
    gv.banner('Festival des arts !', { color: '#ff8a5b' });
    gv.audio.play('powerup');
    toast({ title: 'Festival des arts', text: 'Commandes surprises, payées 50 % de plus, pendant 2 minutes.', iconName: 'sparkle', tone: 'var(--tomato)' });
    mapKey = '';
  }

  /** Absence : les commandes attendent (pas de pénalité), les contrats avancent avec les assistants. */
  function offline(ms) {
    const sec = ms / 1000;
    for (const ct of [...s.contracts]) {
      const made = ct.style === s.runStyle ? Math.floor(E.assistantPaintingRate(s) * sec * 0.5) : 0;
      ct.delivered = Math.min(ct.volume, ct.delivered + made);
      ct.elapsed += sec;
      if (ct.delivered >= ct.volume) finishContract(ct, true);
      else if (ct.elapsed >= ct.total) finishContract(ct, false);
    }
    for (const k of Object.keys(s.vexed)) if ((s.vexed[k] -= sec) <= 0) delete s.vexed[k];
    for (const k of Object.keys(s.galleryCold)) if ((s.galleryCold[k] -= sec) <= 0) delete s.galleryCold[k];
  }

  /** Exposition : les bâtiments et le stock repartent de zéro, les commandes sont annulées sans pénalité. */
  function afterExpo() {
    s.buildings = {};
    s.stock = [];
    s.orders.offers = [];
    s.orders.active = [];
    s.runOrders = 0;
    s.proposals = {};
    mapKey = '';
    refresh(true);
  }

  // ---------- Rendu ----------
  const cardOf = (id) => ctx.els.strip.querySelector(`[data-order="${id}"]`) ?? ctx.els.board.querySelector(`[data-order="${id}"]`);

  function needChips(c) {
    const out = [];
    if (c.style !== undefined && c.style !== null) out.push(`<span class="pe-need">${icon('palette')}${esc(E.STYLES[c.style].name)}</span>`);
    if (c.format) out.push(`<span class="pe-need">${icon('image')}${esc(E.formatOf(c.format).name)}</span>`);
    if (c.family) out.push(`<span class="pe-need"><i class="pe-swatch" style="background:${E.familyOf(c.family).swatch}"></i>${esc(E.familyOf(c.family).name)}</span>`);
    if (c.rarity) out.push(`<span class="pe-need pe-need--rare">${icon('starFill')}${esc(RARITY_LABEL[c.rarity])}</span>`);
    if (!out.length) out.push('<span class="pe-need">Au choix</span>');
    return out.join('');
  }

  function orderCard(o, compact = false) {
    const c = E.clientOf(o.client);
    const st = o.steps[o.stage];
    const T = O.ORDER_TYPES[o.type];
    const stock = s.autoAssign ? 0 : s.stock.filter((p) => O.matches(p, st.c)).length;
    return `<div class="pe-order ${compact ? 'is-compact' : ''}" data-order="${o.id}" style="--c:${c.color}">
      <div class="pe-order__top"><b>${esc(c.name)}</b>${o.loyal ? icon('heartFill', { className: 'pe-loyal' }) : ''}<span class="pe-order__type pe-type--${o.type}">${esc(T.name)}${o.steps.length > 1 ? ` ${o.stage + 1}/${o.steps.length}` : ''}</span></div>
      <div class="pe-order__need">${needChips(st.c)}</div>
      <div class="pe-order__bar"><i data-k></i></div>
      <div class="pe-order__foot"><span data-count>${st.delivered} / ${st.count}</span><span class="pe-order__time" data-time>${clock(st.left)}</span></div>
      ${!s.autoAssign ? `<button class="btn btn--sm btn--success pe-order__deliver" type="button" data-deliver="${o.id}" ${stock ? '' : 'disabled'}>Livrer ${stock ? `(${stock})` : ''}</button>` : ''}
    </div>`;
  }

  function offerCard(o) {
    const c = E.clientOf(o.client);
    const T = O.ORDER_TYPES[o.type];
    const total = o.steps.reduce((n, st) => n + st.count, 0);
    const reward = o.steps.reduce((sum, _, i) => sum + O.stepReward(s, o, i, maxStyle(), { festival: festivalOn() }).money, 0);
    const blocked = o.type === 'geante' && !canGiant();
    return `<div class="pe-offer" data-offer="${o.id}" style="--c:${c.color}">
      <div class="pe-order__top"><b>${esc(c.name)}</b><small>${esc(c.title)}</small>${o.loyal ? icon('heartFill', { className: 'pe-loyal' }) : ''}<span class="pe-order__type pe-type--${o.type}">${esc(T.name)}</span></div>
      <p class="pe-offer__text">${formatInt(total)} toile${total > 1 ? 's' : ''}${o.steps.length > 1 ? ` en ${o.steps.length} étapes` : ''} · ${clock(o.steps[0].duration)} · <b>${esc(fmt(reward))}</b></p>
      <div class="pe-order__need">${needChips(o.steps[0].c)}</div>
      ${blocked ? '<p class="pe-offer__warn">Il faut deux ateliers et l’entrepôt.</p>' : ''}
      <div class="pe-offer__actions"><span class="pe-offer__expire" data-expire>Expire dans ${clock(o.expiresIn)}</span><button class="btn btn--sm btn--ghost" type="button" data-refuse="${o.id}">Refuser</button><button class="btn btn--sm btn--primary" type="button" data-accept="${o.id}" ${blocked ? 'disabled' : ''}>Accepter</button></div>
    </div>`;
  }

  function contractCard(ct) {
    const gal = E.clientOf(ct.gallery);
    const lag = O.contractLag(ct);
    return `<div class="pe-contract" data-contract="${ct.gallery}" style="--c:${gal.color}">
      <div class="pe-order__top"><b>${esc(gal.name)}</b><span class="pe-order__type">Contrat · ${esc(E.STYLES[ct.style].name)}</span></div>
      <div class="pe-order__bar"><i data-ck style="--k:${clamp(ct.delivered / ct.volume).toFixed(3)}"></i></div>
      <div class="pe-order__foot"><span data-ccount>${formatInt(ct.delivered)} / ${formatInt(ct.volume)} toiles</span><span data-ctime>${esc(formatDuration((ct.total - ct.elapsed) * 1000))} restantes</span></div>
      ${lag > 0.25 ? '<p class="pe-offer__warn">En retard sur le rythme prévu.</p>' : ''}
    </div>`;
  }

  /** Bandeau des commandes en cours (visible dans l'atelier comme sur la carte). */
  function renderStrip() {
    const key = [...s.orders.active.map((o) => `${o.id}:${o.stage}`), `o${s.orders.offers.length}`, s.autoAssign, festivalOn()].join('|');
    const el = ctx.els.strip;
    if (key !== stripKey) {
      stripKey = key;
      const offers = s.orders.offers.length;
      el.innerHTML = `${s.orders.active.map((o) => orderCard(o, true)).join('')}
        ${offers ? `<button class="pe-offers-chip" type="button" data-goto="board">${icon('letter')}<b>${offers}</b> offre${offers > 1 ? 's' : ''} de commande</button>` : ''}
        ${!s.orders.active.length && !offers ? `<p class="pe-strip__empty">${icon('home')}Pas de commande en cours. Les clients passent régulièrement sur la carte.</p>` : ''}
        ${festivalOn() ? `<span class="pe-festival-chip">${icon('sparkle')}Festival · <span data-fest>${clock(s.festival.left)}</span></span>` : ''}`;
    }
    updateTimers(el);
  }

  function updateTimers(root) {
    for (const o of s.orders.active) {
      const card = root.querySelector(`[data-order="${o.id}"]`);
      if (!card) continue;
      const st = o.steps[o.stage];
      const k = clamp(st.delivered / st.count);
      card.querySelector('[data-k]').style.setProperty('--k', k.toFixed(3));
      setText(card.querySelector('[data-count]'), `${st.delivered} / ${st.count}`);
      setText(card.querySelector('[data-time]'), clock(st.left));
      card.classList.toggle('is-urgent', st.left <= 10);
    }
    for (const o of s.orders.offers) {
      const card = root.querySelector(`[data-offer="${o.id}"] [data-expire]`);
      if (card) setText(card, `Expire dans ${clock(o.expiresIn)}`);
    }
    for (const ct of s.contracts) {
      const card = root.querySelector(`[data-contract="${ct.gallery}"]`);
      if (!card) continue;
      card.querySelector('[data-ck]').style.setProperty('--k', clamp(ct.delivered / ct.volume).toFixed(3));
      setText(card.querySelector('[data-ccount]'), `${formatInt(ct.delivered)} / ${formatInt(ct.volume)} toiles`);
      setText(card.querySelector('[data-ctime]'), `${formatDuration((ct.total - ct.elapsed) * 1000)} restantes`);
    }
    const fest = root.querySelector('[data-fest]');
    if (fest) setText(fest, clock(s.festival.left));
  }

  /** Tableau de commandes : détail d'un bâtiment, ou vue d'ensemble. */
  function boardHtml() {
    if (selected) return buildingHtml(selected);
    const lvl = E.repLevel(s.rep);
    const nextD = E.DISTRICTS.find((d) => !E.districtOpen(s, d.id));
    const inv = Object.entries(s.inventory).filter(([, n]) => n > 0);
    return `
      <div class="pe-board__head">
        <p class="pe-rep">${icon('starFill')}<b>${formatInt(s.rep)}</b> de réputation · ${esc(lvl.name)}</p>
        ${nextD ? `<p class="pe-board__hint">${esc(nextD.name)} s’ouvre à ${formatInt(nextD.rep)}.</p>` : ''}
      </div>
      <h3 class="pe-board__title">Offres <small>${s.orders.offers.length} / ${MAX_OFFERS}</small></h3>
      ${s.orders.offers.length ? s.orders.offers.map(offerCard).join('') : '<p class="pe-board__empty">Aucune offre pour l’instant : les clients passeront bientôt.</p>'}
      <h3 class="pe-board__title">En cours <small>${s.orders.active.length} / ${activeSlots()}</small></h3>
      ${s.orders.active.length ? s.orders.active.map((o) => orderCard(o)).join('') : '<p class="pe-board__empty">Accepte une offre pour commencer.</p>'}
      ${s.contracts.length ? `<h3 class="pe-board__title">Contrats</h3>${s.contracts.map(contractCard).join('')}` : ''}
      <h3 class="pe-board__title">Réserve</h3>
      <p class="pe-board__line">${icon('blocks')}Stock : <b>${s.stock.length} / ${E.stockCapacity(s)}</b> toiles ${s.stock.length ? `<button class="btn btn--sm btn--ghost" type="button" data-sellstock>Vendre le stock</button>` : ''}</p>
      ${inv.length ? `<p class="pe-board__line">${icon('sparkle')}${inv.map(([id, n]) => `${esc(O.ITEMS[id].name)} ×${n}`).join(' · ')}</p>` : ''}
      <div class="setting-row pe-board__toggle"><span class="setting-row__text"><span id="pe-auto-label">Attribution automatique</span><span class="setting-row__hint">Les toiles qui conviennent partent seules vers les commandes. Sinon, elles vont en réserve et tu livres toi-même.</span></span>
        <button class="switch" type="button" role="switch" aria-labelledby="pe-auto-label" aria-checked="${s.autoAssign}" data-auto></button></div>`;
  }

  function buildingHtml(id) {
    const info = spotInfo(id);
    const back = `<button class="btn btn--sm btn--ghost pe-board__back" type="button" data-unselect>${icon('back')}Tableau des commandes</button>`;
    if (info.kind === 'client' && info.client.kind === 'galerie') {
      const gal = info.client;
      const ct = s.contracts.find((c) => c.gallery === id);
      const cold = s.galleryCold[id];
      const p = !ct && !cold ? proposalFor(id) : null;
      return `${back}<h3 class="pe-board__name">${esc(gal.name)}</h3><p class="pe-board__hint">Galerie · contrats longue durée</p>
        ${ct ? `${contractCard(ct)}<p class="pe-board__note">Bonus actifs : +10 % de revenus, +10 % sur les commandes, une commande de plus à la fois.</p><button class="btn btn--sm btn--danger" type="button" data-break="${id}">Rompre le contrat</button>` : ''}
        ${cold ? `<p class="pe-board__note">La galerie ne veut plus traiter avec toi pendant ${esc(formatDuration(cold * 1000))}.</p>` : ''}
        ${p ? `<div class="pe-contract is-proposal" style="--c:${gal.color}">
            <p class="pe-offer__text">Exclusivité <b>${esc(E.STYLES[p.style].name)}</b> · <b>${formatInt(p.volume)} toiles</b> en <b>${p.hours} h</b> de jeu</p>
            <ul class="pe-dlg-list"><li>${icon('check')}Chaque toile de ce style lui revient, payée 20 % de plus.</li><li>${icon('check')}Tant que le contrat court : +10 % de revenus et de paiement des commandes, une commande de plus à la fois.</li><li>${icon('trophy')}À la fin : ${esc(fmt(O.contractReward(s, p).money))}, +${O.contractReward(s, p).rep} de réputation et un trophée (+2 % de revenus pour toujours).</li><li>${icon('close')}Rompre ou manquer le volume coûte de la réputation.</li></ul>
            <button class="btn btn--primary btn--block" type="button" data-sign="${id}">${icon('check')}Signer le contrat</button></div>` : ''}`;
    }
    if (info.kind === 'client') {
      const c = info.client;
      const offer = s.orders.offers.find((o) => o.client === id);
      const act = s.orders.active.filter((o) => o.client === id);
      return `${back}<h3 class="pe-board__name">${esc(c.name)}</h3><p class="pe-board__hint">${esc(c.title)}${s.loyal.includes(id) ? ' · client fidèle (+30 %)' : ''}</p>
        ${s.vexed[id] ? `<p class="pe-board__note">Déçu·e par ta dernière livraison : pas de commande avant ${esc(clock(s.vexed[id]))}.</p>` : ''}
        ${offer ? offerCard(offer) : ''}${act.map((o) => orderCard(o)).join('')}
        ${!offer && !act.length && !s.vexed[id] ? '<p class="pe-board__empty">Pas de commande pour l’instant.</p>' : ''}`;
    }
    if (id === 'garage') {
      return `${back}<h3 class="pe-board__name">Ton garage</h3><p class="pe-board__hint">${esc(E.ATELIERS[0].desc)}</p>
        <p class="pe-board__line">${icon('blocks')}Stock : <b>${s.stock.length} / ${E.stockCapacity(s)}</b> · ${icon('grid')}${activeSlots()} commande${activeSlots() > 1 ? 's' : ''} à la fois</p>`;
    }
    const b = info.building;
    const open = E.districtOpen(s, b.district);
    const lvl = id === 'entrepot' ? s.buildings.entrepot ?? 0 : s.buildings[id] ? 1 : 0;
    const maxed = id === 'entrepot' ? lvl >= E.WAREHOUSE.max : lvl > 0;
    const cost = buildingCost(id);
    return `${back}<h3 class="pe-board__name">${esc(b.name)}</h3><p class="pe-board__hint">${esc(b.desc)}</p>
      ${!open ? `<p class="pe-board__note">${icon('lock')}Quartier fermé pour l’instant.</p>` : maxed ? `<p class="pe-board__note">${icon('check')}${id === 'entrepot' ? `Niveau ${lvl} : ${E.stockCapacity(s)} places.` : 'Bâtiment à toi.'}</p>` : `<button class="btn btn--primary btn--block" type="button" data-buildbuy="${id}" ${s.money >= cost ? '' : 'disabled'}>${icon('coin')}${id === 'entrepot' && lvl ? `Agrandir · ${esc(fmt(cost))}` : `Acheter · ${esc(fmt(cost))}`}</button>${s.inventory.plan ? '<p class="pe-board__note">Plan de bâtiment : −30 % appliqués.</p>' : ''}`}`;
  }

  function renderBoard(force = false) {
    const key = [selected, s.orders.offers.map((o) => o.id).join(','), s.orders.active.map((o) => `${o.id}${o.stage}`).join(','), s.contracts.map((c) => c.gallery).join(','), s.stock.length, Object.values(s.inventory).join(','), s.autoAssign, Math.floor(s.rep), Object.keys(s.vexed).join(','), JSON.stringify(s.buildings), Object.keys(s.galleryCold).join(','), festivalOn(), selected ? Math.floor(s.money / Math.max(1, buildingCost(selected) || 1)) : 0].join('|');
    if (force || key !== boardKey) {
      boardKey = key;
      const scroll = ctx.els.board.scrollTop;
      ctx.els.board.innerHTML = boardHtml();
      ctx.els.board.scrollTop = scroll;
    }
    updateTimers(ctx.els.board);
  }

  function renderMap() {
    const key = [s.districts.join(','), JSON.stringify(s.buildings), festivalOn()].join('|');
    if (key !== mapKey) {
      mapKey = key;
      ctx.els.map.innerHTML = renderCity({ owned: (id) => !!s.buildings[id], open: (d) => E.districtOpen(s, d) });
      ctx.els.map.firstElementChild.classList.toggle('is-festival', festivalOn());
      bubbleKeys.clear();
    }
    ctx.els.map.querySelectorAll('.pe-b').forEach((g) => g.classList.toggle('is-selected', g.dataset.b === selected));
    renderBubbles();
  }

  const bubbleKeys = new Map();
  function bubbleFor(id) {
    const offer = s.orders.offers.find((o) => o.client === id);
    const act = s.orders.active.find((o) => o.client === id);
    const loyal = s.loyal.includes(id);
    if (act) {
      const st = act.steps[act.stage];
      return { kind: 'active', progress: clamp(st.delivered / st.count), urgent: st.left <= 10, count: st.count - st.delivered, loyal };
    }
    if (offer) return { kind: 'offer', loyal };
    if (s.vexed[id]) return { kind: 'angry' };
    const gal = E.clientOf(id);
    if (gal?.kind === 'galerie' && E.districtOpen(s, gal.district)) {
      const ct = s.contracts.find((c) => c.gallery === id);
      if (ct) return { kind: 'contract', progress: clamp(ct.delivered / ct.volume) };
      if (!s.galleryCold[id] && s.contracts.length < maxContracts()) return { kind: 'proposal' };
    }
    return null;
  }
  function renderBubbles() {
    for (const g of ctx.els.map.querySelectorAll('[data-bubble]')) {
      const id = g.dataset.bubble;
      const b = bubbleFor(id);
      // La structure ne change que si la nature de la bulle change : l'anneau est mis à jour en place
      const key = b ? `${b.kind}|${b.urgent ? 1 : 0}|${b.loyal ? 1 : 0}|${b.count ?? ''}` : '';
      if (bubbleKeys.get(id) !== key) {
        bubbleKeys.set(id, key);
        g.innerHTML = bubbleSvg(b);
      } else if (b?.progress !== undefined) {
        const ring = g.querySelector('.pe-ring');
        if (ring) ring.setAttribute('stroke-dasharray', `${(b.progress * 2 * Math.PI * 21).toFixed(1)} ${(2 * Math.PI * 21).toFixed(1)}`);
      }
    }
  }

  function refresh(force = false) {
    renderStrip();
    renderBoard(force);
    if (ctx.view() === 'ville') renderMap();
    ctx.onChange?.();
  }

  function select(id) {
    selected = id;
    gv.audio.play('select');
    renderBoard(true);
    renderMap();
    if (ctx.narrow()) ctx.els.board.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const el = ctx.els.map.querySelector(`[data-b="${id}"] .pe-b__art`);
    if (el) squash(el, { scaleX: 1.05, scaleY: 0.95, duration: 220 });
  }

  // ---------- Évènements ----------
  function onClick(e) {
    const t = e.target.closest('button, input, [data-b]');
    if (!t) return;
    if (t.dataset.accept) accept(t.dataset.accept);
    else if (t.dataset.refuse) refuse(t.dataset.refuse);
    else if (t.dataset.deliver) {
      const o = s.orders.active.find((x) => x.id === t.dataset.deliver);
      if (o) deliverFromStock(o);
      refresh(true);
    } else if (t.dataset.sign) sign(t.dataset.sign);
    else if (t.dataset.break) breakContract(t.dataset.break);
    else if (t.dataset.buildbuy) buy(t.dataset.buildbuy);
    else if (t.hasAttribute('data-unselect')) {
      selected = null;
      renderBoard(true);
      renderMap();
    } else if (t.hasAttribute('data-sellstock')) sellStock();
    else if (t.hasAttribute('data-auto')) {
      s.autoAssign = !s.autoAssign;
      if (s.autoAssign) for (const o of [...s.orders.active]) deliverFromStock(o);
      refresh(true);
    } else if (t.dataset.b) select(t.dataset.b);
    else if (t.dataset.goto === 'board') ctx.showVille();
  }

  function sellStock() {
    const v = s.stock.reduce((sum, p) => sum + E.paintingValue(s, E.RARITIES.find((r) => r.id === p.rarity) ?? E.RARITIES[0], p.style, p.format) * 0.8, 0);
    const n = s.stock.length;
    s.stock = [];
    ctx.earn(v);
    fx.popupAt(ctx.els.board, `+${fmt(v)}`, { size: 28, color: '#ffc93c', rise: 40 });
    gv.audio.play('coin');
    ctx.notify(`${n} toile${n > 1 ? 's' : ''} du stock vendue${n > 1 ? 's' : ''} sur le marché (80 % du prix).`);
    refresh(true);
  }

  for (const el of [ctx.els.strip, ctx.els.board, ctx.els.map]) el.addEventListener('click', onClick);
  ctx.els.map.addEventListener('keydown', (e) => {
    const g = e.target.closest?.('[data-b]');
    if (g && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      select(g.dataset.b);
    }
  });

  return {
    tick,
    offline,
    route,
    afterExpo,
    refresh,
    renderMap,
    select,
    spawnOffer,
    accept,
    refuse,
    sign,
    breakContract,
    buy,
    addRep,
    startFestival,
    get selected() { return selected; },
  };
}

const setText = (el, t) => {
  if (el && el.textContent !== t) el.textContent = t;
};
