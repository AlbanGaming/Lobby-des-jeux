// Donjon de cartes — trois actes, une carte à embranchements, des combats au tour par tour.
// Tu joues des cartes avec ton énergie ; chaque ennemi annonce son prochain coup. Entre les
// combats : récompenses, feux de camp (repos ou forge), marchands et trésors. Au bout du
// donjon, l'Architecte : une IA qui lit ton paquet avant le combat pour te contrer, puis
// réécrit sa stratégie à mi-vie d'après les cartes que tu as vraiment jouées.

import { bootGame } from '../../shared/js/gameverse.js';
import { createRng, dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { HEROES, CARDS, FOES, ENCOUNTERS, RELICS, RELIC_POOL } from './data.js';

const ACT_NAMES = { 1: 'Les cavernes', 2: 'La crypte', 3: 'La tour de l’Architecte' };
const ROWS = 6; // 6 rangées puis le boss
const HAND = 5;
const ENERGY = 3;

const store = createStore('donjon', {
  version: 1,
  defaults: { hero: 'lame', mode: 'normal', bosses: 0, wins: 0, run: null, daily: { day: '', best: 0, plays: 0 } },
});
const params = new URLSearchParams(location.search);

const gv = bootGame('donjon', {
  hud: [
    { id: 'floor', label: 'Étage' },
    { id: 'hp', label: 'PV' },
    { id: 'gold', label: 'Or' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['icon:pointer'], text: 'Touche une carte pour la jouer (puis l’ennemi visé s’il y en a plusieurs). Touches 1 à 9, flèches pour viser, E pour finir le tour.' },
    { keys: ['icon:eye'], text: 'Chaque ennemi annonce son prochain coup : protège-toi avant une grosse attaque, frappe quand il se renforce.' },
    { keys: ['icon:crown'], text: 'Choisis ton chemin : combats, élites, feux de camp, marchands, trésors. L’Architecte t’attend au sommet.' },
  ],
  onStart: () => startRun(),
  onRestart: () => startRun(),
  formatScore: (n) => formatInt(n),
});

const root = document.createElement('div');
root.className = 'dj-root';
gv.stage.append(root);

let run = null;
let C = null; // combat en cours
let screen = 'menu'; // menu | map | combat | reward | camp | shop | treasure | over
let resumeNext = false;
let uid = 1;

const heroOf = (id) => HEROES.find((h) => h.id === id) ?? HEROES[0];
const heroOpen = (h) => h.id === 'lame' || (h.id === 'ombre' ? store.data.bosses >= 1 : store.data.bosses >= 2);
const def = (c) => ({ ...CARDS[c.id], ...(c.up ? CARDS[c.id].up : {}) });
const has = (r) => run.relics.includes(r);
const rng = () => createRng(run.seed + run.counter++ * 7919);
const alive = () => C.enemies.filter((e) => e.hp > 0);
const wait = (ms) => new Promise((r) => gv.after(ms, r));
const pool = (hero) => Object.keys(CARDS).filter((id) => CARDS[id].hero === hero && id !== heroOf(hero).starter);

// ---------- Textes des cartes ----------
function describe(d, P = null) {
  const out = [];
  const tgt = d.all ? ' à tous les ennemis' : '';
  const atk = (n) => (P ? Math.max(0, Math.floor((n + P.str) * (P.weak ? 0.75 : 1))) : n);
  if (d.block) out.push(`Gagne ${d.block} d’armure`);
  if (d.dmg) out.push(`Inflige ${atk(d.dmg)} dégâts${d.times > 1 ? ` ${d.times} fois` : ''}${tgt}`);
  if (d.blockDmg) out.push('Inflige autant de dégâts que ton armure');
  if (d.vuln) out.push(`Vulnérable ${d.vuln}${d.dmg ? '' : tgt}`);
  if (d.weak) out.push(`Faiblesse ${d.weak}${d.dmg ? '' : tgt}`);
  if (d.poison) out.push(`Poison ${d.poison}${d.dmg ? '' : tgt}`);
  if (d.doublePoison) out.push('Double le poison de la cible');
  if (d.str) out.push(`+${d.str} Force`);
  if (d.thorns) out.push(`+${d.thorns} Épines`);
  if (d.draw) out.push(`Pioche ${d.draw}`);
  if (d.energy) out.push(`+${d.energy} énergie`);
  if (d.strTurn) out.push(`À chaque tour : +${d.strTurn} Force`);
  if (d.blockTurn) out.push(`À chaque tour : ${d.blockTurn} d’armure`);
  if (d.poisonTurn) out.push(`À chaque tour : Poison ${d.poisonTurn} à tous les ennemis`);
  if (d.energyTurn) out.push(`À chaque tour : +${d.energyTurn} énergie`);
  if (d.exhaust) out.push('Épuisée après usage');
  return out.join('. ') + '.';
}
const TYPE = { atk: 'Attaque', skl: 'Technique', pow: 'Pouvoir' };

function cardHTML(c, { idx = null, disabled = false, price = null, data = '', selected = false } = {}) {
  const d = def(c);
  return `<button type="button" class="dj-card dj-card--${d.type} ${c.up ? 'is-up' : ''} ${selected ? 'is-selected' : ''}" ${idx !== null ? `data-card="${idx}"` : ''} ${data} ${disabled ? 'aria-disabled="true"' : ''}>
    <span class="dj-card__cost">${d.cost}</span>
    <span class="dj-card__name">${esc(d.name)}${c.up ? '+' : ''}</span>
    <span class="dj-card__type">${TYPE[d.type]}</span>
    <span class="dj-card__text">${esc(describe(d, screen === 'combat' && C ? C.P : null))}</span>
    ${price !== null ? `<span class="dj-card__price">${icon('coin')}${price}</span>` : ''}
    ${idx !== null && idx < 9 ? `<kbd>${idx + 1}</kbd>` : ''}
  </button>`;
}

// ---------- Dessins ----------
function foeSVG(shape, color) {
  const eyes = (y = 52, dx = 12) => `<circle cx="${50 - dx}" cy="${y}" r="5" fill="#0b0a14"/><circle cx="${50 + dx}" cy="${y}" r="5" fill="#0b0a14"/><circle cx="${51 - dx}" cy="${y - 1.5}" r="1.6" fill="#fff"/><circle cx="${51 + dx}" cy="${y - 1.5}" r="1.6" fill="#fff"/>`;
  const body = {
    blob: `<path d="M18 80c-6-30 8-56 32-56s38 26 32 56z" fill="${color}"/>${eyes(56)}`,
    horn: `<path d="M28 34l-8-20 18 12M72 34l8-20-18 12" fill="#e8e2d0"/><path d="M20 82c0-34 12-52 30-52s30 18 30 52z" fill="${color}"/>${eyes(54)}<path d="M40 70h20" stroke="#0b0a14" stroke-width="4" stroke-linecap="round"/>`,
    cap: `<rect x="38" y="50" width="24" height="34" rx="8" fill="#e8e2d0"/><path d="M12 54c2-22 18-36 38-36s36 14 38 36z" fill="${color}"/><circle cx="34" cy="36" r="5" fill="#fff8ec"/><circle cx="60" cy="30" r="4" fill="#fff8ec"/>${eyes(66, 7)}`,
    helm: `<path d="M22 86V44c0-18 12-28 28-28s28 10 28 28v42z" fill="${color}"/><rect x="28" y="46" width="44" height="10" rx="4" fill="#0b0a14"/><circle cx="40" cy="51" r="3" fill="#ff3b5c"/><circle cx="60" cy="51" r="3" fill="#ff3b5c"/><path d="M50 16v-8" stroke="${color}" stroke-width="6"/>`,
    golem: `<rect x="18" y="30" width="64" height="56" rx="8" fill="${color}"/><rect x="30" y="12" width="40" height="26" rx="6" fill="${color}" stroke="#0b0a14" stroke-opacity=".25" stroke-width="3"/><rect x="36" y="20" width="9" height="7" fill="#ffc93c"/><rect x="55" y="20" width="9" height="7" fill="#ffc93c"/><path d="M30 52h40M40 66h20" stroke="#0b0a14" stroke-opacity=".3" stroke-width="4"/>`,
    skull: `<path d="M24 50c0-20 12-32 26-32s26 12 26 32c0 10-6 14-10 16v14H34V66c-4-2-10-6-10-16z" fill="${color}"/><circle cx="40" cy="50" r="7" fill="#0b0a14"/><circle cx="60" cy="50" r="7" fill="#0b0a14"/><path d="M42 74v6M50 74v6M58 74v6" stroke="#0b0a14" stroke-width="3"/>`,
    hood: `<path d="M50 12c-22 8-30 34-30 74h60c0-40-8-66-30-74z" fill="${color}"/><ellipse cx="50" cy="52" rx="16" ry="18" fill="#0b0a14"/><circle cx="44" cy="50" r="3" fill="#ffc93c"/><circle cx="56" cy="50" r="3" fill="#ffc93c"/>`,
    hydra: `<path d="M30 86c0-20 8-30 20-30s20 10 20 30z" fill="${color}"/><path d="M40 60C26 50 18 36 22 22M50 56V18M60 60c14-10 22-24 18-38" stroke="${color}" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="22" cy="20" r="9" fill="${color}"/><circle cx="50" cy="16" r="9" fill="${color}"/><circle cx="78" cy="20" r="9" fill="${color}"/><circle cx="20" cy="18" r="2.5" fill="#ffc93c"/><circle cx="48" cy="14" r="2.5" fill="#ffc93c"/><circle cx="80" cy="18" r="2.5" fill="#ffc93c"/>`,
    eye: `<path d="M50 14l30 18v36L50 86 20 68V32z" fill="${color}"/><ellipse cx="50" cy="50" rx="20" ry="14" fill="#fff8ec"/><circle cx="50" cy="50" r="8" fill="#0b0a14"/><circle cx="52" cy="47" r="2.5" fill="#fff"/>`,
    architect: `<path d="M50 8l38 22v40L50 92 12 70V30z" fill="#1c1145" stroke="${color}" stroke-width="4"/><path d="M50 8v84M12 30l76 40M88 30L12 70" stroke="${color}" stroke-opacity=".35" stroke-width="2"/><ellipse cx="50" cy="50" rx="18" ry="11" fill="#0b0a14" stroke="${color}" stroke-width="3"/><circle cx="50" cy="50" r="6" fill="#ff3b5c"/>`,
  }[shape];
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
}
function heroSVG(h) {
  const art = {
    lame: `<path d="M50 8l8 52H42z" fill="#e8e2d0"/><rect x="34" y="58" width="32" height="8" rx="3" fill="${h.color}"/><rect x="46" y="64" width="8" height="22" rx="3" fill="#8a5a2e"/>`,
    ombre: `<path d="M50 10c-18 10-26 36-26 76h52c0-40-8-66-26-76z" fill="${h.color}"/><path d="M38 50l12-4 12 4-12 6z" fill="#0b0a14"/><path d="M66 60l18-26" stroke="#e8e2d0" stroke-width="5" stroke-linecap="round"/>`,
    arcane: `<path d="M44 90l4-60h4l4 60z" fill="#8a5a2e"/><circle cx="50" cy="24" r="14" fill="${h.color}"/><circle cx="50" cy="24" r="6" fill="#fff8ec"/><path d="M30 12l4 6M70 12l-4 6M26 30h6M68 30h6" stroke="${h.color}" stroke-width="3" stroke-linecap="round"/>`,
  }[h.id];
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${art}</svg>`;
}

// ---------- Partie ----------
function newMap(act) {
  const r = createRng(run.seed + act * 101);
  const rows = [];
  for (let row = 0; row < ROWS; row++) {
    const cells = [];
    for (let col = 0; col < 3; col++) {
      let type = 'combat';
      if (row === ROWS - 1) type = 'feu';
      else if (row > 0) type = r.weighted(['combat', 'elite', 'feu', 'marchand', 'tresor'], (t) => ({ combat: 45, elite: row >= 2 ? 16 : 0, feu: row >= 2 ? 12 : 0, marchand: 12, tresor: 12 })[t]);
      cells.push(type);
    }
    rows.push(cells);
  }
  return rows;
}

function startRun() {
  if (resumeNext && store.data.run) {
    resumeNext = false;
    run = structuredClone(store.data.run);
    uid = Math.max(0, ...run.deck.map((c) => c.uid)) + 1;
    // Sauvegarde prise juste après un boss : on passe à l'acte suivant
    return run.row === ROWS ? afterNode() : showMap();
  }
  resumeNext = false;
  const h = heroOf(store.data.hero);
  const hero = heroOpen(h) ? h : HEROES[0];
  const daily = store.data.mode === 'jour';
  const seed = daily ? dailySeed('donjon') : Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
  const deck = [];
  for (let k = 0; k < 5; k++) deck.push({ id: 'frappe', up: false, uid: uid++ });
  for (let k = 0; k < 4; k++) deck.push({ id: 'defense', up: false, uid: uid++ });
  deck.push({ id: hero.starter, up: false, uid: uid++ });
  run = { hero: hero.id, hp: hero.hp, max: hero.hp, gold: 60, deck, relics: [hero.relic], act: 1, row: -1, col: null, seed, counter: 0, floor: 0, kills: 0, elites: 0, bosses: 0, win: false, forged: 0, daily, map: null };
  run.map = newMap(1);
  showMap();
}

function hud() {
  gv.hud('floor', run.floor);
  gv.hud('hp', `${run.hp}/${run.max}`);
  gv.hud('gold', formatInt(run.gold));
}
function saveRun() {
  // Une copie : la partie continue de changer après l'enregistrement
  store.data.run = run && !run.over ? structuredClone(run) : null;
  store.save();
}

// ---------- Carte du donjon ----------
const NODE = { combat: ['target', 'Combat'], elite: ['crown', 'Élite'], feu: ['flame', 'Feu de camp'], marchand: ['coin', 'Marchand'], tresor: ['sparkle', 'Trésor'], boss: ['trophy', 'Boss'] };
const canGo = (row, col) => row === run.row + 1 && (run.col === null || Math.abs(col - run.col) <= 1);

function showMap() {
  screen = 'map';
  C = null;
  saveRun();
  hud();
  const bossRow = run.row === ROWS - 1;
  const boss = ENCOUNTERS[run.act].boss[0];
  root.innerHTML = `
    <div class="dj-map">
      ${barHTML()}
      <h2 class="dj-act">Acte ${run.act} · ${ACT_NAMES[run.act]}</h2>
      <div class="dj-boss">
        <button type="button" class="dj-node dj-node--boss ${bossRow ? 'is-open' : ''}" data-boss ${bossRow ? '' : 'disabled'} aria-label="Boss : ${esc(FOES[boss].name)}">
          <span class="dj-node__art">${foeSVG(FOES[boss].shape, FOES[boss].color)}</span><span>${esc(FOES[boss].name)}</span>
        </button>
      </div>
      <ol class="dj-rows" reversed>
        ${run.map
          .map((cells, row) => ({ cells, row }))
          .reverse()
          .map(({ cells, row }) => `<li class="dj-row">${cells
            .map((type, col) => {
              const open = canGo(row, col);
              const here = run.row === row && run.col === col;
              const past = row <= run.row && (run.path ?? []).some((p) => p[0] === row && p[1] === col);
              return `<button type="button" class="dj-node dj-node--${type} ${open ? 'is-open' : ''} ${here ? 'is-here' : ''} ${past ? 'is-past' : ''}" data-node="${row}:${col}" ${open ? '' : 'disabled'} aria-label="${NODE[type][1]}${open ? ', accessible' : ''}">${icon(NODE[type][0])}<span>${NODE[type][1]}</span></button>`;
            })
            .join('')}</li>`)
          .join('')}
      </ol>
      <p class="dj-hint">${run.row < 0 ? 'Choisis ton point d’entrée.' : bossRow ? `Le boss t’attend : ${esc(FOES[boss].name)}.` : 'Choisis la prochaine salle (juste au-dessus, ou en diagonale).'}</p>
    </div>`;
  root.querySelector('.is-open')?.focus({ preventScroll: true });
  root.querySelector('.is-open')?.scrollIntoView({ block: 'center', behavior: 'instant' });
}

function barHTML() {
  const h = heroOf(run.hero);
  return `<header class="dj-bar">
    <span class="dj-bar__hero" style="--c:${h.color}">${heroSVG(h)}<strong>${esc(h.name)}</strong></span>
    <span class="dj-relics">${run.relics.map((r) => `<span class="dj-relic" title="${esc(RELICS[r].name)} : ${esc(RELICS[r].text)}" aria-label="${esc(RELICS[r].name)} : ${esc(RELICS[r].text)}">${icon(RELICS[r].icon)}</span>`).join('')}</span>
    <button type="button" class="btn btn--sm btn--ghost" data-deck>${icon('grid')}Paquet (${run.deck.length})</button>
  </header>`;
}

function enterNode(row, col) {
  const type = run.map[row][col];
  run.path = [...(run.path ?? []), [row, col]];
  run.row = row;
  run.col = col;
  run.floor++;
  gv.audio.play('select');
  if (type === 'combat' || type === 'elite') {
    const r = rng();
    const list = ENCOUNTERS[run.act][type];
    startCombat(r.pick(list), type);
  } else if (type === 'feu') showCamp();
  else if (type === 'marchand') showShop();
  else showTreasure();
}

// ---------- Combat ----------
function makeFoe(id, r) {
  const f = FOES[id];
  const hp = r.int(f.hp[0], f.hp[1]) + (run.act - 1) * (f.boss ? 0 : 4);
  return { id, name: f.name, shape: f.shape, color: f.color, hp, max: hp, block: 0, str: 0, weak: 0, vuln: has('crane') ? 1 : 0, poison: 0, thorns: 0, move: r.int(0, Math.max(0, f.moves.length - 1)) * (f.boss ? 0 : 1), boss: !!f.boss, elite: !!f.elite, intent: null, fx: 0 };
}

function startCombat(ids, kind) {
  const r = rng();
  screen = 'combat';
  const P = { block: has('ancre') ? 10 : 0, str: has('gant') ? 1 : 0, weak: 0, vuln: 0, poison: 0, thorns: has('epines') ? 3 : 0 };
  fxQueue.length = 0;
  C = { kind, enemies: ids.map((id) => makeFoe(id, r)), draw: r.shuffle(run.deck.map((c) => ({ ...c }))), hand: [], discard: [], exhaust: [], energy: 0, P, powers: {}, turn: 0, target: 0, selected: null, busy: false, hurt: false, played: { atk: 0, skl: 0, pow: 0, poison: 0 }, turnCards: 0, rng: r, log: [] };
  if (C.enemies.some((e) => e.id === 'architecte')) architectStart();
  for (const e of C.enemies) e.intent = nextIntent(e);
  playerTurn();
}

function drawCards(n) {
  for (let k = 0; k < n; k++) {
    if (!C.draw.length) {
      if (!C.discard.length) return;
      C.draw = C.rng.shuffle(C.discard);
      C.discard = [];
    }
    if (C.hand.length >= 10) return;
    C.hand.push(C.draw.pop());
  }
}

function playerTurn() {
  C.turn++;
  C.turnCards = 0;
  const P = C.P;
  P.block = 0;
  if (P.poison > 0) {
    run.hp -= P.poison;
    C.hurt = true;
    pop('player', `-${P.poison}`, 'poison');
    P.poison--;
    if (run.hp <= 0) return defeat();
  }
  P.str += C.powers.strTurn ?? 0;
  if (C.powers.blockTurn) P.block += C.powers.blockTurn;
  if (C.powers.poisonTurn) for (const e of alive()) addPoison(e, C.powers.poisonTurn);
  C.energy = ENERGY + (C.powers.energyTurn ?? 0) + (C.turn === 1 && has('sablier') ? 1 : 0);
  drawCards(HAND + (C.turn === 1 && has('plume') ? 2 : 0));
  if (has('braise') && alive().length) {
    const t = C.rng.pick(alive());
    hit(null, t, 3, true);
  }
  C.busy = false;
  renderCombat();
  checkEnd();
}

function addPoison(e, n) {
  e.poison += n + (has('toxine') ? 1 : 0);
  C.played.poison += n;
  if (e.poison >= 40) gv.unlock('poison-40');
}

// Dégâts : force et faiblesse de l'attaquant, vulnérabilité et armure de la cible, épines
function hit(src, tgt, base, raw = false) {
  let dmg = raw ? base : base + (src?.str ?? 0);
  if (!raw && src?.weak) dmg = Math.floor(dmg * 0.75);
  if (tgt.vuln) dmg = Math.floor(dmg * 1.5);
  dmg = Math.max(0, dmg);
  const absorbed = Math.min(tgt.block, dmg);
  tgt.block -= absorbed;
  const rest = dmg - absorbed;
  const isPlayer = tgt === C.P;
  if (isPlayer) {
    run.hp -= rest;
    if (rest > 0) C.hurt = true;
    pop('player', rest ? `-${rest}` : 'Bloqué', rest ? 'dmg' : 'block');
  } else {
    tgt.hp -= rest;
    tgt.fx++;
    pop(C.enemies.indexOf(tgt), rest ? `-${rest}` : 'Bloqué', rest ? 'dmg' : 'block');
    if (tgt.hp <= 0) {
      tgt.hp = 0;
      run.kills++;
      gv.audio.play('explode', { volume: 0.5 });
    }
  }
  if (rest > 0) gv.audio.play('hit', { volume: 0.6, throttle: 0.05 });
  // Épines : l'attaquant se pique
  if (src && tgt.thorns && !raw) hit(null, src, tgt.thorns, true);
}

function needsTarget(d) {
  return !d.all && (d.dmg || d.blockDmg || d.vuln || d.weak || d.poison || d.doublePoison);
}

function playCard(i, ti = C.target) {
  if (!C || C.busy || screen !== 'combat') return false;
  const c = C.hand[i];
  if (!c) return false;
  const d = def(c);
  if (d.cost > C.energy) {
    gv.audio.play('error');
    flashEnergy();
    return false;
  }
  let t = C.enemies[ti];
  if (!t || t.hp <= 0) t = alive()[0];
  if (needsTarget(d) && !t) return false;
  C.energy -= d.cost;
  C.hand.splice(i, 1);
  C.selected = null;
  const P = C.P;
  const targets = d.all ? alive() : t ? [t] : [];
  if (d.block) P.block += d.block;
  if (d.dmg) for (let k = 0; k < (d.times ?? 1); k++) for (const e of targets) if (e.hp > 0) hit(P, e, d.dmg);
  if (d.blockDmg && t) hit(P, t, P.block);
  for (const e of targets) {
    if (e.hp <= 0) continue;
    if (d.vuln) e.vuln += d.vuln;
    if (d.weak) e.weak += d.weak;
    if (d.poison) addPoison(e, d.poison);
    if (d.doublePoison) e.poison *= 2;
  }
  if (d.str) P.str += d.str;
  if (d.thorns) P.thorns += d.thorns;
  if (d.energy) C.energy += d.energy;
  if (d.draw) drawCards(d.draw);
  for (const k of ['strTurn', 'blockTurn', 'poisonTurn', 'energyTurn']) if (d[k]) C.powers[k] = (C.powers[k] ?? 0) + d[k];
  if (d.type !== 'pow') (d.exhaust ? C.exhaust : C.discard).push(c);
  C.played[d.type]++;
  C.turnCards++;
  if (C.turnCards >= 8) gv.unlock('combo-8');
  gv.audio.play(d.type === 'atk' ? 'whoosh' : d.type === 'pow' ? 'powerup' : 'place', { volume: 0.6 });
  // L'Architecte réécrit sa stratégie à mi-vie
  const arch = C.enemies.find((e) => e.id === 'architecte');
  if (arch && arch.hp > 0 && arch.hp <= arch.max / 2 && !C.arch.rewritten) architectRewrite(arch);
  renderCombat();
  checkEnd();
  return true;
}

function endTurn() {
  if (!C || C.busy || screen !== 'combat') return;
  C.busy = true;
  C.selected = null;
  C.discard.push(...C.hand);
  C.hand = [];
  if (C.P.weak) C.P.weak--;
  if (C.P.vuln) C.P.vuln--;
  renderCombat();
  enemyPhase();
}

async function enemyPhase() {
  const id0 = C;
  for (const e of C.enemies) {
    if (e.hp <= 0) continue;
    await wait(380);
    if (C !== id0 || screen !== 'combat') return;
    e.block = 0;
    if (e.poison > 0) {
      hit(null, e, e.poison, true);
      e.poison--;
      if (e.hp <= 0) {
        renderCombat();
        continue;
      }
    }
    act(e, e.intent);
    if (e.weak) e.weak--;
    if (e.vuln) e.vuln--;
    e.intent = nextIntent(e);
    renderCombat();
    if (run.hp <= 0) return defeat();
  }
  await wait(300);
  if (C !== id0 || screen !== 'combat') return;
  if (!checkEnd()) playerTurn();
}

function act(e, m) {
  const P = C.P;
  if (m.purge) {
    e.poison = 0;
    e.hp = Math.min(e.max, e.hp + 12);
    pop(C.enemies.indexOf(e), 'Purge +12', 'heal');
  }
  if (m.def) e.block += m.def;
  if (m.str) e.str += m.str;
  if (m.thorns) e.thorns += m.thorns;
  if (m.atk) {
    if (m.pierce && P.block) {
      P.block = 0;
      pop('player', 'Armure percée', 'block');
    }
    for (let k = 0; k < (m.times ?? 1); k++) if (run.hp > 0 && e.hp > 0) hit(e, P, m.atk);
  }
  if (m.weak) P.weak += m.weak;
  if (m.vuln) P.vuln += m.vuln;
  if (m.poison) P.poison += m.poison;
  if (m.say) taunt(m.say);
}

function nextIntent(e) {
  if (e.id === 'architecte') {
    const plan = PLANS[C.arch.plan];
    const m = plan[e.move % plan.length];
    e.move++;
    return m;
  }
  const moves = FOES[e.id].moves;
  const m = moves[e.move % moves.length];
  e.move++;
  return m;
}

// ---------- L'Architecte : il lit ton paquet, puis tes coups ----------
const PLANS = {
  force: [{ def: 14, thorns: 3 }, { atk: 16 }, { atk: 6, times: 3 }],
  poison: [{ purge: true, def: 10 }, { atk: 18 }, { atk: 9, times: 2 }],
  garde: [{ atk: 20, pierce: true }, { atk: 4, times: 5 }, { str: 2, def: 8 }],
  equilibre: [{ atk: 14, weak: 1 }, { def: 12, str: 2 }, { atk: 7, times: 3 }],
};
const PLAN_SAY = {
  force: 'Tu comptes sur tes attaques. Je deviens un mur hérissé d’épines.',
  poison: 'Ton poison ? Je l’ai analysé. Purge programmée.',
  garde: 'Tu te caches derrière ton armure. Je vais la percer.',
  equilibre: 'Un paquet équilibré… Je m’adapterai en cours de route.',
};
function deckProfile(deck) {
  const ds = deck.map(def);
  const n = ds.length || 1;
  const poison = ds.filter((d) => d.poison || d.doublePoison || d.poisonTurn).length;
  const block = ds.filter((d) => d.block || d.blockTurn).length;
  const atk = ds.filter((d) => d.type === 'atk').length;
  return poison >= 3 ? 'poison' : block / n >= 0.45 ? 'garde' : atk / n >= 0.55 ? 'force' : 'equilibre';
}
function architectStart() {
  const plan = deckProfile(run.deck);
  C.arch = { plan, first: plan, rewritten: false };
  taunt(`J’ai lu ton paquet : ${run.deck.length} cartes. ${PLAN_SAY[plan]}`);
}
function architectRewrite(arch) {
  C.arch.rewritten = true;
  const p = C.played;
  const plan = p.poison >= 6 ? 'poison' : p.skl > p.atk ? 'garde' : 'force';
  C.arch.plan = plan;
  arch.str += 3;
  arch.move = 0;
  arch.intent = nextIntent(arch);
  taunt(`Réécriture : j’ai étudié tes coups de ce combat. ${PLAN_SAY[plan]}`);
  gv.audio.play('powerup', { pitch: 0.6 });
}
function taunt(text) {
  if (!C) return;
  C.taunt = text;
  C.tauntT = Date.now();
}

function checkEnd() {
  if (!C || screen !== 'combat') return true;
  if (run.hp <= 0) {
    defeat();
    return true;
  }
  if (alive().length) return false;
  victory();
  return true;
}

function victory() {
  const kind = C.kind;
  const boss = kind === 'boss';
  gv.unlock('premier-combat');
  if (kind === 'elite') {
    run.elites++;
    gv.unlock('elite');
    if (!C.hurt) gv.unlock('intouchable');
  }
  if (has('fiole')) run.hp = Math.min(run.max, run.hp + 6);
  if (has('lanterne') && kind !== 'combat') run.hp = Math.min(run.max, run.hp + 12);
  gv.audio.play(boss ? 'win' : 'achievement');
  if (boss) {
    run.bosses++;
    const prev = store.data.bosses;
    store.data.bosses = Math.max(prev, run.bosses);
    store.save();
    const unlocked = store.data.bosses > prev && HEROES[store.data.bosses];
    if (unlocked) toast({ title: `Héros débloqué : ${unlocked.name}`, text: 'Choisis-le à l’accueil.', iconName: 'user', tone: unlocked.color });
    gv.unlock(run.act === 1 ? 'golem' : run.act === 2 ? 'hydre' : 'architecte');
    if (run.act === 3) {
      run.win = true;
      store.data.wins++;
      store.save();
      C = null;
      return finish();
    }
  }
  showReward(kind);
}

function defeat() {
  if (screen !== 'combat') return;
  run.hp = 0;
  gv.audio.play('lose');
  if (C?.arch) taunt('Calcul confirmé. Reviens avec un autre paquet.');
  finish();
}

// ---------- Rendu du combat ----------
const fxQueue = [];
function pop(who, text, kind) {
  fxQueue.push({ who, text, kind });
}
function intentHTML(m) {
  if (!m) return '';
  const parts = [];
  if (m.atk) parts.push(`<span class="dj-intent dj-intent--atk" title="Attaque">${icon('bolt')}${m.atk}${m.times > 1 ? `×${m.times}` : ''}${m.pierce ? ' perce' : ''}</span>`);
  if (m.def) parts.push(`<span class="dj-intent dj-intent--def" title="Armure">${icon('lock')}${m.def}</span>`);
  if (m.str) parts.push(`<span class="dj-intent dj-intent--buff" title="Force">${icon('star')}+${m.str}</span>`);
  if (m.thorns) parts.push(`<span class="dj-intent dj-intent--buff" title="Épines">${icon('crown')}${m.thorns}</span>`);
  if (m.purge) parts.push(`<span class="dj-intent dj-intent--buff" title="Purge">${icon('restart')}Purge</span>`);
  if (m.weak || m.vuln || m.poison) parts.push(`<span class="dj-intent dj-intent--debuff" title="Malédiction">${icon(m.poison ? 'flame' : 'eye')}${m.poison ? m.poison : ''}</span>`);
  return parts.join('');
}
function statusHTML(u) {
  const s = [];
  if (u.str) s.push(`<span class="dj-st dj-st--str" title="Force">${icon('star')}${u.str}</span>`);
  if (u.vuln) s.push(`<span class="dj-st dj-st--vuln" title="Vulnérable : +50 % de dégâts subis">${icon('target')}${u.vuln}</span>`);
  if (u.weak) s.push(`<span class="dj-st dj-st--weak" title="Faiblesse : −25 % de dégâts infligés">${icon('minus')}${u.weak}</span>`);
  if (u.poison) s.push(`<span class="dj-st dj-st--poison" title="Poison">${icon('flame')}${u.poison}</span>`);
  if (u.thorns) s.push(`<span class="dj-st dj-st--thorns" title="Épines">${icon('crown')}${u.thorns}</span>`);
  return s.join('');
}

function renderCombat() {
  if (screen !== 'combat' || !C) return;
  hud();
  const P = C.P;
  const h = heroOf(run.hero);
  const living = alive();
  if (!C.enemies[C.target] || C.enemies[C.target].hp <= 0) C.target = C.enemies.indexOf(living[0]);
  const sel = C.selected !== null ? def(C.hand[C.selected]) : null;
  const showTaunt = C.taunt && Date.now() - C.tauntT < 9000;
  root.innerHTML = `
    <div class="dj-combat ${C.kind === 'boss' ? 'is-boss' : ''}">
      ${showTaunt ? `<p class="dj-taunt" role="status">${icon('eye')}<span>${esc(C.taunt)}</span></p>` : ''}
      <div class="dj-foes">${C.enemies
        .map((e, i) => {
          if (e.hp <= 0) return `<div class="dj-foe is-dead" aria-hidden="true"></div>`;
          return `<button type="button" class="dj-foe ${i === C.target ? 'is-target' : ''} ${sel && needsTarget(sel) ? 'is-aiming' : ''} ${e.boss ? 'is-boss' : ''}" data-foe="${i}" aria-label="${esc(e.name)}, ${e.hp} PV sur ${e.max}${e.block ? `, ${e.block} d’armure` : ''}">
            <span class="dj-foe__intent">${intentHTML(e.intent)}</span>
            <span class="dj-foe__art">${foeSVG(e.shape, e.color)}</span>
            <span class="dj-foe__name">${esc(e.name)}</span>
            <span class="dj-hp"><span class="dj-hp__bar" style="width:${(e.hp / e.max) * 100}%"></span><span class="dj-hp__txt">${e.hp}/${e.max}</span>${e.block ? `<span class="dj-block">${icon('lock')}${e.block}</span>` : ''}</span>
            <span class="dj-sts">${statusHTML(e)}</span>
            <span class="dj-pops" data-pops="${i}"></span>
          </button>`;
        })
        .join('')}</div>
      <div class="dj-me">
        <div class="dj-me__hero" style="--c:${h.color}">${heroSVG(h)}<span class="dj-pops" data-pops="player"></span></div>
        <div class="dj-me__stats">
          <span class="dj-hp dj-hp--me"><span class="dj-hp__bar" style="width:${(Math.max(0, run.hp) / run.max) * 100}%"></span><span class="dj-hp__txt">${Math.max(0, run.hp)}/${run.max}</span>${P.block ? `<span class="dj-block">${icon('lock')}${P.block}</span>` : ''}</span>
          <span class="dj-sts">${statusHTML(P)}</span>
        </div>
        <span class="dj-energy" aria-label="Énergie : ${C.energy} sur ${ENERGY}"><b>${C.energy}</b>/${ENERGY}</span>
        <span class="dj-pile" title="Pioche">${icon('grid')}${C.draw.length}</span>
        <span class="dj-pile" title="Défausse">${icon('restart')}${C.discard.length}</span>
        <button type="button" class="btn btn--primary dj-end" data-end ${C.busy ? 'disabled' : ''}>${C.busy ? 'Tour ennemi…' : 'Fin du tour'} <kbd>E</kbd></button>
      </div>
      <div class="dj-hand" style="--n:${C.hand.length}">${C.hand.map((c, i) => cardHTML(c, { idx: i, disabled: def(c).cost > C.energy || C.busy, selected: C.selected === i })).join('')}</div>
    </div>`;
  // Chiffres de dégâts
  while (fxQueue.length) {
    const f = fxQueue.shift();
    const host = root.querySelector(`[data-pops="${f.who}"]`);
    if (!host) continue;
    const s = document.createElement('span');
    s.className = `dj-pop dj-pop--${f.kind}`;
    s.textContent = f.text;
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 40}px`);
    host.append(s);
    host.closest('.dj-foe, .dj-me__hero')?.classList.add('is-hit');
  }
}
function flashEnergy() {
  root.querySelector('.dj-energy')?.animate([{ transform: 'scale(1.25)', color: '#ff3b5c' }, { transform: 'scale(1)' }], { duration: 300 });
}

