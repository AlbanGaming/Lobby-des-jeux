// Turbo circuit : départ, course contre les cinq pilotes IA, dérapage qui charge le turbo,
// arrivée et primes, coupe en plusieurs courses, garage, commandes tactiles.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const tc = (page, expr) => page.evaluate(`window.__tc.${expr}`);
const seed = (page, store = null) =>
  page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data: { migratedLegacy: true, profile: { name: 'TESTEUR', createdAt: 1 }, backup: { last: Date.now(), nudged: 0 } } }));
    if (s) localStorage.setItem('gv:turbo-circuit', JSON.stringify({ v: 1, data: s }));
  }, store);
const play = (page) => page.getByRole('button', { name: 'Jouer', exact: true }).click();
const over = (page) => page.locator('[data-screen="over"]');
const base = { mode: 'course', circuit: 'port', level: 'facile', cash: 0, upg: { moteur: 0, pneus: 0, turbo: 0 }, cups: {}, laps: {}, cup: null };

test.describe('turbo circuit', () => {
  test('départ, compte à rebours, puis la course contre les cinq pilotes', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seed(page);
    await page.goto('games/turbo-circuit/?seed=4');
    await expect(page.locator('.tc-circuit')).toHaveCount(8);
    await shot(page, testInfo, 'turbo-circuit-start');
    await play(page);
    await expect.poll(() => tc(page, 'state')).toBe('count');
    expect(await page.evaluate(() => window.__tc.cars.length)).toBe(6);
    await page.waitForTimeout(600);
    await shot(page, testInfo, 'turbo-circuit-depart');
    await expect.poll(() => tc(page, 'state'), { timeout: 6000 }).toBe('race');
    await page.evaluate(() => (window.__tc.autoplay = true));
    await page.waitForTimeout(3000);
    // Tout le monde roule, sur la route
    const r = await page.evaluate(() => window.__tc.cars.map((c) => ({ v: c.speed, off: c.offT })));
    expect(r.every((c) => c.v > 150 && c.off < 0.5)).toBe(true);
    expect(await tc(page, 'me.idx')).toBeGreaterThan(20);
    expect(await tc(page, 'me.idx')).toBeLessThan(300);
    await shot(page, testInfo, 'turbo-circuit-course');
    w.expectClean();
  });

  test('dérapage : la jauge se remplit, Maj lance le turbo', async ({ page, isMobile }) => {
    test.skip(isMobile, 'clavier');
    await seed(page);
    await page.goto('games/turbo-circuit/?seed=4');
    await play(page);
    await page.evaluate(() => window.__tc.skipCount());
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(1200);
    // Dérapages en zigzag, pour rester sur la route
    await page.keyboard.down('Space');
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']) {
      await page.keyboard.down(k);
      await page.waitForTimeout(260);
      await page.keyboard.up(k);
    }
    await page.keyboard.up('Space');
    expect(await tc(page, 'me.charge')).toBeGreaterThan(0.02); // le dérapage a bien chargé la jauge
    await page.evaluate(() => (window.__tc.me.charge = 1.2));
    await page.keyboard.press('Shift');
    await expect.poll(() => tc(page, 'me.boostT')).toBeGreaterThan(0);
    await page.keyboard.up('ArrowUp');
  });

  test('arrivée en tête : victoire, Chrono battu, prime au garage', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seed(page);
    await page.goto('games/turbo-circuit/?seed=4');
    await play(page);
    await page.evaluate(() => window.__tc.skipCount());
    await expect.poll(() => tc(page, 'state')).toBe('race');
    await page.evaluate(() => window.__tc.finishNow(0));
    await expect(over(page)).toHaveClass(/is-open/, { timeout: 8000 });
    await expect(over(page)).toContainText('Victoire');
    await expect(over(page).locator('.tc-results li')).toHaveCount(6);
    await expect(over(page).locator('.tc-results li.is-me')).toContainText('1. Toi');
    const s = (await readStore(page, 'gv:turbo-circuit')).data;
    expect(s.cash).toBe(120);
    const ach = (await readStore(page, 'gv:meta')).data.achievements;
    expect(ach['turbo-circuit:victoire']).toBeTruthy();
    expect(ach['turbo-circuit:chrono']).toBeTruthy();
    await page.waitForTimeout(400);
    await shot(page, testInfo, 'turbo-circuit-arrivee');
    w.expectClean();
  });

  test('coupe : points, course suivante, puis la coupe remportée ouvre la suivante', async ({ page }) => {
    await seed(page, base);
    await page.goto('games/turbo-circuit/');
    await page.locator('[data-mode="coupe"]').click();
    await expect(page.locator('[data-cup="argent"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-cup="bronze"]').click();
    await expect.poll(() => tc(page, 'state')).toBe('count');
    expect(await tc(page, 'T.id')).toBe('port');
    await page.evaluate(() => window.__tc.finishNow(1));
    await expect(over(page).locator('.tc-table')).toContainText('après 1 course');
    await expect(over(page).locator('.tc-table li.is-me')).toContainText('6 pts');
    await over(page).locator('[data-tc="next"]').click();
    await expect.poll(() => tc(page, 'T.id')).toBe('foret');
    // Dernière course de la coupe, gagnée avec assez d'avance
    await page.evaluate(() => {
      const c = window.__tc.store.cup;
      c.race = 3;
      c.points = { toi: 18, chrono: 16, nitro: 10, prudence: 8, zigzag: 4, bloqueur: 2 };
      window.__tc.finishNow(0);
    });
    await expect(over(page).locator('.tc-table')).toContainText('remportes');
    const s = (await readStore(page, 'gv:turbo-circuit')).data;
    expect(s.cups.bronze).toBe(true);
    expect(s.cup).toBeNull();
    expect(s.cash).toBeGreaterThanOrEqual(200);
    await page.locator('[data-act="replay"]').click();
    await page.keyboard.press('Escape');
    await page.goto('games/turbo-circuit/');
    await page.locator('[data-mode="coupe"]').click();
    await expect(page.locator('[data-cup="argent"]')).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('garage : une amélioration achetée avec les primes', async ({ page }) => {
    await seed(page, { ...base, cash: 500 });
    await page.goto('games/turbo-circuit/');
    await page.locator('[data-mode="garage"]').click();
    await page.locator('[data-upg="moteur"]').click();
    const s = (await readStore(page, 'gv:turbo-circuit')).data;
    expect(s.upg.moteur).toBe(1);
    expect(s.cash).toBe(380);
    await expect(page.locator('[data-upg="moteur"]')).toContainText('220');
    // « Jouer » depuis le garage lance une course rapide
    await play(page);
    await expect.poll(() => tc(page, 'state')).toBe('count');
  });

  test('sur téléphone : la voiture accélère seule, boutons pour tourner', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'commandes tactiles');
    await seed(page);
    await page.goto('games/turbo-circuit/?seed=4');
    await play(page);
    await page.evaluate(() => window.__tc.skipCount());
    await expect(page.locator('.tc-pad')).toBeVisible();
    await page.waitForTimeout(800);
    expect(await tc(page, 'me.speed')).toBeGreaterThan(100);
    const h0 = await tc(page, 'me.h');
    const left = page.locator('.tc-pad [data-k="left"]');
    await left.dispatchEvent('pointerdown');
    await page.waitForTimeout(400);
    await left.dispatchEvent('pointerup');
    expect(await tc(page, 'me.h')).toBeLessThan(h0 - 0.2);
  });
});
