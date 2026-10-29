// Le Potager : semer, arroser, récolter, vendre ; graines verrouillées ; commandes ; parcelles ;
// saisons ; résumé d'absence ; clavier.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const pg = (page, expr) => page.evaluate(`window.__pg.${expr}`);
const plot = (page, i) => page.locator(`.pg-plot[data-i="${i}"]`);

async function open(page) {
  await page.goto('games/potager/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  await page.getByRole('button', { name: 'Ouvrir le potager' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
}
// Sauvegarde préparée côté test (les fonctions ne passent pas dans addInitScript)
const baseSave = () => ({ coins: 30, total: 0, xp: 0, level: 1, time: 0, plots: Array.from({ length: 9 }, () => ({ crop: null, p: 0, wet: 0 })), basket: {}, eggs: 0, eggT: 0, up: { arroseur: 0, etal: 0, poule: 0, serre: 0, aide: 0 }, orders: [], orderT: 5, etalT: 30, seasonsSeen: 0, stats: { harvests: 0, orders: 0, sold: 0, planted: 0 }, lastSeen: Date.now(), sel: 'radis', tab: 'semer' });
const seed = (page, data) =>
  page.addInitScript((d) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gv:potager', JSON.stringify({ v: 1, data: d }));
  }, data);

test.describe('le potager', () => {
  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await page.goto('games/potager/');
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
    await shot(page, testInfo, 'potager-start');
    w.expectClean();
  });

  test('semer, arroser, récolter, vendre', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await plot(page, 0).click();
    expect(await pg(page, 's.plots[0].crop')).toBe('radis');
    expect(await pg(page, 's.coins')).toBe(28);
    await plot(page, 0).click();
    expect(await pg(page, 's.plots[0].wet')).toBeGreaterThan(0);
    await expect(plot(page, 0)).toHaveClass(/is-wet/);
    for (const i of [1, 2, 3]) await plot(page, i).click();
    await page.evaluate(() => window.__pg.tick(8));
    await shot(page, testInfo, 'potager-grow');
    await page.evaluate(() => window.__pg.tick(20));
    await expect(plot(page, 0)).toHaveClass(/is-ripe/);
    await plot(page, 0).click();
    expect(await pg(page, 's.basket.radis')).toBe(1);
    await page.getByRole('tab', { name: 'Marché' }).click();
    await expect(page.locator('.pg-basket li')).toHaveCount(1);
    const before = await pg(page, 's.coins');
    await page.locator('[data-act="sell"]').click();
    expect(await pg(page, 's.coins')).toBe(before + 5);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['potager:premiere-recolte']).toBeTruthy();
    w.expectClean();
  });

  test('graines verrouillées par le niveau', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-seed="tomate"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-seed="tomate"]').click({ force: true });
    await expect(page.locator('#msg')).toContainText('niveau 3');
    await page.locator('[data-seed="carotte"]').click();
    await plot(page, 4).click();
    expect(await pg(page, 's.plots[4].crop')).toBe('carotte');
  });

  test('commande livrée', async ({ page }, testInfo) => {
    await open(page);
    await page.evaluate(() => window.__pg.tick(6));
    expect(await pg(page, 's.orders.length')).toBe(1);
    await page.evaluate(() => {
      const s = window.__pg.s;
      for (const [c, n] of Object.entries(s.orders[0].items)) s.basket[c] = n;
      window.__pg.tick(0);
    });
    await page.getByRole('tab', { name: 'Marché' }).click();
    await expect(page.locator('.pg-order.is-ready')).toHaveCount(1);
    await shot(page, testInfo, 'potager-market');
    const reward = await pg(page, 's.orders[0].reward');
    const before = await pg(page, 's.coins');
    await page.locator('[data-deliver="0"]').click();
    expect(await pg(page, 's.coins')).toBe(before + reward);
    expect(await pg(page, 's.stats.orders')).toBe(1);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['potager:commande']).toBeTruthy();
  });

  test('acheter une parcelle ; améliorations verrouillées', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.__pg.setCoins(1000));
    await page.getByRole('tab', { name: 'Améliorer' }).click();
    await page.locator('[data-act="plot"]').click();
    expect(await pg(page, 's.plots.length')).toBe(10);
    await expect(page.locator('.pg-plot')).toHaveCount(10);
    await expect(page.locator('[data-up="arroseur"]')).toBeDisabled();
  });

  test('les saisons tournent', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.__pg.tick(241));
    await expect(page.locator('#season')).toHaveText('Été');
    await expect(page.locator('body')).toHaveAttribute('data-season', 'ete');
  });

  test('retour après une absence : résumé et récoltes prêtes', async ({ page }, testInfo) => {
    const w = watchPage(page);
    const b = baseSave();
    await seed(page, { ...b, lastSeen: Date.now() - 2 * 3600e3, plots: b.plots.map((p, i) => (i < 4 ? { crop: 'carotte', p: 0.1, wet: 0 } : p)) });
    await open(page);
    await expect(page.locator('#dlg')).toBeVisible();
    await expect(page.locator('#dlg')).toContainText('Tu es parti');
    await expect(page.locator('#dlg')).toContainText('4 parcelles mûres');
    await shot(page, testInfo, 'potager-offline');
    await page.locator('[data-close]').click();
    await expect(page.locator('.pg-plot.is-ripe')).toHaveCount(4);
    w.expectClean();
  });

  test('au clavier : flèches et Entrée', async ({ page }) => {
    await open(page);
    await plot(page, 0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(plot(page, 1)).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await pg(page, 's.plots[1].crop')).toBe('radis');
    await page.keyboard.press('ArrowDown');
    await expect(plot(page, 4)).toBeFocused();
  });
});
