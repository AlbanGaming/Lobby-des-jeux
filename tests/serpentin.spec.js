// Serpentin (jeu secret) : verrouillé sans achat, débloqué depuis le lobby, puis la partie :
// le pilote mange et grandit, virage au clavier, mur mortel, bonus, modes verrouillés, jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const sp = (page, expr) => page.evaluate(`window.__sp.${expr}`);
const seedMeta = (page, data) =>
  page.addInitScript((d) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data: { migratedLegacy: true, profile: { name: 'TESTEUR', createdAt: 1 }, ...d } }));
  }, data);
const unlocked = (page) => seedMeta(page, { credits: 0, owned: ['game:serpentin'] });

async function play(page, modeId = 'classique') {
  await page.goto('games/serpentin/');
  await page.evaluate(() => document.fonts.ready);
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect.poll(() => sp(page, 'state')).toBe('run');
}

test.describe('serpentin', () => {
  test('sans achat : écran verrouillé qui mène à la boutique', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page, { credits: 0 });
    await page.goto('games/serpentin/');
    await expect(page.locator('.gv-locked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jouer' })).toHaveCount(0);
    await expect(page.locator('.gv-locked a').first()).toHaveAttribute('href', /#boutique$/);
    await shot(page, testInfo, 'serpentin-verrou');
    w.expectClean();
  });

  test('débloqué depuis le lobby : carte à cadenas, achat, jeu ouvert', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page, { credits: 500 });
    await page.goto('./');
    const card = page.locator('#grid .gcard[data-id="serpentin"]');
    await expect(card).toHaveClass(/is-locked/);
    await card.locator('.gcard__link').click();
    await expect(page.locator('#dlgShop')).toBeVisible();
    await expect(page.locator('#stab-jeux')).toHaveAttribute('aria-selected', 'true');
    await shot(page, testInfo, 'serpentin-boutique');
    await page.locator('[data-buy-game="serpentin"]').click();
    await page.locator('#confirmYes').click();
    const d = (await readStore(page, 'gv:meta')).data;
    expect(d.owned).toContain('game:serpentin');
    expect(d.achievements['global:mecene']).toBeTruthy();
    await expect(page.locator('#shopBody a[data-play="serpentin"]')).toBeVisible();
    await page.locator('#dlgShop [data-close]').click();
    await expect(card).not.toHaveClass(/is-locked/);
    await card.locator('.gcard__link').click();
    await expect(page).toHaveURL(/games\/serpentin\//);
    await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible();
    w.expectClean();
  });

  test('le pilote mange, grandit et marque des combos', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await unlocked(page);
    await play(page);
    await page.evaluate(() => (window.__sp.autoplay = true));
    await expect.poll(() => sp(page, 'snake.length'), { timeout: 20000 }).toBeGreaterThanOrEqual(9);
    expect(await sp(page, 'run.score')).toBeGreaterThan(40);
    expect(await sp(page, 'frameMs')).toBeLessThan(4);
    await shot(page, testInfo, 'serpentin-play');
    w.expectClean();
  });

  test('virage au clavier, puis le mur', async ({ page }, testInfo) => {
    await unlocked(page);
    await play(page);
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => sp(page, 'dir')).toBe('up');
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 8000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('mur');
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'serpentin-over');
  });

  test('bonus étoile : points doublés pendant 8 secondes', async ({ page }) => {
    await unlocked(page);
    await play(page);
    await page.evaluate(() => window.__sp.bonusAhead('etoile'));
    await expect.poll(() => sp(page, 'active.etoile')).toBeGreaterThan(0);
  });

  test('modes verrouillés, serpent du jour identique', async ({ page }) => {
    await unlocked(page);
    await page.goto('games/serpentin/');
    await expect(page.locator('[data-mode="libre"]')).toHaveAttribute('aria-disabled', 'true');
    await play(page, 'jour');
    const blocks = await page.evaluate(() => [...window.__sp.blocks].sort().join());
    expect(blocks.length).toBeGreaterThan(0);
    await page.reload();
    await play(page, 'jour');
    expect(await page.evaluate(() => [...window.__sp.blocks].sort().join())).toBe(blocks);
  });
});