// ---------- Récompenses, feu de camp, marchand, trésor ----------
function relicChoice(r) {
  const left = RELIC_POOL.filter((x) => !run.relics.includes(x));
  return left.length ? r.pick(left) : null;
}
function gainRelic(id) {
  run.relics.push(id);
  if (id === 'coeur') {
    run.max += 10;
    run.hp += 10;
  }
}

function showReward(kind) {
  screen = 'reward';
  const r = rng();
  const gold = Math.round(r.int(kind === 'combat' ? 10 : kind === 'elite' ? 25 : 60, kind === 'combat' ? 18 : kind === 'elite' ? 35 : 80) * (has('bourse') ? 1.25 : 1));
  run.gold += gold;
  const relic = kind !== 'combat' ? relicChoice(r) : null;
  if (relic) gainRelic(relic);
  if (kind === 'boss') run.hp = Math.min(run.max, run.hp + Math.round(run.max * 0.5));
  const offer = r.shuffle(pool(run.hero)).slice(0, 3).map((id) => ({ id, up: r.chance(0.12 * run.act), uid: uid++ }));
  run.offer = offer;
  C = null;
  saveRun();
  hud();
  root.innerHTML = `
    <div class="dj-panel">
      <h2 class="dj-title">${kind === 'boss' ? 'Boss vaincu !' : kind === 'elite' ? 'Élite vaincue !' : 'Victoire !'}</h2>
      <ul class="dj-loot">
        <li>${icon('coin')} +${gold} or</li>
        ${relic ? `<li>${icon(RELICS[relic].icon)} Relique : <strong>${esc(RELICS[relic].name)}</strong> — ${esc(RELICS[relic].text)}</li>` : ''}
        ${kind === 'boss' ? `<li>${icon('heart')} Le repos du vainqueur : la moitié de tes PV reviennent.</li>` : ''}
      </ul>
      <p class="dj-sub">Ajoute une carte à ton paquet :</p>
      <div class="dj-choices">${offer.map((c, i) => cardHTML(c, { data: `data-take="${i}"` })).join('')}</div>
      <button type="button" class="btn btn--ghost" data-skip>Passer</button>
    </div>`;
  root.querySelector('[data-take]')?.focus({ preventScroll: true });
}

