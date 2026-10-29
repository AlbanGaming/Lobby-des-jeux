// GameVerse — lobby : à la une, sélection, grille filtrable, profil, succès, statistiques, réglages.

import { GAMES, CATEGORIES, getGame, getCategory, gamePath } from '../games/registry.js';
import * as meta from '../shared/js/meta.js';
import { icon } from '../shared/js/ui/icons.js';
import { avatarSVG, PALETTES, getPalette, randomSeed } from '../shared/js/ui/avatar.js';
import { toast, esc } from '../shared/js/ui/toast.js';
import { audio } from '../shared/js/engine/audio.js';
import { formatInt, formatDuration } from '../shared/js/core/math.js';
import { createRng, dailySeed, dayKey } from '../shared/js/core/rng.js';
import { createStore } from '../shared/js/storage.js';
import { motion } from '../shared/js/motion.js';
import { applyLook, FRAMES, equipped } from '../shared/js/shop.js';
import { initShop, openShop } from './shop.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Préférences d'affichage du lobby (onglet, catégorie) : simple confort, propre à ce navigateur
const ui = createStore('lobby-ui', { version: 1, defaults: { tab: '', category: 'all' } });

const state = {
  query: '',
  category: CATEGORIES.some((c) => c.id === ui.data.category) ? ui.data.category : 'all',
  tab: ui.data.tab,
  ptab: 'me',
  avatarSeeds: Array.from({ length: 10 }, randomSeed),
};

const data = () => meta.getData();
// Look d'avatar acheté à la boutique (cadre, accessoire)
const look = () => ({ frame: FRAMES.find((f) => f.id === data().look.frame), hat: data().look.hat });
const titleOf = () => (data().look.title !== 'none' ? equipped('title').name : '');
const stats = (id) => data().games[id];

const normalize = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function formatScore(game, n) {
  if (n === null || n === undefined) return '—';
  const unit = game.score?.unit;
  return formatInt(n) + (unit ? (unit === '€' ? ' €' : ` ${unit}`) : '');
}

const dateLabel = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// ---------- Sons d'interface ----------
audio.configure(meta.getSettings());
const sfx = (name, opts) => audio.play(name, { volume: 0.7, ...opts });

// ---------- Vignettes (SVG inline, animées au survol) ----------
const thumbCache = new Map();
let thumbUid = 0;

function loadThumb(id) {
  if (!thumbCache.has(id)) {
    thumbCache.set(
      id,
      fetch(`games/${id}/thumb.svg`)
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => ''),
    );
  }
  return thumbCache.get(id);
}

// Chaque copie reçoit des id uniques (dégradés, motifs) pour éviter les collisions dans le DOM
function uniqueIds(svg) {
  const n = ++thumbUid;
  return svg.replace(/id="([\w-]+)"/g, `id="$1-${n}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1-${n})`);
}

function injectThumb(el) {
  loadThumb(el.dataset.thumb).then((svg) => {
    if (!svg || !el.isConnected) return;
    el.insertAdjacentHTML('afterbegin', uniqueIds(svg));
    const s = el.querySelector('svg');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.setAttribute('preserveAspectRatio', `${el.dataset.align ?? 'xMidYMid'} slice`);
    requestAnimationFrame(() => el.classList.add('is-loaded'));
  });
}

// Les vignettes ne sont injectées qu'à l'approche de l'écran (DOM plus léger au chargement)
const thumbObserver =
  'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            thumbObserver.unobserve(e.target);
            injectThumb(e.target);
          }
        },
        { rootMargin: '300px 300px' },
      )
    : null;

function hydrateThumbs(root = document) {
  for (const el of $$('[data-thumb]:not([data-hydrated])', root)) {
    el.dataset.hydrated = '1';
    if (thumbObserver) thumbObserver.observe(el);
    else injectThumb(el);
  }
}

// ---------- En-tête ----------
function renderHeader() {
  const d = data();
  const lvl = meta.levelInfo(d.xp);
  const streak = meta.currentStreak();
  const playedToday = d.streak.last === dayKey();

  $('#btnSearch').innerHTML = icon('search');
  $('#btnSettings').innerHTML = icon('sliders');

  const s = $('#hdrStreak');
  s.innerHTML = `${icon('flame')}<span>${streak}</span>`;
  s.classList.toggle('is-cold', !playedToday);
  s.setAttribute('aria-label', `Série : ${streak} jour${streak > 1 ? 's' : ''}${playedToday ? '' : ', joue aujourd’hui pour la prolonger'}`);
  s.title = s.getAttribute('aria-label');

  const c = $('#hdrCredits');
  c.innerHTML = `${icon('coin')}<span>${formatInt(d.credits)}</span>`;
  c.setAttribute('aria-label', `Boutique : ${formatInt(d.credits)} crédits`);

  const C = 2 * Math.PI * 22;
  $('#btnProfile').innerHTML = `
    <svg class="lb-me__ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="none" stroke="var(--ink-700)" stroke-width="3"/>
      <circle cx="24" cy="24" r="22" fill="none" stroke="var(--coin)" stroke-width="3" stroke-linecap="round"
        stroke-dasharray="${(C * lvl.progress).toFixed(1)} ${C.toFixed(1)}"/>
    </svg>
    ${avatarSVG(d.profile.avatar, { size: 36, look: look() })}
    <span class="lb-me__lvl" aria-hidden="true">${lvl.level}</span>`;
  $('#btnProfile').setAttribute('aria-label', `Mon profil : ${d.profile.name}, niveau ${lvl.level}`);
}

