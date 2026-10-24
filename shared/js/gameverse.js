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

export function bootGame(id, opts = {}) {
  const game = opts.game ?? getGame(id);
  if (!game) throw new Error(`Jeu inconnu dans le registre : ${id}`);
  const stage = opts.stage ?? document.querySelector('.gv-stage');
  document.documentElement.classList.add('gv-game-root');
  document.documentElement.setAttribute('data-gv-ready', ''); // désarme le message de secours
  document.body.classList.add('gv-game');

  const settings = meta.getSettings();
  audio.configure(settings);
  if (opts.music) audio.setSong(opts.music);

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
      shell.showStart({ best: gv.best });
    },

    start() {
      if (shell.state === 'playing') return;
      shell.hideScreens();
      meta.startRun(id);
      track(true);
      audio.resumeMusic();
      audio.play('select');
      opts.onStart?.();
    },

    restart() {
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
    gameOver({ score, stats = {}, extraStats = [], nextUnlock, title, kicker, xp, scoreText, sound } = {}) {
      if (shell.state === 'over') return null;
      track(false);
      audio.pauseMusic();
      const r = meta.reportRun(id, { score, stats, xp });
      audio.play(sound ?? (r.isRecord && r.prevBest !== null ? 'record' : 'gameOver'));
      shell.showGameOver({ ...r, stats: extraStats, nextUnlock, title, kicker, scoreText });
      return r;
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
