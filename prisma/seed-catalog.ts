/**
 * Seed catalogue Fika (P03) — idempotent.
 * Sème les 7 univers, les services enrichis (+ ServiceRequirement), les packs
 * (+ lignes PackageService avec remise réelle calculée) et les surcharges
 * ville (ServiceCityPrice).
 *
 * Le dataset vient de src/lib/catalog-data.ts : le modifier modifie le seed
 * ET l'UI. Prérequis : le seed de base (prisma/seed.ts) pour la ville.
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  UNIVERSES, SERVICES, UNIVERSE_PACKAGES, CITY_PRICES, DEFAULT_CITY_SLUG,
  getServiceRef,
} from '../src/lib/catalog-data';
import {
  computePackageSavings, formatPriceFCFA, validatePriceConsistency,
} from '../src/lib/pricing';
import type { BudgetLevel, DelayLevel, NeedType } from '../src/lib/types';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

/* Enums DB (sans accents) ↔ libellés DTO. */
const BUDGETS: Record<BudgetLevel, 'FAIBLE' | 'MOYEN' | 'ELEVE'> = {
  Faible: 'FAIBLE', Moyen: 'MOYEN', 'Élevé': 'ELEVE',
};
const DELAIS: Record<DelayLevel, 'RAPIDE' | 'STANDARD' | 'LONG'> = {
  Rapide: 'RAPIDE', Standard: 'STANDARD', Long: 'LONG',
};
const TYPES: Record<NeedType, 'CREATION' | 'OPTIMISATION' | 'CONSULTING' | 'PRODUCTION' | 'SUPPORT' | 'INTERVENTION'> = {
  Création: 'CREATION', Optimisation: 'OPTIMISATION', Consulting: 'CONSULTING',
  Production: 'PRODUCTION', Support: 'SUPPORT', Intervention: 'INTERVENTION',
};

async function seedCategories() {
  for (const u of UNIVERSES) {
    await prisma.category.upsert({
      where: { slug: u.slug },
      create: { slug: u.slug, title: u.title, description: u.description, icon: u.icon, featured: u.featured },
      update: { title: u.title, description: u.description, icon: u.icon, featured: u.featured },
    });
  }
  console.log(`[seed-catalog] ${UNIVERSES.length} catégories OK.`);
}

async function seedServices() {
  for (const s of SERVICES) {
    const data = {
      slug: s.slug,
      name: s.name,
      shortDescription: s.shortDescription,
      fullDescription: s.fullDescription ?? null,
      priceType: s.priceType,
      startingPrice: s.startingPrice ?? null,
      priceMin: s.priceMin ?? null,
      priceMax: s.priceMax ?? null,
      estimatedDuration: s.estimatedDuration ?? null,
      deliveryIncluded: s.deliveryIncluded,
      includedItems: s.includedItems,
      excludedItems: s.excludedItems,
      whatsappTemplate: s.whatsappTemplate ?? null,
      active: s.active,
      featured: s.featured,
      popular: s.popular,
      displayOrder: s.displayOrder,
      image: s.image ?? null,
      seoTitle: s.seoTitle ?? null,
      seoDescription: s.seoDescription ?? null,
      budget: BUDGETS[s.budget],
      delai: DELAIS[s.delai],
      typeBesoin: TYPES[s.typeBesoin],
      howItWorks: s.howItWorks ? (s.howItWorks as Prisma.InputJsonValue) : Prisma.JsonNull,
      faqs: s.faqs ? (s.faqs as Prisma.InputJsonValue) : Prisma.JsonNull,
      category: { connect: { id: s.categoryId } },
    };

    const service = await prisma.service.upsert({
      where: { slug: s.slug },
      create: data,
      update: { ...data, category: undefined }, // catégorie fixe après création
    });

    // Requirements : remplacement déterministe (structure P04).
    await prisma.serviceRequirement.deleteMany({ where: { serviceId: service.id } });
    if (s.requirements.length > 0) {
      await prisma.serviceRequirement.createMany({
        data: s.requirements.map((r) => ({
          serviceId: service.id,
          label: r.label,
          kind: r.kind,
          required: r.required,
          options: r.options ?? [],
          position: r.position,
        })),
      });
    }
  }
  console.log(`[seed-catalog] ${SERVICES.length} services + requirements OK.`);
}

async function seedPackages() {
  for (const p of UNIVERSE_PACKAGES) {
    const pkg = await prisma.package.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug, title: p.title, description: p.description ?? null,
        price: p.price, targetCustomer: p.targetCustomer ?? null,
        savings: null, // remise calculée à la lecture (lib/pricing)
        whatsappTemplate: p.whatsappTemplate ?? null, active: p.active,
      },
      update: {
        title: p.title, description: p.description ?? null,
        price: p.price, targetCustomer: p.targetCustomer ?? null, active: p.active,
      },
    });

    await prisma.packageService.deleteMany({ where: { packageId: pkg.id } });
    await prisma.packageService.createMany({
      data: p.services.map((line) => ({
        packageId: pkg.id,
        serviceId: line.serviceId,
        quantity: line.quantity,
        customName: line.customName ?? null,
      })),
    });
  }

  for (const p of UNIVERSE_PACKAGES) {
    console.log(`[seed-catalog] Pack « ${p.title} » : remise réelle ${formatPriceFCFA(computePackageSavings(p))}.`);
  }
}

async function seedCityPrices() {
  const city = await prisma.city.findUnique({ where: { name: 'Ngaoundéré' } });
  if (!city) {
    console.warn('[seed-catalog] Ville introuvable — lancez d\u2019abord le seed de base (prisma:seed). Surcharges ville ignorées.');
    return;
  }
  if (DEFAULT_CITY_SLUG !== 'ngaoundere') {
    console.warn(`[seed-catalog] Slug ville inattendu : ${DEFAULT_CITY_SLUG}`);
  }
  for (const row of CITY_PRICES) {
    if (!getServiceRef(row.serviceId)) continue;
    await prisma.serviceCityPrice.upsert({
      where: { serviceId_cityId: { serviceId: row.serviceId, cityId: city.id } },
      create: {
        serviceId: row.serviceId,
        cityId: city.id,
        priceMin: row.priceMin,
        priceMax: row.priceMax,
        targetMargin: row.targetMarginPercent != null ? row.targetMarginPercent / 100 : null,
        deliveryIncluded: row.deliveryIncluded,
      },
      update: {
        priceMin: row.priceMin,
        priceMax: row.priceMax,
        targetMargin: row.targetMarginPercent != null ? row.targetMarginPercent / 100 : null,
        deliveryIncluded: row.deliveryIncluded,
      },
    });
  }
  console.log(`[seed-catalog] ${CITY_PRICES.length} surcharge(s) ville (Ngaoundéré, deliveryIncluded=true) OK.`);
}

function validateCatalog() {
  const issues = [
    ...SERVICES.flatMap((s) => validatePriceConsistency(s)),
    ...UNIVERSE_PACKAGES.flatMap((p) => validatePriceConsistency(p)),
  ];
  if (issues.length > 0) {
    console.warn('[seed-catalog] Incohérences tarifaires détectées :');
    issues.forEach((i) => console.warn(`  - [${i.code}] ${i.message}`));
  } else {
    console.log('[seed-catalog] Cohérence tarifaire : 0 incohérence (services + packs).');
  }
}

async function main() {
  validateCatalog();
  await seedCategories();
  await seedServices();
  await seedPackages();
  await seedCityPrices();
}

main()
  .catch((e) => {
    console.error('[seed-catalog] Échec :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
