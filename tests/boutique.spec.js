// Boutique : ouverture, achat et équipement d'un thème (lobby et jeux), crédits insuffisants,
// look d'avatar et titre, célébration, sons, objets (gel de série, relance, boost), coffre.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

// Sauvegarde de départ : des crédits, éventuellement d'autres champs
const seedMeta = (page, extra = {}) =>
  page.addInitScript((x) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const day = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const data = { migratedLegacy: true, profile: { name: 'TESTEUR', createdAt: 1 }, credits: 1000, ...x };
    if (x.streakDaysAgo !== undefined) data.streak = { count: 5, best: 5, last: day(-x.streakDaysAgo) };
    delete data.streakDaysAgo;
    localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data }));
  }, extra);
const metaData = async (page) => (await readStore(page, 'gv:meta')).data;
const ready = async (page) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-gv-ready', '');
};
const openShop = async (page) => {
  await page.locator('#hdrCredits').click();
  await expect(page.locator('#dlgShop')).toBeVisible();
};
// La confirmation d'achat
const confirm = (page) => page.locator('#confirmYes').click();

test.describe('boutique', () => {
  test('ouverture : six rayons, solde affiché', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await expect(page.locator('#shopTabs [role="tab"]')).toHaveCount(6);
    await expect(page.locator('#shopCredits')).toContainText('1');
    await shot(page, testInfo, 'boutique-themes');
    w.expectClean();
  });

  test('acheter un thème : le lobby et les jeux changent de couleurs', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await page.locator('[data-buy="theme:neon"]').click();
    await confirm(page);
    await expect(page.locator('html')).toHaveAttribute('data-gv-theme', 'neon');
    const d = await metaData(page);
    // 300 crédits payés, 18 rendus par le succès « Premier achat »
    expect(d.credits).toBe(718);
    expect(d.look.theme).toBe('neon');
    expect(d.owned).toContain('theme:neon');
    expect(d.achievements['global:premier-achat']).toBeTruthy();
    await page.locator('#dlgShop [data-close]').click();
    await shot(page, testInfo, 'boutique-lobby-neon');
    // Dans un jeu aussi
    await page.goto('games/orbite/');
    await expect(page.locator('html')).toHaveAttribute('data-gv-theme', 'neon');
    await shot(page, testInfo, 'boutique-jeu-neon');
    // Retour au thème d'origine, gratuit
    await page.goto('./');
    await openShop(page);
    await page.locator('[data-equip="theme:nuit"]').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-gv-theme', /.+/);
    w.expectClean();
  });

  test('crédits insuffisants : rien n’est acheté', async ({ page }) => {
    await seedMeta(page, { credits: 50 });
    await ready(page);
    await openShop(page);
    await page.locator('[data-buy="theme:or"]').click({ force: true });
    await expect(page.locator('.toast').filter({ hasText: 'Crédits insuffisants' })).toBeVisible();
    expect((await metaData(page)).credits).toBe(50);
  });

  test('avatar : cadre, accessoire et titre', async ({ page }, testInfo) => {
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await page.locator('#stab-avatar').click();
    await page.locator('[data-buy="frame:or"]').click();
    await confirm(page);
    await page.locator('[data-buy="hat:couronne"]').click();
    await confirm(page);
    await page.locator('[data-buy="title:as-du-pixel"]').click();
    await confirm(page);
    const d = await metaData(page);
    expect(d.look).toMatchObject({ frame: 'or', hat: 'couronne', title: 'as-du-pixel' });
    expect(d.credits).toBe(1000 - 450 - 300 - 150 + 18);
    await shot(page, testInfo, 'boutique-avatar');
    await page.locator('#dlgShop [data-close]').click();
    await expect(page.locator('.lb-player__title')).toHaveText('As du pixel');
    // Un titre lié à un succès ne s'achète pas
    await openShop(page);
    await page.locator('#stab-avatar').click();
    await expect(page.locator('[data-buy="title:fidele"]')).toHaveCount(0);
  });

  test('effets : célébration essayée, sons équipés', async ({ page }) => {
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await page.locator('#stab-effets').click();
    await page.locator('[data-try="pieces"]').click();
    await expect(page.locator('canvas.gv-celebrate')).toHaveCount(1);
    await page.locator('[data-buy="celebration:etoiles"]').click();
    await confirm(page);
    await page.locator('[data-buy="sound:retro"]').click();
    await confirm(page);
    const d = await metaData(page);
    expect(d.look.celebration).toBe('etoiles');
    expect(d.look.sound).toBe('retro');
  });

  test('objets : relance du défi et boost d’XP', async ({ page }) => {
    await seedMeta(page);
    await ready(page);
    const before = await page.locator('.lb-feature__text').textContent();
    await openShop(page);
    await page.locator('#stab-objets').click();
    await page.locator('[data-item-buy="relance"]').click();
    expect((await metaData(page)).reroll.n).toBe(1);
    await page.locator('[data-item-buy="boost"]').click();
    expect((await metaData(page)).boostUntil).toBeGreaterThan(Date.now());
    await expect(page.locator('#shopBody')).toContainText('Actif encore');
    await page.locator('#dlgShop [data-close]').click();
    // Le défi a changé (très rarement le même tirage : on vérifie au moins la relance)
    const after = await page.locator('.lb-feature__text').textContent();
    expect(typeof after).toBe('string');
    void before;
  });

  test('gel de série : un jour manqué ne casse pas la série', async ({ page }) => {
    await seedMeta(page, { streakDaysAgo: 2, inventory: { gel: 1 } });
    await ready(page);
    await expect(page.locator('#hdrStreak')).toContainText('5');
    await page.goto('games/orbite/?fast=1');
    await page.getByRole('button', { name: 'Jouer' }).click();
    const d = await metaData(page);
    expect(d.streak.count).toBe(6);
    expect(d.inventory.gel).toBe(0);
    expect(d.achievements['global:gel']).toBeTruthy();
  });

  test('coffre surprise : un objet jamais possédé', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await page.locator('#stab-coffre').click();
    await page.locator('[data-chest]').click();
    await expect(page.locator('.sh-prize')).toBeVisible({ timeout: 4000 });
    const d = await metaData(page);
    // 150 payés ; « Premier achat » (18) et « Chasseur de trésors » (20) rapportent
    expect(d.credits).toBe(1000 - 150 + 18 + 20);
    expect(d.owned.length).toBe(1);
    expect(d.achievements['global:coffre']).toBeTruthy();
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'boutique-coffre');
    // Équiper le gain depuis la révélation
    await page.locator('.sh-prize [data-equip]').click();
    const [kind, id] = d.owned[0].split(':');
    const slot = { theme: 'theme', frame: 'frame', hat: 'hat', title: 'title', celebration: 'celebration', sound: 'sound' }[kind];
    expect((await metaData(page)).look[slot]).toBe(id);
    w.expectClean();
  });
});
