// Motif : notation, dictionnaire, accents, mot du jour (une fois par jour), série, clavier, chargement à la demande.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const mf = (page, expr) => page.evaluate(`window.__motif.${expr}`);

async function open(page) {
  await page.goto('games/motif/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function ready(page) {
  await page.waitForFunction(() => window.__motif.dict && !window.__motif.busy && window.__motif.target);
}
async function word(page, w) {
  for (const c of w) await page.keyboard.press(`Key${c}`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__motif.busy, null, { timeout: 5000 });
}
// Un mot valide, différent de la cible, de la bonne longueur
const otherWord = (page) =>
  page.evaluate(() => {
    const t = window.__motif.target;
    for (const w of window.__motif.dict) if (w !== t && w.length === t.length) return w;
  });

test.describe('motif', () => {
  test('accueil sans erreur, données chargées à la demande', async ({ page }, testInfo) => {
    const w = watchPage(page);
    const fetched = [];
    page.on('request', (r) => fetched.push(r.url()));
    await open(page);
    await shot(page, testInfo, 'motif-start');
    await page.waitForTimeout(500);
    // Mot du jour : seul le dictionnaire de 5 lettres est chargé
    expect(fetched.some((u) => u.includes('valid-5.json'))).toBe(true);
    expect(fetched.some((u) => u.includes('valid-7.json'))).toBe(false);
    w.expectClean();
  });

  test('mot du jour : notation, mot inconnu, victoire, une fois par jour', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.getByRole('button', { name: 'Jouer' }).click();
    await ready(page);
    expect(await mf(page, 'mode.id')).toBe('jour');
    // Mot hors dictionnaire : refusé
    await word(page, 'ZXQWV');
    expect(await mf(page, 'rows.length')).toBe(0);
    await expect(page.locator('#toast')).toContainText('dictionnaire');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
    // Un essai valide est noté
    const other = await otherWord(page);
    await word(page, other);
    const rows = await mf(page, 'rows');
    expect(rows).toHaveLength(1);
    expect(rows[0].result).toHaveLength(5);
    await page.waitForTimeout(200);
    await shot(page, testInfo, 'motif-play');
    // Victoire
    await word(page, await mf(page, 'target'));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 6000 });
    await expect(page.locator('[data-screen="over"] .mf-dist')).toBeVisible();
    await page.waitForTimeout(900);
    await shot(page, testInfo, 'motif-over');
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['motif:du-jour']).toBeTruthy();
    // Revenir : le mot du jour est verrouillé jusqu'à demain
    await page.reload();
    await expect(page.locator('[data-mode="jour"]')).toHaveAttribute('aria-disabled', 'true');
    w.expectClean();
  });

  test('les accents tapés au clavier sont acceptés (é → E)', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Jouer' }).click();
    await ready(page);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'é', bubbles: true })));
    await expect(page.locator('.mf-row.is-current .mf-tile').first()).toHaveText('E');
  });

  test('série : les mots s’enchaînent et rechargent le chrono', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.locator('[data-mode="serie"]').click();
    await page.locator('[data-len="4"]').click();
    await page.getByRole('button', { name: 'Jouer' }).click();
    await ready(page);
    expect((await mf(page, 'target')).length).toBe(4);
    for (let i = 0; i < 2; i++) {
      await word(page, await mf(page, 'target'));
      await page.waitForFunction((n) => window.__motif.run.words === n && !window.__motif.busy && window.__motif.rows.length === 0, i + 1, { timeout: 5000 });
    }
    expect(await mf(page, 'run.timeLeft')).toBeGreaterThan(150);
    expect(await mf(page, 'run.mult')).toBeGreaterThan(1);
    await shot(page, testInfo, 'motif-serie');
    await page.evaluate(() => (window.__motif.run.timeLeft = 0.2));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 4000 });
    w.expectClean();
  });

  test('la lettre P s’écrit au lieu de mettre en pause', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Jouer' }).click();
    await ready(page);
    await page.keyboard.press('KeyP');
    await expect(page.locator('[data-screen="pause"]')).not.toHaveClass(/is-open/);
    await expect(page.locator('.mf-row.is-current .mf-tile').first()).toHaveText('P');
  });

  test('clavier à l’écran', async ({ page }) => {
    await open(page);
    await page.locator('[data-mode="libre"]').click();
    await page.locator('[data-len="5"]').click();
    await page.getByRole('button', { name: 'Jouer' }).click();
    await ready(page);
    for (const c of 'MOTIF') await page.locator(`.mf-key[data-key="${c}"]`).click();
    await expect(page.locator('.mf-row.is-current .mf-tile.is-filled')).toHaveCount(5);
    await page.locator('.mf-key[data-key="BACK"]').click();
    await expect(page.locator('.mf-row.is-current .mf-tile.is-filled')).toHaveCount(4);
  });

  test('l’ancienne adresse page8.html redirige vers Motif', async ({ page }) => {
    await page.goto('page8.html');
    await page.waitForURL(/games\/motif\/$/);
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  });
});
