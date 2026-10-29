// Alchimie : fusion et découverte, essai raté, transmutation, chaudron, indice, débordement,
// clavier, formule du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const al = (page, expr) => page.evaluate(`window.__al.${expr}`);
const count = (page) => page.evaluate(() => window.__al.board.filter(Boolean).length);

async function open(page, q = '?fast=1') {
  await page.goto(`games/alchimie/${q}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'classique') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
}
// Plateau sur mesure : { index: élément }
const setup = (page, cells) =>
  page.evaluate((c) => {
    window.__al.clear();
    for (const [i, id] of Object.entries(c)) window.__al.put(Number(i), id);
  }, cells);
const cell = (page, i) => page.locator(`.al-cell[data-i="${i}"]`);
const idle = (page) => page.waitForFunction(() => !window.__al.busy);

test.describe('alchimie', () => {
  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await shot(page, testInfo, 'alchimie-start');
    w.expectClean();
  });

  test('eau + feu = vapeur : fusion, découverte, grimoire', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    await setup(page, { 6: 'eau', 8: 'feu' });
    await cell(page, 6).click();
    await expect(cell(page, 6)).toHaveClass(/is-selected/);
    await cell(page, 8).click();
    await idle(page);
    expect(await al(page, 'board[8]')).toBe('vapeur');
    expect(await al(page, 'run.creations')).toBe(1);
    expect(await al(page, 'found')).toContain('vapeur');
    await expect(page.locator('.al-discovery.is-on')).toHaveCount(1);
    await page.waitForTimeout(250);
    await shot(page, testInfo, 'alchimie-discovery');
    // Un élément est apparu : 1 vapeur + 1 nouvel élément
    expect(await count(page)).toBe(2);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['alchimie:premiere']).toBeTruthy();
    await expect(page.locator('#foundCount')).toHaveText('5 / 54');
    w.expectClean();
  });

  test('essai raté : rien ne se passe, mais un élément apparaît', async ({ page }) => {
    await open(page);
    await play(page);
    await setup(page, { 0: 'feu', 1: 'mer' });
    await cell(page, 0).click();
    await cell(page, 1).click();
    await idle(page);
    expect(await al(page, 'board[0]')).toBe('feu');
    expect(await al(page, 'board[1]')).toBe('mer');
    expect(await count(page)).toBe(3);
    await expect(page.locator('#msg')).toContainText('rien ne se passe');
  });

  test('transmutation, chaudron et indice', async ({ page }) => {
    await open(page);
    await play(page);
    await setup(page, { 3: 'arc', 10: 'eau', 14: 'feu', 20: 'terre' });
    await cell(page, 3).click();
    expect(await al(page, 'board[3]')).toBeNull();
    expect(await al(page, 'run.transmutes')).toBe(1);
    expect(await al(page, 'run.points')).toBeGreaterThan(0);
    // Chaudron
    await page.locator('[data-tool="cauldron"]').click();
    await cell(page, 20).click();
    expect(await al(page, 'board[20]')).toBeNull();
    expect(await al(page, 'run.cauldron')).toBe(2);
    // Indice
    await page.locator('[data-tool="hint"]').click();
    await expect(page.locator('.al-cell.is-hint')).toHaveCount(2);
  });

  test('le plateau déborde : fin de partie', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await play(page);
    // Brique et verre ne se marient pas, et rien n'est final : plus aucune issue
    await page.evaluate(() => {
      window.__al.clear();
      for (let i = 0; i < 25; i++) window.__al.put(i, i % 2 ? 'verre' : 'brique');
      window.__al.run.cauldron = 0;
    });
    await cell(page, 0).click();
    await cell(page, 1).click();
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 4000 });
    await page.waitForTimeout(600);
    await shot(page, testInfo, 'alchimie-over');
    w.expectClean();
  });

  test('au clavier : flèches et Entrée', async ({ page }) => {
    await open(page);
    await play(page);
    await setup(page, { 12: 'air', 13: 'air' });
    await cell(page, 12).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await expect(cell(page, 13)).toBeFocused();
    await page.keyboard.press('Enter');
    await idle(page);
    expect(await al(page, 'board[13]')).toBe('vent');
  });

  test('formule du jour : le même élément pour tous', async ({ page }) => {
    await open(page);
    await play(page, 'jour');
    const target = await al(page, 'run.target');
    expect(target).toBeTruthy();
    await expect(page.locator('#goal')).toBeVisible();
    await page.reload();
    await play(page, 'jour');
    expect(await al(page, 'run.target')).toBe(target);
  });
});
