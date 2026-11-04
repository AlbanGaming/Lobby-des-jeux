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
  $('#dlgShop').addEventListener('cancel', (e) => {
    if (!opening) return;
    e.preventDefault();
    if (opening.revealed) closeOpening();
    else revealOpening();
  });
  $('#dlgShop').addEventListener('close', () => opening && closeOpening());
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
  if (item.chest) return `<button type="button" class="sh-state sh-state--chest" data-stab="coffre">${icon('sparkle')}Dans les coffres</button>`;
  const short = credits() < item.cost;
  return `<button type="button" class="btn btn--sm btn--primary" data-buy="${kind}:${item.id}" ${short ? 'aria-disabled="true"' : ''}>${price(item.cost)}</button>`;
}
function card(kind, item, preview, extra = '') {
  const on = shop.equipped(kind).id === item.id;
  const rar = item.cost || item.rarity ? shop.rarityFor(item) : null;
  return `<div class="sh-item ${on ? 'is-on' : ''} ${item.chest ? 'is-exclusive' : ''}" data-item="${kind}:${item.id}">
    ${item.chest ? '<span class="sh-excl">Exclusif coffre</span>' : ''}
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
  const lookWith = (patch) => ({ frame: frameOf(d.look.frame), hat: d.look.hat, character: d.look.character, ...patch });
  return `
    <div class="sh-me">${avatarSVG(av, { size: 96, look: lookWith({}), label: 'Ton avatar équipé' })}<div><p class="sh-me__name">${esc(d.profile.name)}</p>${d.look.title !== 'none' ? `<p class="sh-title-chip">${esc(shop.equipped('title').name)}</p>` : '<p class="sh-item__desc">Pas de titre.</p>'}</div></div>
    <h3 class="sh-h">Personnages <small>exclusifs aux coffres</small></h3>
    <div class="sh-grid">${shop.CHARACTERS.map((c) => card('character', c, avatarSVG(av, { size: 64, look: lookWith({ character: c.id }) }))).join('')}</div>
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

const RAR_NAME = { commun: 'Toutes raretés', rare: 'Rare ou mieux', epique: 'Épique ou mieux', legendaire: 'Légendaire assuré' };
const RAR_COLOR = { commun: '#3ee6a8', rare: '#4cc3ff', epique: '#a68bff', legendaire: '#ffc93c' };

function chestHTML() {
  const total = shop.chestPool('commun').length;
  return `<p class="sh-lead">Un objet que tu n’as pas encore : personnage, thème, cadre, accessoire, titre, célébration ou sons. Les personnages et les objets marqués « Exclusif coffre » ne sortent que d’ici. Plus le coffre est précieux, plus la récompense est belle, et c’est garanti.</p>
    <div class="sh-chests">${shop.CHESTS.map((c) => {
      const pool = shop.chestPool(c.min);
      const left = pool.length;
      const excl = pool.filter((p) => p.item.chest).length;
      const short = credits() < c.cost;
      return `<div class="sh-chestcard" data-chestcard="${c.id}" style="--rc:${RAR_COLOR[c.min]}">
        <div class="sh-chest__art" id="chestArt-${c.id}">${chestSVG(c)}</div>
        <p class="sh-item__name">${esc(c.name)}</p>
        <span class="sh-rar" style="--r:${RAR_COLOR[c.min]}">${RAR_NAME[c.min]}</span>
        <p class="sh-item__desc">${esc(c.desc)}</p>
        <p class="sh-item__desc sh-chestcard__left">${left ? `${left} objet${left > 1 ? 's' : ''} possible${left > 1 ? 's' : ''}${excl ? `, dont ${excl} exclusif${excl > 1 ? 's' : ''}` : ''}` : 'Plus rien à gagner à ce niveau'}</p>
        <button type="button" class="btn btn--primary" data-chest="${c.id}" ${left ? (short ? 'aria-disabled="true"' : '') : 'disabled'}>${icon('sparkle')}Ouvrir · ${formatInt(c.cost)}</button>
      </div>`;
    }).join('')}</div>
    ${total ? '' : '<p class="sh-lead">Tu possèdes déjà tout : bravo !</p>'}
    <div class="sh-reveal" id="chestReveal" aria-live="polite"></div>`;
}
// Un coffre aux couleurs de son métal ; le diamant scintille
const chestSVG = (c) => `<svg viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="60" cy="92" rx="46" ry="6" fill="#000" opacity=".3"/><rect x="14" y="40" width="92" height="48" rx="8" fill="${c.wood}" stroke="#1b1626" stroke-width="4"/><path d="M14 46h92" stroke="#1b1626" stroke-opacity=".5" stroke-width="4"/><path class="sh-lid" d="M14 44V34a22 22 0 0 1 22-22h48a22 22 0 0 1 22 22v10z" fill="${c.lid}" stroke="#1b1626" stroke-width="4"/><rect x="50" y="36" width="20" height="22" rx="4" fill="${c.band}" stroke="#1b1626" stroke-width="3"/><circle cx="60" cy="47" r="3" fill="#1b1626"/><path d="M30 40v48M90 40v48" stroke="${c.band}" stroke-width="5"/>${c.shine ? '<g class="sh-shine" fill="#fff"><path d="M24 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M98 8l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/><path d="M104 56l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z"/></g>' : ''}</svg>`;

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
    if (b.closest('.sh-open')) {
      b.outerHTML = `<span class="sh-state is-on">${icon('check')}Équipé</span>`;
      return;
    }
    render();
    return;
  }
  if (b.hasAttribute('data-open-close')) return closeOpening();
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
  if (b.dataset.chest) {
    const c = shop.CHESTS.find((x) => x.id === b.dataset.chest);
    if (credits() < c.cost) return short(c.cost);
    return openChest(c);
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

const EXTRA_TEXT = { gel: 'Gel de série', boost: 'Boost d’XP 30 min' };

// Aperçu d'un objet gagné, dans la scène d'ouverture
function previewOf(kind, item) {
  const d = meta.getData();
  const frame = shop.FRAMES.find((f) => f.id === d.look.frame);
  const base = { frame, hat: d.look.hat, character: d.look.character };
  if (kind === 'character') return avatarSVG(d.profile.avatar, { size: 110, look: { ...base, character: item.id } });
  if (kind === 'frame') return avatarSVG(d.profile.avatar, { size: 110, look: { ...base, frame: item } });
  if (kind === 'hat') return avatarSVG(d.profile.avatar, { size: 110, look: { ...base, hat: item.id } });
  if (kind === 'theme') return `<span class="sh-theme sh-theme--big" style="--c1:${item.colors[0]};--c2:${item.colors[1]};--c3:${item.colors[2]}"><i></i><i></i><i></i></span>`;
  if (kind === 'title') return `<span class="sh-title-chip sh-title-chip--big">${esc(item.name)}</span>`;
  return `<span class="sh-fx sh-fx--big">${icon(kind === 'sound' ? 'wave' : CELEB_ICON[item.id] ?? 'sparkle')}</span>`;
}

let opening = null; // { el, timers, revealed }
function openChest(c) {
  holdRender = true;
  const res = shop.openChest(c.id);
  if (!res) {
    holdRender = false;
    return ctx.sfx('error');
  }
  const k = shop.KINDS[res.kind];
  const extras = res.extras
    .map((e) => (e.type === 'item' ? `<li><span class="sh-rar" style="--r:${e.rarity.color}">${e.rarity.name}</span> ${esc(shop.KINDS[e.kind].label)} : <strong>${esc(e.item.name)}</strong></li>` : e.type === 'credits' ? `<li>${icon('coin')} +${e.n} crédits (réserve de gels pleine)</li>` : `<li>${icon(e.type === 'gel' ? 'flame' : 'bolt')} ${EXTRA_TEXT[e.type]}</li>`))
    .join('');
  const el = document.createElement('div');
  el.className = 'sh-open';
  el.style.setProperty('--r', res.rarity.color);
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', `Ouverture : ${c.name}`);
  el.innerHTML = `
    <div class="sh-open__rays" aria-hidden="true"></div>
    <div class="sh-open__chest" aria-hidden="true">${chestSVG(c)}</div>
    <p class="sh-open__hint">${esc(c.name)}…</p>
    <div class="sh-open__card" hidden>
      <span class="sh-rar" style="--r:${res.rarity.color}">${res.rarity.name}</span>
      <div class="sh-open__preview">${previewOf(res.kind, res.item)}</div>
      <p class="sh-prize__kind">${esc(k.label)}${res.item.chest ? ' · exclusif coffre' : ''}</p>
      <p class="sh-prize__name">${esc(res.item.name)}</p>
      ${extras ? `<ul class="sh-prize__extras">${extras}</ul>` : ''}
      <div class="sh-open__actions">
        <button type="button" class="btn btn--primary" data-equip="${res.kind}:${res.item.id}">Équiper</button>
        <button type="button" class="btn btn--ghost" data-open-close>Super !</button>
      </div>
    </div>`;
  $('#dlgShop').append(el);
  opening = { el, timers: [], revealed: false, res, chest: c };
  const later = (ms, fn) => opening.timers.push(setTimeout(fn, ms));
  // Suspense : le coffre tombe, tremble trois fois (de plus en plus fort), puis s'ouvre
  const reduced = document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return revealOpening();
  ctx.sfx('whoosh');
  [550, 1000, 1400].forEach((ms, i) =>
    later(ms, () => {
      el.dataset.bump = String(i + 1);
      audio.tone({ type: 'triangle', freq: 330 * 1.26 ** i, duration: 0.12, volume: 0.18 });
    }),
  );
  later(1850, revealOpening);
  // Toucher la scène passe directement au résultat
  el.addEventListener('click', (e) => {
    if (!opening?.revealed && !e.target.closest('button')) revealOpening();
  });
}

function revealOpening() {
  if (!opening || opening.revealed) return;
  const { el, res, chest } = opening;
  opening.revealed = true;
  opening.timers.forEach(clearTimeout);
  el.classList.add('is-open');
  el.querySelector('.sh-open__hint').hidden = true;
  el.querySelector('.sh-open__card').hidden = false;
  ctx.sfx(res.rarity.id === 'legendaire' ? 'record' : res.rarity.id === 'epique' ? 'achievement' : 'powerup');
  if (res.rarity.id === 'legendaire') celebrate(chest.id === 'diamant' ? 'etoiles' : 'feu', { duration: 2200 });
  else if (res.rarity.id === 'epique') celebrate('feu', { duration: 1600 });
  else celebrate('confettis', { duration: 1400 });
  el.querySelector('[data-equip]')?.focus();
}

function closeOpening() {
  if (!opening) return;
  const { el, res, chest } = opening;
  opening.timers.forEach(clearTimeout);
  opening = null;
  el.remove();
  holdRender = false;
  render();
  // Petit rappel du gain sous les coffres
  const k = shop.KINDS[res.kind];
  $('#chestReveal').innerHTML = `<div class="sh-prize" style="--r:${res.rarity.color}"><p class="sh-prize__kind">${esc(chest.name)}</p><span class="sh-rar" style="--r:${res.rarity.color}">${res.rarity.name}</span><p class="sh-prize__kind">${esc(k.label)}</p><p class="sh-prize__name">${esc(res.item.name)}</p></div>`;
  $(`[data-chest="${chest.id}"]`)?.focus();
}
