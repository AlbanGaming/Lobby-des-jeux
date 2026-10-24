// Paint Empire, la ville : commandes de clients, contraintes, réserve, carte et bâtiments,
// commandes géantes et en chaîne, contrats de galeries, festival, absence, exposition.
import { test, expect } from '@playwright/test';
import { watchPage, shot, readStore } from './helpers.js';

const pe = (page, expr) => page.evaluate(`window.__pe.${expr}`);

async function enter(page) {
  await page.goto('games/paint-empire/');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Ouvrir l’atelier' }).click();
  await expect(page.locator('[data-screen="start"]')).not.toHaveClass(/is-open/);
}
// Une offre sur mesure, puis acceptée
async function order(page, spec) {
  const id = await page.evaluate((sp) => window.__pe.town.spawnOffer(sp).id, spec);
  expect(await page.evaluate((i) => window.__pe.town.accept(i), id)).toBe(true);
  return id;
}
const easel = async (page, format, family) => {
  await page.locator(`[data-format="${format}"]`).click();
  if (family !== undefined) await page.locator(`[data-family="${family}"]`).click();
};
const paintClicks = async (page, n) => {
  for (let i = 0; i < n; i++) await page.locator('#canvasBtn').click();
};

test.describe('paint empire · la ville', () => {
  test('première commande : la voisine veut deux petites toiles', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await enter(page);
    await page.evaluate(() => window.__pe.advance(11));
    await expect(page.locator('.pe-offers-chip')).toBeVisible();
    await expect(page.locator('#villeDot')).toBeVisible();
    await page.locator('.pe-offers-chip').click();
    await expect(page.locator('#paneVille')).toBeVisible();
    const offer = page.locator('.pe-offer').first();
    await expect(offer).toContainText('Mme Roux');
    await expect(offer).toContainText('Petit');
    await page.waitForTimeout(300);
    await shot(page, testInfo, 'paint-empire-ville');
    await offer.getByRole('button', { name: 'Accepter' }).click();
    await expect(page.locator('#strip .pe-order')).toHaveCount(1);
    await page.locator('[data-view="atelier"]').click();
    await easel(page, 'petit');
    await paintClicks(page, 8);
    await expect(page.locator('#strip [data-count]')).toHaveText('1 / 2');
    await paintClicks(page, 8);
    await expect(page.locator('#strip .pe-order')).toHaveCount(0);
    const st = await pe(page, 'state');
    expect(st.ordersDone).toBe(1);
    expect(st.rep).toBeGreaterThan(0);
    expect(st.money).toBeGreaterThan(0);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['paint-empire:premiere-commande']).toBeTruthy();
    w.expectClean();
  });

  test('commande ratée : pénalité mesurée, client déçu pour un moment', async ({ page }) => {
    await enter(page);
    await page.evaluate(() => window.__pe.town.addRep(20));
    await order(page, { clientId: 'bernard', type: 'express', steps: [{ c: {}, count: 6, duration: 20 }] });
    await page.evaluate(() => window.__pe.advance(21));
    const st = await pe(page, 'state');
    expect(st.ordersFailed).toBe(1);
    expect(st.orders.active).toHaveLength(0);
    expect(st.rep).toBeLessThan(20);
    expect(st.rep).toBeGreaterThan(5);
    expect(st.vexed.bernard).toBeGreaterThan(0);
    await expect(page.locator('#notice')).toContainText('Commande ratée');
  });

  test('contraintes : format et couleur dominante', async ({ page }) => {
    await enter(page);
    await order(page, { clientId: 'fournil', type: 'normale', steps: [{ c: { format: 'grand', family: 'rouge' }, count: 2, duration: 300 }] });
    // Mauvais format : la toile est vendue, pas livrée
    await paintClicks(page, 12);
    expect(await pe(page, 'state.orders.active[0].steps[0].delivered')).toBe(0);
    // Le bon format et la bonne couleur
    await easel(page, 'grand', 'rouge');
    expect(await pe(page, 'state.current.family')).toBe('rouge');
    await paintClicks(page, 22);
    expect(await pe(page, 'state.orders.active[0].steps[0].delivered')).toBe(1);
  });

  test('attribution manuelle : la toile va en réserve, puis on la livre', async ({ page }) => {
    await enter(page);
    await page.locator('[data-view="ville"]').click();
    await page.locator('[data-auto]').click();
    expect(await pe(page, 'state.autoAssign')).toBe(false);
    await order(page, { clientId: 'roux', type: 'normale', steps: [{ c: { format: 'petit' }, count: 1, duration: 300 }] });
    await page.locator('[data-view="atelier"]').click();
    await easel(page, 'petit');
    await paintClicks(page, 8);
    expect(await pe(page, 'state.stock.length')).toBe(1);
    await page.locator('[data-view="ville"]').click();
    await page.locator('#board [data-deliver]').click();
    expect(await pe(page, 'state.ordersDone')).toBe(1);
    expect(await pe(page, 'state.stock.length')).toBe(0);
  });

  test('carte : quartiers sous les nuages, ouverture, achat d’un atelier', async ({ page }, testInfo) => {
    const w = watchPage(page);
    await enter(page);
    await page.locator('[data-view="ville"]').click();
    await expect(page.locator('.pe-city .pe-zone')).toHaveCount(4);
    await expect(page.locator('.pe-fog')).toHaveCount(3);
    await page.evaluate(() => window.__pe.town.addRep(35));
    await expect(page.locator('.pe-fog')).toHaveCount(2);
    expect(await pe(page, 'state.districts')).toContain('centre');
    // Le terrain du centre-ville
    await page.locator('.pe-b[data-b="atelier"]').click();
    await expect(page.locator('#board')).toContainText('Atelier du centre');
    await expect(page.locator('[data-buildbuy="atelier"]')).toBeDisabled();
    await page.evaluate(() => window.__pe.earn(30000));
    await page.locator('[data-unselect]').click();
    await page.locator('.pe-b[data-b="atelier"]').click();
    await page.locator('[data-buildbuy="atelier"]').click();
    expect(await pe(page, 'state.buildings.atelier')).toBe(true);
    await expect(page.locator('#board')).toContainText('Bâtiment à toi');
    // Un emplacement de commande en plus
    const slots = await page.evaluate(async () => (await import('./economy.js')).orderSlots(window.__pe.state));
    expect(slots).toBe(2);
    // Au clavier : Entrée sur un bâtiment ouvre son détail
    await page.locator('.pe-b[data-b="roux"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.pe-board__name')).toHaveText('Mme Roux');
    await page.waitForTimeout(300);
    await shot(page, testInfo, 'paint-empire-carte');
    w.expectClean();
  });

  test('commande géante : il faut deux ateliers et l’entrepôt ; commande en chaîne', async ({ page }) => {
    await enter(page);
    await page.evaluate(() => window.__pe.town.addRep(35));
    const id = await page.evaluate(() => window.__pe.town.spawnOffer({ clientId: 'lys', type: 'geante' }).id);
    expect(await page.evaluate((i) => window.__pe.town.accept(i), id)).toBe(false);
    await page.evaluate(() => {
      window.__pe.earn(5e5);
      window.__pe.town.buy('atelier');
      window.__pe.town.buy('entrepot');
    });
    expect(await page.evaluate((i) => window.__pe.town.accept(i), id)).toBe(true);
    // En chaîne : trois étapes successives
    await page.evaluate(() => (window.__pe.state.orders.active = []));
    await order(page, { clientId: 'nova', type: 'chaine', steps: [{ c: {}, count: 1, duration: 200 }, { c: {}, count: 1, duration: 200 }, { c: {}, count: 1, duration: 200 }] });
    for (let k = 1; k <= 3; k++) {
      await paintClicks(page, 12);
      if (k < 3) expect(await pe(page, 'state.orders.active[0].stage')).toBe(k);
    }
    expect(await pe(page, 'state.orders.active.length')).toBe(0);
    const meta = (await readStore(page, 'gv:meta')).data;
    expect(meta.achievements['paint-empire:chaine']).toBeTruthy();
  });

  test('contrat de galerie : exclusivité, livraisons, rupture', async ({ page }) => {
    await enter(page);
    await page.evaluate(() => window.__pe.town.addRep(130));
    await page.locator('[data-view="ville"]').click();
    await page.locator('.pe-b[data-b="blanche"]').click();
    await expect(page.locator('#board')).toContainText('Exclusivité');
    await page.locator('[data-sign="blanche"]').click();
    const ct = await pe(page, 'state.contracts[0]');
    expect(ct.gallery).toBe('blanche');
    // Une toile de ce style lui revient, payée avec un bonus
    await page.locator('[data-view="atelier"]').click();
    const money = await pe(page, 'state.money');
    await paintClicks(page, 12);
    expect(await pe(page, 'state.contracts[0].delivered')).toBe(1);
    expect(await pe(page, 'state.money')).toBeGreaterThan(money);
    // Les offres qui demandent ce style ne sont plus proposées
    const blocked = await page.evaluate(() => window.__pe.state.orders.offers.some((o) => o.steps.some((st) => st.c.style === window.__pe.state.contracts[0].style)));
    expect(blocked).toBe(false);
    const rep = await pe(page, 'state.rep');
    await page.evaluate(() => window.__pe.town.breakContract('blanche'));
    expect(await pe(page, 'state.contracts.length')).toBe(0);
    expect(await pe(page, 'state.rep')).toBeLessThan(rep);
    expect(await pe(page, 'state.galleryCold.blanche')).toBeGreaterThan(0);
  });

  test('festival : fanions sur la carte et commandes surprises', async ({ page }) => {
    await enter(page);
    await page.locator('[data-view="ville"]').click();
    await page.evaluate(() => window.__pe.town.startFestival());
    await page.evaluate(() => window.__pe.advance(3));
    await expect(page.locator('.pe-city.is-festival')).toHaveCount(1);
    await expect(page.locator('.pe-festival-chip')).toBeVisible();
    expect(await page.evaluate(() => window.__pe.state.orders.offers.some((o) => o.type === 'surprise'))).toBe(true);
  });

  test('pendant une absence, les commandes en cours attendent', async ({ page }) => {
    await enter(page);
    await page.evaluate(() => window.__pe.earn(2000));
    await page.locator('[data-qty="10"]').click();
    await page.locator('[data-buy="apprenti"]').click();
    await order(page, { clientId: 'roux', type: 'normale', steps: [{ c: { format: 'grand', family: 'violet' }, count: 3, duration: 120 }] });
    const left = await pe(page, 'state.orders.active[0].steps[0].left');
    await page.addInitScript(() => {
      if (sessionStorage.getItem('pe-away')) return;
      sessionStorage.setItem('pe-away', '1');
      const raw = JSON.parse(localStorage.getItem('gv:paint-empire'));
      raw.data.lastSeen = Date.now() - 3 * 3600e3;
      localStorage.setItem('gv:paint-empire', JSON.stringify(raw));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Ouvrir l’atelier' }).click();
    await expect(page.locator('#dlg')).toBeVisible();
    await expect(page.locator('#dlg')).toContainText('t’ont attendu');
    const st = await pe(page, 'state');
    expect(st.orders.active).toHaveLength(1);
    expect(st.orders.active[0].steps[0].left).toBeGreaterThan(left - 5);
  });

  test('exposition : on repart du garage, la réputation reste', async ({ page }) => {
    await enter(page);
    await page.evaluate(() => {
      window.__pe.town.addRep(40);
      window.__pe.earn(4.2e6);
      window.__pe.town.buy('atelier');
    });
    await order(page, { clientId: 'roux', type: 'normale', steps: [{ c: { format: 'grand' }, count: 3, duration: 300 }] });
    await page.locator('[data-act="expo"]').click();
    await page.locator('[data-expo]').click();
    const st = await pe(page, 'state');
    expect(st.buildings).toEqual({});
    expect(st.orders.active).toHaveLength(0);
    expect(st.ordersFailed).toBe(0);
    expect(st.rep).toBe(40);
    expect(st.districts).toContain('centre');
  });
});
