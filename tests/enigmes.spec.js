// Énigmes Éclair : banque, questions générées, bonne / mauvaise réponse, jokers, survie, énigme du jour.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const en = (page, expr) => page.evaluate(`window.__enigmes.${expr}`);

async function open(page, query = '?fast=1') {
  await page.goto(`games/enigmes/${query}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
}
async function play(page, modeId = 'eclair') {
  await page.locator(`[data-mode="${modeId}"]`).click();
  await page.getByRole('button', { name: 'Jouer' }).click();
  await page.waitForFunction(() => window.__enigmes.cur && !window.__enigmes.cur.answered && window.__enigmes.clock.running);
}
const ready = (page, n) => page.waitForFunction((k) => window.__enigmes.run.index === k && window.__enigmes.cur && !window.__enigmes.cur.answered, n);
const correctIdx = (page) => en(page, 'cur.q.correct');

test.describe('énigmes éclair', () => {
  test('banque cohérente et questions générées justes', async ({ page }) => {
    await open(page);
    await page.waitForFunction(() => window.__enigmes.bank.length > 0);
    const r = await page.evaluate(async () => {
      const { generated, prepare } = await import('./logic.js');
      const { createRng } = await import('../../shared/js/core/rng.js');
      const bank = window.__enigmes.bank;
      const bad = bank.filter((q) => q.w.length !== 3 || new Set([q.a, ...q.w]).size !== 4 || !q.e);
      const rng = createRng(42);
      const gen = [];
      for (let i = 0; i < 400; i++) {
        const q = prepare(rng, generated(rng, i % 8));
        gen.push({ ok: new Set(q.options).size === 4 && q.options[q.correct] === q.a, q: q.q, a: q.a });
      }
      // Vérifie les calculs simples en les évaluant
      const calcBad = gen.filter((g) => /^[\d\s+−×]+= \?$/.test(g.q)).filter((g) => {
        const expr = g.q.replace(' = ?', '').replace(/−/g, '-').replace(/×/g, '*');
        return String(Function(`return ${expr}`)()) !== g.a.replace(/\s/g, '');
      });
      return { count: bank.length, bad: bad.map((b) => b.id), genBad: gen.filter((g) => !g.ok).length, calcBad: calcBad.map((c) => c.q) };
    });
    expect(r.count).toBeGreaterThan(100);
    expect(r.bad).toEqual([]);
    expect(r.genBad).toBe(0);
    expect(r.calcBad).toEqual([]);
  });

  test('accueil sans erreur', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await expect(page.locator('.en-q')).toBeVisible();
    await shot(page, testInfo, 'enigmes-start');
    w.expectClean();
  });

  test('bonne réponse, mauvaise réponse, série et explication', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page, '');
    await play(page);
    await page.waitForTimeout(400);
    await shot(page, testInfo, 'enigmes-question');
    // Au clavier : la touche du bon numéro
    await page.keyboard.press(String((await correctIdx(page)) + 1));
    await expect(page.locator('.en-ans.is-right')).toHaveCount(1);
    await expect(page.locator('.en-explain')).toBeVisible();
    expect(await en(page, 'run.correct')).toBe(1);
    expect(await en(page, 'run.points')).toBeGreaterThan(100);
    await page.waitForTimeout(250);
    await shot(page, testInfo, 'enigmes-right');
    // Espace pour passer à la suite sans attendre
    await page.keyboard.press('Space');
    await ready(page, 1);
    const c = await correctIdx(page);
    await page.locator(`.en-ans[data-i="${(c + 1) % 4}"]`).click();
    await expect(page.locator('.en-ans.is-wrong')).toHaveCount(1);
    await expect(page.locator('.en-explain')).toContainText('La réponse');
    expect(await en(page, 'run.streak')).toBe(0);
    await page.waitForTimeout(250);
    await shot(page, testInfo, 'enigmes-wrong');
    w.expectClean();
  });

  test('partie Éclair complète sans faute', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await open(page);
    await play(page);
    for (let i = 0; i < 12; i++) {
      await ready(page, i);
      await page.locator(`.en-ans[data-i="${await correctIdx(page)}"]`).click();
    }
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('Sans faute');
    await page.waitForTimeout(700);
    await shot(page, testInfo, 'enigmes-over');
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['enigmes:sans-faute']).toBeTruthy();
    expect(meta.achievements['enigmes:serie-10']).toBeTruthy();
    w.expectClean();
  });

  test('jokers : 50/50, +5 s, passer', async ({ page }) => {
    await open(page);
    await play(page);
    await page.locator('[data-joker="fifty"]').click();
    await expect(page.locator('.en-ans.is-out')).toHaveCount(2);
    await expect(page.locator(`.en-ans[data-i="${await correctIdx(page)}"]`)).not.toHaveClass(/is-out/);
    const before = await en(page, 'clock.left');
    await page.locator('[data-joker="time"]').click();
    expect(await en(page, 'clock.left')).toBeGreaterThan(before + 4);
    await page.locator('[data-joker="skip"]').click();
    await ready(page, 1);
    expect(await en(page, 'run.marks')).toEqual(['skip']);
    await expect(page.locator('[data-joker="skip"]')).toBeDisabled();
  });

  test('une pause pendant l’explication ne bloque pas la partie', async ({ page }) => {
    await open(page, '');
    await play(page);
    await page.locator(`.en-ans[data-i="${await correctIdx(page)}"]`).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-screen="pause"]')).toHaveClass(/is-open/);
    await page.waitForTimeout(2200);
    expect(await en(page, 'cur.answered')).toBe(true);
    await page.keyboard.press('Escape');
    await ready(page, 1);
  });

  test('temps écoulé : compte comme une erreur', async ({ page }) => {
    await open(page, '');
    await play(page);
    await page.evaluate(() => (window.__enigmes.clock.left = 0.05));
    await expect(page.locator('.en-explain')).toContainText('Temps écoulé');
    expect(await en(page, 'run.marks')).toEqual(['ko']);
  });

  test('l’énigme du jour : la même pour tous, une fois par jour', async ({ page }) => {
    const w = watchPage(page);
    await open(page);
    await play(page, 'jour');
    const qs = await page.evaluate(() => window.__enigmes.run.list.map((q) => q.q));
    const again = await page.evaluate(async () => {
      const { dailyQuestions } = await import('./logic.js');
      return dailyQuestions(window.__enigmes.bank).map((q) => q.q);
    });
    expect(again).toEqual(qs);
    for (let i = 0; i < 6; i++) {
      await ready(page, i);
      await page.locator(`.en-ans[data-i="${await correctIdx(page)}"]`).click();
    }
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('[data-screen="over"] [data-share]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-mode="jour"]')).toHaveAttribute('aria-disabled', 'true');
    w.expectClean();
  });

  test('survie : trois erreurs et c’est fini', async ({ page }) => {
    await open(page);
    // Débloque la Survie : une partie Éclair sans faute et rapide dépasse 2 500 points
    await play(page);
    for (let i = 0; i < 12; i++) {
      await ready(page, i);
      await page.locator(`.en-ans[data-i="${await correctIdx(page)}"]`).click();
    }
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await page.reload();
    await expect(page.locator('[data-mode="survie"]')).not.toHaveAttribute('aria-disabled', 'true');
    await play(page, 'survie');
    await expect(page.locator('.en-lives .icon')).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await ready(page, i);
      const c = await correctIdx(page);
      await page.locator(`.en-ans[data-i="${(c + 1) % 4}"]`).click();
    }
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 5000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('Plus de vies');
  });

  test('l’ancienne adresse page4.html redirige vers Énigmes Éclair', async ({ page }) => {
    await page.goto('page4.html');
    await page.waitForURL(/games\/enigmes\/$/);
    await expect(page.locator('[data-screen="start"]')).toHaveClass(/is-open/);
  });
});
