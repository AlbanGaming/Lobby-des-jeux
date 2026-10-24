// Serveur statique local qui imite GitHub Pages pour un site de projet :
// le dépôt est servi sous /Lobby-des-jeux/, les dossiers redirigent vers « dossier/ »,
// et toute adresse inconnue renvoie 404.html avec le statut 404.
//   node tests/serve.mjs            → http://localhost:4173/Lobby-des-jeux/

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BASE = '/Lobby-des-jeux/';
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// Fichiers d'outillage jamais publiés sur le site
const PRIVATE = /^(node_modules|tests|test-results|playwright-report|\.git)(\/|$)/;

async function send404(res) {
  const body = await readFile(join(ROOT, '404.html')).catch(() => 'Not found');
  res.writeHead(404, { 'content-type': TYPES['.html'] });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path === '/Lobby-des-jeux') {
      res.writeHead(301, { location: BASE });
      return res.end();
    }
    if (!path.startsWith(BASE)) return send404(res);
    const rel = path.slice(BASE.length);
    if (PRIVATE.test(rel)) return send404(res);
    let file = normalize(join(ROOT, rel));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) return send404(res);

    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      if (!path.endsWith('/')) {
        res.writeHead(301, { location: path + '/' + url.search });
        return res.end();
      }
      file = join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) return send404(res);

    let body = await readFile(file);
    const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const headers = { 'content-type': type, 'cache-control': 'no-cache' };
    // Compression gzip comme GitHub Pages, pour des mesures de performance réalistes
    if (/text|javascript|json|svg/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      body = gzipSync(body);
      headers['content-encoding'] = 'gzip';
      headers.vary = 'Accept-Encoding';
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(err));
  }
});

server.listen(PORT, () => {
  console.log(`GameVerse servi sur http://localhost:${PORT}${BASE}`);
});