// ---------- À la une / défi du jour ----------
function featuredGame() {
  const ch = meta.dailyChallenge();
  if (ch) return { game: getGame(ch.gameId), challenge: ch };
  const pool = GAMES.filter((g) => g.ready);
  const rng = createRng(dailySeed('une'));
  return { game: rng.pick(pool.length ? pool : GAMES), challenge: null };
}

function renderFeature() {
  const { game, challenge } = featuredGame();
  const el = $('#feature');
  el.style.setProperty('--g', game.color);
  el.style.setProperty('--gi', game.ink);
  const cat = getCategory(game.category);
  const kicker = challenge ? `${icon('calendar')} Défi du jour · ${dateLabel()}` : `${icon('sparkle')} À la une · ${dateLabel()}`;
  const rewards = challenge
    ? challenge.done
      ? `<span class="lb-reward lb-reward--done">${icon('check')} Défi réussi</span>`
      : `<span class="lb-reward">${icon('starFill')} +${challenge.reward.xp} XP</span><span class="lb-reward">${icon('coin')} +${challenge.reward.credits}</span>`
    : `<span class="lb-reward">${icon(cat?.icon ?? 'gamepad')} ${esc(cat?.label ?? '')}</span>`;
  el.innerHTML = `
    <div class="lb-feature__art" data-thumb="${game.id}" aria-hidden="true"></div>
    <div class="lb-feature__body">
      <p class="lb-feature__kicker">${kicker}</p>
      <h2 class="lb-feature__title">${esc(game.title)}</h2>
      <p class="lb-feature__text">${esc(challenge ? challenge.text : game.description)}</p>
      <div class="lb-feature__row">
        <a class="btn btn--primary btn--lg" href="${gamePath(game)}" data-play="${game.id}">${icon('play')}${challenge && !challenge.done ? 'Relever le défi' : 'Jouer'}</a>
        ${rewards}
      </div>
    </div>`;
  hydrateThumbs(el);
}

// ---------- Carte joueur ----------
function renderPlayer() {
  const d = data();
  const lvl = meta.levelInfo(d.xp);
  const streak = meta.currentStreak();
  const playedToday = d.streak.last === dayKey();
  const all = meta.allAchievements();
  const unlocked = all.filter((a) => d.achievements[a.key]).length;
  $('#player').innerHTML = `
    <div class="lb-player__id">
      <button class="lb-player__avatar" type="button" data-open="profile" aria-label="Modifier mon avatar">${avatarSVG(d.profile.avatar, { size: 68, look: look() })}</button>
      <div>
        <p class="lb-player__name">${esc(d.profile.name)}</p>
        ${titleOf() ? `<p class="lb-player__title">${esc(titleOf())}</p>` : ''}
        <p class="lb-player__lvl">Niveau <strong>${lvl.level}</strong> · ${formatInt(d.xp)} XP au total</p>
      </div>
    </div>
    <div class="lb-xp">
      <div class="meter" style="--value:${lvl.progress.toFixed(3)}" role="progressbar" aria-label="Progression vers le niveau ${lvl.level + 1}" aria-valuemin="0" aria-valuemax="${lvl.needed}" aria-valuenow="${lvl.into}"><div class="meter__fill"></div></div>
      <div class="lb-xp__row"><span>Niveau ${lvl.level + 1} dans</span><strong>${formatInt(lvl.needed - lvl.into)} XP</strong></div>
    </div>
    <div class="lb-tiles">
      <div class="lb-tile"><span style="color:var(--tomato)">${icon('flame')}</span><span class="lb-tile__value">${streak}</span><span class="lb-tile__label">jour${streak > 1 ? 's' : ''} de série</span></div>
      <button class="lb-tile" type="button" data-open="shop"><span style="color:var(--coin)">${icon('coin')}</span><span class="lb-tile__value">${formatInt(d.credits)}</span><span class="lb-tile__label">crédits · boutique</span></button>
      <button class="lb-tile" type="button" data-open="profile" data-ptab="ach"><span style="color:var(--mint)">${icon('trophy')}</span><span class="lb-tile__value">${unlocked}<small style="font-size:.55em;color:var(--text-3)">/${all.length}</small></span><span class="lb-tile__label">succès</span></button>
    </div>
    <p class="lb-player__hint ${playedToday ? 'is-done' : ''}">${playedToday ? `${icon('check')} Série prolongée aujourd’hui. À demain !` : `${icon('flame')} Joue une partie aujourd’hui pour ${streak ? 'prolonger' : 'lancer'} ta série.`}</p>`;
}