function afterNode() {
  if (screen === 'over') return;
  // Après le boss : acte suivant
  if (run.row === ROWS && run.act < 3) {
    run.act++;
    run.row = -1;
    run.col = null;
    run.path = [];
    run.map = newMap(run.act);
    gv.banner(`Acte ${run.act} · ${ACT_NAMES[run.act]}`, { color: '#ffc93c' });
  }
  showMap();
}

function showCamp() {
  screen = 'camp';
  const heal = Math.round(run.max * 0.3);
  const forgeable = run.deck.filter((c) => !c.up);
  root.innerHTML = `
    <div class="dj-panel">
      <h2 class="dj-title">${icon('flame')} Feu de camp</h2>
      <div class="dj-camp">
        <button type="button" class="dj-option" data-rest>${icon('heart')}<strong>Se reposer</strong><small>Récupère ${heal} PV (${run.hp}/${run.max}).</small></button>
        <button type="button" class="dj-option" data-forge ${forgeable.length ? '' : 'disabled'}>${icon('bolt')}<strong>Forger</strong><small>Améliore une carte de ton paquet.</small></button>
      </div>
      <div class="dj-forge" hidden>
        <p class="dj-sub">Choisis la carte à améliorer :</p>
        <div class="dj-choices dj-choices--wrap">${run.deck.map((c, i) => (c.up ? '' : cardHTML(c, { data: `data-up="${i}"` }))).join('')}</div>
      </div>
    </div>`;
  root.querySelector('[data-rest]').focus({ preventScroll: true });
}

