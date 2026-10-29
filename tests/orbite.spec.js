// Orbite : lâcher, accroche et lâcher parfait (pilote), perte dans le vide, poussière d'étoile,
// fluidité, vaisseaux verrouillés, voyage du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const or = (page, expr) => page.evaluate(`window.__or.${expr}`);

async function open(page, q = '') {
  await page.goto(`games/orbite/${q}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'classique') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
  await expect.poll(() => or(page, 'state')).toBe('run');
}

test.describe('orbite', () => {
  test('accueil sans erreur, la démo vole derrière', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await expect(page.locator('.or-pick')).toHaveCount(5);
    await page.waitForTimeout(1200);
    await shot(page, testInfo, 'orbite-start');
    w.expectClean();
  });

  test('le pilote enchaîne les planètes et les lâchers parfaits', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await play(page);
    await page.evaluate(() => (window.__or.autoplay = true));
    await expect.poll(() => or(page, 'run.planets'), { timeout: 20000 }).toBeGreaterThanOrEqual(6);
    expect(await or(page, 'run.perfects')).toBeGreaterThanOrEqual(3);
    expect(await or(page, 'run.points')).toBeGreaterThan(60);
    await shot(page, testInfo, 'orbite-play');
    expect(await or(page, 'frameMs')).toBeLessThan(4);
    w.expectClean();
  });

  test('un lâcher dans le vide : partie perdue', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await play(page);
    // Lâcher quand le vaisseau file à l'opposé de la planète suivante
    await page.waitForFunction(() => {
      const s = window.__or.ship;
      const n = window.__or.planets[s.p.i + 1];
      const dx = -Math.sin(s.angle) * s.dir;
      const dy = Math.cos(s.angle) * s.dir;
      return (n.x - s.x) * dx + (n.y - s.y) * dy < -100;
    });
    await page.keyboard.press('Space');
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 8000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('Perdu dans le vide');
    await page.waitForTimeout(600);
    await shot(page, testInfo, 'orbite-over');
    w.expectClean();
  });

  test('la poussière d’étoile s’ajoute au compte', async ({ page }) => {
    await open(page);
    await play(page);
    await page.evaluate(() => (window.__or.autoplay = true));
    await expect.poll(() => or(page, 'run.dust'), { timeout: 20000 }).toBeGreaterThan(0);
    await page.evaluate(() => (window.__or.autoplay = false));
    await page.waitForFunction(() => {
      const s = window.__or.ship;
      if (s.mode !== 'orbit') return false;
      const n = window.__or.planets[s.p.i + 1];
      return (n.x - s.x) * -Math.sin(s.angle) * s.dir + (n.y - s.y) * Math.cos(s.angle) * s.dir < -100;
    });
    const dust = await or(page, 'run.dust');
    await page.keyboard.press('Space');
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 8000 });
    expect((await readStore(page, 'gv:orbite')).data.dust).toBeGreaterThanOrEqual(dust);
  });

  test('vaisseaux et galaxies verrouillés', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-skin="comete"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-skin="comete"]').click({ force: true });
    await expect(page.locator('#or-hint')).toContainText('400');
    await page.locator('[data-galaxy="abysse"]').click({ force: true });
    await expect(page.locator('#or-hint')).toContainText('60 planètes');
  });

  test('voyage du jour : les mêmes planètes pour tous', async ({ page }) => {
    await open(page);
    await play(page, 'jour');
    const map = await page.evaluate(() => window.__or.planets.slice(0, 6).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';'));
    await page.reload();
    await play(page, 'jour');
    expect(await page.evaluate(() => window.__or.planets.slice(0, 6).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';'))).toBe(map);
  });
});
