// Tic Tac : coup réussi, trop tôt, trop tard, rejouer, heures, remontoir, chrono, cadran du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const tt = (page, expr) => page.evaluate(`window.__tictac.${expr}`);

async function open(page) {
  await page.goto('games/tic-tac/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'classique') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await page.waitForFunction(() => window.__tictac.state === 'run');
}
// Pilote dans la page : appuie sur Espace quand l'aiguille est au cœur de la zone
const tapInZone = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const t0 = performance.now();
        const step = () => {
          const g = window.__tictac;
          const m = g.targets.find((t) => t.kind === 'main' && !t.dead);
          if (g.state === 'run' && m && performance.now() - t0 > 320 && Math.abs(m.d) < m.half * 0.5) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
            return resolve();
          }
          requestAnimationFrame(step);
        };
        step();
      }),
  );
// Repousse la zone loin devant l'aiguille : une touche immédiate arrive forcément trop tôt
const farTarget = (page) =>
  page.evaluate(() => {
    const g = window.__tictac;
    const m = g.targets.find((t) => t.kind === 'main' && !t.dead);
    m.center = g.hand.a + g.hand.dir * 2.5;
  });
const space = (page) =>
  page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
  });

test.describe('tic tac', () => {
  test('accueil : démonstration sans rien compter ni débloquer', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    const a0 = await tt(page, 'hand.a');
    await page.waitForTimeout(1500);
    expect(await tt(page, 'hand.a')).not.toBe(a0);
    await shot(page, testInfo, 'tic-tac-start');
    const meta = await readStore(page, 'gv:meta');
    expect(Object.keys(meta?.data?.achievements ?? {}).filter((k) => k.startsWith('tic-tac:'))).toEqual([]);
    w.expectClean();
  });

  test('coup réussi : l’aiguille repart dans l’autre sens, plus vite', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await play(page);
    const speed0 = await tt(page, 'hand.speed');
    for (let i = 0; i < 3; i++) {
      const dir = await tt(page, 'hand.dir');
      await tapInZone(page);
      await page.waitForFunction((n) => window.__tictac.run.hits === n, i + 1);
      expect(await tt(page, 'hand.dir')).toBe(-dir);
    }
    expect(await tt(page, 'hand.speed')).toBeGreaterThan(speed0);
    expect(await tt(page, 'run.points')).toBeGreaterThan(0);
    await shot(page, testInfo, 'tic-tac-play');
    w.expectClean();
  });

  test('trop tôt : fin de partie, puis rejouer en moins d’une seconde', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await play(page);
    await page.waitForTimeout(350);
    await farTarget(page);
    await space(page);
    await page.waitForFunction(() => window.__tictac.state === 'ending');
    await page.waitForTimeout(200);
    await shot(page, testInfo, 'tic-tac-crack');
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 4000 });
    await expect(page.locator('[data-screen="over"]')).toContainText(/trop tôt|à un cheveu/i);
    await page.waitForTimeout(500);
    const t0 = Date.now();
    await page.keyboard.press('KeyR');
    await page.waitForFunction(() => window.__tictac.state === 'run');
    expect(Date.now() - t0).toBeLessThan(1000);
    w.expectClean();
  });

  test('trop tard : laisser passer la zone termine la partie', async ({ page }) => {
    await open(page);
    await play(page);
    await page.waitForFunction(() => window.__tictac.state === 'ending', null, { timeout: 8000 });
    expect(await tt(page, 'run.reason')).toBe('Trop tard !');
  });

  test('toucher l’écran compte comme un coup', async ({ page }) => {
    await open(page);
    await play(page);
    await page.waitForTimeout(350);
    await farTarget(page);
    await page.locator('#stage').click({ position: { x: 40, y: 200 } });
    await page.waitForFunction(() => window.__tictac.state === 'ending');
  });

  test('le remontoir sauve une fois', async ({ page }) => {
    await open(page);
    await play(page);
    await page.waitForTimeout(350);
    await page.evaluate(() => (window.__tictac.run.shield = true));
    await farTarget(page);
    await space(page);
    await page.waitForTimeout(100);
    expect(await tt(page, 'state')).toBe('run');
    expect(await tt(page, 'run.saved')).toBe(1);
    expect(await tt(page, 'run.shield')).toBe(false);
  });

  test('les heures passent, le chrono se débloque et se joue', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const w = watchPage(page);
    await open(page);
    await play(page);
    await page.evaluate(() => (window.__tictac.autoplay = true));
    await page.waitForFunction(() => window.__tictac.run.points >= 1600, null, { timeout: 60000 });
    expect(await tt(page, 'run.hour')).toBeGreaterThanOrEqual(3);
    expect(await tt(page, 'frameMs')).toBeLessThan(8);
    await shot(page, testInfo, 'tic-tac-hours');
    await page.evaluate(() => (window.__tictac.autoplay = false));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 8000 });
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['tic-tac:premiere-heure']).toBeTruthy();
    // Chrono : une erreur coûte 3 s mais la partie continue
    await page.reload();
    await expect(page.locator('[data-mode="chrono"]')).not.toHaveAttribute('aria-disabled', 'true');
    await play(page, 'chrono');
    await page.waitForTimeout(350);
    await farTarget(page);
    await space(page);
    await page.waitForTimeout(100);
    expect(await tt(page, 'state')).toBe('run');
    expect(await tt(page, 'run.timeLeft')).toBeLessThan(57.5);
    await shot(page, testInfo, 'tic-tac-chrono');
    await page.evaluate(() => (window.__tictac.run.timeLeft = 0.05));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 4000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('Temps écoulé');
    w.expectClean();
  });

  test('cadran du jour : la même suite de zones pour tous', async ({ page }) => {
    await open(page);
    await play(page, 'jour');
    const first = await tt(page, 'targets[0].center');
    await page.reload();
    await play(page, 'jour');
    expect(await tt(page, 'targets[0].center')).toBeCloseTo(first, 6);
    await page.waitForTimeout(350);
    await farTarget(page);
    await space(page);
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 4000 });
    await expect(page.locator('.tt-daily')).toContainText('Meilleur score du jour');
    expect((await readStore(page, 'gv:tic-tac')).data.daily.plays).toBe(1);
  });

  test('l’ancienne adresse page2.html redirige vers Tic Tac', async ({ page }) => {
    await page.goto('page2.html');
    await page.waitForURL(/games\/tic-tac\/$/);
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  });
});
