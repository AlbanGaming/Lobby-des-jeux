// Boucle de jeu requestAnimationFrame avec delta time, hit-stop, ralenti
// et pause automatique quand l'onglet perd le focus.

/**
 * const loop = createLoop({
 *   update(dt, realDt) {},   // dt = temps de jeu (0 pendant un hit-stop, × timeScale)
 *   render(realDt) {},
 *   fixedStep: 1 / 120,      // optionnel : physique à pas fixe (update appelé N fois)
 *   onAutoPause() {},        // l'onglet est passé en arrière-plan
 * });
 */
export function createLoop({ update, render, fixedStep = 0, maxDt = 1 / 20, onAutoPause } = {}) {
  let raf = 0;
  let last = 0;
  let running = false;
  let paused = false;
  let hitstop = 0;
  let accumulator = 0;

  const loop = {
    timeScale: 1,
    time: 0, // temps de jeu cumulé (s)
    frame: 0,

    get running() {
      return running && !paused;
    },
    get paused() {
      return paused;
    },

    start() {
      if (running) return loop;
      running = true;
      paused = false;
      last = performance.now();
      raf = requestAnimationFrame(tick);
      return loop;
    },

    stop() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },

    pause() {
      if (!running || paused) return;
      paused = true;
      cancelAnimationFrame(raf);
      raf = 0;
      render?.(0); // une dernière image propre sous l'écran de pause
    },

    resume() {
      if (!running || !paused) return;
      paused = false;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },

    // Fige le temps de jeu un court instant sur les gros impacts.
    hitstop(seconds) {
      hitstop = Math.max(hitstop, seconds);
    },

    destroy() {
      loop.stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    },
  };

  function tick(now) {
    raf = requestAnimationFrame(tick);
    let realDt = (now - last) / 1000;
    last = now;
    if (realDt > maxDt) realDt = maxDt; // évite les sauts après un onglet gelé
    if (realDt < 0) realDt = 0;

    let dt = realDt * loop.timeScale;
    if (hitstop > 0) {
      hitstop -= realDt;
      dt = 0;
    }

    if (fixedStep > 0) {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= fixedStep && steps < 8) {
        update?.(fixedStep, realDt);
        accumulator -= fixedStep;
        loop.time += fixedStep;
        steps++;
      }
      if (steps === 8) accumulator = 0;
    } else {
      update?.(dt, realDt);
      loop.time += dt;
    }

    render?.(realDt);
    loop.frame++;
  }

  function onVisibility() {
    if (document.hidden && running && !paused) {
      onAutoPause ? onAutoPause() : loop.pause();
    }
  }
  function onBlur() {
    if (running && !paused) onAutoPause?.();
  }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);

  return loop;
}
