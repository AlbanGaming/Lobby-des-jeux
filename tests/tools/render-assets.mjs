// Génère les images statiques du site à partir de sources HTML/SVG du dépôt :
//   og.png (1200×630, partage sur les réseaux) et apple-touch-icon.png (180×180).
//   npm run assets

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const browser = await chromium.launch();

const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.goto(pathToFileURL(root + 'tests/tools/og.html').href);
await og.evaluate(() => document.fonts.ready);
await og.screenshot({ path: root + 'og.png' });

const svg = readFileSync(root + 'favicon.svg', 'utf8');
const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
await icon.setContent(`<style>html,body{margin:0;background:#11131f}svg{width:180px;height:180px;display:block}</style>${svg}`);
await icon.screenshot({ path: root + 'apple-touch-icon.png' });

await browser.close();
console.log('og.png et apple-touch-icon.png générés.');
