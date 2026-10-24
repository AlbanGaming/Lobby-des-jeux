// Paint Empire — carte de la ville (SVG). Quatre quartiers, des bâtiments en façade, des bulles
// de commande au-dessus des clients. Les quartiers verrouillés restent sous les nuages.

import { DISTRICTS, CLIENTS, ATELIERS, WAREHOUSE } from './economy.js';

const INK = '#2a1a14';
const W = 1200;
const H = 920;

// Zones des quartiers
const ZONES = {
  arts: { x: 30, y: 30, w: 540, h: 400, fill: '#e6d4ee', street: '#d6c2e2' },
  colline: { x: 630, y: 30, w: 540, h: 400, fill: '#cfe3c8', street: '#bcd4b4' },
  lilas: { x: 30, y: 490, w: 540, h: 400, fill: '#dfeccb', street: '#cddcb6' },
  centre: { x: 630, y: 490, w: 540, h: 400, fill: '#ece0cb', street: '#ddcfb5' },
};

// Emplacements : x, y = milieu du pied de la façade
export const SPOTS = {
  garage: { x: 110, y: 840, type: 'garage' },
  roux: { x: 245, y: 840, type: 'house' },
  bernard: { x: 370, y: 840, type: 'house' },
  fournil: { x: 495, y: 840, type: 'shop' },
  nova: { x: 1010, y: 660, type: 'office' },
  entrepot: { x: 740, y: 660, type: 'warehouse' },
  arcades: { x: 690, y: 840, type: 'shop' },
  lys: { x: 870, y: 840, type: 'hotel' },
  atelier: { x: 1070, y: 840, type: 'atelier' },
  loft: { x: 310, y: 200, type: 'loft' },
  blanche: { x: 105, y: 380, type: 'gallery' },
  port: { x: 265, y: 380, type: 'gallery' },
  musee: { x: 440, y: 380, type: 'museum' },
  manufacture: { x: 1010, y: 205, type: 'manufacture' },
  vega: { x: 720, y: 380, type: 'villa' },
  solal: { x: 925, y: 380, type: 'foundation' },
  aurore: { x: 1075, y: 380, type: 'gallery' },
};

const stroke = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
const win = (x, y, w = 14, h = 16, lit = false) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${lit ? '#ffe9a8' : '#a9d3e8'}" ${stroke}/>`;

