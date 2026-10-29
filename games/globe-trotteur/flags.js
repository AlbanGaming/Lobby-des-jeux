// Globe-trotteur — dessin des drapeaux en SVG à partir d'une petite liste d'instructions (data/countries.json).
// Tous les drapeaux sont dessinés au format 3:2 (300 × 200), simplifiés : pas d'armoiries détaillées.
//   ["h", couleurs, poids?]   bandes horizontales      ["v", couleurs, poids?]  bandes verticales
//   ["rect", x, y, w, h, c]   ["circle", cx, cy, r, c] ["ring", cx, cy, r, épaisseur, c]
//   ["star", cx, cy, r, c, rotation?]                  ["pentagram", cx, cy, r, c, épaisseur]
//   ["poly", "x,y x,y …", c]  ["cross", cx, cy, épaisseur, c] (croix pleine largeur)
//   ["saltire", c, épaisseur] ["crescent", cx, cy, r, rIntérieur, décalage, c]
//   ["uj", x, y, w, h] (drapeau à croix superposées)   ["dots", x0, y0, colonnes, lignes, dx, dy, r, c]
//   ["arcdots", cx, cy, r, n, angleDébut, angleFin, taille, c]  ["serrate", x, dents, profondeur, c]

let uid = 0;

function stripes(colors, weights, horizontal) {
  const w = weights ?? colors.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  let at = 0;
  return colors
    .map((c, i) => {
      const size = (w[i] / total) * (horizontal ? 200 : 300);
      const r = horizontal ? `<rect x="0" y="${at.toFixed(2)}" width="300" height="${(size + 0.5).toFixed(2)}" fill="${c}"/>` : `<rect x="${at.toFixed(2)}" y="0" width="${(size + 0.5).toFixed(2)}" height="200" fill="${c}"/>`;
      at += size;
      return r;
    })
    .join('');
}

export function starPoints(cx, cy, r, rot = -90) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = ((rot + i * 36) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.4 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(' ');
}

function op(o) {
  const [k, ...a] = o;
  switch (k) {
    case 'h':
      return stripes(a[0], a[1], true);
    case 'v':
      return stripes(a[0], a[1], false);
    case 'rect':
      return `<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" fill="${a[4]}"/>`;
    case 'circle':
      return `<circle cx="${a[0]}" cy="${a[1]}" r="${a[2]}" fill="${a[3]}"/>`;
    case 'ring':
      return `<circle cx="${a[0]}" cy="${a[1]}" r="${a[2]}" fill="none" stroke="${a[4]}" stroke-width="${a[3]}"/>`;
    case 'star':
      return `<polygon points="${starPoints(a[0], a[1], a[2], a[4] ?? -90)}" fill="${a[3]}"/>`;
    case 'pentagram': {
      const [cx, cy, r, c, w] = a;
      const p = [0, 2, 4, 1, 3].map((i) => {
        const ang = ((-90 + i * 72) * Math.PI) / 180;
        return `${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r).toFixed(1)}`;
      });
      return `<polygon points="${p.join(' ')}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="miter"/>`;
    }
    case 'poly':
      return `<polygon points="${a[0]}" fill="${a[1]}"/>`;
    case 'cross':
      return `<rect x="${a[0] - a[2] / 2}" y="0" width="${a[2]}" height="200" fill="${a[3]}"/><rect x="0" y="${a[1] - a[2] / 2}" width="300" height="${a[2]}" fill="${a[3]}"/>`;
    case 'saltire':
      return `<path d="M0 0L300 200M300 0L0 200" stroke="${a[0]}" stroke-width="${a[1]}"/>`;
    case 'crescent': {
      const [cx, cy, r, ri, dx, c] = a;
      const id = `gtc${++uid}`;
      return `<mask id="${id}"><rect width="300" height="200" fill="#fff"/><circle cx="${cx + dx}" cy="${cy}" r="${ri}" fill="#000"/></mask><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" mask="url(#${id})"/>`;
    }
    case 'uj': {
      const [x, y, w, h] = a;
      return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 60 30" preserveAspectRatio="none"><rect width="60" height="30" fill="#012169"/><path d="M0 0L60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0L60 30M60 0L0 30" stroke="#c8102e" stroke-width="2"/><path d="M30 0V30M0 15H60" stroke="#fff" stroke-width="10"/><path d="M30 0V30M0 15H60" stroke="#c8102e" stroke-width="6"/></svg>`;
    }
    case 'dots': {
      const [x0, y0, cols, rows, dx, dy, r, c] = a;
      let s = '';
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) s += `<circle cx="${x0 + i * dx + (j % 2 ? dx / 2 : 0)}" cy="${y0 + j * dy}" r="${r}"/>`;
      return `<g fill="${c}">${s}</g>`;
    }
    case 'arcdots': {
      const [cx, cy, r, n, a0, a1, size, c] = a;
      let s = '';
      for (let i = 0; i < n; i++) {
        const ang = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180;
        s += `<polygon points="${starPoints(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, size)}"/>`;
      }
      return `<g fill="${c}">${s}</g>`;
    }
    case 'serrate': {
      const [x, n, depth, c] = a;
      const t = 200 / n;
      let d = `M0 0H${x}`;
      for (let i = 0; i < n; i++) d += `L${x + depth} ${(i + 0.5) * t}L${x} ${(i + 1) * t}`;
      return `<path d="${d}H0Z" fill="${c}"/>`;
    }
    default:
      return '';
  }
}

/** SVG d'un drapeau ; `label` le rend accessible (sinon décoratif). */
export function flagSVG(ops, { label = '', className = 'gt-flag' } = {}) {
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg class="${className}" viewBox="0 0 300 200" preserveAspectRatio="none" ${a11y}>${ops.map(op).join('')}</svg>`;
}

/** Deux drapeaux trop proches pour un choix équitable */
export const sameFlag = (a, b) => JSON.stringify(a) === JSON.stringify(b);
