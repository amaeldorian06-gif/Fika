/**
 * E2E espace admin allégé (13/11) — vérifie la suppression des sections non
 * essentielles (Experts, Clients, Exports & archives) SANS régression :
 * 1. Navigation = 7 sections essentielles, aucune entrée supprimée.
 * 2. Chaque section conservée se charge (données réelles, états vides honnêtes).
 * 3. La file Commandes Market affiche les commandes réelles.
 * 4. Les anciennes routes /admin/clients|experts|reports retombent sur le
 *    tableau de bord — jamais d'écran d'erreur.
 * 5. Les endpoints API retirés répondent 404 ; celui du panneau Exécution
 *    (experts affectables) reste fonctionnel.
 *
 * Exécution : npx tsx e2e/admin-essentiel.mts
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { signSession, SESSION_COOKIE } from '../server/routes/auth';
import { FOUNDER_ID } from '../server/lib/founder';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
};

const token = signSession({ sub: FOUNDER_ID, role: 'SUPERADMIN', exp: Date.now() + 60 * 60 * 1000 });
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: SESSION_COOKIE, value: token, url: BASE, httpOnly: true, sameSite: 'Lax' }]);
  const page = await ctx.newPage();

  /* ---------- 1. Navigation allégée ---------- */
  await page.goto(`${BASE}/admin`, { waitUntil: 'load' });
  await page.waitForSelector('text=Tableau de bord', { timeout: 20000 });
  const navLabels = await page.locator('nav[aria-label="Navigation back-office"] a').allInnerTexts();
  const expected = ["Vue d'ensemble", 'Commandes', 'Demandes', 'Analytiques', 'Fika Market', 'Catalogue produits', 'Relevés & marges'];
  ok(JSON.stringify(navLabels) === JSON.stringify(expected), `navigation = 7 sections essentielles (${navLabels.join(' · ')})`);
  const navText = navLabels.join('|');
  ok(!/Experts|Clients|Exports/.test(navText), 'aucune entrée Experts / Clients / Exports & archives');

  /* ---------- 2. Sections conservées ---------- */
  const sections: [string, string, string][] = [
    ['/admin', 'Tableau de bord', 'CA du mois'],
    ['/admin/orders', 'Commandes', 'css=input[aria-label="Rechercher une commande"]'],
    ['/admin/leads', 'Demandes à qualifier', 'Dossiers affichés'],
    ['/admin/analytics', 'Analytiques', 'CA facturé'],
    ['/admin/market', 'Fika Market — pilotage', ''],
    ['/admin/market/catalog', 'Fika Market — catalogue', ''],
    ['/admin/market/releves', 'Fika Market — relevés & marges', ''],
    ['/admin/market/orders', 'Fika Market — commandes', ''],
  ];
  for (const [path, title, marker] of sections) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    const found = await page.waitForSelector(`text=${title}`, { timeout: 15000 }).then(() => true).catch(() => false);
    ok(found, `${path} se charge (« ${title} »)`);
    if (marker) {
      // Le contenu arrive après le chargement asynchrone (useAsync) : on attend
      // le marqueur lui-même, pas le titre qui s'affiche immédiatement.
      const selector = marker.startsWith('css=') ? marker : `text=${marker}`;
      const markerFound = await page.waitForSelector(selector, { timeout: 20000 }).then(() => true).catch(() => false);
      ok(markerFound, `${path} : contenu attendu (${marker})`);
    }
  }

  /* ---------- 3. Commandes réelles visibles dans la file ---------- */
  await page.goto(`${BASE}/admin/market/orders`, { waitUntil: 'load' });
  const orderVisible = await page.waitForSelector('text=MKT-', { timeout: 20000 }).then(() => true).catch(() => false);
  ok(orderVisible, 'file Commandes Market : commande(s) réelle(s) affichée(s) (réf MKT-…)');

  /* ---------- 4. Anciennes routes : repli propre ---------- */
  for (const old of ['/admin/clients', '/admin/experts', '/admin/reports']) {
    await page.goto(`${BASE}${old}`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const body = await page.evaluate(() => document.body.innerText);
    ok(body.includes('Tableau de bord') && !body.includes('Erreur 404'), `${old} → tableau de bord (pas d'écran d'erreur)`);
  }

  /* ---------- 5. Endpoints API ---------- */
  const get = async (path: string) => (await fetch(`${BASE}${path}`, { headers: { cookie: `${SESSION_COOKIE}=${token}` } })).status;
  ok((await get('/api/admin/customers')) === 404, 'GET /api/admin/customers → 404 (endpoint retiré)');
  ok((await get('/api/admin/reports')) === 404, 'GET /api/admin/reports → 404 (endpoint retiré)');
  const post = async (path: string) => (await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: `${SESSION_COOKIE}=${token}` }, body: '{}' })).status;
  const postExperts = await post('/api/admin/experts');
  ok(postExperts === 404, 'POST /api/admin/experts → 404 (endpoint retiré)', `statut ${postExperts}`);
  ok((await get('/api/admin/experts?assignable=1')) === 200, 'GET /api/admin/experts?assignable=1 → 200 (conservé pour le panneau Exécution)');
  ok((await get('/api/admin/export/leads')) === 200, 'export CSV demandes toujours disponible');

  /* ---------- 6. Changement de statut direct dans les listes (14/11) ----------
     Données de test créées puis supprimées : une demande publique + une
     commande Market (client « Test E2E Nav »). Les vraies commandes
     (MKT-2026-0010, MKT-2026-0018…) ne sont jamais touchées. */
  const prisma = new PrismaClient();
  let testLeadId: string | null = null;
  try {
    // Commande Market publique → statut attendu REQUESTED
    const catalog = await (await fetch(`${BASE}/api/market/catalog`)).json();
    const product = catalog.products?.[0];
    const orderRes = await fetch(`${BASE}/api/market/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: product.id, quantity: 1 }], name: 'Test E2E Nav', phone: '690 12 34 56', zoneName: 'Quartier Test', consent: true, requestKey: crypto.randomUUID() }),
    });
    const orderBody = await orderRes.json() as { orderNumber?: string };
    ok(orderRes.status === 200 && !!orderBody.orderNumber, 'commande Market de test créée', JSON.stringify(orderBody));
    if (orderBody.orderNumber) {
      await page.goto(`${BASE}/admin/market/orders`, { waitUntil: 'load' });
      const row = page.locator('tr', { has: page.locator(`text=${orderBody.orderNumber}`) }).first();
      await row.locator('select').first().waitFor({ timeout: 15000 });
      await row.locator('select').selectOption('SUPPLIER_CHECK');
      const badgeOk = await row.locator('span.rounded-full').first().filter({ hasText: 'Vérification fournisseur' })
        .waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      ok(badgeOk, 'statut changé depuis la file (sans ouvrir le détail) : « Vérification fournisseur »');
    }
    // Demande publique → qualification directe depuis la carte
    const leadRes = await fetch(`${BASE}/api/leads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ need: 'Test e2e statut rapide — à nettoyer', zoneName: 'Quartier Test', name: 'Test E2E Statut', phone: '690 12 34 56', urgency: 'FLEXIBLE', consent: true, requestKey: crypto.randomUUID() }),
    });
    const leadBody = await leadRes.json() as { leadId?: string };
    ok(leadRes.status === 200 && !!leadBody.leadId, 'demande publique de test créée');
    if (leadBody.leadId) {
      testLeadId = leadBody.leadId;
      await page.goto(`${BASE}/admin/leads`, { waitUntil: 'load' });
      await page.waitForSelector('text=Dossiers affichés', { timeout: 20000 });
      const card = page.locator('article', { hasText: 'Test e2e statut rapide' }).first();
      await card.locator('select[id^="qs-"]').first().waitFor({ timeout: 15000 });
      await card.locator('select[id^="qs-"]').selectOption('QUALIFYING');
      const leadBadgeOk = await card.locator('span.rounded-full').first().filter({ hasText: /qualification/i })
        .waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      ok(leadBadgeOk, 'statut de demande changé depuis la carte : « En qualification »');
    }
    // File commandes services : sélecteur présent si des commandes existent
    await page.goto(`${BASE}/admin/orders`, { waitUntil: 'load' });
    await page.waitForSelector('css=input[aria-label="Rechercher une commande"]', { timeout: 20000 });
    const serviceRows = await page.locator('tbody tr').count();
    if (serviceRows > 0) {
      const selects = await page.locator('select[id^="st-quick-"]').count();
      ok(selects > 0, `file commandes services : changement de statut disponible (${selects} sélecteur(s) sur ${serviceRows} ligne(s))`);
    } else {
      console.log('  − aucune commande service en base — sélecteur non applicable (SKIP)');
    }
  } finally {
    // Nettoyage : demande de test, commandes Market de test, clients de test
    // (uniquement s'ils n'ont plus aucune référence). Les vraies données
    // (MKT-2026-0010, MKT-2026-0018, demandes réelles) ne sont jamais touchées.
    try {
      if (testLeadId) {
        await prisma.leadEvent.deleteMany({ where: { leadId: testLeadId } });
        await prisma.lead.delete({ where: { id: testLeadId } }).catch(() => {});
      }
      const customers = await prisma.customer.findMany({
        where: { name: { in: ['Test E2E Nav', 'Test E2E Statut'] } },
        include: { orders: { select: { id: true } }, leads: { select: { id: true } }, reviews: { select: { id: true } }, marketOrders: { select: { id: true } } },
      });
      for (const c of customers) {
        for (const o of c.marketOrders) {
          await prisma.marketOrderEvent.deleteMany({ where: { orderId: o.id } });
          await prisma.marketOrderItem.deleteMany({ where: { orderId: o.id } });
          await prisma.marketOrder.delete({ where: { id: o.id } });
        }
        if (!c.orders.length && !c.leads.length && !c.reviews.length && !c.marketOrders.length) {
          await prisma.customer.delete({ where: { id: c.id } });
        }
      }
    } finally { await prisma.$disconnect(); }
  }
} finally {
  await browser.close();
}

console.log(`\n${fail === 0 ? '✅' : '❌'} admin-essentiel : ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