// Façades, dessinées autour de (0, 0) = milieu du pied. Renvoient { svg, h } (hauteur).
const DRAW = {
  garage: () => ({
    h: 96,
    svg: `<path d="M-52 0V-58L0 -92 52 -58V0Z" fill="#e8d5b5" ${stroke}/><path d="M-60 -54L0 -98 60 -54" fill="none" stroke="#b84a3a" stroke-width="10" stroke-linecap="round"/>
      <rect x="-34" y="-50" width="68" height="50" fill="#9aa5b1" ${stroke}/><path d="M-34 -38h68M-34 -26h68M-34 -14h68" stroke="${INK}" stroke-width="2"/>
      <rect x="-14" y="-82" width="28" height="18" rx="3" fill="#ffc93c" ${stroke}/><path d="M-6 -75l4 4 8-8" stroke="${INK}" stroke-width="2.5" fill="none"/>`,
  }),
  house: (c) => ({
    h: 104,
    svg: `<rect x="22" y="-104" width="12" height="26" fill="#a0522d" ${stroke}/><path d="M-50 0V-60L0 -100 50 -60V0Z" fill="${c}" ${stroke}/><path d="M-58 -56L0 -104 58 -56" fill="none" stroke="#8e3b2f" stroke-width="10" stroke-linecap="round"/>
      ${win(-36, -50)}${win(22, -50)}<rect x="-11" y="-36" width="22" height="36" rx="3" fill="#7a4a2e" ${stroke}/><circle cx="6" cy="-17" r="2" fill="${INK}"/>${win(-7, -82, 14, 14)}`,
  }),
  shop: (c) => ({
    h: 100,
    svg: `<rect x="-55" y="-92" width="110" height="92" fill="#f4efe4" ${stroke}/><rect x="-58" y="-100" width="116" height="14" fill="${INK}"/>
      <path d="M-58 -86h116l-6 18h-104z" fill="${c}" ${stroke}/><path d="M-40 -86l-4 18M-20 -86l-2 18M0 -86v18M20 -86l2 18M40 -86l4 18" stroke="#fff" stroke-width="5" opacity=".75"/>
      <rect x="-46" y="-58" width="54" height="42" fill="#a9d3e8" ${stroke}/><rect x="16" y="-56" width="28" height="56" rx="2" fill="#7a4a2e" ${stroke}/>`,
  }),
  office: (c) => ({
    h: 150,
    svg: `<rect x="-46" y="-150" width="92" height="150" fill="${c}" ${stroke}/>${[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2, 3].map((k) => win(-38 + k * 20, -140 + r * 22, 13, 15, (r + k) % 3 === 0)).join('')).join('')}
      <rect x="-14" y="-18" width="28" height="18" fill="#2b3350" ${stroke}/>`,
  }),
  hotel: (c) => ({
    h: 170,
    svg: `<path d="M48 -170v-26" stroke="${INK}" stroke-width="3"/><path d="M48 -196l24 7-24 7z" fill="#ff5a4e" ${stroke}/>
      <rect x="-74" y="-170" width="148" height="170" fill="${c}" ${stroke}/>${[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((k) => win(-62 + k * 26, -158 + r * 28, 16, 18, (r * 2 + k) % 4 === 1)).join('')).join('')}
      <path d="M-74 -18h148" stroke="${INK}" stroke-width="3"/><rect x="-20" y="-24" width="40" height="24" fill="#7a4a2e" ${stroke}/><rect x="-30" y="-36" width="60" height="10" fill="#ff5a4e" ${stroke}/>`,
  }),
  museum: (c) => ({
    h: 130,
    svg: `<path d="M-82 -96L0 -130 82 -96Z" fill="${c}" ${stroke}/><rect x="-80" y="-96" width="160" height="12" fill="${c}" ${stroke}/>
      ${[-62, -34, -6, 22, 50].map((x) => `<rect x="${x}" y="-84" width="12" height="70" fill="#fff8ec" ${stroke}/>`).join('')}
      <rect x="-86" y="-14" width="172" height="14" fill="#d9cfbd" ${stroke}/><circle cx="0" cy="-110" r="7" fill="#ffc93c" ${stroke}/>`,
  }),
  gallery: (c) => ({
    h: 112,
    svg: `<rect x="-60" y="-112" width="120" height="112" fill="${c}" ${stroke}/><rect x="-48" y="-96" width="96" height="62" fill="#1b1626" ${stroke}/>
      <rect x="-30" y="-86" width="34" height="26" fill="#ff8a5b" stroke="#ffc93c" stroke-width="3"/><rect x="12" y="-82" width="26" height="34" fill="#4cc3ff" stroke="#ffc93c" stroke-width="3"/>
      <rect x="-60" y="-26" width="120" height="8" fill="${INK}"/><rect x="-10" y="-18" width="20" height="18" fill="#7a4a2e" ${stroke}/>`,
  }),
  villa: (c) => ({
    h: 96,
    svg: `<path d="M64 0c0-40 6-70 14-90" stroke="#7a4a2e" stroke-width="6" fill="none"/><path d="M78 -90c-18-6-34 0-40 10M78 -90c-4-18-16-26-30-24M78 -90c14-12 30-12 38-2M78 -90c18 2 26 14 26 24" stroke="#3d8a4b" stroke-width="8" fill="none" stroke-linecap="round"/>
      <rect x="-86" y="-70" width="150" height="70" fill="${c}" ${stroke}/><rect x="-96" y="-82" width="170" height="14" rx="4" fill="#fff8ec" ${stroke}/>
      ${win(-74, -56, 30, 26)}${win(-34, -56, 30, 26, true)}${win(6, -56, 30, 26)}<rect x="-100" y="-8" width="66" height="8" fill="#4cc3ff" ${stroke}/>`,
  }),
  foundation: (c) => ({
    h: 140,
    svg: `<path d="M-60 -110a60 30 0 0 1 120 0z" fill="${c}" ${stroke}/><rect x="-66" y="-112" width="132" height="112" fill="#f4efe4" ${stroke}/>
      ${[-50, -22, 6, 34].map((x) => `<path d="M${x} -20v-62a8 8 0 0 1 16 0v62z" fill="#a9d3e8" ${stroke}/>`).join('')}<rect x="-66" y="-14" width="132" height="14" fill="${c}" ${stroke}/>`,
  }),
  warehouse: () => ({
    h: 100,
    svg: `<path d="M-80 0V-70q80-50 160 0V0Z" fill="#b5653c" ${stroke}/><rect x="-36" y="-56" width="72" height="56" fill="#8e8270" ${stroke}/><path d="M-36 -42h72M-36 -28h72M-36 -14h72" stroke="${INK}" stroke-width="2"/>
      <rect x="44" y="-22" width="24" height="22" fill="#d9954a" ${stroke}/><path d="M44 -22l24 22M68 -22l-24 22" stroke="${INK}" stroke-width="2"/>`,
  }),
  atelier: () => ({
    h: 124,
    svg: `<rect x="-62" y="-96" width="124" height="96" fill="#c0634a" ${stroke}/><path d="M-66 -96L-20 -124H66V-96Z" fill="#a9d3e8" ${stroke}/><path d="M-40 -110l60 0M-10 -124l-20 28M20 -124l-20 28M50 -124l-20 28" stroke="${INK}" stroke-width="2"/>
      ${win(-50, -80, 24, 30, true)}${win(-14, -80, 24, 30)}${win(22, -80, 24, 30, true)}<rect x="-14" y="-36" width="28" height="36" fill="#7a4a2e" ${stroke}/>`,
  }),
  loft: () => ({
    h: 140,
    svg: `<rect x="-58" y="-140" width="116" height="140" fill="#9c7bb5" ${stroke}/>${[-118, -74].map((y) => [-44, -6, 32].map((x) => `<path d="M${x} ${y + 34}v-26a12 12 0 0 1 24 0v26z" fill="#ffe9a8" ${stroke}/>`).join('')).join('')}
      <rect x="-14" y="-32" width="28" height="32" fill="#2b3350" ${stroke}/>`,
  }),
  manufacture: () => ({
    h: 150,
    svg: `<rect x="56" y="-150" width="22" height="100" fill="#8e3b2f" ${stroke}/><g class="pe-smoke"><circle cx="67" cy="-164" r="10" fill="#d9d4cc"/><circle cx="80" cy="-180" r="13" fill="#e6e1d9"/><circle cx="72" cy="-202" r="9" fill="#efebe5"/></g>
      <path d="M-90 0V-70L-60 -96V-70L-30 -96V-70L0 -96V-70L30 -96V-70L60 -96V0Z" fill="#c9bfa8" ${stroke}/>${[-80, -50, -20, 10, 40].map((x) => win(x, -56, 20, 24, x % 20 === 0)).join('')}`,
  }),
  plot: () => ({
    h: 70,
    svg: `<rect x="-60" y="-14" width="120" height="14" rx="4" fill="#cdbf9f" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5"/><path d="M-6 -14v-46" stroke="#7a4a2e" stroke-width="5"/>
      <rect x="-40" y="-70" width="68" height="30" rx="4" fill="#fff8ec" ${stroke}/><text x="-6" y="-50" text-anchor="middle" class="pe-map-sign">À VENDRE</text>`,
  }),
};

