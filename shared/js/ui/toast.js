// Notifications non bloquantes (succès, niveau, défi du jour) annoncées aux lecteurs d'écran.

import { icon } from './icons.js';

let host = null;

function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = document.createElement('div');
  host.className = 'toasts';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);
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