function showShop() {
  screen = 'shop';
  const r = rng();
  const cards = r.shuffle(pool(run.hero)).slice(0, 4).map((id) => ({ c: { id, up: false, uid: uid++ }, price: 40 + CARDS[id].cost * 14 + r.int(0, 15) }));
  const relic = relicChoice(r);
  run.shop = { cards, relic, relicPrice: 140, removed: false };
  renderShop();
}
function renderShop() {
  const s = run.shop;
  hud();
  root.innerHTML = `
    <div class="dj-panel">
      <h2 class="dj-title">${icon('coin')} Marchand <span class="dj-gold">${formatInt(run.gold)} or</span></h2>
      <div class="dj-choices dj-choices--wrap">${s.cards.map((o, i) => (o.sold ? '' : cardHTML(o.c, { data: `data-buy="${i}"`, price: o.price, disabled: run.gold < o.price }))).join('')}</div>
      <div class="dj-shoprow">
        ${s.relic && !s.relicSold ? `<button type="button" class="dj-option" data-relic ${run.gold < s.relicPrice ? 'aria-disabled="true"' : ''}>${icon(RELICS[s.relic].icon)}<strong>${esc(RELICS[s.relic].name)} · ${s.relicPrice} or</strong><small>${esc(RELICS[s.relic].text)}</small></button>` : ''}
        ${s.removed ? '' : `<button type="button" class="dj-option" data-remove ${run.gold < 70 ? 'aria-disabled="true"' : ''}>${icon('trash')}<strong>Retirer une carte · 70 or</strong><small>Un paquet plus fin pioche tes meilleures cartes plus souvent.</small></button>`}
      </div>
      <div class="dj-forge" hidden>
        <p class="dj-sub">Choisis la carte à retirer :</p>
        <div class="dj-choices dj-choices--wrap">${run.deck.map((c, i) => cardHTML(c, { data: `data-del="${i}"` })).join('')}</div>
      </div>
      <button type="button" class="btn btn--ghost" data-leave>Partir</button>
    </div>`;
}