function tree(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-4" y="-22" width="8" height="22" fill="#7a4a2e"/><circle cx="0" cy="-34" r="18" fill="#5aa469" stroke="${INK}" stroke-width="2.5"/><circle cx="-8" cy="-40" r="6" fill="#7ac88a"/></g>`;
}

// Largeur de la zone de clic de chaque façade (toute la silhouette et son étiquette)
const hitW = (type) => ({ hotel: 170, villa: 210, museum: 180, warehouse: 170, manufacture: 190, foundation: 150 })[type] ?? 130;

const label = (name, w = 120) => `<g class="pe-map-label"><rect x="${-w / 2}" y="10" width="${w}" height="22" rx="11" fill="#fff8ec" stroke="${INK}" stroke-width="2"/><text x="0" y="25" text-anchor="middle">${name}</text></g>`;

/** Nom affiché et type de dessin de chaque emplacement. */
export function spotInfo(id) {
  const client = CLIENTS.find((c) => c.id === id);
  if (client) return { name: client.name, kind: 'client', client };
  const at = ATELIERS.find((b) => b.id === id);
  if (at) return { name: at.name, kind: 'atelier', building: at };
  if (id === WAREHOUSE.id) return { name: WAREHOUSE.name, kind: 'warehouse', building: WAREHOUSE };
  return { name: id, kind: 'other' };
}

/**
 * Carte complète. `owned(id)` dit si un bâtiment du joueur est construit (sinon : terrain à vendre).
 * `open(districtId)` dit si le quartier est débloqué.
 */
