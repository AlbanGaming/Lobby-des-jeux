// Le Potager — dessins SVG des cultures selon leur stade (0 graine, 1 pousse, 2 croissance, 3 mûr).

import { CROPS } from './garden.js';

const leaf = (x, y, r, rot, c = '#4c9a3a') => `<ellipse cx="${x}" cy="${y}" rx="${r * 0.45}" ry="${r}" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`;

function fruit(id, k) {
  const c = CROPS[id].color;
  switch (id) {
    case 'radis':
      return `${leaf(44, 30, 10 * k, -20)}${leaf(56, 30, 10 * k, 20)}<circle cx="50" cy="${52 + 4 * k}" r="${12 * k}" fill="${c}"/><path d="M50 ${64 + 6 * k}v${8 * k}" stroke="#f4efe4" stroke-width="2"/>`;
    case 'carotte':
      return `${leaf(44, 28, 12 * k, -20, '#5aa83a')}${leaf(56, 28, 12 * k, 20, '#5aa83a')}${leaf(50, 26, 12 * k, 0, '#6aba48')}<path d="M${50 - 9 * k} 44 L${50 + 9 * k} 44 L50 ${44 + 30 * k}Z" fill="${c}"/>`;
    case 'salade':
      return `<circle cx="50" cy="56" r="${20 * k}" fill="#5fb84a"/><circle cx="50" cy="54" r="${14 * k}" fill="${c}"/><circle cx="50" cy="52" r="${7 * k}" fill="#b8ea8a"/>`;
    case 'tomate':
      return `<path d="M50 70V24" stroke="#8a6a3a" stroke-width="3"/>${leaf(42, 38, 10, -40)}${leaf(58, 46, 10, 40)}<circle cx="44" cy="${50}" r="${9 * k}" fill="${c}"/><circle cx="58" cy="${36}" r="${8 * k}" fill="${c}"/>`;
    case 'courgette':
      return `${leaf(38, 40, 14, -50)}${leaf(62, 40, 14, 50)}<ellipse cx="50" cy="60" rx="${22 * k}" ry="${7 * k}" fill="${c}" transform="rotate(-15 50 60)"/><circle cx="${50 + 18 * k}" cy="${55}" r="${3 * k}" fill="#ffc93c"/>`;
    case 'fraise':
      return `${leaf(40, 44, 10, -50)}${leaf(60, 44, 10, 50)}${leaf(50, 40, 10, 0)}<path d="M${50 - 10 * k} ${54} Q50 ${50 - 4 * k} ${50 + 10 * k} 54 Q${50 + 6 * k} ${66 + 6 * k} 50 ${70 + 4 * k} Q${50 - 6 * k} ${66 + 6 * k} ${50 - 10 * k} 54Z" fill="${c}"/>`;
    case 'mais':
      return `${leaf(42, 44, 18, -15, '#6aba48')}${leaf(58, 44, 18, 15, '#6aba48')}<ellipse cx="50" cy="${44}" rx="${7 * k}" ry="${17 * k}" fill="${c}"/><path d="M${50 - 7 * k} 50 Q50 ${64} ${50 + 7 * k} 50" fill="#8ccf6a"/>`;
    case 'poireau':
      return `<rect x="${50 - 5 * k}" y="${40}" width="${10 * k}" height="${30 * k}" rx="4" fill="#f4efe4"/>${leaf(44, 30, 14 * k, -15, '#3f8a3a')}${leaf(56, 30, 14 * k, 15, '#3f8a3a')}`;
    case 'chou':
      return `<circle cx="50" cy="56" r="${20 * k}" fill="#7fbf7a"/><circle cx="50" cy="54" r="${14 * k}" fill="${c}"/><path d="M50 ${40} V${66}" stroke="#7fbf7a" stroke-width="2"/>`;
    case 'potiron':
      return `${leaf(30, 40, 12, -60)}<ellipse cx="50" cy="60" rx="${24 * k}" ry="${16 * k}" fill="${c}"/><path d="M${50 - 8 * k} 46 Q${50 - 10 * k} 60 ${50 - 8 * k} 74 M${50 + 8 * k} 46 Q${50 + 10 * k} 60 ${50 + 8 * k} 74" stroke="#c96f2a" stroke-width="2" fill="none"/><rect x="47" y="${42 - 4 * k}" width="6" height="8" fill="#6b4a2b"/>`;
    default:
      return '';
  }
}

export function cropSVG(id, stage, { className = 'pg-crop' } = {}) {
  let body = '';
  if (stage === 0) body = `<circle cx="50" cy="66" r="4" fill="#5a3a1a"/>${leaf(46, 58, 5, -30)}${leaf(54, 58, 5, 30)}`;
  else if (stage === 1) body = `${leaf(44, 54, 9, -30)}${leaf(56, 54, 9, 30)}${leaf(50, 50, 9, 0, '#5fb84a')}`;
  else body = fruit(id, stage === 2 ? 0.6 : 1);
  return `<svg class="${className}" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
}

export const eggSVG = `<svg class="pg-crop" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="56" rx="18" ry="24" fill="#fff8ec" stroke="#d9c4a0" stroke-width="3"/></svg>`;
export const henSVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="48" cy="60" rx="26" ry="20" fill="#fff8ec" stroke="#c9b48a" stroke-width="3"/><circle cx="70" cy="40" r="12" fill="#fff8ec" stroke="#c9b48a" stroke-width="3"/><path d="M70 26l4-6 3 6 4-4v8" fill="#e63946"/><path d="M82 40l8 3-8 3z" fill="#ffb02e"/><circle cx="73" cy="38" r="2" fill="#1b1626"/><path d="M40 80v8M54 80v8" stroke="#ffb02e" stroke-width="3"/></svg>`;
