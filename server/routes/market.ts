import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';
import {
  MARKET_ANALYTIC_TYPES, marketOrderPayloadSchema, marketVariantsSchema,
  type MarketProductPublic, type MarketProductVariant,
} from '../../src/lib/market';
import { normalizePhoneE164 } from '../../src/lib/lead';
import { sendMarketOrderAlert } from '../lib/notify';
import { serialTransaction, nextDocumentNumber } from '../lib/transaction';

/**
 * API publique Fika Market — catalogue, demande de commande, suivi.
 * Sécurité : sélection explicite des champs publics (JAMAIS de coûts
 * fournisseurs), débit limité par IP, téléphone normalisé E.164,
 * code de suivi sans données personnelles.
 */

/**
 * Débit limité par IP ET par finalité (clé composite « ip:scope ») : les
 * événements analytics (60/min) ne doivent pas consommer le budget de
 * commandes (10/min) d'un même visiteur — sinon un client qui parcourt
 * la boutique avant de commander se voyait refuser sa commande (429).
 * Compteurs en mémoire : remis à zéro au redémarrage du serveur.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
export function checkMarketRate(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  if (buckets.size > 10000) {
    for (const [k, value] of buckets) if (value.resetAt < now) buckets.delete(k);
    if (buckets.size > 10000 && !buckets.has(key)) return false;
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

type Spec = { label?: unknown; value?: unknown };

/** Projection publique : champs explicitement choisis, coûts exclus. */
function toPublicProduct(p: {
  id: string; slug: string; name: string; reference: string; description: string | null;
  specs: unknown; images: unknown; variants: unknown; priceSale: number; delayLabel: string | null;
  availability: MarketProductPublic['availability']; popular: boolean;
  category: { slug: string; name: string };
}): MarketProductPublic {
  const specs = Array.isArray(p.specs)
    ? (p.specs as Spec[]).filter((s) => typeof s?.label === 'string' && typeof s?.value === 'string')
      .slice(0, 12).map((s) => ({ label: String(s.label), value: String(s.value) }))
    : [];
  const images = Array.isArray(p.images)
    ? (p.images as unknown[]).filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u) || typeof u === 'string' && u.startsWith('/')).slice(0, 6)
    : [];
  const parsedVariants = marketVariantsSchema.safeParse(p.variants ?? []);
  const variants: MarketProductVariant[] = parsedVariants.success ? parsedVariants.data : [];
  return {
    id: p.id, slug: p.slug, name: p.name, reference: p.reference,
    category: p.category, description: p.description, specs, images, variants,
    priceSale: p.priceSale, delayLabel: p.delayLabel, availability: p.availability, popular: p.popular,
  };
}

const publicProductSelect = {
  id: true, slug: true, name: true, reference: true, description: true, specs: true,
  images: true, variants: true, priceSale: true, delayLabel: true, availability: true, popular: true,
  category: { select: { slug: true, name: true } },
};

export async function getMarketCatalog(categorySlug?: string): Promise<{
  categories: { slug: string; name: string }[];
  products: MarketProductPublic[];
}> {
  const categories = await prisma.marketCategory.findMany({
    where: { active: true }, orderBy: { position: 'asc' }, select: { slug: true, name: true },
  });
  const products = (await prisma.marketProduct.findMany({ where: { active: true }, orderBy: [{ popular: 'desc' }, { name: 'asc' }], select: publicProductSelect }))
    .filter((p) => !categorySlug || p.category.slug === categorySlug)
    .map(toPublicProduct);
  return { categories, products };
}

export async function getMarketProduct(slug: string): Promise<MarketProductPublic | null> {
  const p = await prisma.marketProduct.findFirst({
    where: { slug, active: true }, select: publicProductSelect,
  });
  return p ? toPublicProduct(p) : null;
}

export type MarketOrderResult =
  | { status: 200; body: { ok: true; orderNumber: string } }
  | { status: 400 | 429; body: { ok: false; code: string; message: string; issues?: Record<string, string[]> } };