function showTreasure() {
  screen = 'treasure';
  const relic = relicChoice(rng());
  if (relic) gainRelic(relic);
  else run.gold += 50;
  hud();
  gv.audio.play('powerup');
  root.innerHTML = `
    <div class="dj-panel">
      <h2 class="dj-title">${icon('sparkle')} Trésor</h2>
      <p class="dj-loot1">${relic ? `${icon(RELICS[relic].icon)} <strong>${esc(RELICS[relic].name)}</strong> — ${esc(RELICS[relic].text)}` : `${icon('coin')} 50 or (tu as déjà toutes les reliques)`}</p>
      <button type="button" class="btn btn--primary" data-continue>Continuer</button>
    </div>`;
  root.querySelector('[data-continue]').focus({ preventScroll: true });
}

function showDeck() {
  const box = document.createElement('div');
  box.className = 'dj-overlay';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Ton paquet');
  box.innerHTML = `<div class="dj-panel"><h2 class="dj-title">Ton paquet · ${run.deck.length} cartes</h2><div class="dj-choices dj-choices--wrap">${[...run.deck].sort((a, b) => a.id.localeCompare(b.id)).map((c) => cardHTML(c)).join('')}</div><button type="button" class="btn btn--primary" data-close-deck>Fermer</button></div>`;
  root.append(box);
  box.querySelector('[data-close-deck]').focus();
}