export function renderCity({ owned, open }) {
  const zones = Object.entries(ZONES)
    .map(([id, z]) => {
      const d = DISTRICTS.find((x) => x.id === id);
      return `<g class="pe-zone" data-zone="${id}">
        <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="22" fill="${z.fill}" stroke="${INK}" stroke-width="3"/>
        <rect x="${z.x + 14}" y="${z.y + z.h - 52}" width="${z.w - 28}" height="30" rx="8" fill="${z.street}"/>
        <text x="${z.x + 22}" y="${z.y + 34}" class="pe-map-district">${d.name}</text>
      </g>`;
    })
    .join('');

  const decor = [
    tree(70, 640, 0.9), tree(180, 600, 0.75), tree(420, 590, 0.8), tree(520, 680, 0.85), tree(130, 720, 0.6),
    tree(660, 250, 0.85), tree(1145, 250, 0.8), tree(800, 150, 0.7), tree(700, 120, 0.75),
    tree(80, 200, 0.75), tree(520, 160, 0.8), tree(460, 250, 0.65), tree(1150, 760, 0.7), tree(880, 600, 0.6),
  ].join('');
  const hills = `<path d="M640 200q90-120 200-60t180-40 140 60v60H640z" fill="#b6d4a8" opacity=".7"/><path d="M640 100q60-40 120-10" stroke="#9cc28d" stroke-width="10" fill="none" stroke-linecap="round"/>`;
  const sea = `<path d="M30 140q40-12 80 0t80 0" stroke="#4cc3ff" stroke-width="6" fill="none" opacity=".5"/><path d="M60 110q40-12 80 0" stroke="#4cc3ff" stroke-width="5" fill="none" opacity=".4"/>`;
  const fountain = `<g transform="translate(470 640)"><ellipse rx="34" ry="12" fill="#a9d3e8" stroke="${INK}" stroke-width="2.5"/><rect x="-5" y="-26" width="10" height="24" fill="#f4efe4" stroke="${INK}" stroke-width="2"/><path class="pe-water" d="M0 -26q-14 6-18 20M0 -26q14 6 18 20" stroke="#4cc3ff" stroke-width="3" fill="none"/></g>`;
  const roads = `<rect x="0" y="442" width="${W}" height="36" fill="#cbbfa6"/><path d="M0 460H${W}" stroke="#f4efe4" stroke-width="3" stroke-dasharray="16 14"/>
    <rect x="582" y="0" width="36" height="${H}" fill="#cbbfa6"/><path d="M600 0V${H}" stroke="#f4efe4" stroke-width="3" stroke-dasharray="16 14"/>
    <circle cx="600" cy="460" r="32" fill="#bfb398" stroke="${INK}" stroke-width="2.5"/><circle cx="600" cy="460" r="14" fill="#5aa469"/>`;
  // Fanions du festival, tendus au-dessus de l'avenue
  const flags = Array.from({ length: 24 }, (_, i) => `<path d="M${25 + i * 50} 446l12 18 12-18z" fill="${['#ff5a4e', '#ffc93c', '#4cc3ff', '#3ee6a8'][i % 4]}" stroke="${INK}" stroke-width="1.5"/>`).join('');
  const bunting = `<g class="pe-festival"><path d="M0 446H${W}" stroke="${INK}" stroke-width="2"/>${flags}</g>`;

  // Les bulles vont sur un calque à part, au-dessus des bâtiments : le bâtiment ne bouge pas sous le doigt
  const bubbles = [];
  const buildings = Object.entries(SPOTS)
    .sort((a, b) => a[1].y - b[1].y)
    .map(([id, sp]) => {
      const info = spotInfo(id);
      const isPlayer = info.kind === 'atelier' || info.kind === 'warehouse';
      const built = !isPlayer || id === 'garage' || owned(id);
      const draw = DRAW[built ? sp.type : 'plot'](info.client?.color ?? '#f4efe4');
      const district = info.client?.district ?? info.building?.district;
      const locked = !open(district);
      const name = built ? info.name : `${info.name} · à vendre`;
      return `<g class="pe-b ${locked ? 'is-locked' : ''} ${isPlayer ? 'is-mine' : ''}" data-b="${id}" transform="translate(${sp.x} ${sp.y})" ${locked ? 'aria-hidden="true"' : `tabindex="0" role="button" aria-label="${name}"`}>
        <ellipse cx="0" cy="2" rx="${sp.type === 'hotel' || sp.type === 'villa' || sp.type === 'museum' ? 90 : 64}" ry="9" fill="${INK}" opacity=".18"/>
        <rect class="pe-hit" x="${-hitW(sp.type) / 2}" y="${-draw.h - 8}" width="${hitW(sp.type)}" height="${draw.h + 44}" fill="#000" fill-opacity="0"/>
        <g class="pe-b__art">${draw.svg}</g>
        ${label(built ? info.name : 'Terrain', built && info.name.length > 15 ? 150 : 120)}
      </g>${(bubbles.push(locked ? '' : `<g class="pe-bubble" data-bubble="${id}" data-b="${id}" transform="translate(${sp.x} ${sp.y - draw.h - 34})"></g>`), '')}`;
    })
    .join('');

  const fog = Object.entries(ZONES)
    .map(([id, z]) => {
      const d = DISTRICTS.find((x) => x.id === id);
      if (open(id)) return '';
      const cx = z.x + z.w / 2;
      const cy = z.y + z.h / 2;
      return `<g class="pe-fog" data-fog="${id}">
        <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="22" fill="url(#pe-hatch)"/>
        ${[-170, -60, 60, 170].map((dx, i) => `<ellipse cx="${cx + dx}" cy="${cy + (i % 2 ? 40 : -30)}" rx="110" ry="52" fill="#f4efe4" opacity=".92"/>`).join('')}
        <g transform="translate(${cx} ${cy})"><rect x="-150" y="-34" width="300" height="68" rx="16" fill="${INK}"/>
        <text y="-6" text-anchor="middle" class="pe-fog__title">${d.name}</text><text y="20" text-anchor="middle" class="pe-fog__sub">Réputation ${d.rep} requise</text></g>
      </g>`;
    })
    .join('');

  return `<svg class="pe-city" viewBox="0 0 ${W} ${H}" role="group" aria-label="Carte de la ville">
    <defs><pattern id="pe-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#e9dfcb"/><path d="M0 0v14" stroke="#d6c9ae" stroke-width="6"/></pattern></defs>
    <rect width="${W}" height="${H}" rx="26" fill="#efe3c8"/>
    ${roads}${zones}${hills}${sea}${fountain}${decor}${bunting}${buildings}<g class="pe-bubbles">${bubbles.join('')}</g>${fog}
  </svg>`;
}

