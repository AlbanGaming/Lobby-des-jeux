// Bubble Pop : grappes éclatées au clic, oursin, clavier, tactile, fin de partie, redirection.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const bp = (page, expr) => page.evaluate(`window.__bubble.${expr}`);

async function open(page) {
  await page.goto('games/bubble-pop/?seed=99');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}

// Coordonnées écran de la plus grosse grappe visible
const biggestCluster = (page) =>
  page.evaluate(() => {
    const B = window.__bubble;
    const groups = [...B.groups.values()].filter((g) => g.every((b) => b.y > 80 && b.y < 600));
    const g = groups.sort((a, b) => b.length - a.length)[0];
    if (!g) return null;
    return { ...B.screenOf(g[0]), size: g.length };
  });

test.describe('bubble pop', () => {
  test('démo derrière l’accueil, sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.waitForTimeout(1500);
    expect(await bp(page, 'sim.bubbles.length')).toBeGreaterThan(5);
    await shot(page, testInfo, 'bubble-start');
    w.expectClean();
  });

  test('cliquer une grappe l’éclate en entier, fin de partie, rejouer', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.keyboard.press('Space');
    expect(await bp(page, 'state')).toBe('run');
    await page.waitForTimeout(2500);
    await shot(page, testInfo, 'bubble-run');
    let popped = 0;
    for (let i = 0; i < 6; i++) {
      const c = await biggestCluster(page);
      if (!c) continue;
      const before = await bp(page, 'run.pops');
      await page.mouse.click(c.x, c.y);
      await page.waitForTimeout(50); // le clic est traité à l'image suivante
      const after = await bp(page, 'run.pops');
      // La grappe peut gagner ou perdre une bulle entre la mesure et le clic
      expect(after - before).toBeGreaterThanOrEqual(Math.max(1, c.size - 1));
      popped += after - before;
      await page.waitForTimeout(250);
    }
    expect(popped).toBeGreaterThan(5);
    await page.waitForTimeout(80);
    await shot(page, testInfo, 'bubble-pop');
    expect(await bp(page, 'run.points')).toBeGreaterThan(0);

    // Fin de partie accélérée
    await page.evaluate(() => (window.__bubble.run.timeLeft = 0.3));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await page.waitForTimeout(1000);
    await shot(page, testInfo, 'bubble-over');
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.games['bubble-pop'].best).toBeGreaterThan(0);
    const t0 = Date.now();
    await page.keyboard.press('KeyR');
    await expect(page.locator('[data-screen="over"]')).not.toHaveClass(/is-open/);
    expect(Date.now() - t0).toBeLessThan(1000);
    w.expectClean();
  });

  test('toucher un oursin coûte 5 secondes', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const pos = await page.evaluate(() => {
      const B = window.__bubble;
      B.sim.bubbles.length = 0; // oursin seul : le clic ne peut pas toucher une voisine
      B.sim.bubbles.push({ id: 9999, kind: 'urchin', color: -1, x: 200, y: 360, r: 22, vx: 0, vy: 0, rise: 0, phase: 0, grow: 1, alive: true, popping: false, cluster: 0 });
      return B.screenOf({ x: 200, y: 360 });
    });
    const before = await bp(page, 'run.timeLeft');
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(50);
    const after = await bp(page, 'run.timeLeft');
    expect(before - after).toBeGreaterThan(4.5);
  });

  test('jouable au clavier : viseur et Espace', async ({ page }) => {
    const w = watchPage(page);
    await open(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    // Les flèches déplacent le viseur et le rendent visible
    const x0 = await bp(page, 'cursor.x');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(250);
    await page.keyboard.up('ArrowLeft');
    expect(await bp(page, 'cursor.x')).toBeLessThan(x0 - 50);
    expect(await bp(page, 'cursor.visible')).toBe(true);
    // Viseur posé sur une bulle : Espace l'éclate
    await page.evaluate(() => {
      const B = window.__bubble;
      const b = B.sim.bubbles.find((x) => x.alive && !x.popping && x.kind === 'color' && x.y > 200 && x.y < 560);
      B.cursor.x = b.x;
      B.cursor.y = b.y;
    });
    const before = await bp(page, 'run.pops');
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);
    expect(await bp(page, 'run.pops')).toBeGreaterThan(before);
    w.expectClean();
  });

  test('tactile : un tap éclate une grappe', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'test tactile');
    await open(page);
    await page.getByRole('button', { name: 'Jouer' }).tap();
    await page.waitForTimeout(2000);
    const c = await biggestCluster(page);
    const before = await bp(page, 'run.pops');
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForTimeout(50);
    expect((await bp(page, 'run.pops')) - before).toBeGreaterThanOrEqual(Math.max(1, c.size - 1));
    await shot(page, testInfo, 'bubble-touch');
  });

  test('budget par image tenu', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Space');
    await page.evaluate(() => (window.__bubble.run.elapsed = 50)); // fin de partie : le plus chargé
    await page.waitForTimeout(2500);
    expect(await bp(page, 'frameMs')).toBeLessThan(8);
  });

  test('l’ancienne adresse page5.html redirige vers Bubble Pop', async ({ page }) => {
    await page.goto('page5.html');
    await page.waitForURL(/games\/bubble-pop\/$/);
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  });
});
