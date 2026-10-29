// Lettres en vrac : mot valide, déjà trouvé, inconnu, glisser sur la roue, clavier, mot entier et
// tirage suivant, mot bonus, fin du chrono, zen et indice, tirage du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const lt = (page, expr) => page.evaluate(`window.__lt.${expr}`);

async function open(page, q = '?fast=1') {
  await page.goto(`games/lettres/${q}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'chrono') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
}
// Un mot cible du tirage, d'une longueur donnée
const target = (page, len) => page.evaluate((n) => window.__lt.tirage.targets.find((w) => w.length === n && !window.__lt.found.includes(w)) ?? null, len);

test.describe('lettres en vrac', () => {
  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await expect(page.locator('.lt-letter')).toHaveCount(7);
    await shot(page, testInfo, 'lettres-start');
    w.expectClean();
  });

  test('un mot valide, puis déjà trouvé, puis inconnu', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    const word = await target(page, 4) ?? (await target(page, 3));
    await page.evaluate((x) => window.__lt.type(x), word);
    await page.locator('[data-act="ok"]').click();
    expect(await lt(page, 'found')).toContain(word);
    expect(await lt(page, 'run.score')).toBeGreaterThan(0);
    await expect(page.locator('.lt-chip.is-got')).toHaveCount(1);
    await page.evaluate((x) => window.__lt.type(x), word);
    await page.keyboard.press('Enter');
    await expect(page.locator('#msg')).toContainText('Déjà trouvé');
    // Les trois premières lettres dans le désordre : rarement un mot
    const letters = await lt(page, 'tirage.letters');
    const junk = await page.evaluate((ls) => {
      const d = window.__lt.dict();
      for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) for (let c = 0; c < 7; c++) {
        if (a === b || b === c || a === c) continue;
        const w = ls[a] + ls[b] + ls[c];
        if (!d.kind(w)) return w;
      }
      return null;
    }, letters);
    await page.evaluate((x) => window.__lt.type(x), junk);
    await page.keyboard.press('Enter');
    await expect(page.locator('#msg')).toContainText('dictionnaire');
    await shot(page, testInfo, 'lettres-play');
    w.expectClean();
  });

  test('glisser sur la roue forme et valide le mot', async ({ page }) => {
    await open(page);
    await play(page);
    const word = await target(page, 3);
    const letters = await lt(page, 'tirage.letters');
    const used = [];
    const pts = [];
    for (const ch of word) {
      const i = letters.findIndex((c, k) => c === ch && !used.includes(k));
      used.push(i);
      const b = await page.locator(`.lt-letter[data-i="${i}"]`).boundingBox();
      pts.push([b.x + b.width / 2, b.y + b.height / 2]);
    }
    await page.mouse.move(...pts[0]);
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(...p, { steps: 6 });
    await page.mouse.up();
    expect(await lt(page, 'found')).toContain(word);
  });

  test('au clavier, et le mot entier ouvre un nouveau tirage', async ({ page }) => {
    await open(page);
    await play(page);
    const root = await lt(page, 'tirage.root');
    for (const ch of root) await page.keyboard.press(ch.toLowerCase());
    expect(await lt(page, 'word')).toBe(root);
    await page.keyboard.press('Enter');
    expect(await lt(page, 'run.sevens')).toBe(1);
    await expect.poll(() => lt(page, 'run.round')).toBe(2);
    expect(await lt(page, 'tirage.root')).not.toBe(root);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['lettres:mot-complet']).toBeTruthy();
  });

  test('un pluriel compte en bonus', async ({ page }) => {
    await open(page, '?fast=1&seed=26');
    await play(page);
    const plural = await page.evaluate(() => {
      const d = window.__lt.dict();
      const t = window.__lt.tirage;
      const pool = {};
      for (const c of t.letters) pool[c] = (pool[c] ?? 0) + 1;
      const fits = (w) => { const c = { ...pool }; for (const ch of w) { if (!c[ch]) return false; c[ch]--; } return true; };
      return [...d.bonus].find((w) => fits(w)) ?? null;
    });
    test.skip(!plural, 'pas de mot bonus dans ce tirage');
    await page.evaluate((x) => window.__lt.type(x), plural);
    await page.keyboard.press('Enter');
    expect(await lt(page, 'run.bonus')).toBe(1);
    await expect(page.locator('.lt-chip.is-bonus')).toHaveCount(1);
  });

  test('fin du chrono : les mots manqués sont montrés', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    await page.evaluate(() => (window.__lt.run.time = 0.2));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 4000 });
    await expect(page.locator('.lt-missed span').first()).toBeVisible();
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'lettres-over');
    w.expectClean();
  });

  test('zen : pas de chrono, un indice dévoile une lettre', async ({ page }, testInfo) => {
    await open(page);
    await play(page, 'zen');
    await expect(page.locator('#timer')).toBeHidden();
    await expect(page.locator('.lt-chip.is-hole').first()).toBeVisible();
    await page.locator('[data-act="hint"]').click();
    expect(await lt(page, 'run.hints')).toBe(2);
    await expect(page.locator('#msg')).toContainText('commence par');
    await shot(page, testInfo, 'lettres-zen');
  });

  test('tirage du jour : les mêmes lettres', async ({ page }) => {
    await open(page);
    await play(page, 'jour');
    const root = await lt(page, 'tirage.root');
    await page.reload();
    await play(page, 'jour');
    expect(await lt(page, 'tirage.root')).toBe(root);
  });
});