// ---------- Cartes de jeu ----------
function cardHTML(game, i = 0) {
  const st = stats(game.id);
  const fav = meta.isFavorite(game.id);
  const cat = getCategory(game.category);
  let line;
  const legacy = game.ready || game.keepLegacy ? '' : ' · ancienne version';
  if (st?.best !== null && st?.best !== undefined) line = `${icon('trophy')}<span>Record ${esc(formatScore(game, st.best))}${legacy}</span>`;
  else if (st?.plays) line = `<span>${esc(cat.label)} · ${st.plays} partie${st.plays > 1 ? 's' : ''}${legacy}</span>`;
  else line = `<span>${esc(cat.label)}${legacy}</span>`;
  const badges = [];
  const locked = !meta.gameUnlocked(game.id);
  if (locked) line = `${icon('lock')}<span>Jeu secret · ${formatInt(game.secret.cost)} crédits</span>`;
  else if (game.secret) badges.push('<span class="badge badge--secret">Secret</span>');
  if (game.status === 'new') badges.push('<span class="badge badge--new">Nouveau</span>');
  if (game.status === 'popular') badges.push('<span class="badge badge--hot">Populaire</span>');
  return `
    <article class="gcard ${locked ? 'is-locked' : ''}" style="--g:${game.color};--gi:${game.ink};--i:${i}" data-id="${game.id}">
      <a class="gcard__link" href="${locked ? '#boutique' : gamePath(game)}" ${locked ? `data-shop-game="${game.id}"` : `data-play="${game.id}"`}>
        <div class="gcard__thumb" data-thumb="${game.id}">
          <span class="gcard__play" aria-hidden="true">${icon(locked ? 'lock' : 'play')}</span>
        </div>
        <div class="gcard__body">
          <h3 class="gcard__title">${esc(game.title)}</h3>
          <p class="gcard__meta">${line}</p>
        </div>
      </a>
      <div class="gcard__badges">${badges.join('')}</div>
      <button class="gcard__fav" type="button" data-fav="${game.id}" aria-pressed="${fav}" aria-label="${fav ? 'Retirer' : 'Ajouter'} ${esc(game.title)} ${fav ? 'des' : 'aux'} favoris">${icon(fav ? 'heartFill' : 'heart')}</button>
    </article>`;
}

// ---------- Ta sélection ----------
const TABS = {
  continue: {
    list: () => GAMES.filter((g) => stats(g.id)?.lastPlayed).sort((a, b) => stats(b.id).lastPlayed - stats(a.id).lastPlayed),
    empty: { icon: 'restart', title: 'Rien à reprendre pour l’instant', text: 'Lance un jeu : il apparaîtra ici pour que tu le retrouves en un clic.' },
  },
  favorites: {
    list: () => data().favorites.map(getGame).filter(Boolean),
    empty: { icon: 'heart', title: 'Aucun favori', text: 'Touche le cœur sur la vignette d’un jeu pour l’épingler ici.' },
  },
  top: {
    list: () =>
      GAMES.filter((g) => stats(g.id)?.plays)
        .sort((a, b) => stats(b.id).timeMs - stats(a.id).timeMs || stats(b.id).plays - stats(a.id).plays)
        .slice(0, 8),
    empty: { icon: 'chart', title: 'Pas encore de classement', text: 'Joue quelques parties : tes jeux préférés se hisseront ici.' },
  },
  new: {
    list: () => [...GAMES.filter((g) => g.status === 'new'), ...GAMES.filter((g) => g.status !== 'new' && !stats(g.id)?.plays)],
    empty: { icon: 'sparkle', title: 'Tu as tout essayé', text: 'Les prochains jeux arriveront ici.' },
  },
};

function defaultTab() {
  if (TABS.continue.list().length) return 'continue';
  return 'new';
}

