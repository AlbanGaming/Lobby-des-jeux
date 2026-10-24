// Entrées unifiées clavier / souris / tactile, lues par la boucle de jeu.
//
//   const input = createInput({ surface: stage, view, bindings: { jump: ['Space', 'ArrowUp', 'pointer'] } });
//   if (input.pressed('jump')) ...      // vrai pendant une seule frame
//   if (input.down('jump')) ...         // maintenu
//   input.endFrame();                   // à appeler après update()

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function createInput({ surface, view, bindings = {}, preventKeys = true } = {}) {
  const held = new Set();
  const pressedNow = new Set();
  const releasedNow = new Set();
  const anyListeners = new Set();
  let enabled = true;

  const pointer = {
    x: 0,
    y: 0,
    down: false,
    pressed: false,
    released: false,
    id: null,
    type: 'mouse',
    startX: 0,
    startY: 0,
    startTime: 0,
  };
  const touches = new Map();

  const boundKeys = () => new Set(Object.values(bindings).flat());

  function isEditable(el) {
    return el && (EDITABLE.has(el.tagName) || el.isContentEditable);
  }

  function press(code, event) {
    if (!held.has(code)) {
      held.add(code);
      pressedNow.add(code);
      for (const fn of anyListeners) fn(code, event);
    }
  }
  function release(code) {
    if (held.delete(code)) releasedNow.add(code);
  }

  function onKeyDown(e) {
    if (!enabled || isEditable(e.target)) return;
    // Un bouton d'interface focalisé garde Espace/Entrée pour lui
    if ((e.code === 'Space' || e.code === 'Enter') && e.target instanceof HTMLButtonElement) return;
    if (preventKeys && boundKeys().has(e.code)) e.preventDefault();
    if (e.repeat) return;
    press(e.code, e);
  }
  function onKeyUp(e) {
    release(e.code);
  }

  function updatePointer(e) {
    if (view) {
      const p = view.toLogical(e.clientX, e.clientY);
      pointer.x = p.x;
      pointer.y = p.y;
    } else {
      const r = surface.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    }
  }

  function onPointerDown(e) {
    if (!enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea, [data-gv-ui]')) return;
    e.preventDefault();
    surface.setPointerCapture?.(e.pointerId);
    updatePointer(e);
    touches.set(e.pointerId, { x: pointer.x, y: pointer.y });
    pointer.type = e.pointerType;
    if (pointer.id === null) {
      pointer.id = e.pointerId;
      pointer.down = true;
      pointer.pressed = true;
      pointer.startX = pointer.x;
      pointer.startY = pointer.y;
      pointer.startTime = performance.now();
      press('pointer', e);
    }
  }
  function onPointerMove(e) {
    if (touches.has(e.pointerId)) {
      updatePointer(e);
      touches.set(e.pointerId, { x: pointer.x, y: pointer.y });
    } else if (e.pointerType === 'mouse') {
      updatePointer(e);
    }
  }
  function onPointerUp(e) {
    touches.delete(e.pointerId);
    if (e.pointerId === pointer.id) {
      updatePointer(e);
      pointer.id = null;
      pointer.down = false;
      pointer.released = true;
      release('pointer');
    }
  }
  function clearAll() {
    for (const code of held) releasedNow.add(code);
    held.clear();
    touches.clear();
    pointer.down = false;
    pointer.id = null;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearAll);
  surface.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  surface.addEventListener('contextmenu', (e) => e.preventDefault());

  const codesFor = (action) => bindings[action] ?? [action];

  return {
    pointer,
    touches,
    bindings,
    down: (action) => codesFor(action).some((c) => held.has(c)),
    pressed: (action) => codesFor(action).some((c) => pressedNow.has(c)),
    released: (action) => codesFor(action).some((c) => releasedNow.has(c)),
    anyPressed: () => pressedNow.size > 0,
    // Appelé à chaque nouvelle touche/clic (utile pour « appuie pour jouer »)
    onAny(fn) {
      anyListeners.add(fn);
      return () => anyListeners.delete(fn);
    },
    setEnabled(v) {
      enabled = v;
      if (!v) clearAll();
    },
    endFrame() {
      pressedNow.clear();
      releasedNow.clear();
      pointer.pressed = false;
      pointer.released = false;
    },
    reset: clearAll,
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearAll);
      surface.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