/** Contenu d'une bulle : offre (!), commande en cours (anneau de progression), fidèle, fâché, contrat. */
export function bubbleSvg(b) {
  if (!b) return '';
  const ring = (k, color) => {
    const r = 21;
    const c = 2 * Math.PI * r;
    return `<circle r="${r}" fill="none" stroke="${INK}" stroke-width="7" opacity=".25"/><circle class="pe-ring" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-dasharray="${(k * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90)" stroke-linecap="round"/>`;
  };
  const icons = {
    offer: `<text y="9" text-anchor="middle" class="pe-bubble__mark">!</text>`,
    active: `<path d="M-9 8l12-16 6 6-12 16z" fill="#ff8a5b" stroke="${INK}" stroke-width="2"/><path d="M3 -8l4-5 6 6-4 5" fill="#c9d1e0" stroke="${INK}" stroke-width="2"/>`,
    contract: `<path d="M-10 -12h20v24h-20z" fill="#fff8ec" stroke="${INK}" stroke-width="2"/><path d="M-5 -5h10M-5 0h10M-5 5h6" stroke="${INK}" stroke-width="2"/>`,
    proposal: `<path d="M0 -12l3.5 7 7.5 1-5.5 5.3 1.3 7.7L0 5.3-6.8 9l1.3-7.7L-11 -4l7.5-1z" fill="#ffc93c" stroke="${INK}" stroke-width="2"/>`,
    angry: `<path d="M-12 4a8 8 0 0 1 4-14 9 9 0 0 1 16 2 7 7 0 0 1 2 12z" fill="#8d93b3" stroke="${INK}" stroke-width="2"/><path d="M-4 -2l3 2M5 -2l-3 2" stroke="${INK}" stroke-width="2"/>`,
  };
  const fill = { offer: '#ffc93c', active: '#fff8ec', contract: '#fff8ec', proposal: '#fff8ec', angry: '#d9d4cc' }[b.kind];
  return `<g class="pe-bubble__in pe-bubble--${b.kind} ${b.urgent ? 'is-urgent' : ''}">
    <path d="M-8 22l8 12 8-12" fill="${fill}" stroke="${INK}" stroke-width="2.5"/>
    <circle r="26" fill="${fill}" stroke="${INK}" stroke-width="3"/>
    ${b.progress !== undefined ? ring(b.progress, b.urgent ? '#ff5a4e' : '#3ee6a8') : ''}
    ${icons[b.kind] ?? ''}
    ${b.loyal ? `<g transform="translate(22 -20)"><circle r="10" fill="#ffc93c" stroke="${INK}" stroke-width="2"/><path d="M0 -6l1.8 3.7 4 .6-2.9 2.8.7 4L0 3.2-3.6 5.1l.7-4-2.9-2.8 4-.6z" fill="${INK}"/></g>` : ''}
    ${b.count ? `<g transform="translate(-22 -20)"><circle r="11" fill="${INK}"/><text y="5" text-anchor="middle" class="pe-bubble__count">${b.count}</text></g>` : ''}
  </g>`;
}
