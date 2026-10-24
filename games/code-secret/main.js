// Code Secret — casse de coffre-fort : déduire un code de 4 chiffres.
// Clavier avec prise de notes, déductions automatiques, outils, modes Classique, Casse-tête,
// Contre la montre et Coffre du jour (le même code pour tout le monde).

import { bootGame } from '../../shared/js/gameverse.js';
import { createFxLayer, squash, wiggle } from '../../shared/js/engine/fx.js';
import { createRng, dailySeed, dayKey } from '../../shared/js/core/rng.js';
import { formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { LENGTH, MAX_TRIES, makeCode, score, deductions, vaultPoints } from './logic.js';

const RUSH_TIME = 90;
const RUSH_BONUS = 20;
const RUSH_FAIL = 15;

const MODES = {
  classique: { id: 'classique', label: 'Classique', hint: 'Chiffres tous différents', unique: true, mult: 1, unlock: 0 },
  cassetete: { id: 'cassetete', label: 'Casse-tête', hint: 'Les chiffres peuvent se répéter', unique: false, mult: 1.5, unlock: 0 },
  rush: { id: 'rush', label: 'Contre la montre', hint: '90 s, +20 s par coffre', unique: true, mult: 1, unlock: 2500 },
  jour: { id: 'jour', label: 'Coffre du jour', hint: 'Le même code pour tous, 1 essai par jour', unique: true, mult: 1.2, unlock: 0 },
};

// Thèmes de coffre, débloqués par le record
const THEMES = [
  { id: 'amethyste', name: 'Améthyste', unlock: 0 },
  { id: 'acier', name: 'Acier', unlock: 1500 },
  { id: 'emeraude', name: 'Émeraude', unlock: 3500 },
  { id: 'rubis', name: 'Rubis', unlock: 6000 },
  { id: 'or', name: 'Or', unlock: 10000 },
];

const store = createStore('code-secret', {
  version: 1,
  defaults: { mode: 'classique', theme: 'amethyste', vaults: 0, cleanVaults: 0, daily: { day: '', tries: 0, won: false } },
});

const $ = (id) => document.getElementById(id);
const entryEl = $('entry');
const historyEl = $('history');
const padEl = $('pad');
const ledsEl = $('leds');
const timerEl = $('timer');
const feedbackEl = $('feedback');
const doorEl = $('door');
const dialEl = $('dial');

const gv = bootGame('code-secret', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['0–9', 'Entrée'], text: 'Compose 4 chiffres et valide.' },
    { keys: ['icon:check', 'icon:target'], text: '✓ bien placé · ◐ présent mais mal placé.' },
    { keys: ['icon:sliders'], text: 'Mode Notes : barre ou valide les chiffres sur le clavier.' },
  ],
  onStart: startGame,
  onRestart: startGame,
});
const fx = createFxLayer(gv.stage, { shakeTarget: document.querySelector('.cs-wrap') });

// ---------- Cadran (graduations : 10 grandes, 40 petites ; pas de chiffres qui tourneraient à l'envers) ----------
const ticks = dialEl.querySelector('.cs-dial__ticks');
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * Math.PI * 2 - Math.PI / 2;
  const big = i % 4 === 0;
  const r1 = big ? 26 : 31;
  ticks.insertAdjacentHTML(
    'beforeend',
    `<line x1="${(100 + Math.cos(a) * r1).toFixed(1)}" y1="${(100 + Math.sin(a) * r1).toFixed(1)}" x2="${(100 + Math.cos(a) * 36).toFixed(1)}" y2="${(100 + Math.sin(a) * 36).toFixed(1)}" class="${big ? 'big' : ''}"/>`,
  );
}

// ---------- État ----------
let mode = MODES.classique;
let rng = createRng(Date.now());
let code = [];
let entry = [];
let history = [];
let notes = new Map(); // chiffre → 'x' (barré) | 'ok' (sûr)
let revealed = new Map(); // position → chiffre (rayon X)
let tools = { stetho: 2, xray: 1 };
let toolsUsed = 0;
let armed = null; // outil en attente d'un chiffre
let notesMode = false;
let run = null;
let timerId = 0;
let locked = false;

