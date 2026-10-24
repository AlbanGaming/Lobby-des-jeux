// Code Secret : saisie clavier, notation, notes, outils, victoire, défaite, coffre du jour, chrono.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const cs = (page, expr) => page.evaluate(`window.__code.${expr}`);

async function open(page) {
  await page.goto('games/code-secret/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}

async function type(page, digits) {
  for (const d of digits) await page.keyboard.press(String(d));
  await page.keyboard.press('Enter');
}

// Un code faux de même longueur, sans doublon
const wrongOf = (code) => {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !code.includes(d));
  return [pool[0], pool[1], code[0], code[1]];
};

test.describe('code secret', () => {
  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await shot(page, testInfo, 'code-start');
    w.expectClean();
  });

  test('essai noté, puis coffre ouvert : points, record, rejouer', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.getByRole('button', { name: 'Jouer' }).click();
    const code = await cs(page, 'code');
    await type(page, wrongOf(code));
    const h = await cs(page, 'history');
    expect(h).toHaveLength(1);
    expect(h[0].exact).toBe(0);
    expect(h[0].misplaced).toBe(2);
    await expect(page.locator('.cs-row')).toHaveCount(1);
    await expect(page.locator('.cs-row .cs-peg--mis')).toHaveCount(2);
    // Chiffres en double refusés en mode Classique
    await page.keyboard.press(String(code[0]));
    await page.keyboard.press(String(code[0]));
    await expect(page.locator('.cs-slot.is-filled')).toHaveCount(1);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(250);
    await shot(page, testInfo, 'code-play');
    await type(page, code);
    await page.waitForTimeout(600);
    await shot(page, testInfo, 'code-open');
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    expect(await cs(page, 'run.points')).toBe(910); // 1000 − 1 essai raté × 90
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.games['code-secret'].best).toBe(910);
    expect(meta.achievements['code-secret:premier']).toBeTruthy();
    expect(meta.achievements['code-secret:en-3']).toBeTruthy();
    await page.waitForTimeout(800);
    await shot(page, testInfo, 'code-over');
    await page.keyboard.press('KeyR');
    await expect(page.locator('[data-screen="over"]')).not.toHaveClass(/is-open/);
    w.expectClean();
  });

  test('notes, déductions automatiques et stéthoscope', async ({ page }) => {
    const w = watchPage(page);
    await open(page);
    await page.getByRole('button', { name: 'Jouer' }).click();
    const code = await cs(page, 'code');
    const absent = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !code.includes(d));
    // Un essai sans aucun chiffre présent les barre tous automatiquement
    await type(page, absent.slice(0, 4));
    for (const d of absent.slice(0, 4)) await expect(page.locator(`.cs-key[data-digit="${d}"]`)).toHaveClass(/is-x/);
    // Mode Notes : un chiffre se barre puis se valide
    await page.locator('[data-act="notes"]').click();
    await page.locator(`.cs-key[data-digit="${code[0]}"]`).click();
    await expect(page.locator(`.cs-key[data-digit="${code[0]}"]`)).toHaveClass(/is-x/);
    await page.locator(`.cs-key[data-digit="${code[0]}"]`).click();
    await expect(page.locator(`.cs-key[data-digit="${code[0]}"]`)).toHaveClass(/is-ok/);
    await page.locator('[data-act="notes"]').click();
    // Stéthoscope sur un chiffre absent
    await page.locator('[data-act="stetho"]').click();
    await page.locator(`.cs-key[data-digit="${absent[4]}"]`).click();
    await expect(page.locator('#feedback')).toContainText('n’est pas dans le code');
    await expect(page.locator('[data-act="stetho"] b')).toHaveText('1');
    w.expectClean();
  });

  test('dix essais ratés : alarme et fin de partie', async ({ page }) => {
    const w = watchPage(page);
    await open(page);
    await page.getByRole('button', { name: 'Jouer' }).click();
    const code = await cs(page, 'code');
    for (let i = 0; i < 10; i++) await type(page, wrongOf(code));
    await expect(page.locator('#door')).toHaveClass(/is-alarm/);
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('[data-screen="over"]')).toContainText(code.join(''));
    w.expectClean();
  });

  test('coffre du jour : une seule tentative par jour', async ({ page }) => {
    const w = watchPage(page);
    await open(page);
    await page.locator('[data-mode="jour"]').click();
    await page.getByRole('button', { name: 'Jouer' }).click();
    expect(await cs(page, 'mode.id')).toBe('jour');
    await type(page, await cs(page, 'code'));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['code-secret:du-jour']).toBeTruthy();
    await page.reload();
    await expect(page.locator('[data-mode="jour"]')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('[data-mode="jour"]')).toContainText('reviens demain');
    w.expectClean();
  });

  test('contre la montre : un coffre ouvert rapporte du temps et en ouvre un autre', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data: { migratedLegacy: true, profile: { name: 'JOUEUR', createdAt: 1 }, games: { 'code-secret': { plays: 3, timeMs: 0, best: 3000, lastPlayed: 1, xp: 0 } } } }));
    });
    await open(page);
    await page.locator('[data-mode="rush"]').click();
    await page.getByRole('button', { name: 'Jouer' }).click();
    await expect(page.locator('#timer')).toBeVisible();
    const first = await cs(page, 'code');
    await type(page, first);
    await page.waitForTimeout(1600);
    expect(await cs(page, 'run.vaults')).toBe(1);
    expect(await cs(page, 'run.timeLeft')).toBeGreaterThan(100);
    expect((await cs(page, 'code')).join('')).not.toBe(first.join('') + 'x');
    await shot(page, testInfo, 'code-rush');
    w.expectClean();
  });

  test('l’ancienne adresse page10.html redirige vers Code Secret', async ({ page }) => {
    await page.goto('page10.html');
    await page.waitForURL(/games\/code-secret\/$/);
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  });
});
