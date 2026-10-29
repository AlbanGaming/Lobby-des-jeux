// Pixel Mystère : remplir, barrer, erreurs, glisser, ligne terminée, indice, clavier, victoire et
// révélation, défaite, chapitres verrouillés, grand format sur téléphone, emblème du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const pm = (page, expr) => page.evaluate(`window.__pm.${expr}`);
const cell = (page, i) => page.locator(`.pm-cell[data-i="${i}"]`);

async function open(page, q = '?fast=1') {
  await page.goto(`games/pixel-mystere/${q}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'album') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
}
// Album déjà commencé : n grilles résolues, la grille choisie
const seed = (page, solvedIds, pick) =>
  page.addInitScript(
    ([ids, p]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const solved = Object.fromEntries(ids.map((id) => [id, { time: 60, score: 100, perfect: false }]));
      localStorage.setItem('gv:pixel-mystere', JSON.stringify({ v: 1, data: { mode: 'album', pick: p, theme: 'papier', tool: 'fill', solved, daily: { day: '', done: false, best: 0, time: 0, plays: 0 } } }));
    },
    [solvedIds, pick],
  );
const FIRST = ['coeur', 'maison', 'champi', 'etoile', 'sapin', 'sablier', 'poisson', 'fleur'];
const PROMENADE = ['chat', 'fusee', 'voilier', 'parapluie', 'sapin2', 'tasse', 'cle', 'note', 'poisson2', 'chalet', 'coeur2', 'lune', 'robot'];

test.describe('pixel mystère', () => {
  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await expect(page.locator('.pm-pic')).toHaveCount(25);
    await shot(page, testInfo, 'pixel-start');
    w.expectClean();
  });

  test('remplir, barrer et se tromper', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    // Cœur : « .r.r. » en première ligne
    await cell(page, 1).click();
    expect(await pm(page, 'cells[1]')).toBe(1);
    await expect(cell(page, 1)).toHaveClass(/is-fill/);
    await page.locator('[data-tool="cross"]').click();
    await cell(page, 0).click();
    expect(await pm(page, 'cells[0]')).toBe(2);
    // Barrer une case pleine : erreur, la case se remplit en rouge
    await cell(page, 5).click();
    expect(await pm(page, 'run.lives')).toBe(2);
    await expect(cell(page, 5)).toHaveClass(/is-fill/);
    await expect(cell(page, 5)).toHaveClass(/is-wrong/);
    await expect(page.locator('#lives .is-lost')).toHaveCount(1);
    await expect(page.locator('#msg')).toContainText('Raté');
    await shot(page, testInfo, 'pixel-play');
    w.expectClean();
  });

  test('glisser remplit une ligne, qui se termine toute seule', async ({ page }) => {
    await open(page);
    await play(page);
    const a = await cell(page, 5).boundingBox();
    const b = await cell(page, 9).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    // Le trait dérive un peu vers le bas : il reste sur la ligne
    await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.9, { steps: 8 });
    await page.mouse.up();
    for (let i = 5; i < 10; i++) expect(await pm(page, `cells[${i}]`)).toBe(1);
    await expect(page.locator('.pm-clue--row[data-row="1"]')).toHaveClass(/is-done/);
    expect(await pm(page, 'run.errors')).toBe(0);
    // Première ligne : les deux cases pleines suffisent, le reste se barre
    await cell(page, 1).click();
    await cell(page, 3).click();
    expect(await pm(page, 'cells[0]')).toBe(2);
    expect(await pm(page, 'cells[4]')).toBe(2);
  });

  test('indice : une ligne entière dévoilée', async ({ page }) => {
    await open(page);
    await play(page);
    await page.locator('[data-tool="hint"]').click();
    expect(await pm(page, 'run.hints')).toBe(1);
    await expect(page.locator('.pm-clue.is-done')).not.toHaveCount(0);
    expect(await pm(page, 'run.errors')).toBe(0);
  });

  test('au clavier : flèches, Entrée et X', async ({ page }) => {
    await open(page);
    await play(page);
    await cell(page, 0).focus();
    await page.keyboard.press('x');
    expect(await pm(page, 'cells[0]')).toBe(2);
    await page.keyboard.press('ArrowRight');
    await expect(cell(page, 1)).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await pm(page, 'cells[1]')).toBe(1);
    await page.keyboard.press('ArrowDown');
    await expect(cell(page, 6)).toBeFocused();
  });

  test('victoire : le dessin se révèle et entre dans l’album', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    await page.evaluate(() => window.__pm.solveAllBut(1));
    const last = (await pm(page, 'remaining()'))[0];
    await cell(page, last).click();
    expect(await pm(page, 'run.won')).toBe(true);
    await expect(page.locator('.pm-wrap')).toHaveClass(/is-solved/);
    await page.waitForTimeout(700);
    await shot(page, testInfo, 'pixel-reveal');
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 6000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('Cœur');
    await expect(page.locator('.pm-over-art svg')).toBeVisible();
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'pixel-over');
    const data = (await readStore(page, 'gv:pixel-mystere')).data;
    expect(data.solved.coeur.perfect).toBe(true);
    expect(data.pick).toBe('maison');
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['pixel-mystere:premiere']).toBeTruthy();
    expect(meta.achievements['pixel-mystere:sans-faute']).toBeTruthy();
    // Rejouer : la grille suivante
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await expect.poll(() => pm(page, 'puzzle.id')).toBe('maison');
    w.expectClean();
  });

  test('trois erreurs : le dessin reste caché', async ({ page }) => {
    await open(page);
    await play(page);
    await page.locator('[data-tool="cross"]').click();
    for (const i of [5, 6, 7]) await cell(page, i).click({ force: true });
    expect(await pm(page, 'run.lives')).toBe(0);
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 4000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('reste caché');
    const data = (await readStore(page, 'gv:pixel-mystere')).data;
    expect(data.solved.coeur).toBeUndefined();
  });

  test('chapitres : verrouillés puis ouverts', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-pick="chat"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-pick="chat"]').click({ force: true });
    await expect(page.locator('#pm-hint')).toContainText('Promenade');
  });

  test('grand format 15 × 15 : la grille tient à l’écran', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seed(page, [...FIRST, ...PROMENADE.slice(0, 4)], 'hibou');
    await open(page, '');
    await expect(page.locator('[data-pick="hibou"]')).toHaveAttribute('aria-checked', 'true');
    await play(page);
    expect(await pm(page, 'N')).toBe(15);
    const box = await page.locator('#board').boundingBox();
    const vp = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    const c = await cell(page, 0).boundingBox();
    expect(c.width).toBeGreaterThanOrEqual(testInfo.project.name.includes('mobile') ? 18 : 28);
    await shot(page, testInfo, 'pixel-grand');
    w.expectClean();
  });

  test('emblème du jour : le même dessin pour tous', async ({ page }) => {
    await open(page);
    await play(page, 'jour');
    expect(await pm(page, 'puzzle.id')).toBe('jour');
    expect(await pm(page, 'N')).toBe(10);
    const rows = await pm(page, 'puzzle.rows.join()');
    await page.reload();
    await play(page, 'jour');
    expect(await pm(page, 'puzzle.rows.join()')).toBe(rows);
    await page.evaluate(() => window.__pm.solveAllBut(0));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 6000 });
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['pixel-mystere:du-jour']).toBeTruthy();
  });
});
