// Audit Lighthouse d'une page du site servi en local (npm run serve doit tourner).
//   node tests/tools/lighthouse.mjs [chemin|.] [mobile|desktop]     (« . » = le lobby)
// Chromium est lancé par Playwright avec un port de débogage, puis Lighthouse s'y connecte.

import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = process.argv[2] ?? '.';
const path = arg === '.' ? '' : arg;
const formFactor = process.argv[3] ?? 'mobile';
const url = `http://localhost:4173/Lobby-des-jeux/${path}`;
const port = 9300 + Math.floor(Math.random() * 500);

const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
try {
  const desktop = formFactor === 'desktop';
  const { lhr } = await lighthouse(
    url,
    { port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] },
    {
      extends: 'lighthouse:default',
      settings: desktop
        ? { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } }
        : { formFactor: 'mobile' },
    },
  );
  const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
  console.log(`${url} [${formFactor}]`, scores);
  const failing = Object.values(lhr.audits)
    .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable')
    .map((a) => `  - ${a.id}: ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`);
  if (failing.length) console.log('À améliorer :\n' + failing.join('\n'));
  mkdirSync('test-results', { recursive: true });
  writeFileSync(`test-results/lighthouse-${formFactor}.json`, JSON.stringify(lhr));
} finally {
  await browser.close();
}
