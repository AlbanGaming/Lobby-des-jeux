// Le Juste Prix : catalogue, plus ou moins, estimation, duel, objets du jour, reprise de l'ancienne sauvegarde.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const jp = (page, expr) => page.evaluate(`window.__jp.${expr}`);

async function open(page, query = '?fast=1') {
  await page.goto(`games/juste-prix/${query}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function choose(page, modeId) {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
}
// Attend un objet (ou un duel) prêt à recevoir une réponse
const ready = (page) => page.waitForFunction(() => window.__jp.cur && !window.__jp.locked && window.__jp.clock.running);
async function offer(page, n) {
  for (const c of String(n)) await page.keyboard.press(c);
  await page.keyboard.press('Enter');
}

test.describe('juste-prix', () => {
  test('catalogue : prix ronds, illustrations pour chaque objet', async ({ page }) => {
    await open(page);
    await page.waitForFunction(() => window.__jp.catalog.length > 0);
    const report = await page.evaluate(async () => {
      const { priceStep } = await import('./logic.js');
      const { ART } = await import('./art.js');
      const items = window.__jp.catalog;
      return {
        count: items.length,
        notRound: items.filter((i) => i.price % priceStep(i.price)).map((i) => i.id),
        noArt: items.filter((i) => !ART[i.icon]).map((i) => i.id),
        dupes: items.length - new Set(items.map((i) => i.id)).size,
      };
    });
    expect(report.count).toBeGreaterThan(90);
    expect(report.notRound).toEqual([]);
    expect(report.noArt).toEqual([]);
    expect(report.dupes).toBe(0);
  });

  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await expect(page.locator('.jp-lot .jp-ico')).toBeVisible();
    await shot(page, testInfo, 'juste-prix-start');
    w.expectClean();
  });

  test('plus ou moins : indices, fourchette, prix trouvé, partie complète', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await choose(page, 'classique');
    await ready(page);
    const price = await jp(page, 'cur.item.price');
    const { lo, hi } = await page.evaluate(() => ({ lo: window.__jp.cur.lo, hi: window.__jp.cur.hi }));
    expect(lo).toBeLessThan(price);
    expect(hi).toBeGreaterThan(price);
    // Trop haut → « c'est moins », la fourchette se resserre
    await offer(page, hi - 1 > price ? hi - 1 : price + 1);
    await expect(page.locator('.jp-stamp')).toContainText(/moins/i);
    expect(await jp(page, 'cur.hi')).toBeLessThan(hi);
    await shot(page, testInfo, 'juste-prix-classique');
    // Le prix exact
    await offer(page, price);
    await expect(page.locator('.jp-stamp--win')).toBeVisible();
    expect(await jp(page, 'run.found')).toBe(1);
    expect(await jp(page, 'run.points')).toBeGreaterThan(300);
    // Les objets suivants : trouvés directement, puis la fin d'émission
    for (let i = 1; i < 5; i++) {
      await page.waitForFunction((n) => window.__jp.run.index === n && !window.__jp.locked, i);
      await offer(page, await jp(page, 'cur.item.price'));
    }
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('.jp-recap__row')).toHaveCount(5);
    await page.waitForTimeout(700);
    await shot(page, testInfo, 'juste-prix-over');
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['juste-prix:premier']).toBeTruthy();
    expect(meta.achievements['juste-prix:sans-faute']).toBeTruthy();
    w.expectClean();
  });

  test('plus ou moins : temps écoulé révèle le prix et casse le combo', async ({ page }) => {
    await open(page, '');
    await choose(page, 'classique');
    await ready(page);
    await page.evaluate(() => window.__jp.setTime(0.05));
    // Vérifié dans la page, avant que l'objet suivant n'arrive
    await page.waitForFunction(() => {
      const r = window.__jp.run.results[0];
      const tag = document.querySelector('.jp-lot [data-tag]')?.textContent.replace(/\s/g, '') ?? '';
      return r && /temps écoulé|si près/i.test(document.querySelector('.jp-stamp')?.textContent ?? '') && tag.includes(String(r.item.price));
    });
    expect(await jp(page, 'run.streak')).toBe(0);
  });

  test('une pause pendant l’enchaînement ne bloque pas la partie', async ({ page }) => {
    await open(page, '');
    await choose(page, 'classique');
    await ready(page);
    await offer(page, await jp(page, 'cur.item.price'));
    await expect(page.locator('.jp-stamp--win')).toBeVisible();
    const first = await jp(page, 'cur.item.id');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-screen="pause"]')).toHaveClass(/is-open/);
    await page.waitForTimeout(2200);
    expect(await jp(page, 'cur.item.id')).toBe(first);
    await page.keyboard.press('Escape');
    await page.waitForFunction((id) => window.__jp.cur.item.id !== id && !window.__jp.locked, first, { timeout: 5000 });
  });

  test('au plus juste : une offre pile rapporte le maximum', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await choose(page, 'estimation');
    await ready(page);
    await offer(page, await jp(page, 'cur.item.price'));
    await expect(page.locator('.jp-gauge')).toBeVisible();
    const r = await jp(page, 'run.results[0]');
    expect(r.tier).toBe('pile');
    expect(r.pts).toBeGreaterThanOrEqual(1500);
    await page.waitForTimeout(150);
    await shot(page, testInfo, 'juste-prix-estimation');
    // Une offre très loin : aucun point, la série retombe
    await page.waitForFunction(() => window.__jp.run.index === 1 && !window.__jp.locked);
    await offer(page, (await jp(page, 'cur.item.price')) * 5);
    await page.waitForFunction(() => window.__jp.run.results.length === 2);
    expect(await jp(page, 'run.results[1].pts')).toBe(0);
    expect(await jp(page, 'run.streak')).toBe(0);
    w.expectClean();
  });

  test('le plus cher : bons choix, série, vies et fin de partie', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await choose(page, 'duel');
    await ready(page);
    await expect(page.locator('button.jp-lot')).toHaveCount(2);
    await shot(page, testInfo, 'juste-prix-duel');
    const winner = () => page.evaluate(() => (window.__jp.cur.pair[0].price > window.__jp.cur.pair[1].price ? 0 : 1));
    for (let i = 0; i < 4; i++) {
      await ready(page);
      const k = await winner();
      await page.keyboard.press(k ? 'ArrowRight' : 'ArrowLeft');
      await page.waitForFunction((n) => window.__jp.run.duels === n, i + 1);
    }
    expect(await jp(page, 'run.streak')).toBe(4);
    await expect(page.locator('#price')).toContainText('Série 4');
    // Trois erreurs : plus de vies
    for (let i = 0; i < 3; i++) {
      await ready(page);
      const k = await winner();
      await page.locator(`[data-pick="${1 - k}"]`).click();
      await page.waitForFunction((n) => window.__jp.run.lives === n, 2 - i);
    }
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    expect((await readStore(page, 'gv:juste-prix')).data.bestStreak).toBe(4);
    w.expectClean();
  });

  test('les 5 du jour : mêmes objets pour tous, une fois par jour, partage', async ({ page, context }) => {
    const w = watchPage(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await open(page);
    await choose(page, 'jour');
    await ready(page);
    const ids = await page.evaluate(() => window.__jp.run.items.map((i) => i.id));
    expect(ids).toHaveLength(5);
    const again = await page.evaluate(async () => {
      const { dailyItems } = await import('./logic.js');
      return dailyItems(window.__jp.catalog).map((i) => i.id);
    });
    expect(again).toEqual(ids);
    for (let i = 0; i < 5; i++) {
      await page.waitForFunction((n) => window.__jp.run.index === n && !window.__jp.locked, i);
      await offer(page, await jp(page, 'cur.item.price'));
    }
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 6000 });
    await expect(page.locator('[data-screen="over"] [data-share]')).toBeVisible();
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['juste-prix:du-jour']).toBeTruthy();
    await page.reload();
    await expect(page.locator('[data-mode="jour"]')).toHaveAttribute('aria-disabled', 'true');
    w.expectClean();
  });

  test('clavier à l’écran', async ({ page }) => {
    await open(page);
    await choose(page, 'classique');
    await ready(page);
    for (const d of '120') await page.locator(`.jp-key[data-digit="${d}"]`).click();
    await expect(page.locator('#price')).toContainText('120');
    await page.locator('.jp-key[data-act="erase"]').click();
    expect(await jp(page, 'entry')).toBe('12');
    await page.locator('.jp-key[data-act="ok"]').click();
    expect(await jp(page, 'cur.tries') + (await jp(page, 'run.found'))).toBeGreaterThan(0);
  });

  test('reprend la sauvegarde de l’ancien Juste Prix', async ({ page }) => {
    await page.goto('games/juste-prix/?fast=1');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('playerData', JSON.stringify({ level: 7, money: 5400, wins: 23, xp: 40, xpToNextLevel: 900, unlockedCategories: ['Électronique de base', 'Gaming', 'Premium'] }));
    });
    await page.reload();
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
    const data = (await readStore(page, 'gv:juste-prix')).data;
    expect(data.found).toBe(23);
    expect(data.bonusRayons.sort()).toEqual(['luxe', 'tech']);
    await expect(page.locator('.jp-rayon.is-open')).toHaveCount(5);
    await expect(page.locator('.toast')).toContainText('Progression reprise');
  });

  test('l’ancienne adresse page1.html redirige vers le Juste Prix', async ({ page }) => {
    await page.goto('page1.html');
    await page.waitForURL(/games\/juste-prix\/$/);
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  });
});
