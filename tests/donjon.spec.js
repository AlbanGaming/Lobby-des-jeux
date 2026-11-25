// Donjon de cartes : carte du donjon, combat (jouer, viser, fin de tour, intentions), récompense,
// feu de camp, marchand, l'Architecte (lit ton paquet puis réécrit sa stratégie), défaite, reprise.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const dj = (page, expr) => page.evaluate(`window.__dj.${expr}`);
const seed = (page, store = null) =>
  page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data: { migratedLegacy: true, profile: { name: 'TESTEUR', createdAt: 1 }, backup: { last: Date.now(), nudged: 0 } } }));
    if (s) localStorage.setItem('gv:donjon', JSON.stringify({ v: 1, data: s }));
  }, store);

async function start(page) {
  await page.goto('games/donjon/?seed=3');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect.poll(() => dj(page, 'screen')).toBe('map');
}
// Force le type d'une salle de la rangée suivante, puis y entre
async function enter(page, type) {
  await page.evaluate((t) => {
    const r = window.__dj.run;
    r.map[r.row + 1] = [t, t, t];
    window.__dj.node(r.col ?? 1);
  }, type);
}

test.describe('donjon de cartes', () => {
  test('carte du donjon puis combat : jouer une carte, finir le tour', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seed(page);
    await page.goto('games/donjon/?seed=3');
    await shot(page, testInfo, 'donjon-start');
    await page.getByRole('button', { name: 'Jouer' }).click();
    await expect(page.locator('.dj-node.is-open')).toHaveCount(3);
    await page.waitForTimeout(500); // fin du fondu de l'accueil
    await shot(page, testInfo, 'donjon-carte');
    await page.locator('.dj-node.is-open').first().click();
    await expect.poll(() => dj(page, 'screen')).toBe('combat');
    await expect(page.locator('.dj-hand .dj-card')).toHaveCount(5);
    await expect(page.locator('.dj-foe .dj-intent').first()).toBeVisible();
    // Une Frappe sur le premier ennemi
    await page.evaluate(() => window.__dj.hand(['frappe', 'defense']));
    const hp0 = await dj(page, 'C.enemies[0].hp');
    await page.locator('.dj-hand .dj-card').first().click();
    if (await page.locator('.dj-card.is-selected').count()) await page.locator('.dj-foe').first().click();
    await expect.poll(() => dj(page, 'C.enemies[0].hp')).toBe(hp0 - 6);
    await page.keyboard.press('1'); // la Défense
    expect(await dj(page, 'C.P.block')).toBe(5);
    expect(await dj(page, 'C.energy')).toBe(7);
    await shot(page, testInfo, 'donjon-combat');
    await page.keyboard.press('e');
    await expect.poll(() => dj(page, 'C?.turn'), { timeout: 6000 }).toBe(2);
    await expect(page.locator('.dj-hand .dj-card')).toHaveCount(5);
    w.expectClean();
  });

  test('viser : la carte attend la cible quand il y a plusieurs ennemis', async ({ page }) => {
    await seed(page);
    await start(page);
    await enter(page, 'combat');
    await page.evaluate(() => {
      const C = window.__dj.C;
      if (C.enemies.length < 2) C.enemies.push({ ...C.enemies[0], hp: 30, max: 30 });
      window.__dj.hand(['frappe']);
    });
    const hp1 = await dj(page, 'C.enemies[1].hp');
    await page.locator('.dj-hand .dj-card').first().click();
    await expect(page.locator('.dj-card.is-selected')).toHaveCount(1);
    await expect(page.locator('.dj-foe.is-aiming')).toHaveCount(2);
    await page.locator('.dj-foe[data-foe="1"]').click();
    expect(await dj(page, 'C.enemies[1].hp')).toBe(hp1 - 6);
  });

  test('victoire : or, choix d’une carte, retour sur la carte', async ({ page }, testInfo) => {
    await seed(page);
    await start(page);
    await enter(page, 'combat');
    const gold = await dj(page, 'run.gold');
    await page.evaluate(() => window.__dj.win());
    await expect.poll(() => dj(page, 'screen')).toBe('reward');
    await expect(page.locator('[data-take]')).toHaveCount(3);
    expect(await dj(page, 'run.gold')).toBeGreaterThan(gold);
    await shot(page, testInfo, 'donjon-recompense');
    await page.locator('[data-take]').first().click();
    expect(await dj(page, 'run.deck.length')).toBe(11);
    await expect.poll(() => dj(page, 'screen')).toBe('map');
    await expect(page.locator('.dj-node.is-open').first()).toBeVisible();
  });

  test('feu de camp : forger une carte ; marchand : acheter, retirer', async ({ page }) => {
    await seed(page);
    await start(page);
    await enter(page, 'feu');
    await page.locator('[data-forge]').click();
    await page.locator('[data-up]').first().click();
    expect(await page.evaluate(() => window.__dj.run.deck.filter((c) => c.up).length)).toBe(1);
    await expect.poll(() => dj(page, 'screen')).toBe('map');
    await page.evaluate(() => (window.__dj.run.gold = 500));
    await enter(page, 'marchand');
    await page.locator('[data-buy]').first().click();
    expect(await dj(page, 'run.deck.length')).toBe(11);
    await page.locator('[data-remove]').click();
    await page.locator('[data-del]').first().click();
    expect(await dj(page, 'run.deck.length')).toBe(10);
    await page.locator('[data-leave]').click();
    await expect.poll(() => dj(page, 'screen')).toBe('map');
  });

  test('l’Architecte lit ton paquet, puis réécrit sa stratégie à mi-vie', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seed(page);
    await start(page);
    // Le profil vient du paquet : poison, garde ou force
    expect(await page.evaluate(() => window.__dj.profile(['fiole', 'fiole', 'nuage-toxique', 'frappe']))).toBe('poison');
    expect(await page.evaluate(() => window.__dj.profile(['defense', 'defense', 'rempart', 'frappe']))).toBe('garde');
    expect(await page.evaluate(() => window.__dj.profile(['frappe', 'frappe', 'charge', 'defense']))).toBe('force');
    await page.evaluate(() => window.__dj.toBoss(3));
    await page.locator('[data-boss]').click();
    await expect.poll(() => dj(page, 'screen')).toBe('combat');
    await expect(page.locator('.dj-taunt')).toContainText('J’ai lu ton paquet');
    await page.waitForTimeout(300);
    await shot(page, testInfo, 'donjon-architecte');
    // À mi-vie, il réécrit son plan d'après tes coups (ici, des techniques)
    await page.evaluate(() => {
      const C = window.__dj.C;
      C.enemies[0].hp = C.enemies[0].max / 2 + 2;
      C.played.skl = 6;
      window.__dj.hand(['frappe']);
    });
    await page.keyboard.press('1');
    await expect(page.locator('.dj-taunt')).toContainText('Réécriture');
    expect(await dj(page, 'C.arch.plan')).toBe('garde');
    await page.evaluate(() => window.__dj.win());
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 8000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('battu l’Architecte');
    const s = (await readStore(page, 'gv:donjon')).data;
    expect(s.wins).toBe(1);
    expect(s.run).toBeNull();
    w.expectClean();
  });

  test('défaite : les PV tombent à zéro pendant le tour ennemi', async ({ page }) => {
    await seed(page);
    await start(page);
    await enter(page, 'combat');
    await page.evaluate(() => {
      window.__dj.setHp(1);
      for (const e of window.__dj.C.enemies) e.intent = { atk: 10 };
    });
    await page.locator('[data-end]').click();
    await expect(page.locator('[data-screen="over"]')).toHaveClass(/is-open/, { timeout: 8000 });
    await expect(page.locator('[data-screen="over"]')).toContainText('Tombé');
  });

  test('reprendre une partie après avoir fermé la page', async ({ page }) => {
    await seed(page);
    await start(page);
    await enter(page, 'tresor');
    await page.locator('[data-continue]').click();
    await expect.poll(() => dj(page, 'screen')).toBe('map');
    const relics = await dj(page, 'run.relics.length');
    await page.reload();
    await expect(page.locator('[data-resume]')).toContainText('étage 1');
    await page.locator('[data-resume]').click();
    await expect.poll(() => dj(page, 'screen')).toBe('map');
    expect(await dj(page, 'run.floor')).toBe(1);
    expect(await dj(page, 'run.relics.length')).toBe(relics);
  });

  test('héros : l’Ombre s’ouvre après le premier boss', async ({ page }) => {
    await seed(page, { hero: 'lame', mode: 'normal', bosses: 1, wins: 0, run: null, daily: { day: '', best: 0, plays: 0 } });
    await page.goto('games/donjon/');
    await expect(page.locator('[data-hero="arcane"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-hero="ombre"]').click();
    await page.getByRole('button', { name: 'Jouer' }).click();
    await expect.poll(() => dj(page, 'run.hero')).toBe('ombre');
    expect(await page.evaluate(() => window.__dj.run.deck.some((c) => c.id === 'lame-poison'))).toBe(true);
    expect(await dj(page, 'run.relics[0]')).toBe('toxine');
  });
});
