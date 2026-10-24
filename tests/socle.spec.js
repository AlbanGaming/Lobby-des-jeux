// Tests du socle : 404, design system, moteur (bac à sable), sauvegarde et migration.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

test.describe('socle', () => {
  test('la 404 est stylée et ses chemins tiennent à n’importe quelle profondeur', async ({ page }, testInfo) => {
    const w = watchPage(page, { allow404: ['/introuvable/'] });
    const res = await page.goto('introuvable/tres/profond/page.html');
    expect(res.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('perdue');
    // La feuille de styles est bien chargée : fond encre et police d'affichage
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(11, 12, 20)');
    await page.evaluate(() => document.fonts.ready);
    const fontOk = await page.evaluate(() => document.fonts.check('900 40px "Big Shoulders Display"'));
    expect(fontOk).toBe(true);
    await expect(page.getByRole('link', { name: /Retour au lobby/ })).toHaveAttribute('href', 'index.html');
    const href = await page.getByRole('link', { name: /Retour au lobby/ }).evaluate((a) => a.href);
    expect(href).toMatch(/\/Lobby-des-jeux\/index\.html$/);
    await shot(page, testInfo, '404');
    w.expectClean();
  });

  test('styleguide sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await page.goto('dev/styleguide.html');
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'Afficher un succès' }).click();
    await expect(page.locator('.toast')).toBeVisible();
    await shot(page, testInfo, 'styleguide');
    await page.screenshot({ path: `tests/screenshots/${testInfo.project.name}/styleguide-full.png`, fullPage: true });
    w.expectClean();
  });

  test('bac à sable : partie complète, pause, fin, rejouer', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await page.goto('dev/sandbox/?round=3');
    await page.evaluate(() => document.fonts.ready);
    const start = page.locator('[data-screen="start"]');
    await expect(start).toHaveClass(/is-open/);
    await shot(page, testInfo, 'sandbox-start');

    await page.keyboard.press('Space'); // démarre la partie
    await expect(start).not.toHaveClass(/is-open/);
    await page.waitForTimeout(900); // laisse apparaître des jetons
    await page.keyboard.press('Space'); // onde de choc : ramasse tout
    await page.waitForTimeout(120);
    await shot(page, testInfo, 'sandbox-play');
    const score = Number((await page.locator('[data-hud="score"] .gv-hud__value').textContent()).replace(/\D/g, ''));
    expect(score).toBeGreaterThan(0);

    // Pause au clavier, puis reprise
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-screen="pause"]')).toHaveClass(/is-open/);
    await page.waitForTimeout(500); // fin du fondu d'ouverture
    await shot(page, testInfo, 'sandbox-pause');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-screen="pause"]')).not.toHaveClass(/is-open/);

    // Fin de partie
    const over = page.locator('[data-screen="over"]');
    await expect(over).toHaveClass(/is-open/, { timeout: 6000 });
    await page.waitForTimeout(1100);
    await expect(over.locator('.gv-score')).not.toHaveText('0');
    await shot(page, testInfo, 'sandbox-over');

    // Méta : la partie est comptée, l'XP et le succès « Premiers pas » sont crédités
    const meta = await readStore(page, 'gv:meta');
    expect(meta.v).toBe(1);
    expect(meta.data.games['dev-sandbox'].plays).toBe(1);
    expect(meta.data.xp).toBeGreaterThan(0);
    expect(meta.data.achievements['global:premiers-pas']).toBeTruthy();

    // Rejouer en un clic, en moins d'une seconde
    const t0 = Date.now();
    await over.getByRole('button', { name: 'Rejouer' }).click();
    await expect(over).not.toHaveClass(/is-open/);
    expect(Date.now() - t0).toBeLessThan(1000);
    w.expectClean();
  });

  test('migration des anciennes sauvegardes sans perte', async ({ page }) => {
    const w = watchPage(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      localStorage.setItem('gameverse_user_data', JSON.stringify({
        username: 'ALBAN', avatar: 'data:image/png;base64,AAAA', favorites: [3, 8, 11],
        gamesStats: { 6: { plays: 4, time: 999 }, 7: { plays: 2, time: 120 } },
        settings: { soundEffects: false, bgMusic: true, animations: true },
      }));
      localStorage.setItem('flappyBestScore', '27');
      localStorage.setItem('dinoHighScore', '1543');
      localStorage.setItem('playerData', JSON.stringify({ level: 3, money: 1200 }));
      localStorage.setItem('artEmpireSave', JSON.stringify({ money: 5 }));
    });
    await page.goto('dev/sandbox/');
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.profile.name).toBe('ALBAN');
    expect(meta.profile.avatar).toEqual({ kind: 'image', data: 'data:image/png;base64,AAAA' });
    expect(meta.favorites).toEqual(['morpion', 'motif', 'paddock']);
    expect(meta.games['volt-rush']).toMatchObject({ plays: 4, best: 1543, timeMs: 0 });
    expect(meta.games.plume).toMatchObject({ plays: 2, best: 27 });
    expect(meta.settings).toMatchObject({ sound: false, music: true });
    expect(meta.migratedLegacy).toBe(true);
    // Les anciennes clés restent en place pour les migrations propres à chaque jeu
    const legacy = await page.evaluate(() => ['gameverse_user_data', 'flappyBestScore', 'dinoHighScore', 'playerData', 'artEmpireSave'].map((k) => localStorage.getItem(k) !== null));
    expect(legacy).toEqual([true, true, true, true, true]);

    // Un record battu plus tard sur une ancienne page encore en ligne remonte au rechargement…
    await page.evaluate(() => localStorage.setItem('flappyBestScore', '40'));
    // …mais un jeu déjà refait ne relit plus son ancienne clé
    await page.evaluate(() => localStorage.setItem('dinoHighScore', '2000'));
    await page.reload();
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
    const after = (await readStore(page, 'gv:meta')).data.games;
    expect(after.plume.best).toBe(40);
    expect(after['volt-rush'].best).toBe(1543);
    w.expectClean();
  });

  test('le site tourne même si le stockage local est bloqué', async ({ page }) => {
    const w = watchPage(page);
    await page.addInitScript(() => {
      const deny = () => { throw new DOMException('Bloqué', 'SecurityError'); };
      Object.defineProperty(window, 'localStorage', { get: deny, configurable: true });
    });
    await page.goto('dev/sandbox/?round=2');
    await page.keyboard.press('Space');
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 6000 });
    w.expectClean();
  });
});
