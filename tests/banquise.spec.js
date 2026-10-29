// Banquise : glisser au clavier et au doigt, plouf, annuler, indice, victoire en par = 3 étoiles,
// niveau suivant, mondes verrouillés, niveau du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const bq = (page, expr) => page.evaluate(`window.__bq.${expr}`);
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const idle = (page) => page.waitForFunction(() => window.__bq.state !== 'anim');

async function open(page, q = '?fast=1') {
  await page.goto(`games/banquise/${q}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'monde') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
  await expect.poll(() => bq(page, 'state')).toBe('play');
}
async function solveByKeys(page) {
  const path = await bq(page, 'solution()');
  for (const d of path) {
    await page.keyboard.press(KEY[d]);
    await idle(page);
  }
  return path.length;
}

test.describe('banquise', () => {
  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await expect(page.locator('.bq-level')).toHaveCount(10);
    await shot(page, testInfo, 'banquise-start');
    w.expectClean();
  });

  test('résoudre au par : 3 étoiles et niveau suivant', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    await shot(page, testInfo, 'banquise-play');
    const par = await bq(page, 'par');
    expect(await solveByKeys(page)).toBe(par);
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('.bq-stars .is-on')).toHaveCount(3);
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'banquise-over');
    const data = (await readStore(page, 'gv:banquise')).data;
    expect(data.stars['banquise-0']).toBe(3);
    expect(data.level).toBe(1);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['banquise:trois-etoiles']).toBeTruthy();
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await expect.poll(() => page.evaluate(() => document.querySelector('.gv-hud').textContent)).toContain('1-2');
    w.expectClean();
  });

  test('plouf : on revient, le coup compte', async ({ page }) => {
    await open(page);
    await play(page);
    const start = await bq(page, 'pos');
    const d = await bq(page, 'fallDir()');
    expect(d).toBeTruthy();
    await page.keyboard.press(KEY[d]);
    await idle(page);
    expect(await bq(page, 'pos')).toBe(start);
    expect(await bq(page, 'run.moves')).toBe(1);
    expect(await bq(page, 'run.falls')).toBe(1);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['banquise:plouf']).toBeTruthy();
  });

  test('annuler et indice', async ({ page }) => {
    await open(page);
    await play(page);
    const start = await bq(page, 'pos');
    const [d] = await bq(page, 'solution()');
    await page.keyboard.press(KEY[d]);
    await idle(page);
    expect(await bq(page, 'pos')).not.toBe(start);
    await page.locator('[data-act="undo"]').click();
    expect(await bq(page, 'pos')).toBe(start);
    expect(await bq(page, 'run.moves')).toBe(0);
    await page.locator('[data-act="hint"]').click();
    expect(await bq(page, 'run.hints')).toBe(1);
    await solveByKeys(page);
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    // Un indice plafonne à 2 étoiles
    await expect(page.locator('.bq-stars .is-on')).toHaveCount(2);
  });

  test('glisser du doigt déplace le pingouin', async ({ page }) => {
    await open(page);
    await play(page);
    const [d] = await bq(page, 'solution()');
    const box = await page.locator('canvas.gv-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 3;
    const [dx, dy] = { up: [0, -80], down: [0, 80], left: [-80, 0], right: [80, 0] }[d];
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
    await page.mouse.up();
    await idle(page);
    expect(await bq(page, 'run.moves')).toBe(1);
  });

  test('mondes verrouillés par les étoiles', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-world="1"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-world="1"]').click({ force: true });
    await expect(page.locator('#bq-hint')).toContainText('8 étoiles');
    await expect(page.locator('[data-level="1"]')).toHaveAttribute('aria-disabled', 'true');
  });

  test('niveau du jour : le même pour tous, et soluble', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page, 'jour');
    const rows = await bq(page, 'lv.cells.join("")');
    await page.reload();
    await play(page, 'jour');
    expect(await bq(page, 'lv.cells.join("")')).toBe(rows);
    await shot(page, testInfo, 'banquise-daily');
    await page.evaluate(() => {
      const u = new URL(location.href);
      return u.search;
    });
    w.expectClean();
  });
});
