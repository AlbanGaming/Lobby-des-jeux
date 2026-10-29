// Conquête : glisser pour envoyer, prise d'une base, toucher-toucher, part envoyée, clavier,
// victoire et étoiles, défaite, modes verrouillés, escarmouche, carte du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const cq = (page, expr) => page.evaluate(`window.__cq.${expr}`);

async function open(page, q = '?fast=1') {
  await page.goto(`games/conquete/${q}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'campagne') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
  await expect.poll(() => cq(page, 'state')).toBe('run');
}
// La base neutre la plus proche de la capitale et sa position dans la page
const PAGE = `const r = document.querySelector('canvas.gv-canvas').getBoundingClientRect(); const pg = (b) => { const p = window.__cq.toScreen(b.x, b.y); return { x: p.x + r.left, y: p.y + r.top }; };`;
const weakest = (page) =>
  page.evaluate(`(() => { ${PAGE} const b = window.__cq.world.bases.filter((x) => !x.owner).sort((a, c) => Math.hypot(a.x - window.__cq.world.bases[0].x, a.y - window.__cq.world.bases[0].y) - Math.hypot(c.x - window.__cq.world.bases[0].x, c.y - window.__cq.world.bases[0].y))[0]; return { id: b.id, troops: b.troops, ...pg(b) }; })()`);
const capital = (page) => page.evaluate(`(() => { ${PAGE} const b = window.__cq.world.bases[0]; return { troops: b.troops, ...pg(b) }; })()`);
const seed = (page, data) =>
  page.addInitScript((d) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gv:conquete', JSON.stringify({ v: 1, data: d }));
  }, data);

test.describe('conquête', () => {
  test('accueil sans erreur, la démo tourne derrière', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await expect.poll(() => cq(page, 'world.fleets.length'), { timeout: 8000 }).toBeGreaterThan(0);
    await shot(page, testInfo, 'conquete-start');
    w.expectClean();
  });

  test('glisser envoie une flotte, qui prend la base', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    const a = await capital(page);
    const t = await weakest(page);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + t.x) / 2, (a.y + t.y) / 2, { steps: 4 });
    await page.mouse.move(t.x, t.y, { steps: 4 });
    await shot(page, testInfo, 'conquete-drag');
    await page.mouse.up();
    const fleets = await cq(page, 'world.fleets.filter((f) => f.owner === 1)');
    expect(fleets).toHaveLength(1);
    expect(fleets[0].to).toBe(t.id);
    expect(fleets[0].n).toBeGreaterThanOrEqual(Math.floor(a.troops * 0.5) - 1);
    await page.waitForTimeout(300);
    await shot(page, testInfo, 'conquete-fleet');
    // Assez de troupes ? 100 % pour être sûr, puis on laisse le temps passer
    if (fleets[0].n <= t.troops) {
      await page.locator('[data-pct="1"]').click();
      await page.evaluate((id) => window.__cq.order([0], id), t.id);
    }
    await page.evaluate(() => window.__cq.advance(12));
    expect(await cq(page, `world.bases[${t.id}].owner`)).toBe(1);
    expect(await cq(page, 'run.captures')).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.gv-hud')).toContainText(/2\/9|3\/9/);
    w.expectClean();
  });

  test('toucher une base puis la cible, avec 100 %', async ({ page }) => {
    await open(page);
    await play(page);
    await page.locator('[data-pct="1"]').click();
    expect((await readStore(page, 'gv:conquete')).data.pct).toBe(1);
    const a = await capital(page);
    const t = await weakest(page);
    await page.mouse.click(a.x, a.y);
    expect(await cq(page, 'selected')).toEqual([0]);
    await page.mouse.click(t.x, t.y);
    const f = await cq(page, 'world.fleets.find((f) => f.owner === 1)');
    expect(f.n).toBeGreaterThanOrEqual(Math.floor(a.troops) - 1);
    expect(await cq(page, 'world.bases[0].troops')).toBeLessThan(2);
    expect(await cq(page, 'selected')).toEqual([]);
  });

  test('au clavier : A, flèches et Entrée', async ({ page }) => {
    await open(page);
    await play(page);
    await page.keyboard.press('2');
    await page.keyboard.press('a');
    expect(await cq(page, 'selected')).toEqual([0]);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect.poll(() => cq(page, 'world.fleets.filter((f) => f.owner === 1).length')).toBe(1);
  });

  test('victoire : étoiles et niveau suivant', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    await page.evaluate(() => window.__cq.conquer());
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 6000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('Niveau 2 débloqué');
    await expect(page.locator('.cq-stars .is-on')).toHaveCount(3);
    await page.waitForTimeout(700);
    await shot(page, testInfo, 'conquete-over');
    const data = (await readStore(page, 'gv:conquete')).data;
    expect(data.stars[0]).toBe(3);
    expect(data.level).toBe(1);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['conquete:premiere']).toBeTruthy();
    expect(meta.achievements['conquete:blitz']).toBeTruthy();
    w.expectClean();
  });

  test('défaite : tes bases sont tombées', async ({ page }) => {
    await open(page);
    await play(page);
    await page.evaluate(() => window.__cq.surrender());
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 6000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('tombées');
    expect((await readStore(page, 'gv:conquete')).data.stars).toEqual([]);
  });

  test('escarmouche verrouillée, puis ouverte avec ses adversaires', async ({ page }, testInfo) => {
    await open(page);
    await expect(page.locator('[data-mode="escarmouche"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-mode="escarmouche"]').click({ force: true });
    await expect(page.locator('#cq-hint')).toContainText('niveau 3');
    await page.evaluate(() => sessionStorage.removeItem('seeded'));
    await seed(page, { mode: 'escarmouche', level: 3, stars: [3, 2, 1], sk: { ais: 3, skill: 1 }, pct: 0.5, wins: 3, captures: 20, daily: { day: '', won: false, best: 0, plays: 0 } });
    await page.reload();
    await expect(page.locator('[data-mode="escarmouche"]')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('[data-skill="2"]')).toHaveAttribute('aria-disabled', 'true');
    await play(page, 'escarmouche');
    expect(await cq(page, 'world.players.length')).toBe(4);
    await page.evaluate(() => window.__cq.advance(6));
    await page.waitForTimeout(300);
    await shot(page, testInfo, 'conquete-melee');
  });

  test('carte du jour : la même pour tous', async ({ page }) => {
    await open(page);
    await play(page, 'jour');
    const map = await cq(page, 'world.bases.map((b) => [Math.round(b.x), Math.round(b.y), b.size].join()).join(";")');
    expect(await cq(page, 'world.players.length')).toBe(3);
    await page.reload();
    await play(page, 'jour');
    expect(await cq(page, 'world.bases.map((b) => [Math.round(b.x), Math.round(b.y), b.size].join()).join(";")')).toBe(map);
  });

  test('fluide : la simulation coûte peu par image', async ({ page }) => {
    await open(page);
    await play(page);
    await page.waitForTimeout(1500);
    expect(await cq(page, 'frameMs')).toBeLessThan(4);
  });
});
