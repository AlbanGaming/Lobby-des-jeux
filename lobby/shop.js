// Lobby — la boutique : thèmes, jeux secrets, look d'avatar, effets (célébrations, sons),
// objets utiles et coffre surprise. Tout se paie en crédits gagnés en jouant.

import * as meta from '../shared/js/meta.js';
import * as shop from '../shared/js/shop.js';
import { gamePath } from '../games/registry.js';
import { icon } from '../shared/js/ui/icons.js';
import { avatarSVG } from '../shared/js/ui/avatar.js';
import { toast, esc } from '../shared/js/ui/toast.js';
import { audio } from '../shared/js/engine/audio.js';
import { celebrate } from '../shared/js/ui/celebrate.js';
import { formatInt, formatDuration } from '../shared/js/core/math.js';

const $ = (sel, root = document) => root.querySelector(sel);

const TABS = [
  { id: 'themes', label: 'Thèmes', icon: 'palette' },
  { id: 'jeux', label: 'Jeux secrets', icon: 'lock' },
  { id: 'avatar', label: 'Avatar', icon: 'user' },
  { id: 'effets', label: 'Effets', icon: 'sparkle' },
  { id: 'objets', label: 'Objets', icon: 'bolt' },
  { id: 'coffre', label: 'Coffre', icon: 'gift' },
];

let ctx = null; // { confirmAction, sfx, hydrateThumbs }
let tab = 'themes';
let holdRender = false; // pendant l'ouverture du coffre, on ne redessine pas l'onglet

export function initShop(c) {
  ctx = c;
  $('#shopTabs').innerHTML = TABS.map((t) => `<button class="chip" role="tab" type="button" id="stab-${t.id}" data-stab="${t.id}" aria-controls="shopBody">${icon(t.icon === 'gift' ? 'sparkle' : t.icon)}${t.label}</button>`).join('');
  $('#dlgShop').addEventListener('click', onClick);
  $('#shopTabs').addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!d) return;
    const i = TABS.findIndex((t) => t.id === tab);
    tab = TABS[(i + d + TABS.length) % TABS.length].id;
    render();
    $(`#stab-${tab}`).focus();
  });
  meta.events.addEventListener('change', () => {
    if ($('#dlgShop').open && !holdRender) render();
  });
}

export function openShop(t) {
  if (t) tab = t;
  render();
  if (!$('#dlgShop').open) $('#dlgShop').showModal();
}

// ---------- Rendu ----------
const credits = () => meta.getData().credits;
const price = (n) => `${icon('coin')}${formatInt(n)}`;

