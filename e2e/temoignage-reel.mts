/**
 * E2E témoignages réels (/services, point 4 UX) — chaîne HONNÊTE complète :
 * demande publique → conversion → devis → paiement confirmé → expert →
 * affectation → exécution → commande terminée → avis client vérifié →
 * affichage public. Aucun faux avis : l'avis n'existe que parce que la
 * commande est réellement terminée dans les règles du produit.
 * Tout est supprimé à la fin (finally) — la base revient à son état initial.
 *
 * Exécution : npx tsx e2e/temoignage-reel.ts
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { signSession, SESSION_COOKIE } from '../server/routes/auth';
import { FOUNDER_ID } from '../server/lib/founder';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
};

const PHONE = '+237690123460';
const EXPERT_PHONE = '+237690123461';
const COMMENT = 'Test e2e automatique FIKA — chaîne complète, nettoyage programmé.';

// Session fondateur réelle (HMAC AUTH_SECRET) — jamais de mot de passe en clair.
const token = signSession({ sub: FOUNDER_ID, role: 'SUPERADMIN', exp: Date.now() + 60 * 60 * 1000 });
const adminHeaders = { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE}=${token}` };

async function apiPost(path, body, admin = false) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: admin ? adminHeaders : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const initial = {
  reviews: await prisma.review.count(),
  orders: await prisma.order.count(),
  leads: await prisma.lead.count(),
  customers: await prisma.customer.count(),
  experts: await prisma.expert.count(),
};
console.log('État initial :', JSON.stringify(initial));

let leadId = null, orderId = null, expertId = null, reviewId = null;

try {
  // --- 1. Demande publique (avec service réel : l'avis en hérite) ---
  const service = await prisma.service.findFirst({ where: { slug: 'intervention-plomberie' }, select: { id: true, name: true } });
  if (!service) throw new Error('Service intervention-plomberie introuvable — seed requis.');
  const lead = await apiPost('/api/leads', {
    need: 'Robinet qui goutte, test e2e témoignage.', zoneName: 'Quartier Test', serviceName: service.name,
    serviceId: service.id, name: 'E2E Temoignage', phone: PHONE, urgency: 'FLEXIBLE', consent: true, requestKey: randomUUID(),
  });
  leadId = lead.body.leadId ?? null;
  ok(lead.status === 200 && !!leadId, 'demande publique créée', JSON.stringify(lead.body));

  // --- 2. Conversion en commande ---
  const conv = await apiPost('/api/admin/leads/convert', { leadId, phone: PHONE, name: 'E2E Temoignage' }, true);
  orderId = conv.body.orderId ?? null;
  ok(conv.status === 200 && !!orderId, 'demande convertie en commande', JSON.stringify(conv.body));

  // --- 3. Devis → paiement confirmé → payée ---
  ok((await apiPost('/api/admin/orders/quotes', { orderId, amount: 5000 }, true)).status === 200, 'devis émis (5 000 F)');
  const pay = await apiPost('/api/admin/payments', { orderId, amount: 5000, method: 'CASH', reference: 'E2ETST-1', idempotencyKey: randomUUID() }, true);
  ok(pay.status === 200, 'paiement saisi (en attente)');
  const confirm = await apiPost('/api/admin/payments/review', { paymentId: pay.body.paymentId, action: 'CONFIRM', receivedVerified: true }, true);
  ok(confirm.status === 200, 'paiement confirmé (réception vérifiée)');
  ok((await apiPost('/api/admin/orders/status', { orderId, to: 'PAID' }, true)).status === 200, 'commande payée');

  // --- 4. Expert + affectation ---
  // La gestion des fiches experts n'est plus une section admin (allègement
  // 13/11) : le partenaire de test est créé directement en base. L'affectation
  // (panneau Exécution du détail commande) reste un parcours supporté.
  const exp = await prisma.expert.create({ data: { name: 'E2E Expert Temoignage', phone: EXPERT_PHONE, skills: ['Plomberie'], usualCost: 0 } });
  expertId = exp.id;
  ok(!!expertId, 'expert créé (directement en base)');
  ok((await apiPost('/api/admin/orders/assign', { orderId, expertId }, true)).status === 200, 'expert affecté');

  // --- 5. Exécution jusqu'à « terminée » (l'affectation ne change pas le statut) ---
  for (const to of ['ASSIGNED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'DELIVERED', 'COMPLETED']) {
    const r = await apiPost('/api/admin/orders/status', { orderId, to }, true);
    ok(r.status === 200, `statut ${to}`, r.status !== 200 ? JSON.stringify(r.body) : '');
    if (r.status !== 200) break;
  }

  // --- 6. Avis client (public, commande terminée réelle) ---
  // Saisi par l'équipe ( conception : /api/reviews réservé au back-office).
  const rev = await apiPost('/api/reviews', { orderId, rating: 5, comment: COMMENT }, true);
  reviewId = rev.body.reviewId ?? null;
  ok(rev.status === 200 && !!reviewId, 'avis saisi par l’équipe sur commande terminée', JSON.stringify(rev.body));

  // --- 7. Refus : un second avis sur la même commande ---
  const dup = await apiPost('/api/reviews', { orderId, rating: 4, comment: 'Un deuxième avis ne doit pas passer.' }, true);
  ok(dup.status === 409, 'second avis refusé (1 commande = 1 avis)', JSON.stringify(dup.body));

  // --- 8. Affichage public sur /services ---
  const browser = await chromium.launch();
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto(`${BASE}/services`, { waitUntil: 'load', timeout: 30000 });
  try {
    await p.waitForSelector('#temoignages', { timeout: 15000 });
  } catch {
    ok(false, 'section témoignages affichée (avis réels présents)', 'timeout');
    await browser.close();
    throw new Error('section témoignages absente');
  }
  ok(true, 'section témoignages affichée (avis réels présents)');
  const sectionText = (await p.locator('#temoignages').evaluate((el) => el.textContent)).replace(/\s+/g, ' ');
  ok(sectionText.includes('Avis vérifié (commande terminée)'), 'badge « Avis vérifié » affiché');
  ok(sectionText.includes('E2E T.'), 'nom anonymisé (prénom + initiale)', 'E2E T. attendu');
  ok(sectionText.includes(COMMENT), 'commentaire affiché');
  ok((await p.locator('#temoignages svg').count()) >= 5, 'étoiles de note affichées');
  await browser.close();
} finally {
  // --- Nettoyage complet, ordre des FK respecté ---
  console.log('\nNettoyage…');
  try {
    if (reviewId) { await prisma.review.delete({ where: { id: reviewId } }); console.log('  avis supprimé'); }
    else await prisma.review.deleteMany({ where: { orderId: orderId ?? 'none' } });
    if (orderId) {
      const taskIds = await prisma.task.findMany({ where: { orderId }, select: { id: true } });
      if (taskIds.length) await prisma.taskAssignment.deleteMany({ where: { taskId: { in: taskIds.map((t) => t.id) } } });
      await prisma.task.deleteMany({ where: { orderId } });
      await prisma.cost.deleteMany({ where: { orderId } });
      await prisma.quote.deleteMany({ where: { orderId } });
      await prisma.payment.deleteMany({ where: { orderId } });
      await prisma.orderEvent.deleteMany({ where: { orderId } });
      await prisma.orderItem.deleteMany({ where: { orderId } });
      await prisma.delivery.deleteMany({ where: { orderId } });
      await prisma.order.delete({ where: { id: orderId } });
      console.log('  commande (et dépendances) supprimée');
    }
    if (leadId) {
      await prisma.leadEvent.deleteMany({ where: { leadId } });
      await prisma.lead.delete({ where: { id: leadId } });
      console.log('  demande supprimée');
    }
    // Client de test : uniquement s'il n'a plus aucune référence.
    const cust = await prisma.customer.findUnique({ where: { phone: PHONE }, include: { orders: { select: { id: true } }, leads: { select: { id: true } }, reviews: { select: { id: true } }, marketOrders: { select: { id: true } } } });
    if (cust && !cust.orders.length && !cust.leads.length && !cust.reviews.length && !cust.marketOrders.length) {
      await prisma.customer.delete({ where: { id: cust.id } });
      console.log('  client de test supprimé');
    }
    if (expertId) { await prisma.expert.delete({ where: { id: expertId } }); console.log('  expert supprimé'); }
  } catch (e) {
    fail++;
    console.log('  ✗ ERREUR NETTOYAGE :', String(e));
  }
  const after = {
    reviews: await prisma.review.count(),
    orders: await prisma.order.count(),
    leads: await prisma.lead.count(),
    customers: await prisma.customer.count(),
    experts: await prisma.expert.count(),
  };
  const restored = JSON.stringify(after) === JSON.stringify(initial);
  ok(restored, 'base revenue à l\'état initial', `initial=${JSON.stringify(initial)} après=${JSON.stringify(after)}`);
  await prisma.$disconnect();
}

console.log(`\n===== TÉMOIGNAGE RÉEL (CHAÎNE COMPLÈTE) : ${pass}/${pass + fail} ${fail === 0 ? 'PASS' : 'FAIL'} =====`);
process.exit(fail === 0 ? 0 : 1);
