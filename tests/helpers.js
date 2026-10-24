// Outils communs aux tests Playwright.
import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Collecte erreurs console, exceptions et requêtes en échec pendant un test.
export function watchPage(page, { allow404 = [] } = {}) {
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const where = msg.location()?.url ?? '';
    if (/Failed to load resource/.test(msg.text()) && allow404.some((a) => where.includes(a))) return;
    problems.push(`console: ${msg.text()} ${where}`);
  });
  page.on('pageerror', (err) => problems.push(`exception: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`requête échouée: ${req.url()} (${req.failure()?.errorText})`));
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 400 && !allow404.some((a) => url.includes(a))) problems.push(`HTTP ${res.status()}: ${url}`);
  });
  return {
    problems,
    expectClean() {
      expect(problems, problems.join('\n')).toEqual([]);
    },
  };
}

export async function shot(page, testInfo, name) {
  const dir = `tests/screenshots/${testInfo.project.name}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

// Lit une clé localStorage JSON de la page
export const readStore = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
