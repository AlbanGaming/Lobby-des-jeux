// Turbo circuit — les circuits (points de contrôle d'une boucle lissée), les pilotes IA et les
// coupes. buildTrack échantillonne la boucle tous les 20 unités : position, direction, normale,
// courbure et trajectoire idéale (côté intérieur des virages), utilisées par le rendu et l'IA.

export const THEMES = {
  vert: { grass: '#2f8a4a', grass2: '#287a40', road: '#3b3f4c', deco: '#1f6b36', deco2: '#3ee6a8' },
  desert: { grass: '#d9a55a', grass2: '#c99448', road: '#5a4a3e', deco: '#7a9a4a', deco2: '#ffc93c' },
  nuit: { grass: '#14162a', grass2: '#1b1e38', road: '#2a2d3e', deco: '#4cc3ff', deco2: '#ff5fa2', lights: true },
  neige: { grass: '#e8eef5', grass2: '#d6e0ec', road: '#4a5266', deco: '#2f6b4a', deco2: '#ffffff' },
  volcan: { grass: '#2a1310', grass2: '#3a1a14', road: '#3b3436', deco: '#ff6a2b', deco2: '#ffc93c' },
};

export const CIRCUITS = [
  { id: 'port', name: 'Anneau du port', theme: 'vert', pts: [[0, 0], [900, -60], [1500, 100], [1700, 600], [1400, 1050], [700, 1100], [100, 950], [-200, 500]] },
  { id: 'foret', name: 'Forêt rapide', theme: 'vert', pts: [[0, 0], [1200, -200], [2200, 200], [2400, 900], [1800, 1500], [900, 1300], [300, 1700], [-500, 1300], [-600, 500]] },
  { id: 'epingles', name: 'Les épingles', theme: 'desert', pts: [[0, 0], [800, 0], [1100, 300], [800, 520], [300, 560], [200, 820], [700, 960], [1300, 900], [1600, 1200], [1200, 1500], [200, 1450], [-300, 900], [-300, 300]] },
  { id: 'nuit', name: 'Ville la nuit', theme: 'nuit', pts: [[0, 0], [1000, 0], [1150, 120], [1600, 120], [1700, 700], [1300, 820], [1300, 1200], [400, 1300], [-100, 900], [-100, 300]] },
  { id: 'neige', name: 'Col enneigé', theme: 'neige', pts: [[0, 0], [700, -300], [1400, -100], [1600, 500], [1200, 900], [1500, 1400], [900, 1700], [300, 1300], [-300, 1500], [-600, 800], [-300, 300]] },
  { id: 'volcan', name: 'Volcan', theme: 'volcan', pts: [[0, 0], [600, -400], [1300, -300], [1500, 300], [1000, 620], [1500, 1000], [1200, 1500], [500, 1300], [0, 1600], [-600, 1100], [-400, 500]] },
  { id: 'dunes', name: 'Grand désert', theme: 'desert', pts: [[0, 0], [1600, 0], [2200, 500], [1800, 1100], [2300, 1700], [1500, 2100], [600, 1700], [100, 2100], [-500, 1500], [-300, 700]] },
  { id: 'gp', name: 'Grand Prix', theme: 'nuit', pts: [[0, 0], [1400, 0], [1700, 250], [1500, 600], [900, 650], [800, 1000], [1500, 1200], [1900, 1700], [1200, 2000], [300, 1800], [-300, 1300], [-200, 500]] },
];

// Pilotes IA : vitesse de pointe, adresse dans les virages, caractère
export const PILOTS = [
  { id: 'nitro', name: 'Nitro', color: '#ff3b5c', top: 1.03, grip: 0.95, brakeLate: 1.12, turbo: 'tôt', line: 1, says: { pass: 'Nitro : Hé ! Personne ne me double !', lose: 'Nitro : Trop d’essence, pas assez de cerveau…' } },
  { id: 'prudence', name: 'Prudence', color: '#3ee6a8', top: 0.95, grip: 1.0, brakeLate: 0.92, turbo: 'ligne droite', line: 0.8, says: { pass: 'Prudence : Belle manœuvre. Je reste concentrée.', lose: 'Prudence : Bien joué, vraiment.' } },
  { id: 'zigzag', name: 'Zigzag', color: '#ffc93c', top: 0.98, grip: 0.9, brakeLate: 1.0, turbo: 'hasard', line: 0.5, wild: true, says: { pass: 'Zigzag : Oups, c’était ma trajectoire ça !', lose: 'Zigzag : J’ai vu un papillon…' } },
  { id: 'bloqueur', name: 'Bloqueur', color: '#a68bff', top: 0.96, grip: 0.95, brakeLate: 1.0, turbo: 'ligne droite', line: 0.7, blocks: true, says: { pass: 'Bloqueur : Tu ne passeras pas deux fois.', lose: 'Bloqueur : Hmpf.' } },
  { id: 'chrono', name: 'Chrono', color: '#4cc3ff', top: 1.03, grip: 1.04, brakeLate: 1.05, turbo: 'ligne droite', line: 1, champion: true, says: { pass: 'Chrono : Intéressant. Voyons si tu tiens le rythme.', lose: 'Chrono : Tu as battu le champion. Respect.' } },
];

