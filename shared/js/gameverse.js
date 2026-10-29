// Point d'entrée commun des jeux : relie l'interface (shell), l'audio, la méta-progression
// (XP, succès, records, temps de jeu) et la pause automatique.
//
//   const gv = bootGame('volt-rush', {
//     hud: [{ id: 'score', label: 'Distance' }, { id: 'best', label: 'Record' }],
//     howTo: [{ keys: ['Espace', 'icon:touch'], text: 'Sauter' }],
//     onStart() {}, onPause() {}, onResume() {},
//   });
//   gv.gameOver({ score: 1234, stats: { coins: 12 }, extraStats: [{ label: 'Pièces', value: 12 }] });

import { getGame } from '../../games/registry.js';
import * as meta from './meta.js';
import { audio } from './engine/audio.js';
import { createShell } from './ui/shell.js';
import { toast } from './ui/toast.js';
import { formatInt } from './core/math.js';
import { motion } from './motion.js';
import { applyLook } from './shop.js';
import { celebrate } from './ui/celebrate.js';

export function bootGame(id, opts = {}) {
  const game = opts.game ?? getGame(id);
  if (!game) throw new Error(`Jeu inconnu dans le registre : ${id}`);
  const stage = opts.stage ?? document.querySelector('.gv-stage');
  document.documentElement.classList.add('gv-game-root');
  document.documentElement.setAttribute('data-gv-ready', ''); // désarme le message de secours
  document.body.classList.add('gv-game');

  const settings = meta.getSettings();
  audio.configure(settings);
  // Thème et pack de sons achetés à la boutique
  applyLook();
  meta.events.addEventListener('change', applyLook);
  const locked = !meta.gameUnlocked(id);
  if (opts.music) audio.setSong(opts.music);

  let runId = 0; // change à chaque partie : annule les enchaînements de la précédente

  // ---------- Temps de jeu actif ----------
  let activeSince = 0;
  const track = (on) => {
    const now = performance.now();
    if (activeSince) meta.addPlayTime(id, now - activeSince);
    activeSince = on ? now : 0;
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) track(false);
    else if (gv.state === 'playing') track(true);
  });
  window.addEventListener('pagehide', () => track(false));

  // ---------- Notifications de méta-progression ----------
  meta.events.addEventListener('achievement', (e) => {
    audio.play('achievement');
    toast({ title: e.detail.title, text: e.detail.desc, iconName: 'trophy' });
  });
  meta.events.addEventListener('levelup', (e) => {
    audio.play('levelUp');
    toast({ title: `Niveau ${e.detail.level} !`, text: '+25 crédits', iconName: 'starFill', tone: 'var(--mint)' });
  });
  meta.events.addEventListener('daily', () => {
    toast({ title: 'Défi du jour réussi', text: '+150 XP · +40 crédits', iconName: 'calendar', tone: 'var(--sky)' });
  });
  meta.events.addEventListener('settings', (e) => {
    audio.configure(e.detail);
    shell.syncSettings();
  });

  const formatScore = opts.formatScore ?? ((n) => formatInt(n) + (game.score?.unit ? ` ${game.score.unit}` : ''));

  const shell = createShell({
    game,
    stage,
    hud: opts.hud ?? [],
    howTo: opts.howTo ?? [],
    startLabel: opts.startLabel,
    pauseKeys: opts.pauseKeys,
    formatScore,
    getSettings: meta.getSettings,
    onSetting: (k, v) => meta.setSetting(k, v),
    onStart: () => gv.start(),
    onPause: () => gv.pause(),
    onResume: () => gv.resume(),
    onRestart: () => gv.restart(),
  });

  const gv = {
    id,
    game,
    shell,
    stage,
    audio,
    meta,
    motion,
    formatScore,

    get state() {
      return shell.state;
    },
    get best() {
      return meta.gameStats(id).best;
    },
    get playing() {
      return shell.state === 'playing';
    },

    showStart() {
      if (locked) return shell.showLocked({ cost: game.secret.cost });
      shell.showStart({ best: gv.best });
    },

    start() {
      if (shell.state === 'playing' || locked) return;
      runId++;
      shell.hideScreens();
      meta.startRun(id);
      track(true);
      audio.resumeMusic();
      audio.play('select');
      opts.onStart?.();
    },

    restart() {
      runId++;
      shell.hideScreens();
      meta.startRun(id);
      track(true);
      audio.resumeMusic();
      (opts.onRestart ?? opts.onStart)?.();
    },

    pause() {
      if (shell.state !== 'playing') return;
      track(false);
      audio.pauseMusic();
      shell.showPause();
      audio.play('back');
      opts.onPause?.();
    },

    resume() {
      if (shell.state !== 'paused') return;
      shell.hidePause();
      track(true);
      audio.resumeMusic();
      audio.play('select');
      opts.onResume?.();
    },

    /**
     * Fin de partie. `stats` sert au défi du jour et aux XP ; `extraStats` s'affiche
     * à l'écran de fin ; `nextUnlock` = { label, current, target }.
     */
    // extraHtml : contenu propre au jeu (graphique, bouton partager…) inséré dans la carte de fin
    gameOver({ score, stats = {}, extraStats = [], nextUnlock, title, kicker, xp, scoreText, sound, extraHtml } = {}) {
      if (shell.state === 'over') return null;
      track(false);
      audio.pauseMusic();
      const r = meta.reportRun(id, { score, stats, xp });
      audio.play(sound ?? (r.isRecord && r.prevBest !== null ? 'record' : 'gameOver'));
      if (r.isRecord && r.prevBest !== null) celebrate(meta.getData().look.celebration);
      shell.showGameOver({ ...r, stats: extraStats, nextUnlock, title, kicker, scoreText, extraHtml });
      return r;
    },

    /**
     * Comme setTimeout, mais le délai ne s'écoule que pendant le jeu : une pause le suspend,
     * une nouvelle partie l'annule. Pour les enchaînements (objet suivant, fin de manche…).
     */
    after(ms, fn) {
      const id0 = runId;
      let left = ms;
      let last = performance.now();
      let timer = 0;
      let cancelled = false;
      const step = () => {
        if (cancelled || runId !== id0 || shell.state === 'over') return;
        const now = performance.now();
        if (shell.state === 'playing') left -= now - last;
        last = now;
        if (left <= 0) return fn();
        timer = setTimeout(step, Math.min(left, 100));
      };
      timer = setTimeout(step, Math.min(ms, 100));
      return {
        cancel() {
          cancelled = true;
          clearTimeout(timer);
        },
      };
    },

    unlock(achId) {
      return meta.unlockAchievement(id, achId);
    },

    hud(key, value, bump = false) {
      shell.setHud(key, value, { bump });
    },

    banner(text, o) {
      shell.banner(text, o);
    },
  };

  return gv;
}
