// Motif — trouver un mot en 6 essais. Mot du jour (le même pour tous), Série contre la montre
// (4 à 7 lettres, chaque mot recharge le chrono) et partie Libre.

import { bootGame } from '../../shared/js/gameverse.js';
import { createFxLayer, wiggle } from '../../shared/js/engine/fx.js';
import { createRng, dayKey } from '../../shared/js/core/rng.js';
import { formatInt } from '../../shared/js/core/math.js';
import { createStore } from '../../shared/js/storage.js';
import { toast, esc } from '../../shared/js/ui/toast.js';
import { icon } from '../../shared/js/ui/icons.js';
import { motion } from '../../shared/js/motion.js';
import { MAX_GUESSES, loadDictionary, loadTargets, normalize, grade, keyStates, dailyWord, dailyIndex, shareText, wordPoints } from './logic.js';

const SERIES_TIME = 120;
const KEY_ROWS = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['ENTER', 'W', 'X', 'C', 'V', 'B', 'N', 'BACK'],
];
const MODES = {
  jour: { id: 'jour', label: 'Mot du jour', hint: '5 lettres, le même pour tous' },
  serie: { id: 'serie', label: 'Série', hint: 'Enchaîne les mots en 2 minutes' },
  libre: { id: 'libre', label: 'Libre', hint: 'Un mot, sans chrono' },
};
const THEMES = [
  { id: 'menthe', name: 'Menthe', unlock: 0 },
  { id: 'agrumes', name: 'Agrumes', unlock: 30 },
  { id: 'encre', name: 'Encre', unlock: 80 },
  { id: 'contraste', name: 'Contraste élevé', unlock: 0 },
];

const store = createStore('motif', {
  version: 1,
  defaults: {
    mode: 'jour',
    length: 5,
    theme: 'menthe',
    words: 0,
    daily: { index: 0, done: false, won: false, rows: [], streak: 0, maxStreak: 0, played: 0, wins: 0, dist: [0, 0, 0, 0, 0, 0], lastWin: 0 },
    seen: [],
  },
});

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const kbEl = $('keyboard');
const toastEl = $('toast');
const titleEl = $('title');
const infoEl = $('info');

const gv = bootGame('motif', {
  hud: [
    { id: 'score', label: 'Score' },
    { id: 'best', label: 'Record' },
  ],
  howTo: [
    { keys: ['A–Z', 'Entrée'], text: 'Tape un mot et valide. Les accents ne comptent pas.' },
    { keys: ['icon:check'], text: 'Vert : bonne place · jaune : présente ailleurs · gris : absente.' },
    { keys: ['icon:clock'], text: 'En Série, chaque mot trouvé recharge le chrono.' },
  ],
  pauseKeys: ['Escape'], // P est une lettre comme une autre
  onStart: startGame,
  onRestart: startGame,
});
const fx = createFxLayer(gv.stage, { shakeTarget: document.querySelector('.mf-board-wrap') });

// ---------- État ----------
let mode = MODES.jour;
let len = 5;
let target = '';
let rows = []; // { guess, result }
let current = '';
let dict = null;
let targets = null;
let busy = false;
let run = null;
let timerId = 0;
let rng = createRng(Date.now());

const theme = () => THEMES.find((t) => t.id === store.data.theme) ?? THEMES[0];
const best = () => gv.best ?? 0;
const todayIndex = () => dailyIndex();
const dailyDone = () => store.data.daily.index === todayIndex() && store.data.daily.done;

async function startGame() {
  mode = MODES[store.data.mode] ?? MODES.jour;
  if (mode.id === 'jour' && dailyDone()) mode = MODES.libre;
  len = mode.id === 'jour' ? 5 : store.data.length;
  run = { points: 0, words: 0, mult: 1, timeLeft: SERIES_TIME, daily: 0, quick: 0, lastTries: 0 };
  document.body.dataset.theme = theme().id;
  gv.hud('score', 0);
  gv.hud('best', formatInt(best()));
  clearInterval(timerId);
  busy = true;
  renderBoard();
  [targets, dict] = await Promise.all([loadTargets(), loadDictionary(len)]);
  busy = false;
  if (mode.id === 'serie') {
    let last = performance.now();
    timerId = setInterval(() => {
      const now = performance.now();
      if (gv.playing && !busy) run.timeLeft -= (now - last) / 1000;
      last = now;
      renderInfo();
      if (run.timeLeft <= 0) finish(false, true);
    }, 100);
  }
  newWord();
}