function renderPicks() {
  if (!TABS[state.tab]) state.tab = defaultTab();
  for (const b of $$('#picksTabs [role="tab"]')) {
    const on = b.dataset.tab === state.tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  const rail = $('#picksRail');
  rail.setAttribute('aria-labelledby', `tab-${state.tab}`);
  const list = TABS[state.tab].list();
  if (!list.length) {
    const e = TABS[state.tab].empty;
    rail.innerHTML = `
      <div class="lb-rail-empty" style="grid-column:1/-1">
        <span class="lb-rail-empty__icon">${icon(e.icon)}</span>
        <p><strong>${e.title}</strong>${e.text}</p>
        ${state.tab === 'favorites' ? '' : `<a class="btn btn--primary" href="#jeux" data-scroll="jeux">${icon('grid')}Voir les jeux</a>`}
      </div>`;
    return;
  }
  rail.innerHTML = list.map((g, i) => cardHTML(g, i)).join('');
  hydrateThumbs(rail);
}

// ---------- Tous les jeux ----------
function renderFilters() {
  const chips = [{ id: 'all', label: 'Tous', icon: 'grid' }, ...CATEGORIES];
  $('#filters').innerHTML = chips
    .map((c) => {
      const n = c.id === 'all' ? GAMES.length : GAMES.filter((g) => g.category === c.id).length;
      return `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${state.category === c.id}">${icon(c.icon)}${esc(c.label)} <span class="lb-chip-count">${n}</span></button>`;
    })
    .join('');
}

function matches(game, q) {
  if (!q) return true;
  const cat = getCategory(game.category);
  const hay = normalize([game.title, game.description, cat?.label ?? '', ...(game.tags ?? [])].join(' '));
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function renderGrid() {
  const q = normalize(state.query.trim());
  const list = GAMES.filter((g) => (state.category === 'all' || g.category === state.category) && matches(g, q));
  const grid = $('#grid');
  grid.innerHTML = list.map((g, i) => cardHTML(g, i)).join('');
  hydrateThumbs(grid);
  const empty = $('#empty');
  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.innerHTML = `
      <span class="lb-empty__art">${icon('search')}</span>
      <h3>Aucun jeu trouvé</h3>
      <p>Rien ne correspond à « ${esc(state.query.trim() || getCategory(state.category)?.label || '')} ». Essaie un autre mot, comme « course », « mots » ou « réflexion ».</p>
      <button class="btn btn--ghost" type="button" data-reset-filters>${icon('restart')}Tout afficher</button>`;
  }
  $('#gameCount').textContent = `${list.length} jeu${list.length > 1 ? 'x' : ''}`;
}

// ---------- Profil ----------
function renderProfilePanel() {
  const d = data();
  const av = d.profile.avatar;
  const palette = av?.kind === 'gen' ? av.palette ?? 0 : 0;
  // L'avatar actuel reste en tête : choisir un avatar ne réordonne jamais la liste
  if (av?.kind === 'gen' && !state.avatarSeeds.includes(av.seed)) state.avatarSeeds = [av.seed, ...state.avatarSeeds.slice(0, 9)];
  const seeds = state.avatarSeeds;
  $('#ppanel-me').innerHTML = `
    <div class="lb-me-head">
      <div class="lb-me-head__avatar">${avatarSVG(av, { size: 112, label: 'Ton avatar', look: look() })}</div>
      <form class="lb-me-head__form" id="nameForm">
        <label class="field__label" for="nameInput">Pseudo</label>
        <div class="lb-me-head__row">
          <input class="input" id="nameInput" maxlength="16" autocomplete="nickname" value="${esc(d.profile.name)}" aria-describedby="nameHelp">
          <button class="btn btn--primary" type="submit">OK</button>
        </div>
        <p class="lb-help" id="nameHelp">2 à 16 caractères.</p>
      </form>
    </div>

    <div class="lb-group" style="margin-top:var(--s-5)">
      <p class="lb-group__title">Avatar</p>
      <div class="lb-avatars">
        ${seeds
          .map((seed) => {
            const on = av?.kind === 'gen' && av.seed === seed;
            return `<button class="lb-avatar-opt" type="button" data-seed="${seed}" aria-pressed="${on}" aria-label="Choisir cet avatar">${avatarSVG({ kind: 'gen', seed, palette }, { size: 60 })}</button>`;
          })
          .join('')}
        ${av?.kind === 'image' ? `<button class="lb-avatar-opt" type="button" aria-pressed="true" aria-label="Image importée">${avatarSVG(av, { size: 60 })}</button>` : ''}
        <button class="lb-avatar-opt lb-avatar-opt--action" type="button" data-shuffle>${icon('dice')}Mélanger</button>
        <button class="lb-avatar-opt lb-avatar-opt--action" type="button" data-import-avatar>${icon('image')}Importer</button>
      </div>
    </div>

    <div class="lb-group">
      <p class="lb-group__title">Couleur · ${formatInt(d.credits)} crédits disponibles</p>
      <div class="lb-palettes">
        ${PALETTES.map((p) => {
          const owned = p.cost === 0 || meta.owns(`palette:${p.id}`);
          const on = av?.kind === 'gen' && palette === p.id;
          const label = owned ? p.name : `${p.name}, ${p.cost} crédits`;
          return `<button class="lb-swatch ${owned ? '' : 'is-locked'}" type="button" data-palette="${p.id}" aria-pressed="${on}" aria-label="${esc(label)}">
            <span class="lb-swatch__dot" style="background:${p.main}"></span>${esc(p.name)}
            ${owned ? '' : `<span class="lb-swatch__price">${icon('coin')}${p.cost}</span>`}
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function renderStatsPanel() {
  const d = data();
  const lvl = meta.levelInfo(d.xp);
  const tiles = [
    ['Niveau', lvl.level],
    ['XP totale', formatInt(d.xp)],
    ['Parties', formatInt(d.stats.runs)],
    ['Temps de jeu', formatDuration(d.stats.timeMs)],
    ['Jours joués', formatInt(d.stats.days)],
    ['Meilleure série', `${d.streak.best} j`],
    ['Records battus', formatInt(d.records)],
    ['Défis réussis', formatInt(d.dailyWins)],
  ];
  const rows = GAMES.map((g) => ({ g, s: stats(g.id) })).sort((a, b) => (b.s?.plays ?? 0) - (a.s?.plays ?? 0));
  $('#ppanel-stats').innerHTML = `
    <div class="lb-stats-grid">${tiles.map(([l, v]) => `<div class="gv-stat lb-tile"><span class="lb-tile__label">${l}</span><span class="lb-tile__value">${esc(v)}</span></div>`).join('')}</div>
    <div class="lb-group" style="margin-top:var(--s-5)">
      <p class="lb-group__title">Par jeu</p>
      <div class="lb-box" style="overflow-x:auto">
        <table class="lb-table">
          <thead><tr><th scope="col">Jeu</th><th scope="col">Parties</th><th scope="col">Temps</th><th scope="col">Record</th></tr></thead>
          <tbody>
            ${rows
              .map(({ g, s }) => `<tr><td><span class="lb-table__game"><span class="lb-table__dot" style="background:${g.color}"></span>${esc(g.title)}</span></td><td>${formatInt(s?.plays ?? 0)}</td><td>${s?.timeMs ? formatDuration(s.timeMs) : '—'}</td><td>${esc(formatScore(g, s?.best ?? null))}</td></tr>`)
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderAchievementsPanel() {
  const d = data();
  const all = meta.allAchievements();
  const done = all.filter((a) => d.achievements[a.key]).length;
  const groups = [{ title: 'GameVerse', items: all.filter((a) => a.scope === 'global') }];
  for (const g of GAMES) {
    const items = all.filter((a) => a.scope === g.id);
    if (items.length) groups.push({ title: g.title, items });
  }
  const fmtDate = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  $('#ppanel-ach').innerHTML = `
    <div class="lb-ach-summary">
      <div class="lb-xp__row"><span>Succès débloqués</span><strong>${done} / ${all.length}</strong></div>
      <div class="meter" style="--value:${(done / Math.max(1, all.length)).toFixed(3)};--meter-color:var(--mint)"><div class="meter__fill"></div></div>
    </div>
    ${groups
      .map(
        (gr) => `
      <div class="lb-group">
        <p class="lb-group__title">${esc(gr.title)}</p>
        <div class="lb-ach-list">
          ${gr.items
            .map((a) => {
              const t = d.achievements[a.key];
              const hidden = a.secret && !t;
              return `<div class="lb-ach ${t ? 'is-on' : ''}">
                <span class="lb-ach__icon">${icon(t ? 'trophy' : 'lock')}</span>
                <span><span class="lb-ach__title">${esc(hidden ? 'Succès secret' : a.title)}</span><span class="lb-ach__desc" style="display:block">${esc(hidden ? 'Continue à jouer pour le découvrir.' : t ? `Débloqué le ${fmtDate(t)}` : a.desc)}</span></span>
                ${a.xp ? `<span class="lb-ach__xp">+${a.xp} XP</span>` : ''}
              </div>`;
            })
            .join('')}
        </div>
      </div>`,
      )
      .join('')}
    <p class="lb-help" style="margin-top:var(--s-4)">Chaque jeu refait ajoutera ses propres succès ici.</p>`;
}

function renderProfile() {
  for (const b of $$('#dlgProfile [role="tab"]')) {
    const on = b.dataset.ptab === state.ptab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  for (const p of ['me', 'stats', 'ach']) $(`#ppanel-${p}`).hidden = p !== state.ptab;
  if (state.ptab === 'me') renderProfilePanel();
  if (state.ptab === 'stats') renderStatsPanel();
  if (state.ptab === 'ach') renderAchievementsPanel();
}

function setAvatar(patch) {
  const d = data();
  const cur = d.profile.avatar?.kind === 'gen' ? d.profile.avatar : { kind: 'gen', seed: randomSeed(), palette: 0 };
  meta.setProfile({ avatar: { ...cur, ...patch, kind: 'gen' } });
}

async function importAvatar(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast({ title: 'Fichier non reconnu', text: 'Choisis une image (PNG, JPG, WebP…).', iconName: 'info', tone: 'var(--tomato)' });
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // On réduit l'image à 160×160 pour ne pas saturer le stockage local
    const size = 160;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    let dataUrl = c.toDataURL('image/webp', 0.86);
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = c.toDataURL('image/jpeg', 0.86);
    meta.setProfile({ avatar: { kind: 'image', data: dataUrl } });
    sfx('confirm');
    toast({ title: 'Avatar importé', text: 'Ton image a été recadrée en carré.', iconName: 'image', tone: 'var(--mint)' });
  } catch {
    toast({ title: 'Image illisible', text: 'Essaie avec un autre fichier.', iconName: 'info', tone: 'var(--tomato)' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Paramètres ----------
function renderSettings() {
  const s = meta.getSettings();
  const motionOpts = [
    ['system', 'Système'],
    ['reduced', 'Réduites'],
    ['full', 'Complètes'],
  ];
  $('#settingsBody').innerHTML = `
    <div class="lb-group">
      <p class="lb-group__title">Audio</p>
      <div class="lb-box">
        <div class="setting-row"><span class="setting-row__text"><span id="set-sound">Effets sonores</span><span class="setting-row__hint">Sons synthétisés en direct, dans les jeux et le lobby</span></span><button class="switch" type="button" role="switch" aria-labelledby="set-sound" aria-checked="${s.sound}" data-setting="sound"></button></div>
        <div class="setting-row"><span class="setting-row__text"><span id="set-music">Musique</span><span class="setting-row__hint">Boucles chiptune pendant les parties</span></span><button class="switch" type="button" role="switch" aria-labelledby="set-music" aria-checked="${s.music}" data-setting="music"></button></div>
        <div class="setting-row"><label for="set-volume">Volume</label><input class="lb-range" id="set-volume" type="range" min="0" max="1" step="0.05" value="${s.volume}"></div>
      </div>
    </div>
    <div class="lb-group">
      <p class="lb-group__title">Affichage</p>
      <div class="lb-box">
        <div class="setting-row lb-setting--stack"><span class="setting-row__text"><span id="set-motion">Animations</span><span class="setting-row__hint">« Réduites » coupe les secousses et la plupart des mouvements</span></span>
          <div class="lb-seg" role="radiogroup" aria-labelledby="set-motion">${motionOpts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${s.motion === v}" data-motion="${v}">${l}</button>`).join('')}</div>
        </div>
      </div>
    </div>
    <div class="lb-group">
      <p class="lb-group__title">Données</p>
      <p class="lb-help" style="margin-bottom:var(--s-3)">Ta progression est enregistrée uniquement dans ce navigateur. Exporte-la pour la sauvegarder ou la transférer sur un autre appareil.</p>
      <div class="lb-data-actions">
        <button class="btn btn--sm" type="button" data-export>${icon('download')}Exporter</button>
        <button class="btn btn--sm" type="button" data-import>${icon('upload')}Importer</button>
        <button class="btn btn--sm btn--danger" type="button" data-reset>${icon('trash')}Réinitialiser</button>
      </div>
    </div>`;
}

function exportData() {
  const blob = new Blob([JSON.stringify(meta.exportAll(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gameverse-sauvegarde-${dayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast({ title: 'Sauvegarde exportée', text: a.download, iconName: 'download', tone: 'var(--mint)' });
}

async function importData(file) {
  try {
    const payload = JSON.parse(await file.text());
    meta.importAll(payload);
    toast({ title: 'Sauvegarde importée', text: 'Ta progression a été restaurée.', iconName: 'upload', tone: 'var(--mint)' });
    renderSettings();
  } catch (err) {
    toast({ title: 'Import impossible', text: err.message || 'Fichier invalide.', iconName: 'info', tone: 'var(--tomato)' });
  }
}

function confirmAction({ title, text, ok }) {
  const dlg = $('#dlgConfirm');
  $('#confirmTitle').textContent = title;
  $('#confirmText').textContent = text;
  $('#confirmYes').textContent = ok;
  return new Promise((resolve) => {
    const done = (v) => {
      dlg.close();
      resolve(v);
    };
    $('#confirmYes').onclick = () => done(true);
    $('#confirmNo').onclick = () => done(false);
    dlg.addEventListener('cancel', () => resolve(false), { once: true });
    dlg.showModal();
    $('#confirmNo').focus();
  });
}

// ---------- Rendu global ----------
function renderAll() {
  renderHeader();
  renderFeature();
  renderPlayer();
  renderPicks();
  renderFilters();
  renderGrid();
  if ($('#dlgProfile').open) renderProfile();
  if ($('#dlgSettings').open) renderSettings();
}

// ---------- Ouverture des boîtes de dialogue ----------
function openDialog(name, opts = {}) {
  sfx('select');
  if (name === 'profile') {
    if (opts.ptab) state.ptab = opts.ptab;
    renderProfile();
    $('#dlgProfile').showModal();
  } else if (name === 'settings') {
    renderSettings();
    $('#dlgSettings').showModal();
  } else if (name === 'shop') {
    openShop(opts.stab);
  }
}

for (const dlg of $$('dialog')) {
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close(); // clic sur le fond
  });
  for (const b of $$('[data-close]', dlg)) {
    b.innerHTML = icon('close');
    b.addEventListener('click', () => {
      sfx('back');
      dlg.close();
    });
  }
}

// ---------- Évènements ----------
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;

  if (t.dataset.fav) {
    e.preventDefault();
    const added = meta.toggleFavorite(t.dataset.fav);
    sfx(added ? 'pop' : 'back');
    // Animation sur toutes les copies de la carte, puis rendu après coup
    renderPicks();
    renderGrid();
    for (const b of $$(`[data-fav="${t.dataset.fav}"]`)) {
      b.classList.add('is-pop');
      b.addEventListener('animationend', () => b.classList.remove('is-pop'), { once: true });
    }
    const g = getGame(t.dataset.fav);
    toast({ title: added ? 'Ajouté aux favoris' : 'Retiré des favoris', text: g.title, iconName: added ? 'heartFill' : 'heart', tone: added ? 'var(--tomato)' : undefined, duration: 1800 });
    return;
  }

  if (t.dataset.shopGame) {
    e.preventDefault();
    openDialog('shop', { stab: 'jeux' });
    return;
  }

  if (t.dataset.play) {
    // Les jeux pas encore refaits ne parlent pas à la méta : on compte le lancement ici
    const g = getGame(t.dataset.play);
    if (g && !g.ready) meta.startRun(g.id);
    sfx('confirm');
    return;
  }

  if (t.dataset.open) {
    e.preventDefault();
    openDialog(t.dataset.open, { ptab: t.dataset.ptab });
    return;
  }

  if (t.dataset.cat) {
    state.category = t.dataset.cat;
    ui.data.category = state.category;
    ui.save();
    sfx('tick');
    renderFilters();
    renderGrid();
    return;
  }

  if (t.matches('[data-reset-filters]')) {
    state.category = 'all';
    state.query = '';
    $('#search').value = '';
    renderFilters();
    renderGrid();
    $('#search').focus();
    return;
  }

  if (t.dataset.scroll) {
    e.preventDefault();
    const target = document.getElementById(t.dataset.scroll);
    target.scrollIntoView({ behavior: motion.reduced ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
    return;
  }

  // --- Profil ---
  if (t.dataset.ptab && t.closest('#dlgProfile')) {
    state.ptab = t.dataset.ptab;
    sfx('tick');
    renderProfile();
    $(`#ptab-${state.ptab}`).focus();
    return;
  }
  if (t.dataset.seed) {
    setAvatar({ seed: t.dataset.seed });
    sfx('select');
    return;
  }
  if (t.matches('[data-shuffle]')) {
    const cur = data().profile.avatar;
    state.avatarSeeds = Array.from({ length: 10 }, randomSeed);
    if (cur?.kind === 'gen') state.avatarSeeds[0] = cur.seed;
    sfx('whoosh');
    renderProfilePanel();
    return;
  }
  if (t.matches('[data-import-avatar]')) {
    $('#fileAvatar').click();
    return;
  }
  if (t.dataset.palette !== undefined && t.closest('#dlgProfile')) {
    const p = getPalette(Number(t.dataset.palette));
    const item = `palette:${p.id}`;
    if (p.cost > 0 && !meta.owns(item)) {
      if (data().credits < p.cost) {
        sfx('error');
        toast({ title: 'Crédits insuffisants', text: `Il te manque ${formatInt(p.cost - data().credits)} crédits. Joue pour en gagner !`, iconName: 'coin', tone: 'var(--tomato)' });
        return;
      }
      confirmAction({ title: `Débloquer « ${p.name} » ?`, text: `Cette couleur coûte ${p.cost} crédits. Tu en as ${formatInt(data().credits)}.`, ok: `Débloquer · ${p.cost}` }).then((yes) => {
        if (!yes) return;
        meta.buy(item, p.cost);
        setAvatar({ palette: p.id });
        sfx('powerup');
        toast({ title: 'Couleur débloquée', text: p.name, iconName: 'sparkle', tone: p.main });
      });
      return;
    }
    setAvatar({ palette: p.id });
    sfx('select');
    return;
  }

  // --- Paramètres ---
  if (t.dataset.setting) {
    const k = t.dataset.setting;
    meta.setSetting(k, !meta.getSettings()[k]);
    audio.configure(meta.getSettings());
    sfx('tick');
    renderSettings();
    $(`[data-setting="${k}"]`).focus();
    return;
  }
  if (t.dataset.motion) {
    meta.setSetting('motion', t.dataset.motion);
    sfx('tick');
    renderSettings();
    $(`[data-motion="${t.dataset.motion}"]`).focus();
    return;
  }
  if (t.matches('[data-export]')) return exportData();
  if (t.matches('[data-import]')) return $('#fileImport').click();
  if (t.matches('[data-reset]')) {
    confirmAction({
      title: 'Tout effacer ?',
      text: 'Niveau, succès, records, favoris et sauvegardes de tous les jeux seront supprimés de ce navigateur. Pense à exporter avant si tu veux les garder.',
      ok: 'Tout effacer',
    }).then((yes) => {
      if (!yes) return;
      meta.resetAll();
      state.tab = '';
      sfx('explode');
      toast({ title: 'Données réinitialisées', text: 'Nouveau départ !', iconName: 'restart' });
    });
  }
});

// Onglets « Ta sélection » : clic et flèches
const picksTabs = $('#picksTabs');
picksTabs.addEventListener('click', (e) => {
  const b = e.target.closest('[role="tab"]');
  if (!b) return;
  state.tab = b.dataset.tab;
  ui.data.tab = state.tab;
  ui.save();
  sfx('tick');
  renderPicks();
});
function arrowTabs(container, onPick) {
  container.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const tabs = $$('[role="tab"]', container);
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[n].focus();
    onPick(tabs[n]);
  });
}
arrowTabs(picksTabs, (b) => b.click());
arrowTabs($('#dlgProfile .lb-dtabs'), (b) => b.click());