// ---------- Fin ----------
function scoreOf() {
  return Math.round(run.floor * 25 + run.elites * 60 + run.bosses * 250 + (run.win ? 1500 : 0) + run.kills * 5 + (run.win ? run.hp * 5 : 0));
}
function finish() {
  screen = 'over';
  run.over = true;
  const sc = scoreOf();
  if (run.daily) {
    const d = store.data.daily;
    if (d.day !== dayKey()) Object.assign(d, { day: dayKey(), best: 0, plays: 0 });
    d.plays++;
    d.best = Math.max(d.best, sc);
    gv.unlock('du-jour');
  }
  store.data.run = null;
  store.save();
  const next = HEROES.find((h) => !heroOpen(h));
  gv.gameOver({
    score: sc,
    stats: { score: sc, floor: run.floor, bosses: run.bosses, win: run.win ? 1 : 0, daily: run.daily ? 1 : 0 },
    extraStats: [
      { label: 'Étage', value: formatInt(run.floor) },
      { label: 'Boss', value: `${run.bosses}/3` },
      { label: 'Paquet', value: `${run.deck.length} cartes` },
    ],
    kicker: heroOf(run.hero).name,
    title: run.win ? 'Tu as battu l’Architecte !' : `Tombé à l’acte ${run.act}`,
    sound: run.win ? 'win' : undefined,
    nextUnlock: next ? { label: `Héros ${next.name}`, current: store.data.bosses, target: next.id === 'ombre' ? 1 : 2 } : undefined,
  });
  root.innerHTML = '';
  gv.hud('best', formatInt(gv.best ?? 0));
  renderOptions();
}

