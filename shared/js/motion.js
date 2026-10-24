// Préférence « réduire les animations » : réglage GameVerse > préférence système.
// Les effets lisent `motion.reduced`, `motion.shakeScale` et `motion.particleScale`.

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let setting = 'system'; // 'system' | 'reduced' | 'full'
const listeners = new Set();

export const motion = {
  reduced: false,
  shakeScale: 1,
  particleScale: 1,

  setPreference(value) {
    setting = value || 'system';
    apply();
  },
  get preference() {
    return setting;
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function apply() {
  const reduced = setting === 'reduced' || (setting === 'system' && !!mq?.matches);
  motion.reduced = reduced;
  motion.shakeScale = reduced ? 0 : 1;
  motion.particleScale = reduced ? 0.35 : 1;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
  }
  for (const fn of listeners) fn(motion);
}

mq?.addEventListener?.('change', apply);
apply();