// Pseudo
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'nameForm') return;
  e.preventDefault();
  const input = $('#nameInput');
  const name = input.value.replace(/\s+/g, ' ').trim();
  const help = $('#nameHelp');
  if (name.length < 2) {
    help.textContent = 'Ton pseudo doit faire au moins 2 caractères.';
    help.classList.add('is-error');
    sfx('error');
    input.focus();
    return;
  }
  meta.setProfile({ name: name.toUpperCase() });
  sfx('confirm');
  toast({ title: 'Pseudo enregistré', text: name.toUpperCase(), iconName: 'user', tone: 'var(--mint)', duration: 2000 });
});

// Volume
document.addEventListener('input', (e) => {
  if (e.target.id === 'set-volume') {
    const v = Number(e.target.value);
    meta.getSettings().volume = v;
    audio.configure({ volume: v });
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'set-volume') {
    meta.setSetting('volume', Number(e.target.value));
    sfx('tick');
  }
});

// Fichiers
$('#fileAvatar').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (f) importAvatar(f);
});
$('#fileImport').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (f) importData(f);
});

// Recherche instantanée
const search = $('#search');
$('#searchIcon').innerHTML = icon('search');
search.addEventListener('input', () => {
  state.query = search.value;
  renderGrid();
});
search.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && search.value) {
    e.stopPropagation();
    search.value = '';
    state.query = '';
    renderGrid();
  }
});
function focusSearch() {
  $('#jeux').scrollIntoView({ behavior: motion.reduced ? 'auto' : 'smooth', block: 'start' });
  search.focus({ preventScroll: true });
}
$('#btnSearch').addEventListener('click', focusSearch);
$('#btnProfile').addEventListener('click', () => openDialog('profile', { ptab: 'me' }));
$('#btnSettings').addEventListener('click', () => openDialog('settings'));
$('#hdrCredits').addEventListener('click', () => openDialog('shop'));
document.addEventListener('keydown', (e) => {
  const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
  if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    focusSearch();
  }
});

