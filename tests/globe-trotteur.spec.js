// Globe-trotteur : bonne et mauvaise réponse, maîtrise, série, clavier, chrono, apprentissage,
// cartes et choix de drapeaux, continents verrouillés, défi du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const gt = (page, expr) => page.evaluate(`window.__gt.${expr}`);
const qkey = (page) => page.evaluate(() => window.__gt.q.answer.id + window.__gt.run.index);
const answerBtn = (page, i) => page.locator(`.gt-answer[data-i="${i}"]`);

async function open(page, q = '?fast=1') {
  await page.goto(`games/globe-trotteur/${q}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'tour') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
}
// Répond juste (ou faux) puis attend la question suivante
async function respond(page, right = true) {
  const id = await qkey(page);
  const good = await gt(page, 'good()');
  await answerBtn(page, right ? good : (good + 1) % 4).click();
  return id;
}
const nextQ = (page, prev) => page.waitForFunction((p) => window.__gt.q.answer.id + window.__gt.run.index !== p && !window.__gt.answered, prev);
const seed = (page, data) =>
  page.addInitScript((d) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gv:globe-trotteur', JSON.stringify({ v: 1, data: d }));
  }, data);
const base = { mode: 'etude', cont: 'europe', kind: 'mix', mastery: {}, correct: 0, flags: 0, bestStreak: 0, daily: { day: '', best: 0, plays: 0, right: 0 } };

test.describe('globe-trotteur', () => {
  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await expect(page.locator('.gt-stamp')).toHaveCount(4);
    await shot(page, testInfo, 'globe-start');
    w.expectClean();
  });

  test('bonne réponse : points, série et maîtrise', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    const id = await gt(page, 'q.answer.id');
    await shot(page, testInfo, 'globe-question');
    const prev = await respond(page, true);
    expect(await gt(page, 'run.right')).toBe(1);
    expect(await gt(page, 'run.streak')).toBe(1);
    expect(await gt(page, 'run.score')).toBe(100);
    expect(await gt(page, `mastery["${id}"]`)).toBe(1);
    await expect(page.locator('.gt-answer.is-right')).toHaveCount(1);
    await nextQ(page, prev);
    w.expectClean();
  });

  test('mauvaise réponse : 3 secondes perdues, la bonne réponse affichée', async ({ page }, testInfo) => {
    await open(page);
    await play(page);
    const t = await gt(page, 'run.time');
    const name = await gt(page, 'q.answer.name');
    await respond(page, false);
    expect(await gt(page, 'run.streak')).toBe(0);
    expect(await gt(page, 'run.time')).toBeLessThan(t - 2.5);
    await expect(page.locator('#learn')).toBeVisible();
    await expect(page.locator('#learn')).toContainText(name);
    await expect(page.locator('.gt-answer.is-wrong')).toHaveCount(1);
    await shot(page, testInfo, 'globe-wrong');
  });

  test('série de 5 : multiplicateur et temps rendu, au clavier', async ({ page }) => {
    await open(page);
    await play(page);
    for (let k = 0; k < 5; k++) {
      const prev = await qkey(page);
      const good = await gt(page, 'good()');
      await page.keyboard.press(String(good + 1));
      if (k < 4) await nextQ(page, prev);
    }
    expect(await gt(page, 'run.streak')).toBe(5);
    expect(await gt(page, 'run.score')).toBe(400 + 150);
    await expect(page.locator('#streak')).toContainText('×1,5');
  });

  test('chrono à zéro : fin du tour du monde', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    await respond(page, true);
    await page.evaluate(() => (window.__gt.run.time = 0.2));
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 4000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('chrono');
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'globe-over');
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['globe-trotteur:premier-tour']).toBeTruthy();
    w.expectClean();
  });

  test('apprentissage : une erreur attend « Continuer », 15 questions', async ({ page }) => {
    await open(page);
    await play(page, 'etude');
    await expect(page.locator('#timer')).toBeHidden();
    await respond(page, false);
    await expect(page.getByRole('button', { name: /Continuer/ })).toBeVisible();
    await page.waitForTimeout(300);
    expect(await gt(page, 'answered')).toBe(true);
    await page.getByRole('button', { name: /Continuer/ }).click();
    expect(await gt(page, 'run.index')).toBe(2);
    for (let k = 2; k <= 15; k++) {
      const prev = await respond(page, true);
      if (k < 15) await nextQ(page, prev);
    }
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 4000 });
    await expect(page.locator('[data-screen="over"] .gt-passport')).toBeVisible();
  });

  test('cartes : le point s’affiche sur les terres dessinées', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seed(page, { ...base, kind: 'map' });
    await open(page, '');
    await play(page, 'etude');
    expect(await gt(page, 'q.kind')).toBe('map');
    await expect(page.locator('.gt-pin')).toBeVisible();
    const inked = await page.evaluate(() => {
      const c = document.querySelector('.gt-map canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n / (c.width * c.height);
    });
    expect(inked).toBeGreaterThan(0.08);
    await shot(page, testInfo, 'globe-map');
    w.expectClean();
  });

  test('drapeaux : quatre drapeaux au choix', async ({ page }, testInfo) => {
    await seed(page, { ...base, kind: 'flag' });
    await open(page);
    await play(page, 'etude');
    for (let k = 0; k < 14 && (await gt(page, 'q.kind')) !== 'flagpick'; k++) {
      const prev = await respond(page, true);
      await nextQ(page, prev);
    }
    expect(await gt(page, 'q.kind')).toBe('flagpick');
    await expect(page.locator('.gt-answer svg.gt-flag')).toHaveCount(4);
    await shot(page, testInfo, 'globe-flagpick');
  });

  test('continents : verrouillés, puis ouverts par les bonnes réponses', async ({ page }) => {
    await open(page);
    await page.locator('[data-mode="etude"]').click();
    await expect(page.locator('[data-cont="afrique"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-cont="afrique"]').click({ force: true });
    await expect(page.locator('#gt-hint')).toContainText('80 bonnes réponses');
    await page.evaluate(() => sessionStorage.removeItem('seeded'));
    await seed(page, { ...base, correct: 80, cont: 'afrique' });
    await page.reload();
    await expect(page.locator('[data-cont="afrique"]')).not.toHaveAttribute('aria-disabled', 'true');
    await play(page, 'etude');
    expect(await gt(page, 'q.answer.cont')).toBe('afrique');
  });

  test('défi du jour : mêmes questions, temps écoulé = erreur', async ({ page }) => {
    await open(page);
    await play(page, 'jour');
    const first = await page.evaluate(() => window.__gt.q.answer.id + window.__gt.q.kind);
    await page.evaluate(() => (window.__gt.run.time = 0.05));
    await expect.poll(() => gt(page, 'run.wrong')).toBe(1);
    await page.reload();
    await play(page, 'jour');
    expect(await page.evaluate(() => window.__gt.q.answer.id + window.__gt.q.kind)).toBe(first);
  });
});
