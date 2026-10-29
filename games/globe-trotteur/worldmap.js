// Globe-trotteur — carte en points : les terres (contours simplifiés de data/world.json) sont
// échantillonnées sur une grille, puis dessinées en petits ronds sur un canvas.

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function createWorld(land) {
  const polys = land.map((p) => {
    const xs = p.map((q) => q[0]);
    const ys = p.map((q) => q[1]);
    return { p, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const isLand = (lon, lat) => polys.some((q) => lon >= q.x0 && lon <= q.x1 && lat >= q.y0 && lat <= q.y1 && inside(q.p, lon, lat));
  const cache = new Map();

  // Points de terre d'une zone [lon0, lat0, lon1, lat1], en coordonnées 0..1
  function dots(box, cols = 64) {
    const key = box.join() + cols;
    if (cache.has(key)) return cache.get(key);
    const [lon0, lat0, lon1, lat1] = box;
    const k = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
    const step = (lon1 - lon0) / cols;
    const stepLat = step * k;
    const rows = Math.round((lat1 - lat0) / stepLat);
    const out = [];
    for (let j = 0; j < rows; j++) {
      const lat = lat1 - (j + 0.5) * stepLat;
      for (let i = 0; i < cols; i++) {
        const lon = lon0 + (i + 0.5) * step;
        if (isLand(lon, lat)) out.push([(i + 0.5) / cols, (j + 0.5) / rows]);
      }
    }
    const res = { pts: out, cols, rows, aspect: cols / rows };
    cache.set(key, res);
    return res;
  }

  /** Position 0..1 d'un point dans la zone */
  const project = (box, lon, lat) => [(lon - box[0]) / (box[2] - box[0]), (box[3] - lat) / (box[3] - box[1])];

  function draw(canvas, box, { color = '#4cc3ff', cols = 64 } = {}) {
    const d = dots(box, cols);
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const rad = Math.max(1, (w / d.cols) * 0.36);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const [x, y] of d.pts) {
      ctx.moveTo(x * w + rad, y * h);
      ctx.arc(x * w, y * h, rad, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  return { dots, draw, project, isLand };
}