const theme = () => THEMES.find((t) => t.id === store.data.theme) ?? THEMES[0];
const best = () => gv.best ?? 0;
const today = () => dayKey();
const dailyDone = () => store.data.daily.day === today();

function startGame() {
  mode = MODES[store.data.mode] ?? MODES.classique;
  if (mode.unlock > best()) mode = MODES.classique;
  if (mode.id === 'jour' && dailyDone()) mode = MODES.classique;
  run = { points: 0, vaults: 0, timeLeft: RUSH_TIME, quick: 0, daily: 0, lastTries: 0 };
  document.body.dataset.theme = theme().id;
  gv.hud('score', 0);
  gv.hud('best', formatInt(best()));
  clearInterval(timerId);
  timerEl.hidden = mode.id !== 'rush';
  if (mode.id === 'rush') {
    let last = performance.now();
    timerId = setInterval(() => {
      const now = performance.now();
      if (gv.playing) run.timeLeft -= (now - last) / 1000;
      last = now;
      renderTimer();
      if (run.timeLeft <= 0) endGame(false, true);
    }, 100);
  }
  newVault();
}

function newVault() {
  rng = mode.id === 'jour' ? createRng(dailySeed('code-secret')) : createRng(Number(new URLSearchParams(location.search).get('seed')) || Date.now() + Math.random() * 1e6);
  code = makeCode(rng, mode.unique);
  entry = [];
  history = [];
  notes = new Map();
  revealed = new Map();
  tools = { stetho: 2, xray: 1 };
  toolsUsed = 0;
  armed = null;
  notesMode = false;
  locked = false;
  doorEl.classList.remove('is-open', 'is-alarm');
  setFeedback(mode.id === 'jour' ? 'Coffre du jour : une seule tentative aujourd’hui.' : 'Compose un code à 4 chiffres.');
  renderAll();
}

// ---------- Saisie ----------
function press(d) {
  if (locked || gv.state !== 'playing') return;
  if (armed) return useTool(armed, d);
  if (notesMode) {
    const cur = notes.get(d);
    notes.set(d, cur === undefined ? 'x' : cur === 'x' ? 'ok' : undefined);
    if (notes.get(d) === undefined) notes.delete(d);
    gv.audio.play('tick', { pitch: 1.4 });
    renderPad();
    return;
  }
  // Les positions révélées au rayon X se remplissent toutes seules
  fillRevealed();
  if (entry.length >= LENGTH) return;
  if (mode.unique && entry.includes(d)) {
    wiggle(padEl.querySelector(`[data-digit="${d}"]`), { amount: 5 });
    setFeedback('Chiffres tous différents dans ce mode.', 'warn');
    gv.audio.play('error');
    return;
  }
  entry.push(d);
  fillRevealed();
  spinDial(d);
  gv.audio.play('tock', { pitch: 0.9 + d * 0.03 });
  renderEntry(entry.length - 1);
}

function fillRevealed() {
  while (entry.length < LENGTH && revealed.has(entry.length)) entry.push(revealed.get(entry.length));
}

function erase() {
  if (locked || gv.state !== 'playing') return;
  if (armed) {
    armed = null;
    renderPad();
    setFeedback('Outil rangé.');
    return;
  }
  // Efface le dernier chiffre saisi, sans toucher aux chiffres révélés au rayon X
  let i = entry.length - 1;
  while (i >= 0 && revealed.has(i)) i--;
  if (i < 0) return;
  entry = entry.slice(0, i);
  gv.audio.play('back', { pitch: 1.3, volume: 0.6 });
  renderEntry();
}

function submit() {
  if (locked || gv.state !== 'playing') return;
  fillRevealed();
  if (entry.length < LENGTH) {
    wiggle(entryEl);
    setFeedback('Il faut 4 chiffres.', 'warn');
    gv.audio.play('error');
    return;
  }
  const guess = [...entry];
  const r = score(code, guess);
  history.push({ guess, ...r });
  entry = [];
  fillRevealed();
  // Petits « clics » de serrure pour chaque bien placé
  for (let i = 0; i < r.exact; i++) setTimeout(() => gv.audio.play('tick', { pitch: 0.8 + i * 0.15 }), 90 * i);
  if (r.exact === LENGTH) return win();
  if (r.exact === 3) {
    setFeedback('Presque ! Un seul chiffre te sépare du déclic.', 'near');
    gv.audio.play('nearMiss');
    fx.addShake(0.12);
  } else setFeedback(`${r.exact} bien placé${r.exact > 1 ? 's' : ''}, ${r.misplaced} mal placé${r.misplaced > 1 ? 's' : ''}.`);
  if (history.length >= MAX_TRIES) return lose();
  renderAll(true);
}

