// Gratte-Ciel : lâcher, coupe, parfait, élargissement, époques, chute, rejouer, tour du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const gc = (page, expr) => page.evaluate(`window.__gc.${expr}`);

async function open(page) {
  await page.goto('games/gratte-ciel/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'classique') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await page.waitForFunction(() => window.__gc.state === 'run');
}
// Lâche la dalle à un décalage donné du sommet (pilote dans la page, synchronisé sur l'affichage)
const dropAt = (page, offset) =>
  page.evaluate(
    (off) =>
      new Promise((resolve) => {
        const n0 = window.__gc.floors.length;
        const t0 = performance.now();
        const step = () => {
          const g = window.__gc;
          if (g.state === 'run' && g.slab && performance.now() - t0 > 280 && Math.abs(g.slab.x - (g.top.x + off)) < g.slab.v / 60) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
            const wait = () => (window.__gc.floors.length !== n0 || window.__gc.state !== 'run' ? resolve() : requestAnimationFrame(wait));
            return requestAnimationFrame(wait);
          }
          requestAnimationFrame(step);
        };
        step();
      }),
    offset,
  );

test.describe('gratte-ciel', () => {
  test('accueil : démonstration sans rien débloquer', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.waitForTimeout(1200);
    await shot(page, testInfo, 'gratte-ciel-start');
    const meta = await readStore(page, 'gv:meta');
    expect(Object.keys(meta?.data?.achievements ?? {}).filter((k) => k.startsWith('gratte-ciel:'))).toEqual([]);
    w.expectClean();
  });

  test('lâcher décalé : la dalle est coupée, le surplus tombe', async ({ page }) => {
    const w = watchPage(page);
    await open(page);
    await play(page);
    await dropAt(page, 40);
    const f = await gc(page, 'top');
    expect(f.w).toBeGreaterThan(160);
    expect(f.w).toBeLessThan(200);
    expect(await gc(page, 'run.streak')).toBe(0);
    w.expectClean();
  });

  test('lâchers parfaits : série, gamme, élargissement après trois', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await play(page);
    await dropAt(page, 30);
    const narrow = (await gc(page, 'top')).w;
    for (let i = 0; i < 3; i++) await dropAt(page, 0);
    expect(await gc(page, 'run.streak')).toBe(3);
    expect((await gc(page, 'top')).w).toBeGreaterThan(narrow);
    await page.waitForTimeout(150);
    await shot(page, testInfo, 'gratte-ciel-play');
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['gratte-ciel:agrandi']).toBeTruthy();
    w.expectClean();
  });

  test('époques : l’Art déco arrive au 15e étage', async ({ page }) => {
    test.setTimeout(90000);
    await open(page);
    await play(page);
    await page.evaluate(() => (window.__gc.autoplay = true));
    await page.waitForFunction(() => window.__gc.floors.length > 16, null, { timeout: 80000 });
    await page.evaluate(() => (window.__gc.autoplay = false));
    expect(await page.evaluate(() => window.__gc.floors[16].epoch)).toBe(1);
    expect(await gc(page, 'frameMs')).toBeLessThan(8);
  });

  test('raté : fin de partie, vue d’ensemble, rejouer en moins d’une seconde', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await play(page);
    await dropAt(page, 0);
    // La dalle entière à côté
    await dropAt(page, 230);
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await page.waitForTimeout(600);
    await shot(page, testInfo, 'gratte-ciel-over');
    const t0 = Date.now();
    await page.keyboard.press('KeyR');
    await page.waitForFunction(() => window.__gc.state === 'run');
    expect(Date.now() - t0).toBeLessThan(1000);
    w.expectClean();
  });

  test('tour du jour : mêmes vitesses pour tous', async ({ page }) => {
    await open(page);
    await play(page, 'jour');
    const v1 = await gc(page, 'slab.v');
    await page.reload();
    await play(page, 'jour');
    expect(await gc(page, 'slab.v')).toBeCloseTo(v1, 6);
    await dropAt(page, 230);
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('.gc-daily')).toContainText('Meilleur score du jour');
  });
});
