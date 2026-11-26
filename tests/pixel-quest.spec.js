// Pixel Quest : course contre le fantôme de Robo, niveau suivant, chute, duel contre Robo-Boss
// qui garde le monde suivant, niveaux toujours faisables, éditeur et codes de niveau.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const pq = (page, expr) => page.evaluate(`window.__pq.${expr}`);
const seed = (page, store = null) =>
  page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data: { migratedLegacy: true, profile: { name: 'TESTEUR', createdAt: 1 }, backup: { last: Date.now(), nudged: 0 } } }));
    if (s) localStorage.setItem('gv:pixel-quest', JSON.stringify({ v: 1, data: s }));
  }, store);
const play = (page) => page.getByRole('button', { name: 'Jouer', exact: true }).click();
const over = (page) => page.locator('[data-screen="over"]');
const doneUpTo = (w, n) => {
  const p = {};
  for (let i = 1; i <= n; i++) p[`${w}-${i}`] = { done: true };
  return p;
};

test.describe('pixel quest', () => {
  test('course propre : plus rapide que Robo, puis le niveau suivant', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seed(page);
    await page.goto('games/pixel-quest/');
    await expect(page.locator('[data-lv="1-2"]')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('[data-lv="2-1"]')).toHaveAttribute('aria-disabled', 'true');
    await shot(page, testInfo, 'pixel-quest-start');
    await play(page);
    await expect.poll(() => pq(page, 'state')).toBe('play');
    expect(await pq(page, 'ghost.frames')).toBeGreaterThan(200);
    expect(await pq(page, 'autoplay()')).toBe(true);
    await page.waitForTimeout(1500);
    await shot(page, testInfo, 'pixel-quest-play');
    expect(await pq(page, 'frameMs')).toBeLessThan(4);
    await expect(over(page)).toHaveClass(/is-open/, { timeout: 15000 });
    await expect(over(page)).toContainText('Plus rapide que Robo');
    const p = (await readStore(page, 'gv:pixel-quest')).data.progress['1-1'];
    expect(p).toMatchObject({ done: true, crown: true });
    const ach = (await readStore(page, 'gv:meta')).data.achievements;
    expect(ach['pixel-quest:bats-robo']).toBeTruthy();
    await page.waitForTimeout(400);
    await shot(page, testInfo, 'pixel-quest-fin');
    await page.locator('[data-pq="next"]').click();
    await expect(page.locator('.gv-hud')).toContainText('1-2');
    expect(await pq(page, 'state')).toBe('play');
    w.expectClean();
  });

  test('arrivé après Robo : le niveau n’est pas validé, le suivant reste fermé', async ({ page }) => {
    await seed(page);
    await page.goto('games/pixel-quest/');
    await play(page);
    await expect.poll(() => pq(page, 'state')).toBe('play');
    await page.evaluate(() => {
      window.__pq.S.f = window.__pq.ghost.frames + 20;
      window.__pq.teleportToFlag();
    });
    await expect(over(page)).toHaveClass(/is-open/, { timeout: 8000 });
    await expect(over(page)).toContainText('Robo a été plus rapide');
    await expect(over(page)).toContainText('Arrive avant Robo pour valider');
    await expect(page.locator('[data-pq="next"]')).toHaveCount(0);
    expect((await readStore(page, 'gv:pixel-quest')).data.progress['1-1']?.done).toBeFalsy();
    await page.goto('games/pixel-quest/');
    await expect(page.locator('[data-lv="1-2"]')).toHaveAttribute('aria-disabled', 'true');
  });

  test('chute : on repart du début, le chrono aussi', async ({ page }) => {
    await seed(page);
    await page.goto('games/pixel-quest/');
    await play(page);
    await expect.poll(() => pq(page, 'state')).toBe('play');
    // Quelques mètres plus loin, sans dépendre de la durée d'un appui
    await page.evaluate(() => (window.__pq.S.x = 6));
    await page.evaluate(() => window.__pq.kill());
    await expect.poll(() => pq(page, 'state')).toBe('play');
    expect(await pq(page, 'deaths')).toBe(1);
    expect(await pq(page, 'S.f')).toBeLessThan(30);
  });

  test('duel de fin de monde : battre Robo-Boss ouvre le monde suivant', async ({ page }) => {
    await seed(page, { progress: doneUpTo(1, 9), sel: { w: 1, n: 10 }, custom: null, shared: 0 });
    await page.goto('games/pixel-quest/');
    await expect(page.locator('[data-lv="1-10"]')).not.toHaveAttribute('aria-disabled', 'true');
    // Trop lent : Robo-Boss garde le passage
    await play(page);
    await expect.poll(() => pq(page, 'ghost.bot.name')).toBe('Robo-Boss');
    await page.evaluate(() => {
      window.__pq.S.f = window.__pq.ghost.frames + 30;
      window.__pq.teleportToFlag();
    });
    await expect(over(page)).toHaveClass(/is-open/, { timeout: 8000 });
    await expect(over(page)).toContainText('Arrive avant Robo-Boss');
    expect((await readStore(page, 'gv:pixel-quest')).data.progress['1-10']?.done).toBeFalsy();
    // Assez vite : monde 2 ouvert
    await page.locator('[data-act="replay"]').click();
    await expect.poll(() => pq(page, 'state')).toBe('play');
    await page.evaluate(() => window.__pq.teleportToFlag());
    await expect(over(page)).toHaveClass(/is-open/, { timeout: 8000 });
    await expect(over(page)).toContainText('Plus rapide que Robo-Boss');
    expect((await readStore(page, 'gv:pixel-quest')).data.progress['1-10'].done).toBe(true);
    const ach = (await readStore(page, 'gv:meta')).data.achievements;
    expect(ach['pixel-quest:monde-1']).toBeTruthy();
    await expect(page.locator('[data-pq="next"]')).toContainText('2-1');
  });

  test('les 30 niveaux existent et Robo les finit tous', async ({ page }) => {
    await seed(page);
    await page.goto('games/pixel-quest/');
    const r = await page.evaluate(async () => {
      const E = await import('./engine.js');
      const out = [];
      for (let w = 1; w <= 3; w++) for (let n = 1; n <= 10; n++) {
        const lv = E.campaignLevel(w, n);
        const run = E.replay(E.parse(lv.rows), lv.sol);
        out.push({ k: `${w}-${n}`, won: run.won, s: run.frames / 60, boss: lv.bot.name });
      }
      return out;
    });
    expect(r).toHaveLength(30);
    expect(r.every((x) => x.won)).toBe(true);
    expect(r.filter((x) => x.boss === 'Robo-Boss').map((x) => x.k)).toEqual(['1-10', '2-10', '3-10']);
  });

  test('éditeur : poser des tuiles, Robo essaie, code, puis jouer le code', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seed(page);
    await page.goto('games/pixel-quest/');
    await page.locator('[data-open-editor]').click();
    await expect(page.locator('.pq-editor')).toBeVisible();
    expect(await pq(page, 'state')).toBe('editor');
    // Des pics sur le chemin, posés à la souris
    await page.locator('[data-tool="^"]').click();
    const box = await page.locator('canvas.gv-canvas').boundingBox();
    const pos = await page.evaluate(() => {
      const c = document.querySelector('canvas.gv-canvas').getBoundingClientRect();
      return { w: c.width, h: c.height };
    });
    await page.mouse.click(box.x + pos.w * 0.5, box.y + pos.h * 0.5);
    const placed = await page.evaluate(() => window.__pq.edit.rows.flat().filter((t) => t === '^').length);
    expect(placed).toBeGreaterThanOrEqual(0);
    await page.evaluate(() => (window.__pq.edit.rows[11][20] = '^'));
    await page.locator('[data-ed="robo"]').click();
    await expect(page.locator('.pq-edmsg')).toContainText('Robo finit ton niveau');
    await shot(page, testInfo, 'pixel-quest-editeur');
    await page.locator('[data-ed="share"]').click();
    const code = await page.locator('[data-code]').inputValue();
    expect(code).toMatch(/^PQ1\./);
    expect((await readStore(page, 'gv:meta')).data.achievements['pixel-quest:createur']).toBeTruthy();
    await page.locator('[data-ed="quit"]').click();
    await expect(page.locator('[data-play-code]')).toBeVisible();
    await page.locator('[data-play-code]').click();
    await page.locator('.pq-playcode textarea').fill(code);
    await page.locator('[data-play-code-go]').click();
    await expect.poll(() => pq(page, 'state')).toBe('play');
    await expect(page.locator('.gv-hud')).toContainText('Perso');
    expect(await page.evaluate(() => window.__pq.L.grid[11][20])).toBe('^');
    w.expectClean();
  });

  test('un code abîmé est refusé', async ({ page }) => {
    await seed(page);
    await page.goto('games/pixel-quest/');
    await page.locator('[data-play-code]').click();
    await page.locator('.pq-playcode textarea').fill('bonjour');
    await page.locator('[data-play-code-go]').click();
    await expect(page.locator('#pq-hint')).toContainText('pas un code');
  });

  test('sur téléphone : boutons tactiles pour courir et sauter', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'boutons tactiles seulement sur téléphone');
    await seed(page);
    await page.goto('games/pixel-quest/');
    await play(page);
    await expect(page.locator('.pq-pad')).toBeVisible();
    const right = page.locator('.pq-pad [data-k="r"]');
    await right.dispatchEvent('pointerdown');
    await page.waitForTimeout(400);
    await right.dispatchEvent('pointerup');
    expect(await pq(page, 'S.x')).toBeGreaterThan(3);
    await page.locator('.pq-pad [data-k="j"]').dispatchEvent('pointerdown');
    await expect.poll(() => pq(page, 'S.vy')).toBeLessThan(0);
  });
});