function pickWord() {
  if (mode.id === 'jour') return dailyWord(targets[5]);
  const list = targets[len];
  const seen = new Set(store.data.seen);
  const fresh = list.filter((w) => !seen.has(w));
  const pool = fresh.length ? fresh : list;
  const w = pool[Math.floor(rng.next() * pool.length)];
  store.data.seen = [...store.data.seen.slice(-400), w];
  store.saveSoon();
  return w;
}

function newWord() {
  target = pickWord();
  rows = [];
  current = '';
  busy = false;
  // Mot du jour déjà entamé aujourd'hui : on reprend la grille
  if (mode.id === 'jour' && store.data.daily.index === todayIndex() && store.data.daily.rows.length) {
    rows = store.data.daily.rows.map((g) => ({ guess: g, result: grade(target, g) }));
  }
  renderBoard();
  renderKeyboard();
  renderInfo();
}

// ---------- Saisie ----------
function type(letter) {
  if (busy || gv.state !== 'playing' || current.length >= len) return;
  current += letter;
  gv.audio.play('tock', { pitch: 0.9 + current.length * 0.05, volume: 0.7 });
  renderRow(rows.length, true);
}

function erase() {
  if (busy || gv.state !== 'playing' || !current) return;
  current = current.slice(0, -1);
  gv.audio.play('back', { pitch: 1.4, volume: 0.5 });
  renderRow(rows.length);
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove('is-on');
  void toastEl.offsetWidth;
  toastEl.classList.add('is-on');
}

async function submit() {
  if (busy || gv.state !== 'playing') return;
  const rowEl = boardEl.children[rows.length];
  if (current.length < len) {
    wiggle(rowEl);
    showToast('Pas assez de lettres');
    gv.audio.play('error');
    return;
  }
  if (!dict.has(current)) {
    wiggle(rowEl);
    showToast('Ce mot n’est pas dans le dictionnaire');
    gv.audio.play('error');
    return;
  }
  const guess = current;
  const result = grade(target, guess);
  rows.push({ guess, result });
  current = '';
  if (mode.id === 'jour') {
    store.data.daily = { ...store.data.daily, index: todayIndex(), rows: rows.map((r) => r.guess), done: false };
    store.save();
  }
  busy = true;
  await reveal(rows.length - 1);
  busy = false;
  renderKeyboard();
  const won = guess === target;
  if (won) return solved();
  if (rows.length >= MAX_GUESSES) return failed();
  const greens = result.filter((r) => r === 'correct').length;
  if (greens === len - 1) {
    showToast('Presque ! Une seule lettre');
    gv.audio.play('nearMiss');
  }
}

// Retournement des tuiles, une par une, avec un son qui monte
function reveal(r) {
  const rowEl = boardEl.children[r];
  const { result } = rows[r];
  const step = motion.reduced ? 40 : 230;
  return new Promise((resolve) => {
    [...rowEl.children].forEach((tile, i) => {
      setTimeout(() => {
        tile.classList.add('is-flip');
        setTimeout(() => {
          tile.dataset.state = result[i];
          gv.audio.play(result[i] === 'correct' ? 'tick' : result[i] === 'present' ? 'tock' : 'click', { pitch: 1 + i * 0.08, volume: 0.8 });
        }, step / 2);
      }, i * step);
    });
    setTimeout(() => {
      renderRow(r);
      resolve();
    }, len * step + step);
  });
}

function solved() {
  const tries = rows.length;
  const pts = Math.round(wordPoints(tries, len) * run.mult);
  run.points += pts;
  run.words++;
  run.lastTries = tries;
  if (tries <= 3) run.quick = 1;
  store.data.words++;
  gv.hud('score', formatInt(run.points), true);
  gv.unlock('premier');
  if (tries <= 2) gv.unlock('en-2');
  if (tries === 1) gv.unlock('devin');
  if (len === 7) gv.unlock('sept');
  if (store.data.words >= 100) gv.unlock('cent');
  // Vague de rebond et confettis
  const rowEl = boardEl.children[tries - 1];
  [...rowEl.children].forEach((t, i) => setTimeout(() => t.classList.add('is-bounce'), i * 80));
  fx.burstAt(rowEl, { count: 36, colors: ['#3ee6a8', '#ffc93c', '#4cc3ff', '#f4efe4'], speed: [160, 420], size: [4, 8], gravity: 700, spin: [-10, 10], life: [0.6, 1.1] });
  fx.popupAt(rowEl, `+${formatInt(pts)}`, { size: 38, color: '#3ee6a8', rise: 70 });
  gv.audio.play(tries <= 2 ? 'perfect' : 'win');

  if (mode.id === 'jour') {
    const d = store.data.daily;
    const consecutive = d.lastWin === todayIndex() - 1;
    d.done = true;
    d.won = true;
    d.played++;
    d.wins++;
    d.dist[tries - 1]++;
    d.streak = consecutive ? d.streak + 1 : 1;
    d.maxStreak = Math.max(d.maxStreak, d.streak);
    d.lastWin = todayIndex();
    run.daily = 1;
    gv.unlock('du-jour');
    if (d.streak >= 7) gv.unlock('jour-7');
  }
  store.save();

  if (mode.id === 'serie') {
    const bonus = 20 + (MAX_GUESSES - tries) * 5;
    run.timeLeft += bonus;
    if (tries <= 3) run.mult = Math.min(4, run.mult + 1);
    else run.mult = 1;
    showToast(`+${bonus} s${run.mult > 1 ? ` · multiplicateur ×${run.mult}` : ''}`);
    if (run.words >= 10) gv.unlock('serie-10');
    busy = true;
    gv.after(motion.reduced ? 500 : 1300, newWord);
  } else gv.after(motion.reduced ? 600 : 1500, () => finish(true));
}