// ---------- Clics et clavier ----------
root.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.hasAttribute('data-deck')) return showDeck();
  if (b.hasAttribute('data-close-deck')) return b.closest('.dj-overlay').remove();
  if (screen === 'map') {
    if (b.dataset.node) {
      const [row, col] = b.dataset.node.split(':').map(Number);
      if (canGo(row, col)) enterNode(row, col);
    } else if (b.hasAttribute('data-boss') && run.row === ROWS - 1) {
      run.row = ROWS;
      run.floor++;
      startCombat(ENCOUNTERS[run.act].boss, 'boss');
    }
    return;
  }
  if (screen === 'combat') {
    if (b.hasAttribute('data-end')) return endTurn();
    if (b.dataset.foe !== undefined) {
      C.target = Number(b.dataset.foe);
      if (C.selected !== null) return playCard(C.selected, C.target);
      gv.audio.play('tick');
      return renderCombat();
    }
    if (b.dataset.card !== undefined) {
      const i = Number(b.dataset.card);
      const d = def(C.hand[i]);
      if (d.cost > C.energy) {
        gv.audio.play('error');
        return flashEnergy();
      }
      // Plusieurs ennemis et une carte ciblée : on attend le choix de la cible
      if (needsTarget(d) && alive().length > 1 && C.selected !== i) {
        C.selected = i;
        gv.audio.play('tick');
        return renderCombat();
      }
      return playCard(i, C.target);
    }
    return;
  }
  if (screen === 'reward') {
    if (b.dataset.take !== undefined) {
      run.deck.push(run.offer[Number(b.dataset.take)]);
      gv.audio.play('coin');
    }
    if (b.dataset.take !== undefined || b.hasAttribute('data-skip')) {
      run.offer = null;
      if (run.row === ROWS && run.act < 3) run.row = ROWS;
      return afterNode();
    }
  }
  if (screen === 'camp') {
    if (b.hasAttribute('data-rest')) {
      run.hp = Math.min(run.max, run.hp + Math.round(run.max * 0.3));
      gv.audio.play('powerup');
      return afterNode();
    }
    if (b.hasAttribute('data-forge')) {
      root.querySelector('.dj-forge').hidden = false;
      root.querySelector('[data-up]')?.focus();
      return;
    }
    if (b.dataset.up !== undefined) {
      run.deck[Number(b.dataset.up)].up = true;
      run.forged++;
      if (run.forged >= 5) gv.unlock('forgeron');
      gv.audio.play('achievement');
      return afterNode();
    }
  }
  if (screen === 'shop') {
    const s = run.shop;
    if (b.dataset.buy !== undefined) {
      const o = s.cards[Number(b.dataset.buy)];
      if (run.gold < o.price) return gv.audio.play('error');
      run.gold -= o.price;
      o.sold = true;
      run.deck.push(o.c);
      gv.audio.play('coin');
      return renderShop();
    }
    if (b.hasAttribute('data-relic')) {
      if (run.gold < s.relicPrice) return gv.audio.play('error');
      run.gold -= s.relicPrice;
      s.relicSold = true;
      gainRelic(s.relic);
      gv.audio.play('powerup');
      return renderShop();
    }
    if (b.hasAttribute('data-remove')) {
      if (run.gold < 70) return gv.audio.play('error');
      root.querySelector('.dj-forge').hidden = false;
      return;
    }
    if (b.dataset.del !== undefined) {
      run.gold -= 70;
      run.deck.splice(Number(b.dataset.del), 1);
      s.removed = true;
      gv.audio.play('explode', { volume: 0.4 });
      return renderShop();
    }
    if (b.hasAttribute('data-leave')) {
      run.shop = null;
      return afterNode();
    }
  }
  if (screen === 'treasure' && b.hasAttribute('data-continue')) afterNode();
});

