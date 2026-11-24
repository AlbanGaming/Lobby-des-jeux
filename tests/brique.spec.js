// Brique-à-brac (jeu secret) : verrouillé sans achat, acheté depuis le lobby, puis la partie :
// le pilote casse des briques, murs symétriques et reproductibles, bonus, niveau suivant,
// raquette à la souris et au clavier, fin de partie quand les balles sont perdues.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const bq = (page, expr) => page.evaluate(`window.__bq.${expr}`);
const seedMeta = (page, data) =>
  page.addInitScript((d) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data: { migratedLegacy: true, profile: { name: 'TESTEUR', createdAt: 1 }, backup: { last: Date.now(), nudged: 0 }, ...d } }));
  }, data);
const unlocked = (page) => seedMeta(page, { credits: 0, owned: ['game:brique'] });

async function play(page, modeId = 'classique') {
  await page.goto('games/brique/');
  await page.evaluate(() => document.fonts.ready);
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect.poll(() => bq(page, 'state')).toBe('run');
}

test.describe('brique-à-brac', () => {
  test('sans achat : écran verrouillé qui mène à la boutique', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page, { credits: 0 });
    await page.goto('games/brique/');
    await expect(page.locator('.gv-locked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jouer' })).toHaveCount(0);
    await expect(page.locator('.gv-locked a').first()).toHaveAttribute('href', /#boutique$/);
    await shot(page, testInfo, 'brique-verrou');
    w.expectClean();
  });

  test('acheté à la boutique avec Serpentin déjà à soi : Mécène, jeu ouvert', async ({ page }) => {
    const w = watchPage(page);
    await seedMeta(page, { credits: 600, owned: ['game:serpentin'] });
    await page.goto('./');
    const card = page.locator('#grid .gcard[data-id="brique"]');
    await expect(card).toHaveClass(/is-locked/);
    await card.locator('.gcard__link').click();
    await expect(page.locator('#stab-jeux')).toHaveAttribute('aria-selected', 'true');
    await page.locator('[data-buy-game="brique"]').click();
    await page.locator('#confirmYes').click();
    const d = (await readStore(page, 'gv:meta')).data;
    expect(d.owned).toContain('game:brique');
    expect(d.credits).toBeLessThan(600 - 450 + 200);
    expect(d.achievements['global:mecene']).toBeTruthy();
    await page.locator('#dlgShop [data-close]').click();
    await expect(card).not.toHaveClass(/is-locked/);
    w.expectClean();
  });

  test('le pilote casse des briques et marque des points', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await unlocked(page);
    await play(page);
    const start = await bq(page, 'bricks.length');
    await page.evaluate(() => (window.__bq.autoplay = true));
    await expect.poll(() => bq(page, 'run.bricks'), { timeout: 20000 }).toBeGreaterThanOrEqual(6);
    expect(await bq(page, 'bricks.length')).toBeLessThan(start);
    expect(await bq(page, 'run.score')).toBeGreaterThan(50);
    expect(await bq(page, 'frameMs')).toBeLessThan(4);
    await shot(page, testInfo, 'brique-play');
    w.expectClean();
  });

  test('murs symétriques, les mêmes pour une même graine', async ({ page }) => {
    await unlocked(page);
    await page.goto('games/brique/');
    for (const n of [1, 2, 4, 7]) {
      const a = await page.evaluate((k) => window.__bq.layout(k, 4242), n);
      const b = await page.evaluate((k) => window.__bq.layout(k, 4242), n);
      expect(a).toEqual(b);
      const set = new Set(a);
      for (const s of a) {
        const [c, r, t] = s.split(',');
        expect(set.has(`${9 - Number(c)},${r},${t}`)).toBe(true);
      }
      expect(a.filter((s) => !s.endsWith('metal')).length).toBeGreaterThanOrEqual(10);
    }
    expect(await page.evaluate(() => window.__bq.layout(3, 1))).not.toEqual(await page.evaluate(() => window.__bq.layout(3, 2)));
  });

  test('raquette à la souris et au clavier, lancer au clic', async ({ page }) => {
    await unlocked(page);
    await play(page);
    const box = await page.locator('canvas.gv-canvas').boundingBox();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
    await expect.poll(() => bq(page, 'paddle.x')).toBeLessThan(150);
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
    await expect.poll(() => bq(page, 'paddle.x')).toBeGreaterThan(210);
    expect(await bq(page, 'balls[0].stuck')).toBe(true);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => bq(page, 'balls[0].stuck')).toBe(false);
    const x0 = await bq(page, 'paddle.x');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(250);
    await page.keyboard.up('ArrowLeft');
    expect(await bq(page, 'paddle.x')).toBeLessThan(x0 - 40);
  });

  test('bonus : raquette large, multi-balle, vie en plus', async ({ page }) => {
    await unlocked(page);
    await play(page);
    await page.evaluate(() => window.__bq.dropBonus('large'));
    await expect.poll(() => bq(page, 'active.large')).toBeGreaterThan(0);
    await expect.poll(() => bq(page, 'paddle.w')).toBeGreaterThan(90);
    await page.evaluate(() => window.__bq.launch());
    await page.evaluate(() => window.__bq.dropBonus('multi'));
    await expect.poll(() => bq(page, 'balls.length')).toBe(3);
    await page.evaluate(() => window.__bq.dropBonus('vie'));
    await expect.poll(() => bq(page, 'run.lives')).toBe(4);
    const saved = (await readStore(page, 'gv:brique')).data.bonuses;
    expect(saved).toEqual(expect.arrayContaining(['large', 'multi', 'vie']));
  });

  test('mur vidé : niveau suivant avec un bonus de points', async ({ page }, testInfo) => {
    await unlocked(page);
    await play(page);
    await page.evaluate(() => {
      window.__bq.clearWall();
      window.__bq.autoplay = true;
    });
    await expect.poll(() => bq(page, 'level'), { timeout: 15000 }).toBe(2);
    expect(await bq(page, 'run.score')).toBeGreaterThanOrEqual(100);
    expect(await bq(page, 'bricks.length')).toBeGreaterThan(10);
    const ach = (await readStore(page, 'gv:meta')).data.achievements;
    expect(ach['brique:parfait']).toBeTruthy();
    await page.waitForTimeout(300);
    await shot(page, testInfo, 'brique-niveau-2');
  });

  test('trois balles perdues : fin de partie, puis rejouer', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await unlocked(page);
    await play(page);
    for (let i = 3; i > 0; i--) {
      await expect.poll(() => bq(page, 'balls.length')).toBe(1);
      await page.evaluate(() => window.__bq.dropBall());
      await expect.poll(() => bq(page, 'run.lives')).toBe(i - 1);
    }
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 8000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('échappé');
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'brique-over');
    await page.locator('[data-act="replay"]').click();
    await expect.poll(() => bq(page, 'run.lives')).toBe(3);
    w.expectClean();
  });

  test('mode turbo verrouillé tant qu’on n’a pas 3 000 points', async ({ page }) => {
    await unlocked(page);
    await page.goto('games/brique/');
    await page.locator('[data-mode="turbo"]').click({ force: true });
    await expect(page.locator('#bq-hint')).toContainText('3');
    await expect(page.locator('[data-mode="classique"]')).toHaveAttribute('aria-checked', 'true');
  });
});