export const LEVELS = {
  facile: { name: 'Facile', top: 0.84, grip: 0.82, rubber: 0.04, mult: 1 },
  normal: { name: 'Normal', top: 0.93, grip: 0.93, rubber: 0.015, mult: 1.5 },
  expert: { name: 'Expert', top: 1.0, grip: 1.0, rubber: 0, mult: 2 },
};

export const CUPS = [
  { id: 'bronze', name: 'Coupe de bronze', level: 'facile', circuits: ['port', 'foret', 'epingles', 'nuit'], prize: 200, color: '#c98f5a' },
  { id: 'argent', name: 'Coupe d’argent', level: 'normal', circuits: ['nuit', 'neige', 'volcan', 'dunes'], prize: 350, color: '#c9d2e3' },
  { id: 'or', name: 'Coupe d’or', level: 'expert', circuits: ['epingles', 'volcan', 'dunes', 'gp'], prize: 600, color: '#ffc93c' },
];

export const UPGRADES = {
  moteur: { name: 'Moteur', desc: '+4 % de vitesse de pointe', costs: [120, 220, 360] },
  pneus: { name: 'Pneus', desc: 'Meilleure tenue en virage', costs: [100, 200, 320] },
  turbo: { name: 'Turbo', desc: 'Le turbo se charge plus vite et dure plus', costs: [100, 180, 300] },
};

const SPACING = 20;
export const ROAD = 150; // largeur de la route

export function buildTrack(circuit) {
  // Les points sont donnés à l'échelle 2/3 : on agrandit (tours plus longs, virages plus doux)
  const P = circuit.pts.map(([x, y]) => [x * 1.5, y * 1.5]);
  const n = P.length;
  // Catmull-Rom fermée, très finement, puis rééchantillonnée à pas constant
  const dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n];
    const p1 = P[i];
    const p2 = P[(i + 1) % n];
    const p3 = P[(i + 2) % n];
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      const t2 = t * t;
      const t3 = t2 * t;
      dense.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  const xs = [];
  const ys = [];
  let carry = 0;
  for (let i = 0; i < dense.length; i++) {
    const a = dense[i];
    const b = dense[(i + 1) % dense.length];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = carry;
    while (d < seg) {
      xs.push(a[0] + ((b[0] - a[0]) * d) / seg);
      ys.push(a[1] + ((b[1] - a[1]) * d) / seg);
      d += SPACING;
    }
    carry = d - seg;
  }
  const N = xs.length;
  const tx = new Float32Array(N);
  const ty = new Float32Array(N);
  const curv = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const h = (i - 1 + N) % N;
    const dx = xs[j] - xs[h];
    const dy = ys[j] - ys[h];
    const l = Math.hypot(dx, dy) || 1;
    tx[i] = dx / l;
    ty[i] = dy / l;
  }
  for (let i = 0; i < N; i++) {
    const a = Math.atan2(ty[(i + 2) % N], tx[(i + 2) % N]);
    const b = Math.atan2(ty[(i - 2 + N) % N], tx[(i - 2 + N) % N]);
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    curv[i] = d / (4 * SPACING); // courbure signée (1 / rayon)
  }
  // Trajectoire idéale : on se décale vers l'intérieur des virages (lissé)
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let c = 0;
    for (let k = -6; k <= 6; k++) c += curv[(i + k + N) % N];
    raw[i] = Math.max(-1, Math.min(1, (c / 13) * 900));
  }
  const line = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = -8; k <= 8; k++) s += raw[(i + k + N) % N];
    line[i] = (s / 17) * (ROAD / 2 - 28);
  }
  // Décor : arbres, rochers ou lampadaires, jamais sur la route
  const deco = [];
  let seed = circuit.id.length * 9301;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i += 5) {
    for (const side of [-1, 1]) {
      if (rnd() < 0.45) continue;
      const off = ROAD / 2 + 50 + rnd() * 220;
      const x = xs[i] - ty[i] * off * side;
      const y = ys[i] + tx[i] * off * side;
      let ok = true;
      for (let j = 0; j < N && ok; j += 2) if ((xs[j] - x) ** 2 + (ys[j] - y) ** 2 < (ROAD / 2 + 40) ** 2) ok = false;
      if (ok) deco.push({ x, y, r: 14 + rnd() * 16, k: rnd() });
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < N; i++) {
    minX = Math.min(minX, xs[i]);
    maxX = Math.max(maxX, xs[i]);
    minY = Math.min(minY, ys[i]);
    maxY = Math.max(maxY, ys[i]);
  }
  return { ...circuit, N, xs, ys, tx, ty, curv, line, deco, box: { minX, minY, maxX, maxY }, length: N * SPACING };
}

// Échantillon le plus proche, cherché autour du précédent
export function nearest(T, x, y, from) {
  let best = from;
  let bd = Infinity;
  for (let k = -25; k <= 25; k++) {
    const i = (from + k + T.N) % T.N;
    const d = (T.xs[i] - x) ** 2 + (T.ys[i] - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return { i: best, d: Math.sqrt(bd) };
}