document.addEventListener('keydown', (e) => {
  if (!gv.playing || screen !== 'combat' || !C || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    playCard(Number(e.key) - 1, C.target);
  } else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
    e.preventDefault();
    endTurn();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const living = C.enemies.map((x, i) => (x.hp > 0 ? i : -1)).filter((i) => i >= 0);
    const k = living.indexOf(C.target);
    C.target = living[(k + (e.key === 'ArrowRight' ? 1 : -1) + living.length) % living.length];
    renderCombat();
  }
});

// ---------- Accueil ----------
function renderOptions() {
  const s = store.data;
  const saved = s.run;
  gv.shell.startExtra.innerHTML = `
    <div class="dj-options">
      ${saved ? `<button type="button" class="btn btn--block dj-resume" data-resume>${icon('play')}Reprendre : ${esc(heroOf(saved.hero).name)}, acte ${saved.act}, étage ${saved.floor} (${saved.hp}/${saved.max} PV)</button>` : ''}
      <span class="dj-label" id="dj-hero-label">Héros</span>
      <div class="dj-heroes" role="radiogroup" aria-labelledby="dj-hero-label">
        ${HEROES.map((h) => {
          const open = heroOpen(h);
          return `<button type="button" role="radio" class="dj-hero" data-hero="${h.id}" aria-checked="${s.hero === h.id && open}" ${open ? '' : 'aria-disabled="true"'} style="--c:${h.color}">
            <span class="dj-hero__art">${open ? heroSVG(h) : icon('lock')}</span><strong>${esc(h.name)}</strong><small>${esc(open ? `${h.hp} PV · ${h.desc}` : h.how)}</small></button>`;
        }).join('')}
      </div>
      <span class="dj-label" id="dj-mode-label">Donjon</span>
      <div class="dj-modes" role="radiogroup" aria-labelledby="dj-mode-label">
        <button type="button" role="radio" class="dj-mode" data-mode="normal" aria-checked="${s.mode === 'normal'}">${icon('dice')}Au hasard</button>
        <button type="button" role="radio" class="dj-mode" data-mode="jour" aria-checked="${s.mode === 'jour'}">${icon('calendar')}Donjon du jour${s.daily.day === dayKey() ? ` · ${formatInt(s.daily.best)}` : ''}</button>
      </div>
      <p class="dj-hint" id="dj-hint">${s.wins ? `L’Architecte est tombé ${s.wins} fois.` : 'Au sommet, l’Architecte lira ton paquet pour te contrer.'}</p>
    </div>`;
}
gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.hasAttribute('data-resume')) {
    resumeNext = true;
    gv.start();
    return;
  }
  if (b.dataset.hero) {
    const h = heroOf(b.dataset.hero);
    if (!heroOpen(h)) {
      document.getElementById('dj-hint').textContent = `${h.name} : ${h.how.charAt(0).toLowerCase() + h.how.slice(1)} pour le débloquer.`;
      gv.audio.play('error');
      return;
    }
    store.data.hero = h.id;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  store.save();
  gv.audio.play('select');
  renderOptions();
  gv.shell.startExtra.querySelector(b.dataset.hero ? `[data-hero="${b.dataset.hero}"]` : `[data-mode="${b.dataset.mode}"]`)?.focus();
});

// ---------- Tests ----------
window.__dj = {
  get screen() { return screen; },
  get run() { return run; },
  get C() { return C; },
  play: (i, t) => playCard(i, t),
  end: endTurn,
  node(col) { const row = run.row + 1; if (row === ROWS) { run.row = ROWS; run.floor++; startCombat(ENCOUNTERS[run.act].boss, 'boss'); } else enterNode(row, col); },
  win() { for (const e of C.enemies) e.hp = 0; checkEnd(); },
  setHp(n) { run.hp = n; },
  give(id, up = false) { run.deck.push({ id, up, uid: uid++ }); },
  hand(ids) { C.hand = ids.map((id) => ({ id, up: false, uid: uid++ })); C.energy = 9; renderCombat(); },
  toBoss(act) { run.act = act; run.map = newMap(act); run.row = ROWS - 1; run.col = 1; showMap(); },
  profile: (ids) => deckProfile(ids.map((id) => ({ id, up: false }))),
};

renderOptions();
gv.hud('best', formatInt(gv.best ?? 0));
gv.hud('floor', 0);
gv.hud('hp', '—');
gv.hud('gold', '—');
gv.showStart();