// Petit son au survol des cartes (souris uniquement, très discret)
document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const link = e.target.closest?.('.gcard__link');
  if (link && !link.contains(e.relatedTarget)) audio.play('hover', { volume: 0.5, throttle: 0.06 });
});

// Méta-progression
meta.events.addEventListener('change', () => {
  applyLook();
  renderAll();
});
meta.events.addEventListener('gel', (e) => {
  toast({ title: 'Série sauvée !', text: `${e.detail.used} gel${e.detail.used > 1 ? 's' : ''} de série utilisé${e.detail.used > 1 ? 's' : ''}. Il t’en reste ${e.detail.left}.`, iconName: 'flame', tone: 'var(--sky)' });
});
meta.events.addEventListener('settings', (e) => audio.configure(e.detail));
meta.events.addEventListener('achievement', (e) => {
  sfx('achievement');
  toast({ title: e.detail.title, text: e.detail.desc });
});
meta.events.addEventListener('levelup', (e) => {
  sfx('levelUp');
  toast({ title: `Niveau ${e.detail.level} !`, text: '+25 crédits', iconName: 'starFill', tone: 'var(--mint)' });
});

// Retour depuis un jeu via le bouton Précédent (page restaurée du cache) : on relit la sauvegarde
window.addEventListener('pageshow', (e) => {
  if (e.persisted) meta.reload();
});

applyLook();
initShop({ confirmAction: (o) => confirmAction(o), sfx, hydrateThumbs });
renderAll();
// Lien direct vers la boutique (depuis un jeu secret verrouillé)
if (location.hash === '#boutique') openDialog('shop', { stab: 'jeux' });
document.documentElement.classList.add('is-ready');
document.documentElement.setAttribute('data-gv-ready', '');
