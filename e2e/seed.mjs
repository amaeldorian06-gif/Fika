// Données e2e Phase 1 nav — supprimées à la fin des tests (cleanup.mjs).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const TAG = 'E2E-NAV1';
try {
  const cat = await prisma.marketCategory.upsert({
    where: { slug: 'e2e-nav-accessoires' },
    update: {},
    create: { slug: 'e2e-nav-accessoires', name: 'Accessoires (e2e)', active: true, position: 99 },
  });
  const p1 = await prisma.marketProduct.upsert({
    where: { slug: 'e2e-nav-ecouteurs-bluetooth' },
    update: { active: true },
    create: {
      slug: 'e2e-nav-ecouteurs-bluetooth', reference: `FK-${TAG}-A`, name: 'Écouteurs Bluetooth E2E',
      categoryId: cat.id, description: 'Écouteurs sans fil de test e2e.',
      specs: [{ label: 'Autonomie', value: '20 h' }], images: [], variants: [{ name: 'Couleur', values: ['Noir', 'Blanc'] }],
      priceSale: 14500, supplierPrice: 9000, estimatedLandedCost: 11000, delayLabel: '3 à 5 jours',
      availability: 'PREORDER', active: true, popular: false,
    },
  });
  const p2 = await prisma.marketProduct.upsert({
    where: { slug: 'e2e-nav-cable-usb' },
    update: { active: true },
    create: {
      slug: 'e2e-nav-cable-usb', reference: `FK-${TAG}-B`, name: 'Câble USB-C E2E',
      categoryId: cat.id, description: 'Câble de charge de test e2e.',
      specs: [], images: [], variants: [],
      priceSale: 2500, supplierPrice: 1200, estimatedLandedCost: 1800, delayLabel: '2 à 4 jours',
      availability: 'AVAILABLE', active: true, popular: false,
    },
  });
  console.log('seed ok:', cat.slug, p1.reference, p2.reference);
} finally { await prisma.$disconnect(); }