// ---------- Outils ----------
function arm(tool) {
  if (locked || gv.state !== 'playing' || tools[tool] <= 0) return;
  if (tool === 'xray') return useTool('xray');
  armed = armed === tool ? null : tool;
  setFeedback(armed ? 'Stéthoscope : touche un chiffre pour l’écouter.' : 'Outil rangé.');
  gv.audio.play('select');
  renderPad();
}

function useTool(tool, d) {
  tools[tool]--;
  toolsUsed++;
  armed = null;
  if (tool === 'stetho') {
    const present = code.includes(d);
    notes.set(d, present ? 'ok' : 'x');
    setFeedback(present ? `Le ${d} est dans le code.` : `Le ${d} n’est pas dans le code.`, present ? 'good' : 'warn');
    fx.popupAt(padEl.querySelector(`[data-digit="${d}"]`), present ? 'Présent !' : 'Absent', { size: 18, color: present ? '#3ee6a8' : '#ff8a5b', rise: 30 });
    gv.audio.play(present ? 'pickup' : 'back');
  } else {
    const free = [...Array(LENGTH).keys()].filter((i) => !revealed.has(i));
    const pos = free[Math.floor(rng.next() * free.length)];
    revealed.set(pos, code[pos]);
    entry = entry.slice(0, pos);
    fillRevealed();
    setFeedback(`Rayon X : position ${pos + 1} = ${code[pos]}.`, 'good');
    gv.audio.play('powerup');
    fx.burstAt(entryEl.children[pos], { count: 14, colors: ['#4cc3ff', '#ffffff'], speed: [80, 220], size: [2, 4], gravity: 0, shape: 'spark' });
  }
  renderAll();
}

// ---------- Fin de coffre ----------
function win() {
  locked = true;
  const tries = history.length;
  const pts = vaultPoints({ tries, tools: toolsUsed, mult: mode.mult });
  run.points += pts;
  run.vaults++;
  run.lastTries = tries;
  if (tries <= 6) run.quick = 1;
  store.data.vaults++;
  if (!toolsUsed) store.data.cleanVaults++;
  if (mode.id === 'jour') {
    store.data.daily = { day: today(), tries, won: true };
    run.daily = 1;
    gv.unlock('du-jour');
  }
  store.save();
  gv.hud('score', formatInt(run.points), true);
  gv.unlock('premier');
  if (tries <= 5) gv.unlock('en-5');
  if (tries <= 3) gv.unlock('en-3');
  if (tries === 1) gv.unlock('chanceux');
  if (store.data.cleanVaults >= 10) gv.unlock('sans-outil');
  if (mode.id === 'cassetete') gv.unlock('casse-tete');
  if (run.vaults >= 5 && mode.id === 'rush') gv.unlock('rush-5');

  renderAll(true);
  renderEntry(-1, code);
  setFeedback(`Ouvert en ${tries} essai${tries > 1 ? 's' : ''} ! +${formatInt(pts)} points`, 'good');
  doorEl.classList.add('is-open');
  dialEl.style.setProperty('--turn', `${720 + code[0] * 36}deg`);
  fx.addShake(0.35);
  fx.burstAt(doorEl, { count: 50, colors: ['#ffc93c', '#fff3c4', '#c98f00', '#3ee6a8'], speed: [200, 560], size: [4, 9], gravity: 900, spin: [-12, 12], life: [0.7, 1.3], shape: 'star' });
  fx.popupAt(doorEl, `+${formatInt(pts)}`, { size: 44, color: '#ffc93c', rise: 80, life: 1.2 });
  gv.audio.play('win');
  setTimeout(() => gv.audio.play('coin'), 380);

  if (mode.id === 'rush') {
    run.timeLeft += RUSH_BONUS;
    fx.popupAt(timerEl, `+${RUSH_BONUS} s`, { size: 22, color: '#3ee6a8' });
    gv.after(motion.reduced ? 500 : 1300, newVault);
  } else gv.after(motion.reduced ? 600 : 1600, () => endGame(true));
}