function failed() {
  showToast(`Le mot était ${target}`);
  fx.addShake(0.3);
  gv.audio.play('lose');
  boardEl.classList.add('is-fail');
  setTimeout(() => boardEl.classList.remove('is-fail'), 700);
  if (mode.id === 'jour') {
    const d = store.data.daily;
    d.done = true;
    d.won = false;
    d.played++;
    d.streak = 0;
    store.save();
  }
  if (mode.id === 'serie') {
    run.timeLeft -= 30;
    run.mult = 1;
    busy = true;
    gv.after(1500, () => (run.timeLeft > 0 ? newWord() : finish(false, true)));
  } else gv.after(1700, () => finish(false));
}

function distributionHtml() {
  const d = store.data.daily;
  const max = Math.max(1, ...d.dist);
  return `
    <div class="mf-dist">
      <p class="mf-dist__title">Mot du jour · ${d.wins}/${d.played} réussis · série ${d.streak} (record ${d.maxStreak})</p>
      ${d.dist.map((n, i) => `<div class="mf-dist__row"><span>${i + 1}</span><b style="--w:${(n / max) * 100}%" class="${d.won && rows.length === i + 1 ? 'is-today' : ''}">${n}</b></div>`).join('')}
      <button class="btn btn--sm btn--block mf-share" type="button" data-share>${icon('share')}Copier mon résultat</button>
    </div>`;
}

function finish(won, timeUp = false) {
  if (gv.state === 'over') return;
  clearInterval(timerId);
  busy = true;
  const next = THEMES.filter((t) => t.unlock > store.data.words).sort((a, b) => a.unlock - b.unlock)[0];
  const isDaily = mode.id === 'jour';
  gv.gameOver({
    score: run.points,
    stats: { score: run.points, daily: run.daily, words: mode.id === 'serie' ? run.words : 0, quick: run.quick },
    extraStats:
      mode.id === 'serie'
        ? [{ label: 'Mots', value: formatInt(run.words) }, { label: 'Lettres', value: String(len) }]
        : [{ label: 'Essais', value: won ? `${run.lastTries}/${MAX_GUESSES}` : `X/${MAX_GUESSES}` }, { label: 'Mot', value: target }],
    kicker: timeUp ? 'Temps écoulé' : isDaily ? `Mot du jour n°${todayIndex()}` : won ? 'Mot trouvé' : 'Mot manqué',
    title: won ? 'Bravo !' : `Le mot était ${target}`,
    nextUnlock: next ? { label: `Thème ${next.name}`, current: store.data.words, target: next.unlock } : undefined,
    extraHtml: isDaily ? distributionHtml() : '',
    sound: won || run.words ? 'record' : 'lose',
  });
  const shareBtn = document.querySelector('[data-screen="over"] [data-share]');
  shareBtn?.addEventListener('click', async () => {
    const text = shareText(rows, won, todayIndex());
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Résultat copié', text: 'Colle-le où tu veux : le mot reste secret.', iconName: 'share', tone: 'var(--mint)', duration: 2400 });
    } catch {
      toast({ title: 'Copie impossible', text: text.split('\n')[0], iconName: 'info', tone: 'var(--tomato)' });
    }
  });
  if (THEMES.every((t) => store.data.words >= t.unlock)) gv.unlock('collection');
  for (const t of THEMES) if (t.unlock > 0 && store.data.words === t.unlock) toast({ title: 'Nouveau thème !', text: `Motif ${t.name} débloqué.`, iconName: 'palette', tone: 'var(--mint)' });
  gv.hud('best', formatInt(best()));
  renderOptions();
}