export async function createMarketOrder(body: unknown, ip: string): Promise<MarketOrderResult> {
  if (!checkMarketRate(`${ip || 'unknown'}:order`)) {
    return { status: 429, body: { ok: false, code: 'RATE_LIMITED', message: 'Trop de demandes. Réessayez dans une minute.' } };
  }
  const parsed = marketOrderPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { ok: false, code: 'VALIDATION', message: 'Commande invalide. Vérifiez les champs.', issues: z.flattenError(parsed.error).fieldErrors },
    };
  }
  const data = parsed.data;
  const phone = normalizePhoneE164(data.phone)!;

  // Idempotence : un double-clic ne crée jamais deux commandes.
  if (data.requestKey) {
    const existing = await prisma.marketOrder.findUnique({ where: { requestKey: data.requestKey } });
    if (existing) return { status: 200, body: { ok: true, orderNumber: existing.orderNumber } };
  }

  // Produits : tous doivent exister et être actifs. Indisponible => précommande impossible.
  const products = await prisma.marketProduct.findMany({
    where: { id: { in: data.items.map((i) => i.productId) }, active: true },
    select: { id: true, name: true, availability: true, priceSale: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  if (data.items.some((i) => !byId.get(i.productId))) {
    return { status: 400, body: { ok: false, code: 'PRODUCT_INVALID', message: 'Un produit de votre commande n’est plus disponible.' } };
  }
  if (data.items.some((i) => byId.get(i.productId)!.availability === 'UNAVAILABLE')) {
    return { status: 400, body: { ok: false, code: 'PRODUCT_UNAVAILABLE', message: 'Ce produit est actuellement indisponible. Contactez-nous pour une alternative.' } };
  }

  const created: { orderNumber?: string } = {};
  const result: MarketOrderResult = await serialTransaction(async tx => {
    let order: { id: string; orderNumber: string; trackCode: string };
    try {
      const customer = await tx.customer.upsert({
        where: { phone },
        create: { phone, name: data.name },
        update: data.name ? { name: data.name } : {},
      });
      order = await tx.marketOrder.create({
        data: {
          orderNumber: await nextDocumentNumber(tx, 'MKT'),
          trackCode: randomBytes(6).toString('base64url').toUpperCase(),
          requestKey: data.requestKey,
          customerId: customer.id,
          name: data.name, phone, zoneName: data.zoneName,
          address: data.address ?? null, notes: data.notes ?? null,
          status: 'REQUESTED', source: 'SITE',
          items: { create: data.items.map((i) => ({ productId: i.productId, productName: byId.get(i.productId)!.name, variantLabel: i.variantLabel ?? null, quantity: i.quantity })) },
          events: { create: { to: 'REQUESTED', note: 'Demande reçue depuis la boutique.' } },
        },
        select: { id: true, orderNumber: true, trackCode: true },
      });
    } catch (e) {
      if (data.requestKey && typeof e === 'object' && e && 'code' in e && e.code === 'P2002') {
        const existing = await tx.marketOrder.findUnique({ where: { requestKey: data.requestKey } });
        if (existing) return { status: 200, body: { ok: true, orderNumber: existing.orderNumber } };
      }
      throw e;
    }
    created.orderNumber = order.orderNumber;
    return { status: 200, body: { ok: true, orderNumber: order.orderNumber } };
  });
  // Alerte e-mail best-effort au fondateur — jamais sur un double-clic (idempotence).
  if (created.orderNumber) {
    await sendMarketOrderAlert({
      orderNumber: created.orderNumber,
      name: data.name, phone, zoneName: data.zoneName,
      address: data.address ?? null, notes: data.notes ?? null,
      items: data.items.map((i) => {
        const p = byId.get(i.productId)!;
        return { productName: p.name, variantLabel: i.variantLabel ?? null, quantity: i.quantity, unitPrice: p.priceSale };
      }),
      totalIndicatif: data.items.reduce((t, i) => t + (byId.get(i.productId)?.priceSale ?? 0) * i.quantity, 0),
    });
  }
  return result;
}

/** Suivi public : étapes datées + produits, sans coordonnées client. */
/* ------------------------- Événements analytiques -------------------------- */

const analyticEventSchema = z.object({
  type: z.enum(MARKET_ANALYTIC_TYPES),
  productId: z.string().max(60).optional(),
  slug: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
});

/** Funnel pré-commande : vues boutique/produit, ajout panier, début commande. Sans données personnelles. */
export async function recordMarketAnalyticEvent(body: unknown, ip: string): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!checkMarketRate(`${ip || 'unknown'}:events`, 60, 60_000)) return { status: 429, body: { ok: false, code: 'RATE_LIMITED', message: 'Trop de requêtes.' } };
  const parsed = analyticEventSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { ok: false, message: 'Événement invalide.' } };
  const d = parsed.data;
  let productId: string | null = null;
  if (d.productId || d.slug) {
    const product = await prisma.marketProduct.findFirst({
      where: d.productId ? { id: d.productId } : { slug: d.slug ?? '' },
      select: { id: true },
    });
    productId = product?.id ?? null;
  }
  await prisma.marketAnalyticEvent.create({
    data: {
      type: d.type,
      productId,
      meta: { slug: d.slug ?? null, category: d.category ?? null },
    },
  });
  return { status: 200, body: { ok: true } };
}
