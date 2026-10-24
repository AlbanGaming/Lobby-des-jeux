// Volt Rush : jouable au clavier et au tactile, fin de partie, rejouer, redirection, méta.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const vr = (page, expr) => page.evaluate(`window.__voltRush.${expr}`);

async function open(page, query = '?seed=1234') {
  await page.goto(`games/volt-rush/${query}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}

test.describe('volt rush', () => {
  test('mode démo derrière l’accueil, sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    expect(await vr(page, 'state')).toBe('attract');
    const x0 = await vr(page, 'player.x');
    await page.waitForTimeout(700);
    expect(await vr(page, 'player.x')).toBeGreaterThan(x0 + 100);
    await shot(page, testInfo, 'volt-start');
    w.expectClean();
  });

  test('partie complète au clavier, fin, rejouer en moins d’une seconde', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.keyboard.press('Space');
    await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
    expect(await vr(page, 'state')).toBe('run');
    // Pas de saut parasite avec la touche qui lance la partie
    expect(await vr(page, 'player.onGround')).toBe(true);

    // On saute régulièrement un moment
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(260);
      await page.keyboard.down('Space');
      await page.waitForTimeout(90);
      await page.keyboard.up('Space');
    }
    expect(await vr(page, 'run.meters')).toBeGreaterThan(20);
    expect(Number((await page.locator('[data-hud="score"] .gv-hud__value').textContent()).replace(/\D/g, ''))).toBeGreaterThan(0);
    await shot(page, testInfo, 'volt-run');

    // Surcharge forcée pour vérifier l'effet (si Volt court encore : sous forte charge, il a pu tomber)
    const surged = (await vr(page, 'state')) === 'run';
    if (surged) {
      await vr(page, 'surge()');
      await page.waitForTimeout(400);
      expect(await vr(page, 'run.surgeT')).toBeGreaterThan(0);
      await shot(page, testInfo, 'volt-surge');
    }

    // Pause et reprise (si Volt est encore en course : sous forte charge, il a pu tomber)
    if ((await vr(page, 'state')) === 'run') {
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-screen="pause"]')).toHaveClass(/is-open/);
      const xp = await vr(page, 'player.x');
      await page.waitForTimeout(300);
      expect(await vr(page, 'player.x')).toBe(xp);
      await page.keyboard.press('Escape');
    }

    // Sans sauter, Volt finit par tomber ou heurter un obstacle
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 20000 });
    await page.waitForTimeout(1000);
    await shot(page, testInfo, 'volt-over');
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.games['volt-rush'].plays).toBe(1);
    expect(meta.games['volt-rush'].best).toBeGreaterThan(0);
    if (surged) expect(meta.achievements['volt-rush:survolte']).toBeTruthy();

    const t0 = Date.now();
    await page.keyboard.press('KeyR');
    await expect(page.locator('[data-screen="over"]')).not.toHaveClass(/is-open/);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(await vr(page, 'state')).toBe('run');
    w.expectClean();
  });

  test('tactile : un tap fait sauter, un balayage vers le bas fait glisser', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'test tactile');
    const w = watchPage(page);
    await open(page);
    await page.getByRole('button', { name: 'Jouer' }).tap();
    await page.waitForTimeout(250);
    const box = await page.locator('#stage').boundingBox();
    // Balayage vers le bas (évènements pointeur tactiles) : le tap initial devient une glissade
    await page.evaluate(({ x, y }) => {
      const el = document.getElementById('stage');
      const ev = (type, yy) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: yy, bubbles: true, isPrimary: true }));
      ev('pointerdown', y);
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y + 30, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y + 80, bubbles: true }));
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await page.waitForTimeout(80);
    expect(await vr(page, 'player.sliding')).toBe(true);
    expect(await vr(page, 'player.onGround')).toBe(true);
    await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })), { x: box.x + box.width / 2, y: box.y + box.height / 2 + 80 });
    await page.waitForTimeout(300);
    expect(await vr(page, 'state')).toBe('run');
    // Un tap simple fait sauter
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(60);
    expect(await vr(page, 'player.onGround')).toBe(false);
    await shot(page, testInfo, 'volt-touch');
    w.expectClean();
  });

  test('budget par image tenu (< 8 ms en moyenne, soit la moitié des 16,7 ms à 60 i/s)', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Space');
    await vr(page, 'surge()'); // le cas le plus chargé : particules et effets de Surcharge
    await page.waitForTimeout(1500);
    const ms = await vr(page, 'frameMs');
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(8);
  });

  test('l’ancienne adresse page6.html redirige vers le jeu', async ({ page }) => {
    await page.goto('page6.html');
    await page.waitForURL(/games\/volt-rush\/$/);
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  });

  test('le lobby envoie vers la nouvelle version', async ({ page }) => {
    await page.goto('./');
    const card = page.locator('#grid .gcard[data-id="volt-rush"]');
    await expect(card.locator('.gcard__link')).toHaveAttribute('href', 'games/volt-rush/');
    await expect(card).not.toContainText('ancienne version');
  });
});
