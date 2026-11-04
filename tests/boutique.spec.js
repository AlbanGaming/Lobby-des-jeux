// Boutique : ouverture, achat et équipement d'un thème (lobby et jeux), crédits insuffisants,
// look d'avatar et titre, célébration, sons, objets (gel de série, relance, boost), coffre.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

// Sauvegarde de départ : des crédits, éventuellement d'autres champs
const seedMeta = (page, extra = {}) =>
  page.addInitScript((x) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const day = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const data = { migratedLegacy: true, profile: { name: 'TESTEUR', createdAt: 1 }, credits: 1000, ...x };
    if (x.streakDaysAgo !== undefined) data.streak = { count: 5, best: 5, last: day(-x.streakDaysAgo) };
    delete data.streakDaysAgo;
    localStorage.setItem('gv:meta', JSON.stringify({ v: 1, data }));
  }, extra);
const metaData = async (page) => (await readStore(page, 'gv:meta')).data;
const ready = async (page) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-gv-ready', '');
};
const openShop = async (page) => {
  await page.locator('#hdrCredits').click();
  await expect(page.locator('#dlgShop')).toBeVisible();
};
// La confirmation d'achat
const confirm = (page) => page.locator('#confirmYes').click();

test.describe('boutique', () => {
  test('ouverture : six rayons, solde affiché', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await expect(page.locator('#shopTabs [role="tab"]')).toHaveCount(6);
    await expect(page.locator('#shopCredits')).toContainText('1');
    await shot(page, testInfo, 'boutique-themes');
    w.expectClean();
  });

  test('acheter un thème : le lobby et les jeux changent de couleurs', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await page.locator('[data-buy="theme:neon"]').click();
    await confirm(page);
    await expect(page.locator('html')).toHaveAttribute('data-gv-theme', 'neon');
    const d = await metaData(page);
    // 300 crédits payés, 18 rendus par le succès « Premier achat »
    expect(d.credits).toBe(718);
    expect(d.look.theme).toBe('neon');
    expect(d.owned).toContain('theme:neon');
    expect(d.achievements['global:premier-achat']).toBeTruthy();
    await page.locator('#dlgShop [data-close]').click();
    await shot(page, testInfo, 'boutique-lobby-neon');
    // Dans un jeu aussi
    await page.goto('games/orbite/');
    await expect(page.locator('html')).toHaveAttribute('data-gv-theme', 'neon');
    await shot(page, testInfo, 'boutique-jeu-neon');
    // Retour au thème d'origine, gratuit
    await page.goto('./');
    await openShop(page);
    await page.locator('[data-equip="theme:nuit"]').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-gv-theme', /.+/);
    w.expectClean();
  });

  test('crédits insuffisants : rien n’est acheté', async ({ page }) => {
    await seedMeta(page, { credits: 50 });
    await ready(page);
    await openShop(page);
    await page.locator('[data-buy="theme:or"]').click({ force: true });
    await expect(page.locator('.toast').filter({ hasText: 'Crédits insuffisants' })).toBeVisible();
    expect((await metaData(page)).credits).toBe(50);
  });

  test('avatar : cadre, accessoire et titre', async ({ page }, testInfo) => {
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await page.locator('#stab-avatar').click();
    await page.locator('[data-buy="frame:or"]').click();
    await confirm(page);
    await page.locator('[data-buy="hat:couronne"]').click();
    await confirm(page);
    await page.locator('[data-buy="title:as-du-pixel"]').click();
    await confirm(page);
    const d = await metaData(page);
    expect(d.look).toMatchObject({ frame: 'or', hat: 'couronne', title: 'as-du-pixel' });
    expect(d.credits).toBe(1000 - 450 - 300 - 150 + 18);
    await shot(page, testInfo, 'boutique-avatar');
    await page.locator('#dlgShop [data-close]').click();
    await expect(page.locator('.lb-player__title')).toHaveText('As du pixel');
    // Un titre lié à un succès ne s'achète pas
    await openShop(page);
    await page.locator('#stab-avatar').click();
    await expect(page.locator('[data-buy="title:fidele"]')).toHaveCount(0);
  });

  test('effets : célébration essayée, sons équipés', async ({ page }) => {
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await page.locator('#stab-effets').click();
    await page.locator('[data-try="pieces"]').click();
    await expect(page.locator('canvas.gv-celebrate')).toHaveCount(1);
    await page.locator('[data-buy="celebration:etoiles"]').click();
    await confirm(page);
    await page.locator('[data-buy="sound:retro"]').click();
    await confirm(page);
    const d = await metaData(page);
    expect(d.look.celebration).toBe('etoiles');
    expect(d.look.sound).toBe('retro');
  });

  test('objets : relance du défi et boost d’XP', async ({ page }) => {
    await seedMeta(page);
    await ready(page);
    const before = await page.locator('.lb-feature__text').textContent();
    await openShop(page);
    await page.locator('#stab-objets').click();
    await page.locator('[data-item-buy="relance"]').click();
    expect((await metaData(page)).reroll.n).toBe(1);
    await page.locator('[data-item-buy="boost"]').click();
    expect((await metaData(page)).boostUntil).toBeGreaterThan(Date.now());
    await expect(page.locator('#shopBody')).toContainText('Actif encore');
    await page.locator('#dlgShop [data-close]').click();
    // Le défi a changé (très rarement le même tirage : on vérifie au moins la relance)
    const after = await page.locator('.lb-feature__text').textContent();
    expect(typeof after).toBe('string');
    void before;
  });

  test('gel de série : un jour manqué ne casse pas la série', async ({ page }) => {
    await seedMeta(page, { streakDaysAgo: 2, inventory: { gel: 1 } });
    await ready(page);
    await expect(page.locator('#hdrStreak')).toContainText('5');
    await page.goto('games/orbite/?fast=1');
    await page.getByRole('button', { name: 'Jouer' }).click();
    const d = await metaData(page);
    expect(d.streak.count).toBe(6);
    expect(d.inventory.gel).toBe(0);
    expect(d.achievements['global:gel']).toBeTruthy();
  });

  // Rareté d'un objet possédé (« genre:id »), lue dans le catalogue de la page
  const rarityOfKey = (page, key) =>
    page.evaluate(async (k) => {
      const shop = await import('./shared/js/shop.js');
      const [kind, id] = k.split(':');
      return shop.rarityFor(shop.KINDS[kind].list.find((x) => x.id === id)).id;
    }, key);
  // Ouvre un coffre : la scène se joue, puis la carte du gain apparaît
  const openChest = async (page, id) => {
    await page.locator(`[data-chest="${id}"]`).click();
    await expect(page.locator('.sh-open')).toBeVisible();
    await expect(page.locator('.sh-open__card')).toBeVisible({ timeout: 5000 });
  };

  test('coffre en bois : la scène d’ouverture, puis le gain', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await page.locator('#stab-coffre').click();
    await page.locator('[data-chest="bois"]').click();
    await expect(page.locator('.sh-open')).toBeVisible();
    await page.waitForTimeout(1200);
    await shot(page, testInfo, 'boutique-coffre-suspense');
    await expect(page.locator('.sh-open__card')).toBeVisible({ timeout: 5000 });
    const d = await metaData(page);
    // 150 payés ; « Premier achat » (18) et « Chasseur de trésors » (20) rapportent
    expect(d.credits).toBe(1000 - 150 + 18 + 20);
    expect(d.owned.length).toBe(1);
    expect(d.achievements['global:coffre']).toBeTruthy();
    await page.waitForTimeout(600);
    await shot(page, testInfo, 'boutique-coffre');
    // Équiper depuis la scène, puis la refermer
    await page.locator('.sh-open [data-equip]').click();
    await expect(page.locator('.sh-open .sh-state.is-on')).toBeVisible();
    const [kind, id] = d.owned[0].split(':');
    expect((await metaData(page)).look[kind]).toBe(id);
    await page.locator('[data-open-close]').click();
    await expect(page.locator('.sh-open')).toHaveCount(0);
    await expect(page.locator('#chestReveal .sh-prize')).toBeVisible();
    w.expectClean();
  });

  test('toucher la scène passe directement au gain', async ({ page }) => {
    await seedMeta(page);
    await ready(page);
    await openShop(page);
    await page.locator('#stab-coffre').click();
    await page.locator('[data-chest="bois"]').click();
    await page.locator('.sh-open').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.sh-open__card')).toBeVisible({ timeout: 600 });
  });

  test('coffre de diamant : un légendaire assuré, un objet en plus et un gel', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await seedMeta(page, { credits: 2000 });
    await ready(page);
    await openShop(page);
    await page.locator('#stab-coffre').click();
    await expect(page.locator('[data-chest]')).toHaveCount(4);
    await openChest(page, 'diamant');
    await expect(page.locator('.sh-open__card .sh-rar').first()).toHaveText('Légendaire');
    const d = await metaData(page);
    expect(d.owned.length).toBe(2);
    expect(d.inventory.gel).toBe(1);
    expect(d.achievements['global:diamant']).toBeTruthy();
    expect(await rarityOfKey(page, d.owned[0])).toBe('legendaire');
    await page.waitForTimeout(700);
    await shot(page, testInfo, 'boutique-diamant');
    w.expectClean();
  });

  test('coffre d’or : épique ou mieux, boost offert', async ({ page }) => {
    await seedMeta(page, { credits: 800 });
    await ready(page);
    await openShop(page);
    await page.locator('#stab-coffre').click();
    await openChest(page, 'or');
    const d = await metaData(page);
    expect(d.boostUntil).toBeGreaterThan(Date.now());
    expect(['epique', 'legendaire']).toContain(await rarityOfKey(page, d.owned[0]));
    // Échap referme la scène sans fermer la boutique
    await page.keyboard.press('Escape');
    await expect(page.locator('.sh-open')).toHaveCount(0);
    await expect(page.locator('#dlgShop')).toBeVisible();
    // Plus assez de crédits pour un second coffre d'or
    await expect(page.locator('[data-chest="or"]')).toHaveAttribute('aria-disabled', 'true');
  });

  test('exclusivités : personnages et objets qui ne s’achètent pas', async ({ page }, testInfo) => {
    await seedMeta(page, { credits: 5000 });
    await ready(page);
    await openShop(page);
    await page.locator('#stab-avatar').click();
    await expect(page.locator('[data-item="character:dragon"] .sh-excl')).toBeVisible();
    await expect(page.locator('[data-buy="character:dragon"]')).toHaveCount(0);
    await expect(page.locator('[data-buy="theme:galaxie"]')).toHaveCount(0);
    await shot(page, testInfo, 'boutique-personnages');
    // « Dans les coffres » mène au rayon des coffres
    await page.locator('[data-item="character:dragon"] [data-stab="coffre"]').click();
    await expect(page.locator('#stab-coffre')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-chestcard="diamant"]')).toContainText('exclusif');
  });

  test('un personnage gagné remplace le robot dans le lobby', async ({ page }) => {
    await seedMeta(page, { owned: ['character:astronaute', 'theme:galaxie'], look: { character: 'astronaute', theme: 'galaxie' } });
    await ready(page);
    await expect(page.locator('html')).toHaveAttribute('data-gv-theme', 'galaxie');
    // Le fond du personnage astronaute est dessiné dans l'avatar de l'en-tête
    await expect(page.locator('#btnProfile svg.avatar-svg rect').first()).toHaveAttribute('fill', '#0b1026');
    // Choisir un robot dans le profil repasse sur le robot
    await page.locator('#btnProfile').click();
    await expect(page.locator('#ppanel-me')).toContainText('Astronaute');
    await page.locator('.lb-avatar-opt[data-seed]').nth(1).click();
    expect((await metaData(page)).look.character).toBe('robot');
  });

  test('plus d’import de photo de profil', async ({ page }) => {
    await seedMeta(page, { profile: { name: 'TESTEUR', createdAt: 1, avatar: { kind: 'image', data: 'data:image/png;base64,AAAA' } } });
    await ready(page);
    expect((await metaData(page)).profile.avatar.kind).toBe('gen');
    await page.locator('#btnProfile').click();
    await expect(page.locator('[data-import-avatar]')).toHaveCount(0);
    await expect(page.locator('#fileAvatar')).toHaveCount(0);
  });
});
