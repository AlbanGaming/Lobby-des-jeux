// Survivants néon : le pilote survit et tue, choix de niveau, évolution, le Directeur (IA) qui
// repère ta direction de fuite et adapte son plan, le boss final, la défaite, les éclats.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const sv = (page, expr) => page.evaluate(`window.__sv.${expr}`);
const seed = (page, store = null) =>
  page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data: { migratedLegacy: true, profile: { name: 'TESTEUR', createdAt: 1 }, backup: { last: Date.now(), nudged: 0 } } }));
    if (s) localStorage.setItem('gv:survivants', JSON.stringify({ v: 1, data: s }));
  }, store);

async function play(page) {
  await page.goto('games/survivants/?seed=11');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect.poll(() => sv(page, 'state')).toBe('run');
}

test.describe('survivants néon', () => {
  test('accueil : héros verrouillés, améliorations, puis le pilote tient et élimine', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seed(page);
    await page.goto('games/survivants/?seed=11');
    await expect(page.locator('[data-hero="volt"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-hero="spectre"]')).toHaveAttribute('aria-disabled', 'true');
    await shot(page, testInfo, 'survivants-start');
    await page.getByRole('button', { name: 'Jouer' }).click();
    await expect.poll(() => sv(page, 'state')).toBe('run');
    await page.evaluate(() => (window.__sv.autoplay = true));
    await expect.poll(() => sv(page, 'run.kills'), { timeout: 25000 }).toBeGreaterThanOrEqual(12);
    expect(await sv(page, 'player.hp')).toBeGreaterThan(0);
    expect(await sv(page, 'frameMs')).toBeLessThan(6);
    await expect(page.locator('.gv-hud')).toContainText('0:');
    await shot(page, testInfo, 'survivants-play');
    w.expectClean();
  });

  test('niveau gagné : trois choix, touche 1, la partie reprend', async ({ page }, testInfo) => {
    await seed(page);
    await play(page);
    await page.evaluate(() => window.__sv.xp(12));
    await expect(page.locator('.sv-pick')).toBeVisible();
    await expect(page.locator('.sv-card')).toHaveCount(3);
    expect(await sv(page, 'state')).toBe('pick');
    await page.waitForTimeout(300);
    await shot(page, testInfo, 'survivants-choix');
    const before = await page.evaluate(() => Object.keys(window.__sv.weapons).length + Object.keys(window.__sv.passives).length + Object.values(window.__sv.weapons).reduce((s, w) => s + w.lv, 0));
    await page.keyboard.press('1');
    await expect(page.locator('.sv-pick')).toBeHidden();
    expect(await sv(page, 'state')).toBe('run');
    const after = await page.evaluate(() => Object.keys(window.__sv.weapons).length + Object.keys(window.__sv.passives).length + Object.values(window.__sv.weapons).reduce((s, w) => s + w.lv, 0));
    expect(after).toBeGreaterThan(before);
  });

  test('arme au niveau 5 + son talent : l’évolution est proposée en premier', async ({ page }) => {
    await seed(page);
    await play(page);
    await page.evaluate(() => {
      window.__sv.give('eclair', 5);
      window.__sv.givePassive('cadence', 1);
      window.__sv.xp(12);
    });
    await expect(page.locator('.sv-card.is-evo')).toHaveCount(1);
    await expect(page.locator('.sv-card').first()).toContainText('Tempête');
    await page.locator('.sv-card.is-evo').click();
    expect(await sv(page, 'weapons.eclair.evolved')).toBe(true);
    const ach = (await readStore(page, 'gv:meta')).data.achievements;
    expect(ach['survivants:evolution']).toBeTruthy();
  });

  test('le Directeur repère où tu fuis, adapte son plan et te le dit', async ({ page }) => {
    await seed(page);
    await play(page);
    const r = await page.evaluate(() => {
      const s = window.__sv;
      s.setTime(90);
      for (let k = 0; k < 30; k++) s.flee(1, 0, 1); // vers l'est pendant 30 s
      s.setTime(140);
      s.give('onde', 4);
      s.give('orbe', 3);
      s.flee(1, 0, 1);
      return { bias: s.ai.bias, plan: s.ai.plan, msg: s.ai.msg, said: [...s.ai.said] };
    });
    expect(r.bias).toBe(0);
    expect(r.plan).toBe('blindés');
    expect(r.said).toContain('fuite-0');
    expect(r.said.join(' ') + r.msg).toMatch(/est|blindage/);
  });

  test('bats le Directeur : victoire, héros Spectre débloqué', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seed(page);
    await play(page);
    await page.evaluate(() => {
      window.__sv.autoplay = true;
      window.__sv.setTime(600);
      window.__sv.give('eclair', 5);
    });
    await expect.poll(() => page.evaluate(() => window.__sv.enemies.some((e) => e.type === 'directeur'))).toBe(true);
    await page.waitForTimeout(600);
    await shot(page, testInfo, 'survivants-directeur');
    await page.evaluate(() => window.__sv.killBoss());
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 15000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('battu le Directeur');
    const s = (await readStore(page, 'gv:survivants')).data;
    expect(s.wins).toBe(1);
    expect(s.shards).toBeGreaterThan(100);
    const ach = (await readStore(page, 'gv:meta')).data.achievements;
    expect(ach['survivants:victoire']).toBeTruthy();
    await page.waitForTimeout(400);
    await shot(page, testInfo, 'survivants-victoire');
    await page.locator('[data-act="replay"]').click();
    await expect.poll(() => sv(page, 'state')).toBe('run');
    w.expectClean();
  });

  test('défaite : fin de partie, éclats gagnés, rejouer', async ({ page }) => {
    await seed(page);
    await play(page);
    await page.evaluate(() => window.__sv.hurt(999));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 8000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('Submergé');
    await expect(page.locator('[data-screen="over"]')).toContainText('Éclats');
  });

  test('améliorations permanentes achetées avec les éclats', async ({ page }) => {
    await seed(page, { hero: 'volt', shards: 100, up: { force: 0, vie: 0, pas: 0, attrait: 0, relance: 0 }, bestTime: 320, totalKills: 0, wins: 0, evolved: [] });
    await page.goto('games/survivants/');
    // 5 minutes tenues : Nova est ouverte
    await expect(page.locator('[data-hero="nova"]')).not.toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-hero="nova"]').click();
    await page.locator('[data-up="vie"]').click();
    const s = (await readStore(page, 'gv:survivants')).data;
    expect(s.up.vie).toBe(1);
    expect(s.shards).toBe(75);
    expect(s.hero).toBe('nova');
    await page.locator('[data-hero="spectre"]').click({ force: true });
    await expect(page.locator('#sv-hint')).toContainText('Directeur');
    await page.getByRole('button', { name: 'Jouer' }).click();
    expect(await sv(page, 'player.max')).toBe(140);
    expect(await sv(page, 'weapons.onde.lv')).toBe(1);
  });
});
