// Nettoyage des données e2e Phase 1 nav — la base repart propre.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  // commandes de test créées par les runs e2e (client "Test E2E Nav")
  const testCustomers = await prisma.customer.findMany({ where: { name: 'Test E2E Nav' }, select: { id: true } });
  for (const c of testCustomers) {
    const orders = await prisma.marketOrder.findMany({ where: { customerId: c.id }, select: { id: true } });
    for (const o of orders) {
      await prisma.marketOrderEvent.deleteMany({ where: { orderId: o.id } });
      await prisma.marketOrderItem.deleteMany({ where: { orderId: o.id } });
      await prisma.marketOrder.delete({ where: { id: o.id } });
    }
    await prisma.customer.delete({ where: { id: c.id } });
  }
  // produits + catégorie de test
  await prisma.marketProduct.deleteMany({ where: { slug: { startsWith: 'e2e-nav-' } } });
  // catégorie e2e : uniquement si plus aucun produit ne l'utilise — le
  // fondateur l'a renommée « Accessoires Mode » avec de vrais produits
  // (LIP TINT, STYLISH BAG) le 13/11, elle lui appartient désormais.
  await prisma.marketCategory.deleteMany({ where: { slug: 'e2e-nav-accessoires', products: { none: {} } } });
  // événements analytics générés pendant les tests — UNIQUEMENT ceux liés aux
  // produits e2e (productId ou meta.slug) ; les événements réels du site en
  // production ne doivent jamais être supprimés (leçon de l'incident 03/11).
  const e2eIds = (await prisma.marketProduct.findMany({ where: { slug: { startsWith: 'e2e-nav-' } }, select: { id: true } })).map((p) => p.id);
  const ev = await prisma.marketAnalyticEvent.deleteMany({
    where: { OR: [{ productId: { in: e2eIds } }, { meta: { path: ['slug'], string_starts_with: 'e2e-nav-' } }] },
  });
  console.log('  événements e2e supprimés :', ev.count);
  // état final
  const count = async (m) => prisma[m].count();
  console.log('Vérification post-nettoyage :');
  console.log('  orders:', await count('marketOrder'), '| items:', await count('marketOrderItem'), '| products:', await count('marketProduct'), '| categories:', await count('marketCategory'), '| events:', await count('marketAnalyticEvent'));
  const svc = await prisma.service.count(); const remaining = await prisma.customer.findMany({ select: { name: true } });
  console.log('  services (à préserver):', svc, '| customers restants:', remaining.map(c => c.name).join(', '));
} finally { await prisma.$disconnect(); }