// ---------- Rendu ----------
function renderBoard() {
  boardEl.style.setProperty('--cols', len);
  boardEl.innerHTML = Array.from({ length: MAX_GUESSES }, (_, r) => `<div class="mf-row" role="group"></div>`).join('');
  for (let r = 0; r < MAX_GUESSES; r++) renderRow(r);
  fit();
}

const STATE_FR = { correct: 'bien placée', present: 'mal placée', absent: 'absente' };
function renderRow(r, popLast = false) {
  const rowEl = boardEl.children[r];
  if (!rowEl) return;
  const done = rows[r];
  const letters = done ? done.guess : r === rows.length ? current : '';
  rowEl.innerHTML = Array.from({ length: len }, (_, i) => {
    const ch = letters[i] ?? '';
    const st = done ? done.result[i] : '';
    const pop = popLast && i === letters.length - 1 ? 'is-pop' : '';
    return `<span class="mf-tile ${ch ? 'is-filled' : ''} ${pop}" ${st ? `data-state="${st}"` : ''} aria-hidden="true">${ch}</span>`;
  }).join('');
  rowEl.classList.toggle('is-current', r === rows.length && !done);
  rowEl.setAttribute('aria-label', done ? `Essai ${r + 1} : ${done.guess}, ${done.guess.split('').map((c, i) => `${c} ${STATE_FR[done.result[i]]}`).join(', ')}` : r === rows.length ? `Saisie en cours : ${current || 'vide'}` : `Essai ${r + 1} : vide`);
}

function renderKeyboard() {
  const st = keyStates(rows);
  kbEl.innerHTML = KEY_ROWS.map(
    (row) =>
      `<div class="mf-krow">${row
        .map((k) => {
          if (k === 'ENTER') return `<button type="button" class="mf-key mf-key--wide mf-key--enter" data-key="ENTER" aria-label="Valider">${icon('check')}</button>`;
          if (k === 'BACK') return `<button type="button" class="mf-key mf-key--wide" data-key="BACK" aria-label="Effacer">${icon('back')}</button>`;
          return `<button type="button" class="mf-key" data-key="${k}" ${st[k] ? `data-state="${st[k]}"` : ''} aria-label="${k}${st[k] ? `, ${STATE_FR[st[k]]}` : ''}">${k}</button>`;
        })
        .join('')}</div>`,
  ).join('');
}

function renderInfo() {
  if (!run) return;
  if (mode.id === 'jour') titleEl.textContent = `Mot du jour n°${todayIndex()}`;
  else if (mode.id === 'serie') titleEl.textContent = `Série · ${len} lettres`;
  else titleEl.textContent = `Libre · ${len} lettres`;
  if (mode.id === 'serie') {
    const t = Math.max(0, run.timeLeft);
    infoEl.innerHTML = `<span class="mf-chip">${icon('check')} ${run.words} mot${run.words > 1 ? 's' : ''}</span>${run.mult > 1 ? `<span class="mf-chip mf-chip--mult">×${run.mult}</span>` : ''}<span class="mf-chip mf-chip--time ${t <= 15 ? 'is-low' : ''}">${icon('clock')} ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}</span>`;
  } else infoEl.innerHTML = `<span class="mf-chip">${icon('target')} ${Math.max(0, MAX_GUESSES - rows.length)} essai${MAX_GUESSES - rows.length > 1 ? 's' : ''}</span>`;
}

// Taille des tuiles : la grille et le clavier tiennent toujours dans l'écran
function fit() {
  const stage = gv.stage.getBoundingClientRect();
  const kb = kbEl.getBoundingClientRect().height || 180;
  const avH = stage.height - kb - 110;
  const avW = Math.min(stage.width, 560) - 32;
  const gap = 6;
  const size = Math.max(30, Math.min(64, (avW - gap * (len - 1)) / len, (avH - gap * (MAX_GUESSES - 1)) / MAX_GUESSES));
  boardEl.style.setProperty('--tile', `${Math.floor(size)}px`);
}
new ResizeObserver(fit).observe(gv.stage);

