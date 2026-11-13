/**
 * E2E réception des commandes Fika Market — parcours complet, données réelles.
 * 1. Client : fiche produit (variante choisie) → « Précommander » → formulaire
 *    → confirmation avec référence MKT-…. Couvre la régression ?product= (le
 *    mode produit direct retombait sur « panier vide ») et la transmission de
 *    la variante.
 * 2. Base : commande REQUESTED avec contact complet, article, variante, événement.
 * 3. Admin (session fondateur réelle, HMAC) : file /admin/market/orders → détail
 *    (client, article, prix à confirmer, transitions disponibles).
 * 4. Nettoyage : commande + client de test supprimés (les événements analytics
 *    du produit seedé sont nettoyés par cleanup.mjs).
 *
 * Prérequis : node e2e/seed.mjs — Exécution : npx tsx e2e/commandes-reception.mts
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { signSession, SESSION_COOKIE } from '../server/routes/auth';
import { FOUNDER_ID } from '../server/lib/founder';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient();
const NAME = 'Test E2E Reception';
const PHONE = '+237690554433';
const PRODUCT_SLUG = 'e2e-nav-ecouteurs-bluetooth';

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
};

const browser = await chromium.launch();
try {
  /* ---------- 1. Parcours client : produit → commande directe ---------- */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/boutique/produit/${PRODUCT_SLUG}`, { waitUntil: 'load' });
  await page.waitForSelector(`text=Écouteurs Bluetooth E2E`, { timeout: 20000 });
  await page.getByRole('button', { name: 'Blanc', exact: true }).click();
  await page.getByRole('link', { name: /Précommander/ }).click();
  await page.waitForSelector('text=Votre commande', { timeout: 15000 });
  await page.waitForSelector('text=Écouteurs Bluetooth E2E', { timeout: 15000 });

  ok(page.url().includes('/boutique/commande?product='), '« Précommander » → page commande en mode produit (régression ?product=)', page.url());
  ok(await page.getByText('Couleur : Blanc').isVisible(), 'variante choisie transmise et affichée');
  ok(!(await page.getByText('Votre panier est vide').count() > 0), 'pas de « panier vide » en mode produit direct');

  await page.fill('#m-name', NAME);
  await page.fill('#m-phone', '690 55 44 33');
  await page.fill('#m-zone', 'Manwi');
  await page.fill('#m-address', 'Station Total, vers la scierie');
  await page.fill('#m-notes', 'Appeler le matin avant 10 h');
  await page.check('input[type=checkbox]');
  await page.getByRole('button', { name: 'Envoyer ma demande de commande' }).click();

  await page.waitForSelector('text=Votre demande est envoyée.', { timeout: 20000 });
  const refMatch = (await page.locator('strong.font-mono').first().innerText()).match(/MKT-\d{4}-\d+/);
  ok(!!refMatch, `confirmation avec référence ${refMatch?.[0] ?? '—'}`);
  const ref = refMatch![0];
  ok(await page.getByText('Rien n\'est engagé avant votre accord', { exact: false }).count() > 0, 'promesse « rien engagé avant accord » rappelée');

  /* ---------- 2. Base : commande complète ---------- */
  const order = await prisma.marketOrder.findUnique({
    where: { orderNumber: ref },
    include: { items: true, events: true, customer: true },
  });
  ok(!!order, 'commande enregistrée en base');
  ok(order?.status === 'REQUESTED', 'statut initial REQUESTED');
  ok(order?.name === NAME && order?.phone === PHONE, 'contact client complet (nom + téléphone E.164)');
  ok(order?.zoneName === 'Manwi' && !!order?.address && !!order?.notes, 'zone, repère et notes conservés');
  ok(order?.items.length === 1 && order?.items[0].productName === 'Écouteurs Bluetooth E2E', 'article snapshot correct');
  ok(order?.items[0].variantLabel === 'Couleur : Blanc', 'variante sauvegardée sur la ligne de commande');
  ok(order?.events.some((e) => e.to === 'REQUESTED'), 'événement « Demande reçue » créé');
  ok(!!order?.customerId, 'client rattaché (fiche client)');

  /* ---------- 3. Admin : réception dans la file Commandes ---------- */
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const token = signSession({ sub: FOUNDER_ID, role: 'SUPERADMIN', exp: Date.now() + 60 * 60 * 1000 });
  await adminCtx.addCookies([{ name: SESSION_COOKIE, value: token, url: BASE, httpOnly: true, sameSite: 'Lax' }]);
  const admin = await adminCtx.newPage();

  await admin.goto(`${BASE}/admin/market/orders`, { waitUntil: 'load' });
  await admin.waitForSelector('text=Commandes', { timeout: 20000 });
  const row = admin.locator('tr', { hasText: ref });
  ok(await row.waitFor({ timeout: 15000 }).then(() => true).catch(() => false), 'commande visible dans la file admin');
  ok((await row.innerText()).includes(NAME), 'nom du client visible dans la file');
  ok((await row.innerText()).includes('Manwi'), 'quartier visible dans la file');
  ok((await row.innerText()).includes('Demande reçue'), 'statut « Demande reçue » affiché');

  await admin.goto(`${BASE}/admin/market/orders/${order!.id}`, { waitUntil: 'load' });
  await admin.waitForSelector(`text=${ref}`, { timeout: 20000 });
  const detail = await admin.evaluate(() => document.body.innerText);
  ok(detail.includes(NAME) && detail.includes('+237690554433'), 'détail : contact complet (nom + téléphone)');
  ok(detail.includes('Écouteurs Bluetooth E2E') && detail.includes('Couleur : Blanc'), 'détail : article et variante');
  ok(detail.includes('Le prix final n\'est pas encore confirmé'), 'détail : prix à confirmer signalé');
  ok(detail.includes('Faire avancer la commande'), 'détail : actions de progression disponibles');
  ok(detail.includes('Code suivi'), 'détail : code suivi présent');
  ok(detail.includes('Appeler le matin avant 10 h'), 'détail : notes client transmises');

  /* ---------- 4. Nettoyage ---------- */
  if (order) {
    await prisma.marketOrderEvent.deleteMany({ where: { orderId: order.id } });
    await prisma.marketOrderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.marketOrder.delete({ where: { id: order.id } });
    if (order.customerId) {
      const remaining = await prisma.marketOrder.count({ where: { customerId: order.customerId } });
      if (remaining === 0) await prisma.customer.delete({ where: { id: order.customerId } });
    }
    const after = await prisma.marketOrder.findUnique({ where: { orderNumber: ref } });
    ok(!after, 'nettoyage : commande de test supprimée');
  }
} finally {
  await browser.close();
  await prisma.$disconnect();
}

console.log(`\n${fail === 0 ? '✅' : '❌'} commandes-reception : ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
