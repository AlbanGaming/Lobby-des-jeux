// Interface commune à tous les jeux : barre du haut (retour, titre, HUD, son, plein écran, pause),
// écran d'accueil, écran de pause et écran de fin de partie.

import { icon, logoMark } from './icons.js';
import { esc } from './toast.js';
import { getCategory } from '../../../games/registry.js';
import { motion } from '../motion.js';
import { formatInt } from '../core/math.js';

const REPLAY_GRACE_MS = 450;

export function createShell({
  game,
  stage,
  hud = [],
  howTo = [],
  lobbyHref = '../../index.html',
  startLabel = 'Jouer',
  formatScore = (n) => formatInt(n),
  getSettings,
  onSetting,
  onStart,
  onPause,
  onResume,
  onRestart,
}) {
  const listeners = { start: onStart, pause: onPause, resume: onResume, restart: onRestart };
  let openScreen = null;
  let overAt = 0;

  // ---------- Barre du haut ----------
  const bar = document.createElement('header');
  bar.className = 'gv-topbar';
  bar.innerHTML = `
    <div class="gv-topbar__left">
      <a class="gv-back" href="${lobbyHref}" data-gv-ui>${icon('back')}<span class="gv-back__label">Lobby</span><span class="sr-only">Retour au lobby GameVerse</span></a>
    </div>
    <div class="gv-topbar__title">
      ${logoMark()}
      <h1 class="gv-topbar__name">${esc(game.title)}</h1>
      <div class="gv-hud">
        ${hud.map((h) => `<div class="gv-hud__item" data-hud="${h.id}"><span class="gv-hud__label">${esc(h.label)}</span><span class="gv-hud__value">${esc(h.value ?? '0')}</span></div>`).join('')}
      </div>
    </div>
    <div class="gv-topbar__right">
      <button class="icon-btn" type="button" data-act="sound" data-gv-ui aria-label="Son"></button>
      <button class="icon-btn gv-hide-sm" type="button" data-act="fullscreen" data-gv-ui aria-label="Plein écran" hidden>${icon('fullscreen')}</button>
      <button class="icon-btn" type="button" data-act="pause" data-gv-ui aria-label="Pause (Échap)">${icon('pause')}</button>
    </div>`;
  document.body.prepend(bar);

  const hudEls = Object.fromEntries(hud.map((h) => [h.id, bar.querySelector(`[data-hud="${h.id}"] .gv-hud__value`)]));
  const soundBtn = bar.querySelector('[data-act="sound"]');
  const fsBtn = bar.querySelector('[data-act="fullscreen"]');
  const pauseBtn = bar.querySelector('[data-act="pause"]');

  stage.tabIndex = -1;
  stage.setAttribute('aria-label', `Zone de jeu : ${game.title}`);

  function syncSound() {
    const on = getSettings().sound;
    soundBtn.innerHTML = icon(on ? 'soundOn' : 'soundOff');
    soundBtn.setAttribute('aria-pressed', String(!on));
    soundBtn.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son');
  }
  soundBtn.addEventListener('click', () => {
    onSetting('sound', !getSettings().sound);
    syncSound();
  });
  syncSound();

  if (document.fullscreenEnabled) {
    fsBtn.hidden = false;
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      fsBtn.innerHTML = icon(on ? 'fullscreenExit' : 'fullscreen');
      fsBtn.setAttribute('aria-label', on ? 'Quitter le plein écran' : 'Plein écran');
    });
  }

  pauseBtn.addEventListener('click', () => {
    if (shell.state === 'playing') listeners.pause?.();
    else if (shell.state === 'paused') listeners.resume?.();
  });

  // ---------- Écrans ----------
  function makeScreen(name, label) {
    const el = document.createElement('section');
    el.className = 'gv-screen';
    el.dataset.screen = name;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', label);
    el.setAttribute('data-gv-ui', '');
    stage.appendChild(el);
    return el;
  }

  function open(el, focusSel = '[data-primary]') {
    if (openScreen && openScreen !== el) close(openScreen, false);
    openScreen = el;
    el.classList.add('is-open');
    el.removeAttribute('inert');
    requestAnimationFrame(() => el.querySelector(focusSel)?.focus({ preventScroll: true }));
  }

  function close(el, refocus = true) {
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('inert', '');
    if (openScreen === el) openScreen = null;
    if (refocus) {
      if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
      stage.focus({ preventScroll: true });
    }
  }

  // Accueil
  const startEl = makeScreen('start', `${game.title} : accueil`);
  const cat = getCategory(game.category);
  startEl.innerHTML = `
    <div class="gv-card">
      <p class="gv-kicker">${esc(cat?.label ?? '')}</p>
      <h2 class="gv-card__title">${esc(game.title)}</h2>
      <p class="gv-card__lead">${esc(game.description)}</p>
      <div class="gv-actions">
        <button class="btn btn--primary btn--lg btn--block" type="button" data-primary data-act="start">${icon('play')}${esc(startLabel)}</button>
      </div>
      <p class="gv-hint gv-start-best" hidden></p>
      ${howTo.length ? `<div class="gv-howto">${howTo.map((h) => `
        <div class="gv-howto__row">
          <span class="gv-howto__keys">${h.keys.map((k) => (k.startsWith('icon:') ? `<span class="kbd">${icon(k.slice(5))}</span>` : `<span class="kbd">${esc(k)}</span>`)).join('')}</span>
          <span class="gv-howto__text">${esc(h.text)}</span>
        </div>`).join('')}</div>` : ''}
      <div class="gv-start-extra"></div>
    </div>`;
  startEl.querySelector('[data-act="start"]').addEventListener('click', () => listeners.start?.());

  // Pause
  const pauseEl = makeScreen('pause', 'Pause');
  pauseEl.innerHTML = `
    <div class="gv-card">
      <p class="gv-kicker">Partie en pause</p>
      <h2 class="gv-card__title">Pause</h2>
      <div class="gv-actions">
        <button class="btn btn--primary btn--lg btn--block" type="button" data-primary data-act="resume">${icon('play')}Reprendre</button>
        <div class="gv-actions gv-actions--row" style="margin-top:0">
          <button class="btn btn--ghost" type="button" data-act="restart">${icon('restart')}Rejouer</button>
          <a class="btn btn--ghost" href="${lobbyHref}">${icon('home')}Lobby</a>
        </div>
      </div>
      <div class="gv-quick-settings">
        ${toggleRow('sound', 'Effets sonores')}
        ${toggleRow('music', 'Musique')}
        ${toggleRow('motion', 'Réduire les animations')}
      </div>
      <p class="gv-hint"><span class="kbd">Échap</span> pour reprendre</p>
    </div>`;
  pauseEl.querySelector('[data-act="resume"]').addEventListener('click', () => listeners.resume?.());
  pauseEl.querySelector('[data-act="restart"]').addEventListener('click', () => listeners.restart?.());
  pauseEl.querySelectorAll('.switch').forEach((sw) => {
    sw.addEventListener('click', () => {
      const key = sw.dataset.setting;
      const s = getSettings();
      if (key === 'motion') onSetting('motion', motion.reduced ? 'full' : 'reduced');
      else onSetting(key, !s[key]);
      syncToggles();
      syncSound();
    });
  });

  function toggleRow(key, label) {
    return `<div class="setting-row"><span id="gv-set-${key}">${label}</span><button class="switch" type="button" role="switch" aria-labelledby="gv-set-${key}" data-setting="${key}"></button></div>`;
  }
  function syncToggles() {
    const s = getSettings();
    pauseEl.querySelectorAll('.switch').forEach((sw) => {
      const k = sw.dataset.setting;
      sw.setAttribute('aria-checked', String(k === 'motion' ? motion.reduced : !!s[k]));
    });
  }

  // Fin de partie
  const overEl = makeScreen('over', 'Fin de partie');

  // ---------- Clavier ----------
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (shell.state === 'playing') {
        e.preventDefault();
        listeners.pause?.();
      } else if (shell.state === 'paused') {
        e.preventDefault();
        listeners.resume?.();
      }
      return;
    }
    if (e.repeat) return;
    const go = e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter';
    // Espace / Entrée appartiennent au bouton focalisé ; R reste un raccourci partout
    if (onButton && go) return;
    if (shell.state === 'start' && go && openScreen === startEl) {
      e.preventDefault();
      listeners.start?.();
    } else if (shell.state === 'over' && (go || e.code === 'KeyR') && performance.now() - overAt > REPLAY_GRACE_MS) {
      e.preventDefault();
      listeners.restart?.();
    }
  });

  // ---------- API ----------
  const shell = {
    state: 'start',
    bar,
    stage,
    startExtra: startEl.querySelector('.gv-start-extra'),

    setHud(id, value, { bump = false } = {}) {
      const el = hudEls[id];
      if (!el) return;
      const text = String(value);
      if (el.textContent !== text) el.textContent = text;
      if (bump && !motion.reduced) {
        el.classList.remove('is-bump');
        void el.offsetWidth;
        el.classList.add('is-bump');
      }
    },

    showStart({ best } = {}) {
      shell.state = 'start';
      const b = startEl.querySelector('.gv-start-best');
      if (best !== null && best !== undefined) {
        b.hidden = false;
        b.innerHTML = `${icon('trophy')} Ton record : <strong>${esc(formatScore(best))}</strong>`;
        b.style.cssText = 'display:flex;gap:6px;align-items:center;justify-content:center';
      }
      open(startEl);
    },

    hideScreens() {
      if (openScreen) close(openScreen);
      shell.state = 'playing';
      pauseBtn.innerHTML = icon('pause');
      pauseBtn.setAttribute('aria-label', 'Pause (Échap)');
    },

    showPause() {
      shell.state = 'paused';
      syncToggles();
      pauseBtn.innerHTML = icon('play');
      pauseBtn.setAttribute('aria-label', 'Reprendre');
      open(pauseEl);
    },

    hidePause() {
      close(pauseEl);
      shell.state = 'playing';
      pauseBtn.innerHTML = icon('pause');
      pauseBtn.setAttribute('aria-label', 'Pause (Échap)');
    },

    /**
     * r = { score, best, isRecord, prevBest, xp, credits, levelBefore, levelAfter, daily,
     *       title?, kicker?, stats?: [{ label, value }], nextUnlock?: { label, current, target } }
     */
    showGameOver(r) {
      shell.state = 'over';
      overAt = performance.now();
      const scoreLabel = game.score?.label ?? 'Score';
      const lvlUp = r.levelAfter.level > r.levelBefore.level;
      const stats = [
        { label: 'Record', value: r.best === null ? '—' : formatScore(r.best) },
        ...(r.stats ?? []),
      ];
      const nu = r.nextUnlock;
      overEl.innerHTML = `
        <div class="gv-card">
          ${r.isRecord && r.prevBest !== null ? '<span class="gv-record">Nouveau record !</span>' : ''}
          <p class="gv-kicker">${esc(r.kicker ?? 'Partie terminée')}</p>
          <h2 class="sr-only">${esc(r.title ?? 'Fin de partie')}</h2>
          <p class="gv-score" aria-label="${esc(scoreLabel)} : ${esc(formatScore(r.score))}">${esc(formatScore(0))}</p>
          <p class="gv-hint" style="margin-top:4px">${esc(r.title ?? scoreLabel)}</p>
          <div class="gv-stats">${stats.map((s) => `<div class="gv-stat"><div class="gv-stat__label">${esc(s.label)}</div><div class="gv-stat__value">${esc(s.value)}</div></div>`).join('')}</div>
          <div class="gv-progress">
            <div class="gv-progress__row"><span>${lvlUp ? `<strong>Niveau ${r.levelAfter.level} atteint !</strong>` : `Niveau <strong>${r.levelAfter.level}</strong>`}</span><span><strong>+${formatInt(r.xp)} XP</strong> · +${formatInt(r.credits)} ${icon('coin')}</span></div>
            <div class="meter" data-meter="xp" style="--value:${lvlUp ? 0 : r.levelBefore.progress}"><div class="meter__fill"></div></div>
            ${nu ? `
              <div class="gv-progress__row"><span>Prochain déblocage : <strong>${esc(nu.label)}</strong></span><span>${esc(formatInt(Math.min(nu.current, nu.target)))} / ${esc(formatInt(nu.target))}</span></div>
              <div class="meter" style="--meter-color:var(--sky);--value:${Math.min(1, nu.current / nu.target)}"><div class="meter__fill"></div></div>` : ''}
            ${r.daily ? `<div class="gv-progress__row"><span>${icon('calendar')} <strong>Défi du jour réussi !</strong></span><span>+${r.daily.reward.xp} XP</span></div>` : ''}
          </div>
          <div class="gv-actions gv-actions--row">
            <a class="btn btn--ghost" href="${lobbyHref}">${icon('home')}Lobby</a>
            <button class="btn btn--primary" type="button" data-primary data-act="replay">${icon('restart')}Rejouer</button>
          </div>
          <p class="gv-hint"><span class="kbd">Espace</span> ou <span class="kbd">R</span> pour rejouer</p>
        </div>`;
      overEl.querySelector('[data-act="replay"]').addEventListener('click', () => listeners.restart?.());
      open(overEl);

      // Compteur de score et remplissage de la barre d'XP
      const scoreEl = overEl.querySelector('.gv-score');
      const meterEl = overEl.querySelector('[data-meter="xp"]');
      setTimeout(() => meterEl.style.setProperty('--value', r.levelAfter.progress), motion.reduced ? 0 : 250);
      // Score textuel (ex. « 3 – 1 » en duel) : affiché tel quel, sans compteur
      if (r.scoreText) {
        scoreEl.textContent = r.scoreText;
        scoreEl.setAttribute('aria-label', r.scoreText);
        return;
      }
      const target = Number(r.score) || 0;
      const t0 = performance.now();
      const dur = motion.reduced ? 0 : Math.min(900, 300 + Math.abs(target) * 4);
      const step = (now) => {
        const p = dur ? Math.min(1, (now - t0) / dur) : 1;
        const e = 1 - (1 - p) ** 3;
        scoreEl.textContent = formatScore(Math.round(target * e));
        if (p < 1 && shell.state === 'over') requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },

    banner(text, { color } = {}) {
      const el = document.createElement('div');
      el.className = 'gv-banner';
      el.textContent = text;
      if (color) el.style.color = color;
      stage.appendChild(el);
      el.addEventListener('animationend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 1200);
    },

    syncSettings() {
      syncSound();
      syncToggles();
    },
  };

  startEl.setAttribute('inert', '');
  pauseEl.setAttribute('inert', '');
  overEl.setAttribute('inert', '');
  return shell;
}
