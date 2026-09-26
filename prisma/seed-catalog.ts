import 'dotenv/config';
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

/** Ids catalogue → ids base (cuid) : résolution par slug, seule clé stable. */
const categorySlugById: Record<string, string> = Object.fromEntries(UNIVERSES.map((u) => [u.id, u.slug]));
const serviceDbIdByCatalogId = new Map<string, string>();

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
      category: { connect: { slug: categorySlugById[s.categoryId] ?? s.categoryId } },
    };

    const service = await prisma.service.upsert({
      where: { slug: s.slug },
      create: data,
      update: data, // le catalogue est la source de vérité, catégorie comprise (réaffectation par slug)
    });
    serviceDbIdByCatalogId.set(s.id, service.id);

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

function resolveServiceDbId(catalogId: string): string {
  const dbId = serviceDbIdByCatalogId.get(catalogId);
  if (!dbId) throw new Error(`[seed-catalog] Service inconnu en base : ${catalogId}`);
  return dbId;
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
        serviceId: resolveServiceDbId(line.serviceId),
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
  const city = await prisma.city.upsert({
    where: { name: 'Ngaoundéré' },
    create: { name: 'Ngaoundéré', active: true, position: 1 },
    update: {},
  });
  if (DEFAULT_CITY_SLUG !== 'ngaoundere') {
    console.warn(`[seed-catalog] Slug ville inattendu : ${DEFAULT_CITY_SLUG}`);
  }
  for (const row of CITY_PRICES) {
    if (!getServiceRef(row.serviceId)) continue;
    const serviceId = resolveServiceDbId(row.serviceId);
    await prisma.serviceCityPrice.upsert({
      where: { serviceId_cityId: { serviceId, cityId: city.id } },
      create: {
        serviceId,
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
  console.log(`[seed-catalog] ${CITY_PRICES.length} surcharge(s) ville (Ngaoundéré) OK.`);
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

/**
 * Tout ce qui n'est plus dans le catalogue est désactivé (jamais supprimé :
 * les commandes/leads historiques gardent leurs liens). Le front ne lit que
 * les services/packs actifs ; les catégories orphelines n'ont plus de service actif.
 */
async function retireLegacyCatalog() {
  const services = await prisma.service.updateMany({
    where: { slug: { notIn: SERVICES.map((s) => s.slug) }, active: true },
    data: { active: false, featured: false, popular: false },
  });
  const packages = await prisma.package.updateMany({
    where: { slug: { notIn: UNIVERSE_PACKAGES.map((p) => p.slug) }, active: true },
    data: { active: false },
  });
  await prisma.category.updateMany({
    where: { slug: { notIn: UNIVERSES.map((u) => u.slug) } },
    data: { featured: false },
  });
  console.log(`[seed-catalog] Anciens éléments désactivés : ${services.count} service(s), ${packages.count} pack(s).`);
}

async function main() {
  validateCatalog();
  await seedCategories();
  await seedServices();
  await seedPackages();
  await seedCityPrices();
  await retireLegacyCatalog();
}

main()
  .catch((e) => {
    console.error('[seed-catalog] Échec :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
