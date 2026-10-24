// Paint Empire : peindre et vendre, achats, paliers, collectionneur, exposition (prestige),
// mécènes, gains hors ligne, sauvegarde et reprise de l'ancienne partie.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const pe = (page, expr) => page.evaluate(`window.__pe.${expr}`);

async function open(page) {
  await page.goto('games/paint-empire/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function enter(page) {
  await page.getByRole('button', { name: 'Ouvrir l’atelier' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
}

test.describe('paint empire', () => {
  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await shot(page, testInfo, 'paint-empire-start');
    w.expectClean();
  });

  test('peindre une toile la vend et l’ajoute à la galerie', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await enter(page);
    for (let i = 0; i < 11; i++) await page.locator('#canvasBtn').click();
    expect(await pe(page, 'state.sold')).toBe(0);
    expect(await pe(page, 'state.current.done')).toBe(11);
    await page.locator('#canvasBtn').click();
    expect(await pe(page, 'state.sold')).toBe(1);
    expect(await pe(page, 'state.money')).toBeGreaterThanOrEqual(12);
    await expect(page.locator('.pe-thumb')).toHaveCount(1);
    // Le clavier peint aussi
    await page.keyboard.press('Space');
    expect(await pe(page, 'state.current.done')).toBe(1);
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'paint-empire-play');
    // La vignette s'ouvre en grand
    await page.locator('.pe-thumb').first().click();
    await expect(page.locator('#dlg')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-screen="pause"]')).not.toHaveClass(/is-open/);
    w.expectClean();
  });

  test('assistants, quantités, paliers et matériel', async ({ page }) => {
    await open(page);
    await enter(page);
    await page.evaluate(() => window.__pe.earn(5000));
    await page.locator('[data-buy="apprenti"]').click();
    expect(await pe(page, 'state.assistants.apprenti')).toBe(1);
    await page.locator('[data-qty="10"]').click();
    await page.locator('[data-buy="apprenti"]').click();
    expect(await pe(page, 'state.assistants.apprenti')).toBe(11);
    // Palier 10 franchi : production doublée
    await expect(page.locator('.toast', { hasText: 'palier 10' })).toBeVisible({ timeout: 9000 });
    await page.locator('[data-qty="max"]').click();
    const money = await pe(page, 'state.money');
    await page.locator('[data-buy="eleve"]').click();
    expect(await pe(page, 'state.assistants.eleve')).toBeGreaterThan(1);
    expect(await pe(page, 'state.money')).toBeLessThan(money);
    // Matériel : les pinceaux donnent un coup de plus par clic
    await page.evaluate(() => window.__pe.earn(1000));
    await page.locator('[data-tab="tools"]').click();
    await page.locator('[data-buy="pinceaux"]').click();
    const before = await pe(page, 'state.current.done');
    await page.locator('#canvasBtn').click();
    expect(((await pe(page, 'state.current.done')) - before + 12) % 12).toBe(2);
    // Trop cher : refusé
    await page.evaluate(() => (window.__pe.state.money = 0));
    await page.locator('[data-buy="chevalet"]').click({ force: true });
    expect(await pe(page, 'state.tools.chevalet ?? 0')).toBe(0);
  });

  test('le collectionneur de passage', async ({ page }) => {
    await open(page);
    await enter(page);
    await page.evaluate(() => window.__pe.showCollector());
    await expect(page.locator('#collector')).toBeVisible();
    const money = await pe(page, 'state.money');
    await page.locator('#collector').click({ force: true });
    await expect(page.locator('#collector')).toBeHidden();
    expect(await pe(page, 'state.collectors')).toBe(1);
    const buffed = await page.evaluate(() => window.__pe.buffs.inspiration > window.__pe.time || window.__pe.buffs.frenesie > window.__pe.time);
    expect(buffed || (await pe(page, 'state.money')) > money).toBe(true);
  });

  test('exposition : renommée, remise à zéro et mécènes', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await enter(page);
    await expect(page.locator('[data-act="expo"]')).toBeDisabled();
    await page.evaluate(() => window.__pe.earn(4.2e6));
    await page.locator('[data-buy="apprenti"]').click();
    await expect(page.locator('[data-act="expo"]')).toBeEnabled();
    await expect(page.locator('[data-act="expo"]')).toContainText('+2');
    await page.waitForTimeout(300);
    await shot(page, testInfo, 'paint-empire-rich');
    await page.locator('[data-act="expo"]').click();
    await expect(page.locator('#dlg')).toBeVisible();
    await page.locator('[data-expo]').click();
    const st = await pe(page, 'state');
    expect(st.renown).toBe(2);
    expect(st.tokens).toBe(2);
    expect(st.money).toBe(0);
    expect(st.assistants).toEqual({});
    expect(st.runEarned).toBe(0);
    expect(st.totalEarned).toBeGreaterThan(4e6);
    // La renommée augmente les revenus
    await expect(page.locator('#rate')).toContainText('+10 %');
    await page.locator('[data-tab="patrons"]').click();
    await page.locator('[data-buy="reseau"]').click();
    expect(await pe(page, 'state.patrons.reseau')).toBe(1);
    expect(await pe(page, 'state.tokens')).toBe(0);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['paint-empire:exposition']).toBeTruthy();
    expect(meta.games['paint-empire'].best).toBeGreaterThan(4e6);
    w.expectClean();
  });

  test('gains hors ligne au retour', async ({ page }, testInfo) => {
    await open(page);
    await enter(page);
    await page.evaluate(() => window.__pe.earn(2000));
    await page.locator('[data-qty="10"]').click();
    await page.locator('[data-buy="apprenti"]').click();
    const rate = 0.5 * 10 * 2; // 10 apprentis, palier 10 : ×2
    // Absence de 2 h simulée juste avant le rechargement (la sortie de page enregistre l'heure)
    await page.addInitScript(() => {
      if (sessionStorage.getItem('pe-away')) return;
      sessionStorage.setItem('pe-away', '1');
      const raw = JSON.parse(localStorage.getItem('gv:paint-empire'));
      raw.data.lastSeen = Date.now() - 2 * 3600e3;
      localStorage.setItem('gv:paint-empire', JSON.stringify(raw));
    });
    await page.reload();
    await enter(page);
    await expect(page.locator('#dlg')).toBeVisible();
    await expect(page.locator('#dlg')).toContainText('Pendant ton absence');
    await page.waitForTimeout(200);
    await shot(page, testInfo, 'paint-empire-offline');
    const before = await pe(page, 'state.money');
    await page.locator('[data-collect]').click();
    const gained = (await pe(page, 'state.money')) - before;
    // 2 h à 50 % du revenu
    expect(gained).toBeGreaterThan(rate * 7200 * 0.5 * 0.98);
    expect(gained).toBeLessThan(rate * 7200 * 0.5 * 1.05);
  });

  test('la partie est sauvegardée', async ({ page }) => {
    await open(page);
    await enter(page);
    for (let i = 0; i < 17; i++) await page.locator('#canvasBtn').click();
    await page.keyboard.press('Escape');
    await page.reload();
    const st = (await readStore(page, 'gv:paint-empire')).data;
    expect(st.sold).toBe(1);
    expect(st.current.done).toBe(5);
    expect(st.gallery).toHaveLength(1);
  });

  test('reprend la sauvegarde de l’ancien Paint Empire', async ({ page }) => {
    // Ancienne sauvegarde posée avant le tout premier chargement
    await page.addInitScript(() => {
      if (!localStorage.getItem('gv:paint-empire')) localStorage.setItem('artEmpireSave', JSON.stringify({ money: 5000, totalEarnings: 20000, paintingsSold: 42, prestigePoints: 3, totalClicks: 800, upgrades: {} }));
    });
    await page.goto('games/paint-empire/');
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
    const st = await pe(page, 'state');
    expect(st.money).toBe(5000);
    expect(st.totalEarned).toBe(20000);
    expect(st.sold).toBe(42);
    expect(st.renown).toBe(3);
    await expect(page.locator('.toast', { hasText: 'Progression reprise' })).toBeVisible();
  });

  test('l’ancienne adresse page9.html redirige vers Paint Empire', async ({ page }) => {
    await page.goto('page9.html');
    await page.waitForURL(/games\/paint-empire\/$/);
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  });
});
