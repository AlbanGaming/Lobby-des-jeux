// Événement de la semaine : bandeau du lobby, jeu tiré chaque lundi (jamais deux fois de suite),
// XP doublée sur ce jeu, objet exclusif à la 5e partie, objets d'événement dans la boutique.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const seedMeta = (page, extra = {}) =>
  page.addInitScript((x) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const data = { migratedLegacy: true, profile: { name: 'TESTEUR', createdAt: 1 }, credits: 100, backup: { last: Date.now(), nudged: 0 }, ...x };
    localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data }));
  }, extra);
const metaData = async (page) => (await readStore(page, 'gv:meta')).data;
const ready = async (page) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-gv-ready', '');
};
const weekly = (page) => page.evaluate(async () => (await import('./shared/js/meta.js')).weeklyEvent());

test.describe('événement de la semaine', () => {
  test('le bandeau du lobby annonce le jeu, la progression et la récompense', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page);
    await ready(page);
    const ev = await weekly(page);
    const title = await page.evaluate(async (id) => (await import('./games/registry.js')).getGame(id).title, ev.gameId);
    await expect(page.locator('#weeklyTitle')).toContainText(title);
    await expect(page.locator('#weekly')).toContainText('0 / 5');
    await expect(page.locator('#weekly')).toContainText('« ');
    await expect(page.locator(`#weekly [data-play="${ev.gameId}"]`)).toBeVisible();
    // Le jeu de la semaine porte le badge XP ×2 dans la grille, et lui seul
    await expect(page.locator('.gcard .badge--week')).toHaveCount(await page.locator(`.gcard[data-id="${ev.gameId}"]`).count());
    await expect(page.locator(`.gcard[data-id="${ev.gameId}"] .badge--week`).first()).toBeVisible();
    await page.locator('#weekly').scrollIntoViewIfNeeded();
    await shot(page, testInfo, 'semaine-bandeau');
    w.expectClean();
  });

  test('un jeu à parties chaque semaine, jamais le même deux semaines de suite', async ({ page }) => {
    await seedMeta(page);
    await ready(page);
    const res = await page.evaluate(async () => {
      const meta = await import('./shared/js/meta.js');
      const { getGame } = await import('./games/registry.js');
      const out = [];
      const d = new Date(2026, 0, 7);
      for (let i = 0; i < 40; i++) {
        const ev = meta.weeklyEvent(d);
        // Toute la semaine donne le même jeu
        const sunday = new Date(d);
        sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
        const g = getGame(ev.gameId);
        out.push({ id: ev.gameId, same: meta.weeklyEvent(sunday).gameId === ev.gameId, ok: g.ready && !g.secret && !g.keepLegacy && g.category !== 'gestion' });
        d.setDate(d.getDate() + 7);
      }
      return out;
    });
    expect(res.every((r) => r.ok && r.same)).toBe(true);
    for (let i = 1; i < res.length; i++) expect(res[i].id).not.toBe(res[i - 1].id);
    expect(new Set(res.map((r) => r.id)).size).toBeGreaterThan(5);
  });

  test('XP doublée, et la 5e partie offre l’objet exclusif une seule fois', async ({ page }) => {
    await seedMeta(page);
    await ready(page);
    const r = await page.evaluate(async () => {
      const meta = await import('./shared/js/meta.js');
      const { GAMES } = await import('./games/registry.js');
      const ev = meta.weeklyEvent();
      const other = GAMES.find((g) => g.ready && g.id !== ev.gameId && !g.secret);
      const plain = meta.reportRun(other.id, { score: 1, xp: 10 });
      const runs = [];
      for (let i = 0; i < 6; i++) runs.push(meta.reportRun(ev.gameId, { score: 1, xp: 10 }));
      return { ev, plain, runs: runs.map((x) => ({ xp: x.xp, bonus: x.weeklyBonus, plays: x.weekly.plays, completed: x.weekly.completed })), after: meta.weeklyEvent() };
    });
    expect(r.plain.xp).toBe(10);
    expect(r.plain.weekly).toBeNull();
    expect(r.runs[0]).toMatchObject({ xp: 20, bonus: true, plays: 1, completed: false });
    expect(r.runs.map((x) => x.completed)).toEqual([false, false, false, false, true, false]);
    expect(r.runs[5].plays).toBe(5);
    const d = await metaData(page);
    expect(d.owned).toContain(r.ev.reward);
    expect(d.owned.filter((k) => k.startsWith('frame:') || k.startsWith('title:'))).toHaveLength(1);
    expect(d.achievements['global:semaine']).toBeTruthy();
    expect(r.after.done).toBe(true);
    // La récompense de la semaine suivante sera un autre objet
    expect(r.after.reward).not.toBe(r.ev.reward);
    await ready(page);
    await expect(page.locator('#weekly')).toContainText('Gagné');
    await expect(page.locator('#weekly')).toContainText('5 / 5');
  });

  test('tous les objets d’événement gagnés : des crédits à la place', async ({ page }) => {
    await seedMeta(page);
    await ready(page);
    const r = await page.evaluate(async () => {
      const meta = await import('./shared/js/meta.js');
      meta.WEEKLY_REWARDS.forEach((k) => meta.grant(k));
      const ev = meta.weeklyEvent();
      const before = meta.getData().credits;
      let last;
      for (let i = 0; i < 5; i++) last = meta.reportRun(ev.gameId, { score: 1, xp: 0 });
      return { reward: ev.reward, gained: meta.getData().credits - before, completed: last.weekly.completed, credits: meta.WEEKLY_CREDITS };
    });
    expect(r.reward).toBeNull();
    expect(r.completed).toBe(true);
    expect(r.gained).toBeGreaterThanOrEqual(r.credits);
  });

  test('boutique : les objets d’événement se gagnent, ils ne s’achètent pas', async ({ page }) => {
    await seedMeta(page, { credits: 5000 });
    await ready(page);
    await page.locator('#hdrCredits').click();
    await page.locator('#stab-avatar').click();
    const card = page.locator('[data-item="frame:emeraude"]');
    await expect(card.locator('.sh-excl--event')).toBeVisible();
    await expect(card).toContainText('Événement de la semaine');
    await expect(page.locator('[data-buy="frame:emeraude"]')).toHaveCount(0);
    await expect(page.locator('[data-buy="title:champion"]')).toHaveCount(0);
    expect(await page.evaluate(async () => (await import('./shared/js/shop.js')).purchase('frame', 'emeraude'))).toBe(false);
  });
});
