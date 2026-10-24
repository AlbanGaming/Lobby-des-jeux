// Plume : jouable (pilote côté test), chapitres, fin de partie, rejouer, migration du record, redirection.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const pl = (page, expr) => page.evaluate(`window.__plume.${expr}`);

async function open(page, query = '?seed=777') {
  await page.goto(`games/plume/${query}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}

// Joue « comme un humain », dans la page (une décision par image, sans latence du test) :
// de vrais évènements clavier Espace quand l'oiseau descend sous le centre de l'ouverture.
async function fly(page, ms) {
  await page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const t0 = performance.now();
        const key = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }));
        let held = false;
        const tick = () => {
          const p = window.__plume;
          if (p.state !== 'run' || performance.now() - t0 > duration) {
            if (held) key('keyup');
            return resolve();
          }
          const b = p.bird;
          const g = p.world.gates.find((x) => x.x + x.w > b.x - 13);
          const target = g ? g.gap : 280;
          if (held) {
            key('keyup');
            held = false;
          } else if (b.y > target + 6 && b.vy > -80) {
            key('keydown');
            held = true;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

test.describe('plume', () => {
  test('démo derrière l’accueil, sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    expect(await pl(page, 'state')).toBe('attract');
    await page.waitForTimeout(600);
    await shot(page, testInfo, 'plume-start');
    w.expectClean();
  });

  test('partie jouée, falaises franchies, fin et rejouer', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.keyboard.press('Space');
    expect(await pl(page, 'state')).toBe('run');
    await fly(page, 7000);
    const gates = await pl(page, 'run.gates');
    expect(gates).toBeGreaterThan(1);
    await shot(page, testInfo, 'plume-run');

    // Pause / reprise
    if ((await pl(page, 'state')) === 'run') {
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-screen="pause"]')).toHaveClass(/is-open/);
      await page.keyboard.press('Escape');
    }
    // On arrête de voler : chute et fin de partie
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 8000 });
    await page.waitForTimeout(1000);
    await shot(page, testInfo, 'plume-over');
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.games.plume.plays).toBe(1);
    expect(meta.games.plume.best).toBeGreaterThan(0);
    expect(meta.achievements['plume:envol'] !== undefined || gates < 10).toBe(true);

    const t0 = Date.now();
    await page.keyboard.press('KeyR');
    await expect(page.locator('[data-screen="over"]')).not.toHaveClass(/is-open/);
    expect(Date.now() - t0).toBeLessThan(1000);
    w.expectClean();
  });

  test('les quatre chapitres s’affichent (forêt, nuit, tempête)', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.keyboard.press('Space');
    await pl(page, 'immortal(true)');
    await fly(page, 2600); // amène les premières falaises à l'écran
    for (const [i, name] of [[1, 'foret'], [2, 'nuit'], [3, 'tempete']]) {
      await pl(page, `chapter(${i})`);
      // Les falaises à l'écran prennent les couleurs (et le danger) du chapitre demandé
      await page.evaluate((c) => window.__plume.world.gates.forEach((g) => (g.chapter = c)), i);
      if (name === 'tempete') await page.evaluate(() => { const w = window.__plume.world; const g = w.gates[1]; w.winds.push({ x0: g.x + g.w + 40, x1: g.x + 260, force: -600 }); });
      await fly(page, 500);
      await shot(page, testInfo, `plume-${name}`);
    }
    expect(await pl(page, 'state')).toBe('run');
    w.expectClean();
  });

  test('tap au tactile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'test tactile');
    await open(page);
    await page.getByRole('button', { name: 'Jouer' }).tap();
    await page.waitForTimeout(400);
    const box = await page.locator('#stage').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(30);
    expect(await pl(page, 'bird.vy')).toBeLessThan(0);
  });

  test('l’ancien record Flappy est repris à la nouvelle échelle (×10)', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('flappyBestScore', '31');
    });
    await open(page);
    expect((await readStore(page, 'gv:meta')).data.games.plume.best).toBe(310);
    await expect(page.locator('.gv-start-best')).toContainText('310');
    // Un second chargement ne reconvertit pas
    await page.reload();
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
    expect((await readStore(page, 'gv:meta')).data.games.plume.best).toBe(310);
  });

  test('budget par image tenu', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Space');
    await pl(page, 'chapter(2)'); // la nuit : dégradés et lumières, le plus coûteux
    await page.waitForTimeout(1200);
    expect(await pl(page, 'frameMs')).toBeLessThan(8);
  });

  test('l’ancienne adresse page7.html redirige vers Plume', async ({ page }) => {
    await page.goto('page7.html');
    await page.waitForURL(/games\/plume\/$/);
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  });
});
