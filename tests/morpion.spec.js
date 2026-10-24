// Morpion Dynamique : règle des 3 pions, match complet contre un robot, clavier, duel, redirection.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const mo = (page, expr) => page.evaluate(`window.__morpion.${expr}`);

async function open(page, query = '?fast=1') {
  await page.goto(`games/morpion/${query}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}

// Attend que ce soit au joueur humain (X) de jouer
async function myTurn(page) {
  await page.waitForFunction(() => {
    const m = window.__morpion;
    return m.state.turn === 'X' && !m.busy && !m.match.roundOver;
  });
}

test.describe('morpion', () => {
  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await shot(page, testInfo, 'morpion-start');
    w.expectClean();
  });

  test('règle des 3 pions : le plus ancien clignote puis s’efface', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.locator('[data-level="facile"]').click();
    await page.getByRole('button', { name: 'Jouer' }).click();
    // On force une position sans alignement possible pour tester la règle
    await myTurn(page);
    await page.evaluate(() => {
      const m = window.__morpion;
      m.state.X = [0, 5, 7];
      m.state.O = [1, 3, 8];
      m.state.turn = 'X';
      m.refresh();
    });
    // Le plus ancien pion de X (case 0) est signalé avant d'être effacé
    await expect(page.locator('.mo-cell[data-cell="0"]')).toHaveClass(/is-doomed/);
    await shot(page, testInfo, 'morpion-doomed');
    await page.locator('.mo-cell[data-cell="2"]').click();
    const X = await mo(page, 'state.X');
    expect(X.length).toBe(3);
    expect(X).not.toContain(0); // le plus ancien a disparu
    expect(X).toContain(2);
    await expect(page.locator('.mo-cell[data-cell="0"]')).not.toHaveClass(/is-x/);
    await page.waitForTimeout(300);
    await shot(page, testInfo, 'morpion-play');
    w.expectClean();
  });

  test('match complet contre Pixel, fin de partie, rejouer', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.locator('[data-level="facile"]').click();
    await page.getByRole('button', { name: 'Jouer' }).click();
    // Stratégie simple côté test : gagner si possible, sinon bloquer, sinon centre puis coins
    for (let k = 0; k < 120; k++) {
      if (await page.locator('[data-screen="over"].is-open').count()) break;
      try {
        await page.waitForFunction(() => {
          const m = window.__morpion;
          return (m.state.turn === 'X' && !m.busy && !m.match.roundOver) || document.querySelector('[data-screen="over"].is-open');
        }, null, { timeout: 4000 });
      } catch {
        continue;
      }
      if (await page.locator('[data-screen="over"].is-open').count()) break;
      const cell = await page.evaluate(() => {
        const { state } = window.__morpion;
        const occ = Array(9).fill(null);
        state.X.forEach((c) => (occ[c] = 'X'));
        state.O.forEach((c) => (occ[c] = 'O'));
        const L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        const wins = (mine, c) => {
          const next = [...mine, c];
          if (next.length > 3) next.shift();
          return L.some((l) => l.every((i) => next.includes(i)));
        };
        const free = [...Array(9).keys()].filter((i) => !occ[i]);
        return free.find((c) => wins(state.X, c)) ?? free.find((c) => wins(state.O, c)) ?? [4, 0, 2, 6, 8, 1, 3, 5, 7].find((c) => free.includes(c));
      });
      await page.locator(`.mo-cell[data-cell="${cell}"]`).click();
    }
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 15000 });
    await page.waitForTimeout(800);
    await shot(page, testInfo, 'morpion-over');
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.games.morpion.plays).toBe(1);
    const t0 = Date.now();
    await page.keyboard.press('KeyR');
    await expect(page.locator('[data-screen="over"]')).not.toHaveClass(/is-open/);
    expect(Date.now() - t0).toBeLessThan(1000);
    w.expectClean();
  });

  test('jouable au clavier : flèches et Entrée', async ({ page }) => {
    const w = watchPage(page);
    await open(page);
    await page.getByRole('button', { name: 'Jouer' }).click();
    await myTurn(page);
    await page.locator('.mo-cell[data-cell="4"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.mo-cell[data-cell="5"]')).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await mo(page, 'state.X')).toContain(5);
    w.expectClean();
  });

  test('duel à deux joueurs', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await page.locator('[data-mode="duel"]').click();
    await page.getByRole('button', { name: 'Jouer' }).click();
    await expect(page.locator('#nameO')).toHaveText('Joueur 2');
    // X : 0, 1, 2 (ligne) ; O : 3, 4
    for (const c of [0, 3, 1, 4, 2]) await page.locator(`.mo-cell[data-cell="${c}"]`).click();
    await expect(page.locator('#pipsX i.on')).toHaveCount(1);
    await shot(page, testInfo, 'morpion-duel');
    w.expectClean();
  });

  test('l’ancienne adresse page3.html redirige vers le Morpion', async ({ page }) => {
    await page.goto('page3.html');
    await page.waitForURL(/games\/morpion\/$/);
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  });
});