// ---------- Évènements ----------
kbEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-key]');
  if (!b) return;
  const k = b.dataset.key;
  if (k === 'ENTER') submit();
  else if (k === 'BACK') erase();
  else type(k);
  b.blur();
});
window.addEventListener('keydown', (e) => {
  if (gv.state !== 'playing' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter') {
    if (e.target instanceof HTMLButtonElement && !e.target.dataset.key) return;
    e.preventDefault();
    submit();
  } else if (e.key === 'Backspace') erase();
  else {
    const l = normalize(e.key);
    if (l.length === 1) type(l);
  }
});

// ---------- Options (écran d'accueil) ----------
function renderOptions() {
  const d = store.data;
  const done = dailyDone();
  gv.shell.startExtra.innerHTML = `
    <div class="mf-options">
      <div class="mf-row-opt">
        <span class="mf-label" id="mf-mode-label">Mode</span>
        <div class="mf-modes" role="radiogroup" aria-labelledby="mf-mode-label">
          ${Object.values(MODES)
            .map((m) => {
              const locked = m.id === 'jour' && done;
              const sub = locked ? (d.daily.won ? `Trouvé en ${d.daily.rows.length} · reviens demain` : 'Manqué · reviens demain') : m.hint;
              return `<button type="button" role="radio" class="mf-mode" data-mode="${m.id}" aria-checked="${d.mode === m.id}" ${locked ? 'aria-disabled="true"' : ''}>${icon({ jour: 'calendar', serie: 'clock', libre: 'letter' }[m.id])}<span>${m.label}</span><small>${esc(sub)}</small></button>`;
            })
            .join('')}
        </div>
      </div>
      ${d.mode !== 'jour' ? `<div class="mf-row-opt"><span class="mf-label" id="mf-len-label">Longueur</span><div class="mf-lens" role="radiogroup" aria-labelledby="mf-len-label">${[4, 5, 6, 7].map((n) => `<button type="button" role="radio" class="mf-len" data-len="${n}" aria-checked="${d.length === n}">${n}</button>`).join('')}</div></div>` : ''}
      <div class="mf-row-opt">
        <span class="mf-label" id="mf-theme-label">Thème · ${formatInt(d.words)} mots trouvés</span>
        <div class="mf-themes" role="radiogroup" aria-labelledby="mf-theme-label">
          ${THEMES.map((t) => {
            const locked = d.words < t.unlock;
            return `<button type="button" role="radio" class="mf-theme mf-theme--${t.id}" data-theme="${t.id}" aria-checked="${d.theme === t.id}" title="${esc(locked ? `${t.name}, à ${t.unlock} mots` : t.name)}" aria-label="${esc(locked ? `${t.name}, débloqué à ${t.unlock} mots` : t.name)}" ${locked ? 'aria-disabled="true"' : ''}><i></i><i></i><i></i>${locked ? `<em>${icon('lock')}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <p class="mf-hint" id="mf-hint" aria-live="polite"></p>
    </div>`;
}

gv.shell.startExtra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') {
    $('mf-hint').textContent = b.dataset.mode ? 'Le mot du jour change à minuit. En attendant : Série ou Libre !' : `Trouve ${THEMES.find((t) => t.id === b.dataset.theme).unlock} mots pour débloquer ce thème.`;
    gv.audio.play('error');
    return;
  }
  if (b.dataset.mode) store.data.mode = b.dataset.mode;
  if (b.dataset.len) store.data.length = Number(b.dataset.len);
  if (b.dataset.theme) {
    store.data.theme = b.dataset.theme;
    document.body.dataset.theme = b.dataset.theme;
  }
  store.save();
  gv.audio.play('select');
  renderOptions();
  const sel = b.dataset.mode ? `[data-mode="${b.dataset.mode}"]` : b.dataset.len ? `[data-len="${b.dataset.len}"]` : `[data-theme="${b.dataset.theme}"]`;
  gv.shell.startExtra.querySelector(sel)?.focus();
});

// ---------- Démarrage ----------
window.__motif = {
  get target() { return target; },
  get rows() { return rows; },
  get run() { return run; },
  get mode() { return mode; },
  get busy() { return busy; },
  get dict() { return dict; },
};

document.body.dataset.theme = theme().id;
// Décor de l'accueil : une grille en cours
target = 'MOTIF';
len = 5;
rows = [
  { guess: 'PIANO', result: grade('MOTIF', 'PIANO') },
  { guess: 'MIEUX', result: grade('MOTIF', 'MIEUX') },
];
renderBoard();
renderKeyboard();
renderOptions();
gv.hud('best', formatInt(best()));
gv.showStart();
// On précharge les données pendant que le joueur lit l'accueil
loadTargets();
loadDictionary(store.data.mode === 'jour' ? 5 : store.data.length);
