import 'dotenv/config';
/**
 * RESTAURATION post-incident (2026-11-03) — usage unique.
 * Resseme les services admin de l'ère v2 perdus lors de la réinitialisation
 * accidentelle de la base (base fantôme pointée sur la production), à partir
 * du snapshot historique prisma/catalog-v2-snapshot.ts (commit 31c0571).
 *
 * - Seuls les services ABSENTS de la base sont créés (idempotent).
 * - Ils sont créés INACTIFS (active=false) : visibles et exploitables côté
 *   admin, jamais exposés au public sans décision du fondateur. Le catalogue
 *   public reste src/lib/catalog-data.ts.
 * - Les catégories v2 manquantes sont recréées (non mises en avant).
 * - Les packs v2 ne sont PAS restaurés (fonctionnalité retirée du catalogue
 *   actuel — commit ba54dc1). Les surcharges ville v2 ne le sont pas non plus
 *   (elles visaient des villes inactives).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { UNIVERSES as V2_UNIVERSES, SERVICES as V2_SERVICES } from './catalog-v2-snapshot';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

const BUDGETS: Record<string, 'FAIBLE' | 'MOYEN' | 'ELEVE'> = {
  Faible: 'FAIBLE', Moyen: 'MOYEN', 'Élevé': 'ELEVE',
};
const DELAIS: Record<string, 'RAPIDE' | 'STANDARD' | 'LONG'> = {
  Rapide: 'RAPIDE', Standard: 'STANDARD', Long: 'LONG',
};
const TYPES: Record<string, 'CREATION' | 'OPTIMISATION' | 'CONSULTING' | 'PRODUCTION' | 'SUPPORT' | 'INTERVENTION'> = {
  Création: 'CREATION', Optimisation: 'OPTIMISATION', Consulting: 'CONSULTING',
  Production: 'PRODUCTION', Support: 'SUPPORT', Intervention: 'INTERVENTION',
};

// Typage permissif : le snapshot est une donnée historique brute (sans
// annotation), le script ne fait que relayer ses champs vers la base.
type V2Service = {
  id: string; slug: string; name: string; categoryId: string; shortDescription: string;
  fullDescription?: string; priceType: string; startingPrice?: number | null;
  priceMin?: number | null; priceMax?: number | null; estimatedDuration?: string | null;
  deliveryIncluded?: boolean; includedItems?: string[]; excludedItems?: string[];
  whatsappTemplate?: string | null; popular?: boolean; displayOrder?: number;
  image?: string | null; seoTitle?: string | null; seoDescription?: string | null;
  budget?: string; delai?: string; typeBesoin?: string;
  howItWorks?: unknown; faqs?: unknown;
  requirements?: { label: string; kind: string; required: boolean; options?: string[]; position: number }[];
};

async function main() {
  // 1. Catégories v2 manquantes (sans mise en avant).
  for (const u of V2_UNIVERSES) {
    await prisma.category.upsert({
      where: { slug: u.slug },
      create: { slug: u.slug, title: u.title, description: u.description ?? null, icon: u.icon ?? null, featured: false },
      update: {},
    });
  }
  const existing = new Set((await prisma.service.findMany({ select: { slug: true } })).map((s) => s.slug));
  const categorySlugById = Object.fromEntries(V2_UNIVERSES.map((u) => [u.id, u.slug]));

  // 2. Services v2 absents de la base — recréés INACTIFS.
  let created = 0;
  let restoredReqs = 0;
  for (const s of V2_SERVICES as V2Service[]) {
    if (existing.has(s.slug)) continue;
    const reqs = s.requirements ?? [];
    const service = await prisma.service.create({
      data: {
        slug: s.slug,
        name: s.name,
        shortDescription: s.shortDescription,
        fullDescription: s.fullDescription ?? null,
        priceType: s.priceType as 'FIXED' | 'FROM' | 'PER_UNIT' | 'QUOTE' | 'DIAGNOSTIC' | 'PROJECT',
        startingPrice: s.startingPrice ?? null,
        priceMin: s.priceMin ?? null,
        priceMax: s.priceMax ?? null,
        estimatedDuration: s.estimatedDuration ?? null,
        deliveryIncluded: Boolean(s.deliveryIncluded),
        includedItems: (s.includedItems ?? []) as string[],
        excludedItems: (s.excludedItems ?? []) as string[],
        whatsappTemplate: s.whatsappTemplate ?? null,
        active: false, // restauration prudente : jamais exposé sans décision fondateur
        featured: false,
        popular: Boolean(s.popular),
        displayOrder: s.displayOrder ?? 99,
        image: s.image ?? null,
        seoTitle: s.seoTitle ?? null,
        seoDescription: s.seoDescription ?? null,
        budget: BUDGETS[s.budget as string] ?? 'MOYEN',
        delai: DELAIS[s.delai as string] ?? 'STANDARD',
        typeBesoin: TYPES[s.typeBesoin as string] ?? 'SUPPORT',
        howItWorks: s.howItWorks ? (s.howItWorks as Prisma.InputJsonValue) : Prisma.JsonNull,
        faqs: s.faqs ? (s.faqs as Prisma.InputJsonValue) : Prisma.JsonNull,
        category: { connect: { slug: categorySlugById[s.categoryId] ?? s.categoryId } },
      },
    });
    if (reqs.length > 0) {
      await prisma.serviceRequirement.createMany({
        data: reqs.map((r) => ({
          serviceId: service.id,
          label: r.label,
          kind: r.kind as 'TEXT' | 'FILE' | 'OPTION' | 'QUANTITY',
          required: r.required,
          options: r.options ?? [],
          position: r.position,
        })),
      });
      restoredReqs += reqs.length;
    }
    created += 1;
    console.log(`[restore] + ${s.slug} (${reqs.length} exigences) — inactif`);
  }

  const total = await prisma.service.count();
  const reqTotal = await prisma.serviceRequirement.count();
  const catTotal = await prisma.category.count();
  console.log(`\n[restore] ${created} service(s) v2 recréé(s), ${restoredReqs} exigences.`);
  console.log(`[restore] État base : ${total} services, ${reqTotal} exigences, ${catTotal} catégories.`);
}

main()
  .catch((e) => { console.error('[restore] Échec :', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
