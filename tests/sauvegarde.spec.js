// Code de sauvegarde : copier sa progression, la restaurer dans un navigateur vidé,
// refuser un code abîmé, et le rappel quand on n'a pas sauvegardé depuis longtemps.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const seedMeta = (page, extra = {}) =>
  page.addInitScript((x) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const data = { migratedLegacy: true, profile: { name: 'TESTEUR', createdAt: 1 }, credits: 777, ...x };
    localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data }));
    localStorage.setItem('gv:volt-rush', JSON.stringify({ v: 1, data: { best: 4321 } }));
  }, extra);
const metaData = async (page) => (await readStore(page, 'gv:meta')).data;
const ready = async (page) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-gv-ready', '');
};
const openSettings = async (page) => {
  await page.locator('#btnSettings').click();
  await expect(page.locator('#dlgSettings')).toBeVisible();
};
const NOW = { last: Date.now(), nudged: 0 };

test.describe('sauvegarde', () => {
  test('copier son code, tout effacer, le recoller : la progression revient', async ({ page, context }, testInfo) => {
    const w = watchPage(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await seedMeta(page, { owned: ['theme:neon'], look: { theme: 'neon' }, xp: 900 });
    await ready(page);
    await openSettings(page);
    await expect(page.locator('#backupLast')).toContainText('jamais');
    await page.locator('[data-code="copy"]').click();
    const ta = page.locator('#codeText');
    await expect(ta).toHaveValue(/^GV[01]\.[A-Za-z0-9_-]{40,}$/);
    const code = await ta.inputValue();
    await page.locator('#codeGo').click();
    await expect(page.locator('#codeMsg')).toContainText(/copi/i);
    await shot(page, testInfo, 'sauvegarde-code');
    expect((await metaData(page)).backup.last).toBeGreaterThan(0);
    await page.locator('#dlgCode [data-close]').click();
    await expect(page.locator('#backupLast')).toContainText('aujourd’hui');

    // Safari a tout effacé : nouveau profil vierge
    await page.evaluate(() => localStorage.clear());
    await ready(page);
    expect((await metaData(page)).credits).toBe(0);
    await openSettings(page);
    await page.locator('[data-code="paste"]').click();
    await page.locator('#codeText').fill(code);
    await page.locator('#codeGo').click();
    await page.locator('#confirmYes').click();
    await expect(page.locator('#dlgCode')).not.toBeVisible();
    const d = await metaData(page);
    expect(d.credits).toBe(777);
    expect(d.owned).toContain('theme:neon');
    expect((await readStore(page, 'gv:volt-rush')).data.best).toBe(4321);
    await expect(page.locator('html')).toHaveAttribute('data-gv-theme', 'neon');
    w.expectClean();
  });

  test('un code abîmé est refusé sans rien toucher', async ({ page }) => {
    await seedMeta(page, { backup: NOW });
    await ready(page);
    await openSettings(page);
    await page.locator('[data-code="paste"]').click();
    await page.locator('#codeGo').click();
    await expect(page.locator('#codeMsg')).toHaveClass(/is-error/);
    for (const [bad, msg] of [['bonjour', 'pas un code'], ['GV1.H4sIAAAAAAAAA', 'abîmé']]) {
      await page.locator('#codeText').fill(bad);
      await page.locator('#codeGo').click();
      await page.locator('#confirmYes').click();
      await expect(page.locator('#codeMsg')).toContainText(msg);
    }
    expect((await metaData(page)).credits).toBe(777);
  });

  test('rappel de sauvegarde : une seule fois, et pas si on vient de sauvegarder', async ({ page }) => {
    await seedMeta(page, { xp: 3000 });
    await ready(page);
    await expect(page.locator('.toast', { hasText: 'Pense à sauvegarder' })).toBeVisible({ timeout: 7000 });
    expect((await metaData(page)).backup.nudged).toBeGreaterThan(0);
    await ready(page);
    await page.waitForTimeout(4600);
    await expect(page.locator('.toast', { hasText: 'Pense à sauvegarder' })).toHaveCount(0);
  });

  test('pas de rappel juste après une sauvegarde', async ({ page }) => {
    await seedMeta(page, { xp: 3000, backup: NOW });
    await ready(page);
    await page.waitForTimeout(4600);
    await expect(page.locator('.toast', { hasText: 'Pense à sauvegarder' })).toHaveCount(0);
  });
});