function lose() {
  locked = true;
  doorEl.classList.add('is-alarm');
  fx.addShake(0.5);
  gv.audio.play('error');
  renderAll(true);
  renderEntry(-1, code);
  setFeedback(`Alarme ! Le code était ${code.join('')}.`, 'warn');
  if (mode.id === 'jour') {
    store.data.daily = { day: today(), tries: MAX_TRIES, won: false };
    store.save();
  }
  if (mode.id === 'rush') {
    run.timeLeft -= RUSH_FAIL;
    fx.popupAt(timerEl, `−${RUSH_FAIL} s`, { size: 22, color: '#ff5a4e' });
    gv.after(1300, () => (run.timeLeft > 0 ? newVault() : endGame(false, true)));
  } else gv.after(1700, () => endGame(false));
}

function endGame(won, timeUp = false) {
  if (gv.state === 'over') return;
  clearInterval(timerId);
  locked = true;
  const next = [...THEMES, MODES.rush].filter((t) => t.unlock > Math.max(best(), run.points)).sort((a, b) => a.unlock - b.unlock)[0];
  const beforeBest = best();
  gv.gameOver({
    score: run.points,
    stats: { score: run.points, daily: run.daily, quick: run.quick, vaults: mode.id === 'rush' ? run.vaults : 0 },
    extraStats:
      mode.id === 'rush'
        ? [{ label: 'Coffres', value: formatInt(run.vaults) }, { label: 'Mode', value: 'Chrono' }]
        : [{ label: 'Essais', value: won ? String(run.lastTries) : '—' }, { label: 'Outils', value: String(toolsUsed) }],
    kicker: timeUp ? 'Temps écoulé' : won ? `Coffre ouvert · ${mode.label}` : `Coffre verrouillé · ${mode.label}`,
    title: won || run.vaults ? 'Butin' : `Le code était ${code.join('')}`,
    nextUnlock: next ? { label: next.name ? `Coffre ${next.name}` : 'Contre la montre', current: Math.max(beforeBest, run.points), target: next.unlock } : undefined,
    sound: won || run.vaults ? 'record' : 'lose',
  });
  const after = best();
  for (const t of THEMES) if (t.unlock > 0 && beforeBest < t.unlock && after >= t.unlock) toast({ title: 'Nouveau coffre !', text: `Thème ${t.name} débloqué.`, iconName: 'lock', tone: 'var(--grape)' });
  if (beforeBest < MODES.rush.unlock && after >= MODES.rush.unlock) toast({ title: 'Contre la montre débloqué', text: 'Enchaîne les coffres en 90 secondes.', iconName: 'clock', tone: 'var(--grape)' });
  if (THEMES.every((t) => after >= t.unlock)) gv.unlock('collection');
  gv.hud('best', formatInt(after));
  renderOptions();
}

// ---------- Rendu ----------
function spinDial(d) {
  dialEl.style.setProperty('--turn', `${-d * 36}deg`);
}

function setFeedback(text, tone = '') {
  feedbackEl.textContent = text;
  feedbackEl.dataset.tone = tone;
}

function renderEntry(fresh = -1, show = null) {
  const digits = show ?? entry;
  entryEl.innerHTML = Array.from({ length: LENGTH }, (_, i) => {
    const d = digits[i];
    const rev = revealed.has(i);
    const cls = ['cs-slot', d !== undefined ? 'is-filled' : '', rev ? 'is-revealed' : '', i === digits.length && !show ? 'is-caret' : '', show ? 'is-final' : ''].join(' ');
    return `<span class="${cls}">${d ?? ''}</span>`;
  }).join('');
  if (fresh >= 0) squash(entryEl.children[fresh], { scaleX: 1.2, scaleY: 0.8, duration: 220 });
}

