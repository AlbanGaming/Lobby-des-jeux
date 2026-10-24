// Notifications non bloquantes (succès, niveau, défi du jour) annoncées aux lecteurs d'écran.

import { icon } from './icons.js';

let host = null;

const canPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

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
  if (canPopover) {
    // Ré-ouvrir le popover le remet tout en haut de la pile, devant une modale ouverte entre-temps
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
  }
  return host;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function toast({ title, text = '', iconName = 'trophy', duration = 3600, tone } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <span class="toast__icon" ${tone ? `style="background:${tone}"` : ''}>${icon(iconName)}</span>
    <span><span class="toast__title">${esc(title)}</span>${text ? `<span class="toast__text">${esc(text)}</span>` : ''}</span>`;
  el.querySelector('.toast__text')?.style.setProperty('display', 'block');
  const h = ensureHost();
  h.appendChild(el);
  while (h.children.length > 3) h.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
  }, duration);
  return el;
}

export { esc };
