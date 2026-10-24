// Jeu d'icônes GameVerse : SVG 24×24 au trait épais et arrondi, dessinées pour le site.
// icon('play') renvoie une chaîne SVG ; les icônes sont décoratives sauf si `label` est fourni.

const P = {
  back: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  forward: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  chevronDown: '<path d="M5 9l7 7 7-7"/>',
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  play: '<path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z" fill="currentColor"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1.4" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.4" fill="currentColor" stroke="none"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4 4.5V9h4.5"/>',
  soundOn: '<path d="M4 9.5v5h3.5l4.5 4V5.5l-4.5 4z" fill="currentColor"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18 6.6a7.6 7.6 0 0 1 0 10.8"/>',
  soundOff: '<path d="M4 9.5v5h3.5l4.5 4V5.5l-4.5 4z" fill="currentColor"/><path d="M16 9.5l5 5"/><path d="M21 9.5l-5 5"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  fullscreen: '<path d="M4 9V5a1 1 0 0 1 1-1h4"/><path d="M15 4h4a1 1 0 0 1 1 1v4"/><path d="M20 15v4a1 1 0 0 1-1 1h-4"/><path d="M9 20H5a1 1 0 0 1-1-1v-4"/>',
  fullscreenExit: '<path d="M9 4v4a1 1 0 0 1-1 1H4"/><path d="M20 9h-4a1 1 0 0 1-1-1V4"/><path d="M15 20v-4a1 1 0 0 1 1-1h4"/><path d="M4 15h4a1 1 0 0 1 1 1v4"/>',
  heart: '<path d="M12 19.5s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10z"/>',
  heartFill: '<path d="M12 19.5s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10z" fill="currentColor"/>',
  star: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z"/>',
  starFill: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" fill="currentColor"/>',
  trophy: '<path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5a3 3 0 0 0 3.2 4"/><path d="M16.5 6h3a3 3 0 0 1-3.2 4"/><path d="M12 14v3"/><path d="M8 20h8l-.8-3H8.8z"/>',
  sliders: '<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2"/>',
  user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  search: '<circle cx="11" cy="11" r="6.2"/><path d="M20 20l-4.6-4.6"/>',
  flame: '<path d="M12 21c-3.9 0-6.6-2.6-6.6-6.2 0-3.4 2.5-5.4 3.7-8.3.4 1.9 1.5 3 2.6 3.4.1-2.9 1.3-5.3 3.5-6.9-.2 3 1.4 4.7 2.6 6.5 1 1.5 1.6 3 1.6 5.3 0 3.6-2.7 6.2-7.4 6.2z"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.6l1.3 3.1 3.1 1.3-3.1 1.3-1.3 3.1-1.3-3.1-3.1-1.3 3.1-1.3z" fill="currentColor" stroke-width="1.2"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  share: '<path d="M12 15V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chart: '<path d="M5 20V11"/><path d="M12 20V5"/><path d="M19 20v-6"/>',
  sparkle: '<path d="M12 3.5c.6 4.4 2.4 6.2 6.8 6.8-4.4.6-6.2 2.4-6.8 6.8-.6-4.4-2.4-6.2-6.8-6.8 4.4-.6 6.2-2.4 6.8-6.8z"/><path d="M19 16.5v4"/><path d="M17 18.5h4"/>',
  gamepad: '<path d="M7.5 8h9a4 4 0 0 1 3.9 4.6l-.7 4.1a2.4 2.4 0 0 1-4.2 1.1L14 16h-4l-1.5 1.8a2.4 2.4 0 0 1-4.2-1.1l-.7-4.1A4 4 0 0 1 7.5 8z"/><path d="M8.5 11v3"/><path d="M7 12.5h3"/><path d="M15.5 11.5h.01"/><path d="M17 13.5h.01"/>',
  joystick: '<circle cx="12" cy="6" r="2.6"/><path d="M12 8.6V15"/><path d="M5 17.6c0-1.4 3.1-2.6 7-2.6s7 1.2 7 2.6V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/>',
  blocks: '<rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/><rect x="8.5" y="4" width="7" height="7" rx="1.5"/>',
  letter: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.6 16l3.4-8 3.4 8"/><path d="M9.8 13.2h4.4"/>',
  crown: '<path d="M4 8.5l4 3.5 4-6 4 6 4-3.5-1.6 10H5.6z"/>',
  hourglass: '<path d="M7 4h10"/><path d="M7 20h10"/><path d="M8 4v1.6c0 2.6 4 3.8 4 6.4s-4 3.8-4 6.4V20"/><path d="M16 4v1.6c0 2.6-4 3.8-4 6.4s4 3.8 4 6.4V20"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16"/><path d="M8.5 3.5v4"/><path d="M15.5 3.5v4"/>',
  upload: '<path d="M12 15V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M4.5 15.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3.5"/>',
  download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 15.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3.5"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/><path d="M6.5 7l.9 12a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.9-12"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 8.5h.01"/><path d="M15.5 8.5h.01"/><path d="M12 12h.01"/><path d="M8.5 15.5h.01"/><path d="M15.5 15.5h.01"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17.5l4.5-4.5 3 3 2.5-2.5 4 4"/>',
  medal: '<path d="M8 3.5l2.5 5"/><path d="M16 3.5l-2.5 5"/><circle cx="12" cy="14.5" r="5.5"/><path d="M12 12.2l.8 1.6 1.8.2-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z" fill="currentColor" stroke="none"/>',
  keyboard: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M7 10h.01"/><path d="M11 10h.01"/><path d="M15 10h.01"/><path d="M8 14h8"/>',
  pointer: '<path d="M6 4l12 6.5-5.2 1.4 3.2 6-2.4 1.3-3.2-6L6 17z"/>',
  touch: '<path d="M9.5 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12.5 10a1.5 1.5 0 0 1 3 0v1"/><path d="M15.5 10.5a1.5 1.5 0 0 1 3 0v3.5a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4.1-2.1L5 14.2a1.5 1.5 0 0 1 2.3-1.9L9.5 14"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  wave: '<path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  palette: '<path d="M12 4a8 8 0 0 0 0 16c1.1 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.8 0-1 .8-1.6 1.8-1.6H17a3.5 3.5 0 0 0 3-3.4C20 6.9 16.4 4 12 4z"/><path d="M7.5 12h.01"/><path d="M9.5 8h.01"/><path d="M14 7.5h.01"/>',
};

export const ICON_NAMES = Object.keys(P);

export function icon(name, { label, className = '' } = {}) {
  const body = P[name] ?? P.info;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="icon ${className}" viewBox="0 0 24 24" ${a11y}>${body}</svg>`;
}

// Logo GameVerse : un jeton d'arcade marqué d'un G
export function logoMark({ className = 'gv-logo-mark', title } = {}) {
  const t = title ? `<title>${title}</title>` : '';
  const a11y = title ? 'role="img"' : 'aria-hidden="true"';
  return `<svg class="${className}" viewBox="0 0 64 64" ${a11y}>${t}<circle cx="32" cy="35" r="24" fill="#c98f00"/><circle cx="32" cy="31" r="24" fill="#ffc93c"/><circle cx="32" cy="31" r="18.5" fill="none" stroke="#2a1d00" stroke-opacity=".16" stroke-width="2.5"/><path d="M40.5 22.6A12 12 0 1 0 44 31H33.5" fill="none" stroke="#2a1d00" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