function renderHistory(animateLast = false) {
  $('tryCount').textContent = `${history.length} / ${MAX_TRIES}`;
  if (!history.length) {
    historyEl.innerHTML = '<li class="cs-empty">Aucun essai pour l’instant. Commence par des chiffres variés.</li>';
    return;
  }
  historyEl.innerHTML = [...history]
    .map((h, i) => {
      const pegs = [...Array(h.exact).fill('exact'), ...Array(h.misplaced).fill('mis'), ...Array(LENGTH - h.exact - h.misplaced).fill('none')];
      const last = i === history.length - 1 && animateLast;
      return `<li class="cs-row ${last ? 'is-new' : ''}">
        <span class="cs-row__n">${i + 1}</span>
        <span class="cs-row__digits">${h.guess.map((d) => `<b>${d}</b>`).join('')}</span>
        <span class="cs-row__pegs" role="img" aria-label="${h.exact} bien placés, ${h.misplaced} mal placés">${pegs.map((p, k) => `<i class="cs-peg cs-peg--${p}" style="--k:${k}"></i>`).join('')}</span>
        <span class="cs-row__txt">${h.exact}✓ ${h.misplaced}◐</span>
      </li>`;
    })
    .reverse()
    .join('');
}

function renderLeds() {
  const left = MAX_TRIES - history.length;
  ledsEl.innerHTML = Array.from({ length: MAX_TRIES }, (_, i) => `<i class="${i < left ? (left <= 3 ? 'on warn' : 'on') : ''}"></i>`).join('');
  ledsEl.setAttribute('aria-label', `${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}`);
}

function renderTimer() {
  if (mode.id !== 'rush' || !run) return;
  const t = Math.max(0, run.timeLeft);
  timerEl.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  timerEl.classList.toggle('is-low', t <= 15);
}

function renderPad() {
  const auto = deductions(history, mode.unique);
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'erase', 0, 'ok'];
  padEl.innerHTML = `
    <div class="cs-keys">
      ${keys
        .map((k) => {
          if (k === 'erase') return `<button type="button" class="cs-key cs-key--fn" data-act="erase" aria-label="Effacer">${icon('back')}</button>`;
          if (k === 'ok') return `<button type="button" class="cs-key cs-key--ok" data-act="ok" aria-label="Valider le code">${icon('check')}</button>`;
          const note = notes.get(k) ?? (auto.excluded.has(k) ? 'x' : auto.confirmed.has(k) ? 'ok' : '');
          const isAuto = !notes.has(k) && note;
          return `<button type="button" class="cs-key ${note ? `is-${note}` : ''} ${isAuto ? 'is-auto' : ''}" data-digit="${k}" aria-label="${k}${note === 'x' ? ', barré' : note === 'ok' ? ', sûr' : ''}">${k}</button>`;
        })
        .join('')}
    </div>
    <div class="cs-tools">
      <button type="button" class="cs-tool ${notesMode ? 'is-on' : ''}" data-act="notes" aria-pressed="${notesMode}">${icon('sliders')}<span>Notes</span></button>
      <button type="button" class="cs-tool ${armed === 'stetho' ? 'is-on' : ''}" data-act="stetho" ${tools.stetho ? '' : 'disabled'} aria-pressed="${armed === 'stetho'}">${icon('wave')}<span>Stéthoscope <b>${tools.stetho}</b></span></button>
      <button type="button" class="cs-tool" data-act="xray" ${tools.xray && revealed.size < LENGTH ? '' : 'disabled'}>${icon('eye')}<span>Rayon X <b>${tools.xray}</b></span></button>
    </div>`;
}

function renderAll(animate = false) {
  renderEntry();
  renderHistory(animate);
  renderLeds();
  renderPad();
  renderTimer();
}

