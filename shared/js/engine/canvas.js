// Canvas responsive et net (devicePixelRatio), avec un repère logique stable.
//
// Modes :
//  - 'height'  : hauteur logique fixe, la largeur suit l'écran (runners, défilants)
//  - 'width'   : largeur logique fixe, la hauteur suit l'écran
//  - 'contain' : largeur ET hauteur logiques fixes, letterbox centré
//  - 'stage'   : au moins `height` unités de haut ET `minWidth` de large visibles (nombre ou
//                fonction (largeurCSS, hauteurCSS) → nombre) ; l'écran
//                remplit le reste (plus de ciel en portrait, plus d'horizon en paysage)
//  - 'fill'    : 1 unité = 1 px CSS

export function createCanvas(container, { mode = 'fill', width = 800, height = 450, minWidth = 0, maxDpr = 2, minAspect = 0, maxAspect = Infinity, onResize, alpha = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gv-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha });

  const view = {
    canvas,
    ctx,
    width, // largeur logique visible
    height, // hauteur logique visible
    scale: 1, // px CSS par unité logique
    offsetX: 0, // px CSS
    offsetY: 0,
    cssWidth: 0,
    cssHeight: 0,
    dpr: 1,

    // Applique la transformation logique ; à appeler en début de rendu.
    begin(clear = true) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (clear) ctx.clearRect(0, 0, canvas.width, canvas.height);
      const k = view.dpr * view.scale;
      ctx.setTransform(k, 0, 0, k, view.offsetX * view.dpr, view.offsetY * view.dpr);
      return ctx;
    },

    // Coordonnées écran → repère logique
    toLogical(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return {
        x: (clientX - r.left - view.offsetX) / view.scale,
        y: (clientY - r.top - view.offsetY) / view.scale,
      };
    },

    resize,
    destroy() {
      ro.disconnect();
      canvas.remove();
    },
  };

  function resize() {
    const rect = container.getBoundingClientRect();
    const cw = Math.max(1, rect.width);
    const ch = Math.max(1, rect.height);
    view.cssWidth = cw;
    view.cssHeight = ch;
    view.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    canvas.width = Math.round(cw * view.dpr);
    canvas.height = Math.round(ch * view.dpr);

    let aspect = cw / ch;
    view.offsetX = 0;
    view.offsetY = 0;

    if (mode === 'fill') {
      view.scale = 1;
      view.width = cw;
      view.height = ch;
    } else if (mode === 'stage') {
      const mw = typeof minWidth === 'function' ? minWidth(cw, ch) : minWidth;
      view.scale = mw ? Math.min(ch / height, cw / mw) : ch / height;
      view.width = cw / view.scale;
      view.height = ch / view.scale;
    } else if (mode === 'height') {
      aspect = Math.min(Math.max(aspect, minAspect), maxAspect);
      view.height = height;
      view.width = height * aspect;
      view.scale = Math.min(ch / view.height, cw / view.width);
      view.offsetX = (cw - view.width * view.scale) / 2;
      view.offsetY = (ch - view.height * view.scale) / 2;
    } else if (mode === 'width') {
      aspect = Math.min(Math.max(aspect, minAspect), maxAspect);
      view.width = width;
      view.height = width / aspect;
      view.scale = Math.min(cw / view.width, ch / view.height);
      view.offsetX = (cw - view.width * view.scale) / 2;
      view.offsetY = (ch - view.height * view.scale) / 2;
    } else {
      view.width = width;
      view.height = height;
      view.scale = Math.min(cw / width, ch / height);
      view.offsetX = (cw - width * view.scale) / 2;
      view.offsetY = (ch - height * view.scale) / 2;
    }
    ctx.imageSmoothingEnabled = true;
    onResize?.(view);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  return view;
}
