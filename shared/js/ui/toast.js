// Notifications non bloquantes (succès, niveau, défi du jour) annoncées aux lecteurs d'écran.
// Dans le lobby : cartes détaillées. En jeu : pastilles compactes, une à la fois, en file
// d'attente (les rafales sont regroupées) pour ne jamais masquer la partie.

import { icon } from './icons.js';

let host = null;
let queue = [];
let showing = 0;

const canPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
const inGame = () => document.documentElement.classList.contains('gv-game-root');
const narrow = () => typeof innerWidth === 'number' && innerWidth < 600;
const QUEUE_MAX = 2; // au-delà, les notifications en attente sont résumées en une seule

function ensureHost() {
  if (!host || !document.body.contains(host)) {
    host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    // En « popover », les notifications passent au-dessus des boîtes de dialogue modales
    if (canPopover) host.setAttribute('popover', 'manual');
    document.body.appendChild(host);
  }
  host.classList.toggle('is-compact', inGame());
  if (canPopover) {
    // Ré-ouvrir le popover le remet tout en haut de la pile, devant une modale ouverte entre-temps
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
  }
  return host;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function render(t, compact) {
  const el = document.createElement('div');
  el.className = compact ? 'toast toast--compact' : 'toast';
  el.innerHTML = `
    <span class="toast__icon" ${t.tone ? `style="background:${t.tone}"` : ''}>${icon(t.iconName)}</span>
    <span class="toast__content"><span class="toast__title">${esc(t.title)}</span>${t.text ? `<span class="toast__text">${esc(t.text)}</span>` : ''}</span>`;
  return el;
}

function dismiss(el, after) {
  el.classList.add('is-leaving');
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    el.remove();
    after?.();
  };
  el.addEventListener('animationend', end, { once: true });
  setTimeout(end, 600);
}

function showNext() {
  if (showing || !queue.length) return;
  const t = queue.shift();
  showing = 1;
  const h = ensureHost();
  const el = render(t, true);
  h.appendChild(el);
  setTimeout(() => dismiss(el, () => {
    showing = 0;
    showNext();
  }), t.duration);
}

export function toast({ title, text = '', iconName = 'trophy', duration = 3600, tone } = {}) {
  // En jeu : pastille compacte, une seule à la fois
  if (inGame()) {
    const t = { title, text, iconName, tone, duration: Math.min(duration, narrow() ? 2000 : 2600) };
    if (queue.length >= QUEUE_MAX) {
      // Rafale : ce qui attend est résumé en une pastille, la plus récente reste affichée en entier
      const n = queue.reduce((sum, q) => sum + (q.summary ?? 1), 0);
      queue = [{ title: `+${n} notifications`, text: 'Succès et récompenses : voir le profil', iconName: 'trophy', duration: 2000, summary: n }, t];
    } else queue.push(t);
    showNext();
    return null;
  }
  const el = render({ title, text, iconName, tone }, false);
  const h = ensureHost();
  h.appendChild(el);
  // Sur petit écran, deux notifications à la fois suffisent
  const max = narrow() ? 2 : 3;
  while (h.children.length > max) h.firstElementChild.remove();
  setTimeout(() => dismiss(el), duration);
  return el;
}

export { esc };