// ---------- Évènements ----------
padEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.digit !== undefined) press(Number(b.dataset.digit));
  else if (b.dataset.act === 'erase') erase();
  else if (b.dataset.act === 'ok') submit();
  else if (b.dataset.act === 'notes') {
    notesMode = !notesMode;
    armed = null;
    setFeedback(notesMode ? 'Mode Notes : touche un chiffre pour le barrer, puis le valider.' : 'Mode saisie.');
    gv.audio.play('select');
    renderPad();
  } else if (b.dataset.act === 'stetho' || b.dataset.act === 'xray') arm(b.dataset.act);
  b.blur?.();
});
// Clic droit sur un chiffre : note rapide
padEl.addEventListener('contextmenu', (e) => {
  const b = e.target.closest('[data-digit]');
  if (!b) return;
  e.preventDefault();
  const prev = notesMode;
  notesMode = true;
  press(Number(b.dataset.digit));
  notesMode = prev;
});
window.addEventListener('keydown', (e) => {
  if (gv.state !== 'playing' || e.repeat) return;
  if (/^[0-9]$/.test(e.key)) {
    press(Number(e.key));
    padEl.querySelector(`[data-digit="${e.key}"]`)?.classList.add('is-pressed');
    setTimeout(() => padEl.querySelector(`[data-digit="${e.key}"]`)?.classList.remove('is-pressed'), 120);
  } else if (e.key === 'Backspace') erase();
  else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    submit();
  } else if (e.key.toLowerCase() === 'n') padEl.querySelector('[data-act="notes"]')?.click();
});

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const d = store.data;
  const b = best();
  gv.shell.startExtra.innerHTML = `
    <div class="cs-options">
      <div class="cs-row-opt">
        <span class="cs-label" id="cs-mode-label">Mode</span>
        <div class="cs-modes" role="radiogroup" aria-labelledby="cs-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const locked = b < m.unlock;
              const done = m.id === 'jour' && dailyDone();
              const sub = locked ? `${formatInt(m.unlock)} pts` : done ? (d.daily.won ? `Ouvert en ${d.daily.tries} essais · reviens demain` : 'Raté aujourd’hui · reviens demain') : m.hint;
              return `<button type="button" role="radio" class="cs-mode" data-mode="${m.id}" aria-checked="${d.mode === m.id}" ${locked || done ? 'aria-disabled="true"' : ''}>
                ${locked ? icon('lock') : { classique: icon('lock'), cassetete: icon('dice'), rush: icon('clock'), jour: icon('calendar') }[m.id]}
                <span>${m.label}</span><small>${esc(sub)}</small>
              </button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="cs-row-opt">
        <span class="cs-label" id="cs-theme-label">Coffre</span>
        <div class="cs-themes" role="radiogroup" aria-labelledby="cs-theme-label">
          ${THEMES.map((t) => {
            const locked = b < t.unlock;
            const label = locked ? `${t.name}, débloqué à ${formatInt(t.unlock)} points` : t.name;
            return `<button type="button" role="radio" class="cs-theme cs-theme--${t.id}" data-theme="${t.id}" aria-checked="${d.theme === t.id}" aria-label="${esc(label)}" title="${esc(label)}" ${locked ? 'aria-disabled="true"' : ''}><span></span>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="cs-hint" id="cs-hint" aria-live="polite"></p>
    </div>`;
}

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    const m = MODES[b.dataset.mode];
    $('cs-hint').textContent = m?.id === 'jour' ? 'Le coffre du jour se renouvelle à minuit.' : `Atteins ${formatInt((m ?? THEMES.find((t) => t.id === b.dataset.theme)).unlock)} points pour le débloquer.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.theme) {
    store.data.theme = b.dataset.theme;
    document.body.dataset.theme = b.dataset.theme;
  }
  store.save();
  gv.audio.play('select');
  renderOptions();
  gv.shell.startExtra.querySelector(b.dataset.mode ? `[data-mode="${b.dataset.mode}"]` : `[data-theme="${b.dataset.theme}"]`)?.focus();
});

// ---------- Démarrage ----------
window.__code = {
  get code() { return code; },
  get history() { return history; },
  get run() { return run; },
  get mode() { return mode; },
};

document.body.dataset.theme = theme().id;
// Décor de l'accueil : un coffre déjà entamé
code = [4, 7, 1, 9];
history = [
  { guess: [1, 2, 3, 4], exact: 0, misplaced: 2 },
  { guess: [4, 1, 5, 6], exact: 1, misplaced: 1 },
];
renderAll();
renderOptions();
gv.hud('best', formatInt(best()));
gv.showStart();
