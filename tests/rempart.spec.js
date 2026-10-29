// Rempart : construire en touchant une case, améliorer, vendre, lancer la vague (bonus d'or),
// accélérer, victoire et étoiles, défaite, clavier, cartes et tours verrouillées, carte du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const rp = (page, expr) => page.evaluate(`window.__rp.${expr}`);

async function open(page, q = '?fast=1') {
  await page.goto(`games/rempart/${q}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'campagne') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
  await expect.poll(() => rp(page, 'state')).toBe('run');
}
// Position dans la page du centre d'une case
const cellPos = (page, c, r) =>
  page.evaluate(([c0, r0]) => {
    const rc = document.querySelector('canvas.gv-canvas').getBoundingClientRect();
    const [x, y] = window.__rp.toScreen(c0 + 0.5, r0 + 0.5);
    return [x + rc.left, y + rc.top];
  }, [c, r]);
// Une case constructible près du chemin
const freeCell = (page) =>
  page.evaluate(() => {
    const g = window.__rp.g;
    for (let r = 0; r < 10; r++) for (let c = 0; c < 16; c++) {
      const i = r * 16 + c;
      if (g.cells.has(i) || g.blocked.has(i)) continue;
      if ([...g.cells].some((k) => Math.hypot((k % 16) - c, ((k / 16) | 0) - r) < 1.5)) return [c, r];
    }
    return null;
  });

test.describe('rempart', () => {
  test('accueil sans erreur, la démo se défend derrière', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await expect(page.locator('.rp-map')).toHaveCount(4);
    await page.waitForTimeout(1500);
    await shot(page, testInfo, 'rempart-start');
    w.expectClean();
  });

  test('construire, améliorer, vendre', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    const [c, r] = await freeCell(page);
    await page.mouse.click(...(await cellPos(page, c, r)));
    await expect(page.locator('[data-build="arbalete"]')).toBeVisible();
    await expect(page.locator('[data-build="givre"]')).toBeDisabled();
    await page.locator('[data-build="arbalete"]').click();
    expect(await rp(page, 'g.towers.length')).toBe(1);
    expect(await rp(page, 'g.gold')).toBe(100);
    await expect(page.locator('[data-act="up"]')).toBeVisible();
    await shot(page, testInfo, 'rempart-build');
    await page.locator('[data-act="up"]').click();
    expect(await rp(page, 'g.towers[0].level')).toBe(2);
    await page.locator('[data-act="sell"]').click();
    expect(await rp(page, 'g.towers.length')).toBe(0);
    w.expectClean();
  });

  test('lancer la vague, accélérer, les tours tirent', async ({ page }, testInfo) => {
    await open(page);
    await play(page);
    const [c, r] = await freeCell(page);
    await page.mouse.click(...(await cellPos(page, c, r)));
    await page.locator('[data-build="arbalete"]').click();
    await page.mouse.click(...(await cellPos(page, c, r)));
    await page.locator('[data-act="wave"]').click();
    expect(await rp(page, 'g.wave')).toBe(1);
    await page.locator('[data-act="speed"]').click();
    expect((await readStore(page, 'gv:rempart')).data.speed).toBe(2);
    await expect.poll(() => rp(page, 'g.stats.kills'), { timeout: 15000 }).toBeGreaterThan(0);
    await shot(page, testInfo, 'rempart-wave');
    expect(await rp(page, 'frameMs')).toBeLessThan(5);
  });

  test('défaite : le rempart tombe', async ({ page }) => {
    await open(page);
    await play(page);
    await page.locator('[data-act="wave"]').click();
    await page.evaluate(() => (window.__rp.g.lives = 1));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 20000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('tombé');
  });

  test('victoire : étoiles, carte et tour suivantes', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    await page.evaluate(() => {
      const g = window.__rp.g;
      g.wave = 15;
      g.phase = 'wave';
      g.queue = [];
    });
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('.rp-stars .is-on')).toHaveCount(3);
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'rempart-over');
    const data = (await readStore(page, 'gv:rempart')).data;
    expect(data.stars.prairie).toBe(3);
    expect(data.map).toBe(1);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['rempart:sans-fuite']).toBeTruthy();
    // La tour de givre est maintenant ouverte
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await expect.poll(() => rp(page, 'state')).toBe('run');
    const [c, r] = await freeCell(page);
    await page.mouse.click(...(await cellPos(page, c, r)));
    await expect(page.locator('[data-build="givre"]')).toBeEnabled();
    w.expectClean();
  });

  test('au clavier : flèches, 1 pour construire, N pour la vague', async ({ page }) => {
    await open(page);
    await play(page);
    await page.keyboard.press('ArrowRight');
    const sel = await rp(page, 'sel');
    expect(sel).toBeTruthy();
    // On cherche une case libre au clavier
    for (let k = 0; k < 20 && !(await page.evaluate(() => { const s = window.__rp.sel; const g = window.__rp.g; const i = s.r * 16 + s.c; return !g.cells.has(i) && !g.blocked.has(i); })); k++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('1');
    expect(await rp(page, 'g.towers.length')).toBe(1);
    await page.keyboard.press('n');
    expect(await rp(page, 'g.wave')).toBe(1);
  });

  test('cartes et mode infini verrouillés', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-map="1"]')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('[data-mode="infini"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-map="1"]').click({ force: true });
    await expect(page.locator('#rp-hint')).toContainText('Prairie');
  });

  test('carte du jour : toutes les tours permises, mêmes vagues', async ({ page }) => {
    await open(page);
    await play(page, 'jour');
    const id = await rp(page, 'g.map.id');
    const [c, r] = await freeCell(page);
    await page.mouse.click(...(await cellPos(page, c, r)));
    await expect(page.locator('[data-build="eclair"]')).not.toBeDisabled();
    await page.reload();
    await play(page, 'jour');
    expect(await rp(page, 'g.map.id')).toBe(id);
  });
});
