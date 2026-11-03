import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const orders = await prisma.marketOrder.findMany({ include: { items: true } });
  for (const o of orders) {
    console.log('COMMANDE', o.orderNumber, '| statut:', o.status, '| total:', o.totalPrice, 'F | items:', o.items.map(i => `${i.quantity}× ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ''}`).join(' + '));
  }
  const events = await prisma.marketAnalyticEvent.groupBy({ by: ['type'], _count: true });
  console.log('EVENTS:', events.map(e => `${e.type}=${e._count}`).join(', '));
  const cats = await prisma.marketCategory.count(); const prods = await prisma.marketProduct.count();
  console.log('catégories:', cats, '| produits:', prods);
} finally { await prisma.$disconnect(); }
