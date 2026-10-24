// Tests du lobby : rendu, recherche, filtres, favoris, profil, réglages, données.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const cards = (page) => page.locator('#grid .gcard');

async function ready(page) {
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  await expect(cards(page)).toHaveCount(11);
  await expect(page.locator('html')).toHaveClass(/is-ready/);
  // Les vignettes s'injectent à l'approche de l'écran : on fait défiler pour toutes les charger
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
  });
  await expect(page.locator('#grid .gcard__thumb.is-loaded')).toHaveCount(11);
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe('lobby', () => {
  test('rendu complet sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await ready(page);
    await expect(page.locator('#feature .lb-feature__title')).not.toBeEmpty();
    await expect(page.locator('#player .lb-player__name')).toHaveText('JOUEUR');
    await expect(page.locator('#gameCount')).toHaveText('11 jeux');
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'lobby');
    await page.screenshot({ path: `tests/screenshots/${testInfo.project.name}/lobby-full.png`, fullPage: true });
    w.expectClean();
  });

  test('recherche instantanée, insensible aux accents, avec état vide', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await ready(page);
    await page.keyboard.press('/');
    await expect(page.locator('#search')).toBeFocused();
    await page.keyboard.type('enigme');
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Énigmes Éclair');
    await page.locator('#search').fill('course');
    await expect(cards(page)).toHaveCount(2);
    await page.locator('#search').fill('xylophone');
    await expect(cards(page)).toHaveCount(0);
    await expect(page.locator('#empty')).toBeVisible();
    await shot(page, testInfo, 'lobby-empty-search');
    await page.getByRole('button', { name: 'Tout afficher' }).click();
    await expect(cards(page)).toHaveCount(11);
    w.expectClean();
  });

  test('filtre par catégorie mémorisé', async ({ page }) => {
    const w = watchPage(page);
    await ready(page);
    await page.locator('#filters [data-cat="gestion"]').click();
    await expect(cards(page)).toHaveCount(2);
    await page.reload();
    await expect(page.locator('#filters [data-cat="gestion"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page)).toHaveCount(2);
    w.expectClean();
  });

  test('favoris : ajout, onglet, persistance', async ({ page }) => {
    const w = watchPage(page);
    await ready(page);
    await page.locator('#grid [data-fav="morpion"]').click();
    await expect(page.locator('#grid [data-fav="morpion"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#picksTabs [data-tab="favorites"]').click();
    await expect(page.locator('#picksRail .gcard')).toHaveCount(1);
    await expect(page.locator('#picksRail .gcard')).toContainText('Morpion Dynamique');
    const metaData = (await readStore(page, 'gv:meta')).data;
    expect(metaData.favorites).toEqual(['morpion']);
    w.expectClean();
  });

  test('lancer un ancien jeu compte la partie et alimente « Continuer »', async ({ page }) => {
    await ready(page);
    await page.locator('#grid .gcard[data-id="code-secret"] .gcard__link').click();
    await page.waitForURL(/page10\.html$/);
    await page.goBack();
    await expect(cards(page)).toHaveCount(11);
    await expect(page.locator('#picksTabs [data-tab="continue"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#picksRail .gcard').first()).toContainText('Code Secret');
    const g = (await readStore(page, 'gv:meta')).data.games['code-secret'];
    expect(g.plays).toBe(1);
  });

  test('profil : pseudo, avatar, couleur payante, stats et succès', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data: { credits: 100, xp: 640, migratedLegacy: true, profile: { name: 'JOUEUR', createdAt: 1 } } }));
    });
    await ready(page);
    await page.locator('#btnProfile').click();
    const dlg = page.locator('#dlgProfile');
    await expect(dlg).toBeVisible();
    await dlg.locator('#nameInput').fill('Alban');
    await dlg.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('#player .lb-player__name')).toHaveText('ALBAN');

    await dlg.locator('[data-seed]').nth(3).click();
    await expect(dlg.locator('[data-seed]').nth(3)).toHaveAttribute('aria-pressed', 'true');

    // Couleur à 60 crédits : achat confirmé
    await dlg.locator('[data-palette="6"]').click();
    await expect(page.locator('#dlgConfirm')).toBeVisible();
    await page.locator('#confirmYes').click();
    await expect(dlg.locator('[data-palette="6"]')).toHaveAttribute('aria-pressed', 'true');
    let m = (await readStore(page, 'gv:meta')).data;
    expect(m.owned).toContain('palette:6');
    expect(m.credits).toBe(40);
    // Couleur trop chère : refus
    await dlg.locator('[data-palette="10"]').click();
    await expect(page.locator('#dlgConfirm')).toBeHidden();
    await page.waitForTimeout(400);
    await shot(page, testInfo, 'lobby-profile');

    await dlg.locator('[data-ptab="stats"]').click();
    await expect(dlg.locator('#ppanel-stats table tbody tr')).toHaveCount(11);
    await shot(page, testInfo, 'lobby-stats');
    await dlg.locator('[data-ptab="ach"]').click();
    await expect(dlg.locator('#ppanel-ach .lb-ach').first()).toBeVisible();
    await shot(page, testInfo, 'lobby-achievements');
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    w.expectClean();
  });

  test('paramètres : son, animations, export, réinitialisation', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await ready(page);
    await page.locator('#btnSettings').click();
    const dlg = page.locator('#dlgSettings');
    await expect(dlg).toBeVisible();
    await dlg.locator('[data-setting="sound"]').click();
    await expect(dlg.locator('[data-setting="sound"]')).toHaveAttribute('aria-checked', 'false');
    await dlg.locator('[data-motion="reduced"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await shot(page, testInfo, 'lobby-settings');

    const [download] = await Promise.all([page.waitForEvent('download'), dlg.locator('[data-export]').click()]);
    expect(download.suggestedFilename()).toMatch(/^gameverse-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);

    await page.locator('#grid [data-fav="plume"]').click({ force: true }).catch(() => {});
    await dlg.locator('[data-reset]').click();
    await expect(page.locator('#dlgConfirm')).toBeVisible();
    await page.locator('#confirmYes').click();
    const m = (await readStore(page, 'gv:meta')).data;
    expect(m.settings.sound).toBe(true);
    expect(m.favorites).toEqual([]);
    w.expectClean();
  });

  test('anciennes données migrées visibles dans le lobby', async ({ page }) => {
    const w = watchPage(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('gameverse_user_data', JSON.stringify({ username: 'ALBAN', favorites: [9], gamesStats: { 6: { plays: 3 } } }));
      localStorage.setItem('dinoHighScore', '812');
    });
    await ready(page);
    await expect(page.locator('#player .lb-player__name')).toHaveText('ALBAN');
    await expect(page.locator('#grid .gcard[data-id="volt-rush"] .gcard__meta')).toContainText('Record 812 m');
    await page.locator('#picksTabs [data-tab="favorites"]').click();
    await expect(page.locator('#picksRail .gcard')).toContainText('Paint Empire');
    w.expectClean();
  });

  test('survol d’une carte (animation de vignette)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'pas de survol au tactile');
    await ready(page);
    await page.locator('#grid .gcard[data-id="volt-rush"] .gcard__thumb').hover();
    await page.waitForTimeout(450);
    await page.locator('#grid .gcard[data-id="volt-rush"]').screenshot({ path: `tests/screenshots/${testInfo.project.name}/card-hover.png` });
  });
});