function render() {
  for (const b of document.querySelectorAll('#shopTabs [role="tab"]')) {
    const on = b.dataset.stab === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  $('#shopCredits').innerHTML = `${icon('coin')}<span>${formatInt(credits())}</span> crédits`;
  const body = $('#shopBody');
  body.setAttribute('aria-labelledby', `stab-${tab}`);
  body.innerHTML = { themes: themesHTML, jeux: gamesHTML, avatar: avatarHTML, effets: effectsHTML, objets: itemsHTML, coffre: chestHTML }[tab]();
  ctx.hydrateThumbs?.(body);
}

// Bouton d'action d'un cosmétique : équipé, équiper, acheter (ou gagné par un succès)
function action(kind, item) {
  const on = shop.equipped(kind).id === item.id;
  const own = shop.owned(kind, item);
  if (on) return `<span class="sh-state is-on">${icon('check')}Équipé</span>`;
  if (own) return `<button type="button" class="btn btn--sm" data-equip="${kind}:${item.id}">Équiper</button>`;
  if (item.ach) return `<span class="sh-state">${icon('trophy')}${esc(item.how)}</span>`;
  const short = credits() < item.cost;
  return `<button type="button" class="btn btn--sm btn--primary" data-buy="${kind}:${item.id}" ${short ? 'aria-disabled="true"' : ''}>${price(item.cost)}</button>`;
}
function card(kind, item, preview, extra = '') {
  const on = shop.equipped(kind).id === item.id;
  const rar = item.cost ? shop.rarityOf(item.cost) : null;
  return `<div class="sh-item ${on ? 'is-on' : ''}" data-item="${kind}:${item.id}">
    <div class="sh-item__preview">${preview}</div>
    <div class="sh-item__body">
      <p class="sh-item__name">${esc(item.name)}${rar ? `<span class="sh-rar" style="--r:${rar.color}">${rar.name}</span>` : ''}</p>
      ${item.desc ? `<p class="sh-item__desc">${esc(item.desc)}</p>` : ''}
      <div class="sh-item__foot">${action(kind, item)}${extra}</div>
    </div>
  </div>`;
}

function themesHTML() {
  return `<p class="sh-lead">Change les couleurs du lobby et de la barre de tous les jeux.</p><div class="sh-grid">${shop.THEMES.map((t) =>
    card('theme', t, `<span class="sh-theme" style="--c1:${t.colors[0]};--c2:${t.colors[1]};--c3:${t.colors[2]}"><i></i><i></i><i></i></span>`),
  ).join('')}</div>`;
}

function gamesHTML() {
  const list = shop.secretGames();
  return `<p class="sh-lead">Des jeux qu’on ne trouve qu’ici. Une fois débloqués, ils comptent comme les autres : records, succès, défi du jour.</p><div class="sh-grid sh-grid--games">${list
    .map((g) => {
      const own = meta.gameUnlocked(g.id);
      return `<div class="sh-game ${own ? 'is-own' : ''}" style="--g:${g.color};--gi:${g.ink}">
        <div class="sh-game__thumb" data-thumb="${g.id}">${own ? '' : `<span class="sh-game__lock">${icon('lock')}</span>`}</div>
        <div class="sh-item__body">
          <p class="sh-item__name">${esc(g.title)}</p>
          <p class="sh-item__desc">${esc(g.description)}</p>
          <div class="sh-item__foot">${own ? `<a class="btn btn--sm btn--primary" href="${gamePath(g)}" data-play="${g.id}">${icon('play')}Jouer</a>` : `<button type="button" class="btn btn--sm btn--primary" data-buy-game="${g.id}" ${credits() < g.secret.cost ? 'aria-disabled="true"' : ''}>${icon('lock')}Débloquer · ${formatInt(g.secret.cost)}</button>`}</div>
        </div>
      </div>`;
    })
    .join('')}</div>`;
}

function avatarHTML() {
  const d = meta.getData();
  const av = d.profile.avatar;
  const frameOf = (id) => shop.FRAMES.find((f) => f.id === id);
  const lookWith = (patch) => ({ frame: frameOf(d.look.frame), hat: d.look.hat, ...patch });
  return `
    <div class="sh-me">${avatarSVG(av, { size: 96, look: lookWith({}), label: 'Ton avatar équipé' })}<div><p class="sh-me__name">${esc(d.profile.name)}</p>${d.look.title !== 'none' ? `<p class="sh-title-chip">${esc(shop.equipped('title').name)}</p>` : '<p class="sh-item__desc">Pas de titre.</p>'}</div></div>
    <h3 class="sh-h">Cadres</h3>
    <div class="sh-grid">${shop.FRAMES.map((f) => card('frame', f, avatarSVG(av, { size: 64, look: lookWith({ frame: f }) }))).join('')}</div>
    <h3 class="sh-h">Accessoires</h3>
    <div class="sh-grid">${shop.HATS.map((h) => card('hat', h, avatarSVG(av, { size: 64, look: lookWith({ hat: h.id }) }))).join('')}</div>
    <h3 class="sh-h">Titres <small>affichés sous ton pseudo</small></h3>
    <div class="sh-grid">${shop.TITLES.map((t) => card('title', t, `<span class="sh-title-chip">${esc(t.id === 'none' ? '—' : t.name)}</span>`)).join('')}</div>`;
}

const CELEB_ICON = { confettis: 'sparkle', feu: 'star', pieces: 'coin', etoiles: 'starFill', pixels: 'grid' };
function effectsHTML() {
  return `
    <h3 class="sh-h">Célébration de record <small>quand tu bats ton record, dans tous les jeux</small></h3>
    <div class="sh-grid">${shop.CELEBRATIONS.map((c) => card('celebration', c, `<span class="sh-fx">${icon(CELEB_ICON[c.id])}</span>`, `<button type="button" class="btn btn--sm btn--ghost" data-try="${c.id}">${icon('play')}Voir</button>`)).join('')}</div>
    <h3 class="sh-h">Sons <small>le timbre de tous les effets sonores</small></h3>
    <div class="sh-grid">${shop.SOUNDS.map((s) => card('sound', s, `<span class="sh-fx">${icon('wave')}</span>`, `<button type="button" class="btn btn--sm btn--ghost" data-listen="${s.id}">${icon('soundOn')}Écouter</button>`)).join('')}</div>`;
}

function itemsHTML() {
  const d = meta.getData();
  const ch = meta.dailyChallenge();
  const state = {
    gel: `En réserve : <strong>${d.inventory.gel} / 2</strong>`,
    relance: ch?.done ? 'Défi du jour déjà réussi' : `Aujourd’hui : <strong>${meta.rerollsToday()} / ${shop.RELANCES_PER_DAY}</strong>${ch ? ` · défi actuel : ${esc(ch.text)}` : ''}`,
    boost: meta.boostActive() ? `Actif encore <strong>${formatDuration(d.boostUntil - Date.now())}</strong>` : 'Inactif',
  };
  const can = {
    gel: d.inventory.gel < 2,
    relance: ch && !ch.done && meta.rerollsToday() < shop.RELANCES_PER_DAY,
    boost: true,
  };
  return `<p class="sh-lead">Des coups de pouce, à consommer.</p><div class="sh-grid sh-grid--wide">${shop.ITEMS.map((it) => `
    <div class="sh-item">
      <div class="sh-item__preview"><span class="sh-fx">${icon(it.icon)}</span></div>
      <div class="sh-item__body">
        <p class="sh-item__name">${esc(it.name)}</p>
        <p class="sh-item__desc">${esc(it.desc)}</p>
        <p class="sh-item__desc">${state[it.id]}</p>
        <div class="sh-item__foot"><button type="button" class="btn btn--sm btn--primary" data-item-buy="${it.id}" ${!can[it.id] ? 'disabled' : credits() < it.cost ? 'aria-disabled="true"' : ''}>${price(it.cost)}</button></div>
      </div>
    </div>`).join('')}</div>`;
}

function chestHTML() {
  const left = shop.chestPool().length;
  return `<div class="sh-chest">
    <div class="sh-chest__art" id="chestArt">${CHEST_SVG}</div>
    <p class="sh-lead">Un objet de la boutique que tu n’as pas encore, au hasard : thème, cadre, accessoire, titre, célébration ou sons. Les objets rares sortent moins souvent.</p>
    <p class="sh-item__desc">${left ? `${left} objet${left > 1 ? 's' : ''} encore à gagner.` : 'Tu possèdes déjà tout : bravo !'}</p>
    <button type="button" class="btn btn--primary btn--lg" data-chest ${left ? (credits() < shop.CHEST_COST ? 'aria-disabled="true"' : '') : 'disabled'}>${icon('sparkle')}Ouvrir · ${formatInt(shop.CHEST_COST)}</button>
    <div class="sh-reveal" id="chestReveal" aria-live="polite"></div>
  </div>`;
}
const CHEST_SVG = `<svg viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="60" cy="92" rx="46" ry="6" fill="#000" opacity=".3"/><rect x="14" y="40" width="92" height="48" rx="8" fill="#8a5a2e" stroke="#4a2e14" stroke-width="4"/><path d="M14 46h92" stroke="#4a2e14" stroke-width="4"/><path class="sh-lid" d="M14 44V34a22 22 0 0 1 22-22h48a22 22 0 0 1 22 22v10z" fill="#a66b36" stroke="#4a2e14" stroke-width="4"/><rect x="50" y="36" width="20" height="22" rx="4" fill="#ffc93c" stroke="#4a2e14" stroke-width="3"/><circle cx="60" cy="47" r="3" fill="#4a2e14"/><path d="M30 40v48M90 40v48" stroke="#ffc93c" stroke-width="5"/></svg>`;

// ---------- Actions ----------
function short(cost) {
  ctx.sfx('error');
  toast({ title: 'Crédits insuffisants', text: `Il te manque ${formatInt(cost - credits())} crédits. Joue pour en gagner !`, iconName: 'coin', tone: 'var(--tomato)' });
}

async function onClick(e) {
  const b = e.target.closest('button, a');
  if (!b || b.disabled) return;
  if (b.dataset.stab) {
    tab = b.dataset.stab;
    ctx.sfx('tick');
    render();
    $(`#stab-${tab}`).focus();
    return;
  }
  if (b.dataset.equip) {
    const [kind, id] = b.dataset.equip.split(':');
    shop.equip(kind, id);
    ctx.sfx('select');
    render();
    return;
  }
  if (b.dataset.buy) {
    const [kind, id] = b.dataset.buy.split(':');
    const item = shop.KINDS[kind].list.find((x) => x.id === id);
    if (credits() < item.cost) return short(item.cost);
    const yes = await ctx.confirmAction({ title: `Acheter « ${item.name} » ?`, text: `${shop.KINDS[kind].label} · ${formatInt(item.cost)} crédits. Tu en as ${formatInt(credits())}.`, ok: `Acheter · ${formatInt(item.cost)}` });
    if (!yes || !shop.purchase(kind, id)) return;
    ctx.sfx('powerup');
    toast({ title: 'Acheté et équipé', text: item.name, iconName: 'sparkle', tone: 'var(--mint)' });
    if (kind === 'celebration') celebrate(id);
    if (kind === 'sound') listen(id);
    render();
    return;
  }
  if (b.dataset.buyGame) {
    const g = shop.secretGames().find((x) => x.id === b.dataset.buyGame);
    if (credits() < g.secret.cost) return short(g.secret.cost);
    const yes = await ctx.confirmAction({ title: `Débloquer ${g.title} ?`, text: `Ce jeu secret coûte ${formatInt(g.secret.cost)} crédits. Tu en as ${formatInt(credits())}. Il sera à toi pour toujours.`, ok: `Débloquer · ${formatInt(g.secret.cost)}` });
    if (!yes || !shop.purchaseGame(g.id)) return;
    ctx.sfx('record');
    celebrate('confettis', { duration: 1800 });
    toast({ title: 'Jeu débloqué !', text: `${g.title} t’attend dans la liste des jeux.`, iconName: 'gamepad', tone: g.color });
    render();
    return;
  }
  if (b.dataset.try) {
    celebrate(b.dataset.try);
    ctx.sfx('record');
    return;
  }
  if (b.dataset.listen) return listen(b.dataset.listen);
  if (b.dataset.itemBuy) {
    const it = shop.ITEMS.find((x) => x.id === b.dataset.itemBuy);
    if (credits() < it.cost) return short(it.cost);
    if (!meta.buyItem(it.id, it.cost, { max: it.max, boostMs: shop.BOOST_MS, maxRerolls: shop.RELANCES_PER_DAY })) return ctx.sfx('error');
    ctx.sfx('powerup');
    const after = meta.dailyChallenge();
    const text = it.id === 'relance' ? `Nouveau défi : ${after.text}` : it.id === 'gel' ? 'Ta série est protégée pour un jour manqué.' : 'XP doublée pendant 30 minutes.';
    toast({ title: it.name, text, iconName: it.icon, tone: 'var(--mint)' });
    render();
    return;
  }
  if (b.hasAttribute('data-chest')) {
    if (credits() < shop.CHEST_COST) return short(shop.CHEST_COST);
    return openChest();
  }
}

function listen(id) {
  const prev = audio.pack;
  audio.pack = id;
  audio.play('coin');
  setTimeout(() => audio.play('powerup'), 180);
  setTimeout(() => audio.play('pop'), 620);
  setTimeout(() => {
    audio.pack = shop.equipped('sound').id === id ? id : prev;
  }, 900);
}

function openChest() {
  const art = $('#chestArt');
  holdRender = true;
  const res = shop.openChest();
  if (!res) {
    holdRender = false;
    return ctx.sfx('error');
  }
  art.classList.add('is-shake');
  ctx.sfx('whoosh');
  const reveal = () => {
    art.classList.remove('is-shake');
    art.classList.add('is-open');
    ctx.sfx(res.rarity.id === 'legendaire' ? 'record' : 'achievement');
    if (res.rarity.id === 'legendaire' || res.rarity.id === 'epique') celebrate('feu', { duration: 1800 });
    const k = shop.KINDS[res.kind];
    const out = $('#chestReveal');
    out.innerHTML = `<div class="sh-prize" style="--r:${res.rarity.color}"><span class="sh-rar" style="--r:${res.rarity.color}">${res.rarity.name}</span><p class="sh-prize__kind">${esc(k.label)}</p><p class="sh-prize__name">${esc(res.item.name)}</p><button type="button" class="btn btn--sm btn--primary" data-equip="${res.kind}:${res.item.id}">Équiper</button></div>`;
    // On garde l'affichage du gain ; le reste de l'onglet se met à jour au prochain rendu
    $('#shopCredits').innerHTML = `${icon('coin')}<span>${formatInt(credits())}</span> crédits`;
    holdRender = false;
  };
  setTimeout(reveal, 900);
}
