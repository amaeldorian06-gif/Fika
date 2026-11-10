import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';
import {
  MARKET_QUOTE_VALIDITY_DAYS, MARKET_QUOTE_LABELS, MARKET_BATCH_LABELS,
  allocateMarketExpenses, canTransition, canTransitionBatch, deriveMarketPaymentStatus,
  isMarketBatchStatus, isMarketStatus, isQuoteRespondable, marketVariantsSchema,
  MARKET_STATUS_LABELS, type MarketAllocationMethod, type MarketBatchStatusV2, type MarketOrderStatus, type MarketPaymentStatus,
} from '../../src/lib/market';
import { nextDocumentNumber, serialTransaction } from '../lib/transaction';
import { computeLedger, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, type LedgerPaymentStatus } from '../../src/lib/market-ledger';

/**
 * API admin Fika Market 2.0 — catalogue, devis, commandes, paiements,
 * remboursements, approvisionnements (dépenses + allocation), livraisons,
 * indicateurs. Toutes ces routes sont derrière la garde de session admin
 * (server/app.ts) ; les coûts fournisseurs ne circulent JAMAIS dans les API
 * publiques. Les prix d'un devis sont verrouillés à la création (snapshot).
 */

type R<T = Record<string, unknown>> = { status: number; body: T };

const ok = (body: Record<string, unknown> = {}): R => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, message: string): R => ({ status, body: { ok: false, message } });

/* ------------------------------ Produits ---------------------------------- */

const specSchema = z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(200) });

const productSchema = z.object({
  productId: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  reference: z.string().trim().min(2).max(40),
  categoryId: z.string().min(1),
  supplierId: z.string().max(60).nullable().optional(),
  description: z.string().trim().max(3000).nullable().optional(),
  specs: z.array(specSchema).max(12).default([]),
  images: z.array(z.string().trim().max(400).regex(/^https?:\/\/|^\//, 'URL d’image invalide.')).max(6).default([]),
  variants: marketVariantsSchema.default([]),
  priceSale: z.number().int().min(100).max(50_000_000),
  supplierPrice: z.number().int().min(0).max(50_000_000).default(0),
  estimatedLandedCost: z.number().int().min(0).max(50_000_000).default(0),
  delayLabel: z.string().trim().max(120).nullable().optional(),
  availability: z.enum(['AVAILABLE', 'PREORDER', 'UNAVAILABLE']).default('PREORDER'),
  active: z.boolean().default(true),
  popular: z.boolean().default(false),
});

const slugify = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'produit';

export async function listMarketProducts(): Promise<unknown[]> {
  const rows = await prisma.marketProduct.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: { category: { select: { name: true } }, supplier: { select: { name: true } } },
  });
  return rows.map((p) => ({
    ...p,
    categoryName: p.category.name, supplierName: p.supplier?.name ?? null,
    estimatedMargin: p.priceSale - p.estimatedLandedCost,
    specsCount: Array.isArray(p.specs) ? (p.specs as unknown[]).length : 0,
    imagesCount: Array.isArray(p.images) ? (p.images as unknown[]).length : 0,
  }));
}

export async function saveMarketProduct(body: unknown): Promise<R> {
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  const category = await prisma.marketCategory.findUnique({ where: { id: d.categoryId } });
  if (!category) return fail(400, 'Catégorie introuvable.');
  if (d.supplierId) {
    const supplier = await prisma.marketSupplier.findUnique({ where: { id: d.supplierId } });
    if (!supplier) return fail(400, 'Fournisseur introuvable.');
  }
  const data = {
    name: d.name, reference: d.reference, categoryId: d.categoryId,
    supplierId: d.supplierId ?? null, description: d.description ?? null,
    specs: d.specs, images: d.images, variants: d.variants, priceSale: d.priceSale,
    supplierPrice: d.supplierPrice, estimatedLandedCost: d.estimatedLandedCost,
    delayLabel: d.delayLabel ?? null, availability: d.availability,
    active: d.active, popular: d.popular,
  };
  try {
    if (d.productId) {
      await prisma.marketProduct.update({ where: { id: d.productId }, data });
      return ok();
    }
    // slug unique : suffixe incrémenté si pris
    let slug = slugify(d.name);
    for (let i = 2; i < 50; i++) {
      const taken = await prisma.marketProduct.findUnique({ where: { slug } });
      if (!taken) break;
      slug = `${slugify(d.name)}-${i}`;
    }
    await prisma.marketProduct.create({ data: { ...data, slug } });
    return ok();
  } catch (e) {
    if (typeof e === 'object' && e && 'code' in e && e.code === 'P2002') return fail(409, 'Cette référence produit existe déjà.');
    throw e;
  }
}

/* ----------------------------- Catégories --------------------------------- */

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  position: z.number().int().min(0).max(99).default(0),
  active: z.boolean().default(true),
});

export async function saveMarketCategory(body: unknown): Promise<R> {
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  const data = { name: d.name, position: d.position, active: d.active };
  if (d.id) {
    await prisma.marketCategory.update({ where: { id: d.id }, data });
    return ok();
  }
  const slug = slugify(d.name);
  if (await prisma.marketCategory.findUnique({ where: { slug } })) return fail(409, 'Cette catégorie existe déjà.');
  await prisma.marketCategory.create({ data: { ...data, slug } });
  return ok();
}

/* ----------------------------- Fournisseurs -------------------------------- */

const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().max(160).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  active: z.boolean().default(true),
});

export async function listMarketSuppliers(): Promise<unknown[]> {
  return prisma.marketSupplier.findMany({ orderBy: { name: 'asc' } });
}

export async function saveMarketSupplier(body: unknown): Promise<R> {
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  const data = { name: d.name, contact: d.contact ?? null, note: d.note ?? null, active: d.active };
  if (d.id) await prisma.marketSupplier.update({ where: { id: d.id }, data });
  else await prisma.marketSupplier.create({ data });
  return ok();
}

/* ------------------------------ Commandes --------------------------------- */

const orderInclude = {
  items: true,
  events: { orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { createdAt: 'asc' as const } },
  refunds: { orderBy: { createdAt: 'asc' as const } },
  quotes: { orderBy: { createdAt: 'desc' as const } },
  delivery: true,
} as const;

/** Marque expirés les devis SENT dont la validité est passée (évaluation paresseuse). */
async function expireStaleQuotes(): Promise<void> {
  await prisma.marketQuote.updateMany({
    where: { status: 'SENT', validUntil: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
}

function marketOrderSummary(o: {
  id: string; orderNumber: string; trackCode: string; status: string; name: string; phone: string;
  zoneName: string; createdAt: Date; deliveryFee: number | null; deliveredAt: Date | null;
  items: { productName: string; variantLabel: string | null; quantity: number; unitPrice: number | null; unitCostReal: number | null }[];
  payments: { amount: number; status: string }[];
  refunds?: { amount: number }[];
  quotes?: { quoteNumber: string; status: string; validUntil: Date | null }[];
  delivery: { cost: number } | null;
}) {
  const total = o.items.every((i) => i.unitPrice != null)
    ? o.items.reduce((s, i) => s + i.unitPrice! * i.quantity, 0) + (o.deliveryFee ?? 0) : null;
  const confirmed = o.payments.filter((p) => p.status === 'CONFIRMED').reduce((s, p) => s + p.amount, 0);
  const refunded = (o.refunds ?? []).reduce((s, r) => s + r.amount, 0);
  const margin = total != null && o.items.every((i) => i.unitCostReal != null)
    ? total - o.items.reduce((s, i) => s + i.unitCostReal! * i.quantity, 0) - (o.delivery?.cost ?? 0)
    : null;
  const activeQuote = (o.quotes ?? []).find((q) => q.status === 'SENT' || q.status === 'ACCEPTED') ?? (o.quotes ?? [])[0] ?? null;
  const paymentStatus: MarketPaymentStatus = deriveMarketPaymentStatus({
    orderStatus: o.status as MarketOrderStatus,
    total,
    confirmedPayments: confirmed,
    pendingPayments: o.payments.filter((p) => p.status === 'PENDING').length,
    rejectedPayments: o.payments.filter((p) => p.status === 'REJECTED').length,
    refunds: refunded,
  });
  return {
    id: o.id, orderNumber: o.orderNumber, trackCode: o.trackCode, status: o.status,
    statusLabel: MARKET_STATUS_LABELS[o.status as MarketOrderStatus] ?? o.status,
    paymentStatus,
    name: o.name, phone: o.phone, zoneName: o.zoneName, createdAt: o.createdAt.toISOString(),
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    products: o.items.map((i) => i.productName + (i.variantLabel ? ` (${i.variantLabel})` : '')).join(' · '),
    total, paid: confirmed, refunded, margin, deliveredAt: o.deliveredAt?.toISOString() ?? null,
    quote: activeQuote ? { quoteNumber: activeQuote.quoteNumber, status: activeQuote.status } : null,
  };
}

export async function listMarketOrders(status?: string, q?: string): Promise<unknown[]> {
  await expireStaleQuotes();
  const rows = await prisma.marketOrder.findMany({ include: orderInclude, orderBy: { createdAt: 'desc' } });
  const search = q?.trim().toLocaleLowerCase('fr');
  return rows
    .filter((o) => (!status || o.status === status) &&
      (!search || [o.orderNumber, o.name, o.phone, o.trackCode].some((v) => v?.toLocaleLowerCase('fr').includes(search))))
    .map(marketOrderSummary);
}

export async function getMarketOrder(id: string): Promise<unknown | null> {
  await expireStaleQuotes();
  const o = await prisma.marketOrder.findUnique({ where: { id }, include: orderInclude });
  if (!o) return null;
  return {
    ...marketOrderSummary(o),
    address: o.address, notes: o.notes, source: o.source,
    items: o.items.map((i) => ({ ...i })),
    events: o.events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    payments: o.payments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), confirmedAt: p.confirmedAt?.toISOString() ?? null })),
    refunds: o.refunds.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    quotes: o.quotes.map((q) => ({
      quoteNumber: q.quoteNumber, status: q.status, statusLabel: MARKET_QUOTE_LABELS[q.status as keyof typeof MARKET_QUOTE_LABELS] ?? q.status,
      items: q.items, deliveryFee: q.deliveryFee, totalAmount: q.totalAmount, note: q.note,
      validUntil: q.validUntil?.toISOString() ?? null, sentAt: q.sentAt?.toISOString() ?? null,
      acceptedAt: q.acceptedAt?.toISOString() ?? null, rejectedAt: q.rejectedAt?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
    })),
    delivery: o.delivery ? { ...o.delivery, scheduledAt: o.delivery.scheduledAt?.toISOString() ?? null, deliveredAt: o.delivery.deliveredAt?.toISOString() ?? null } : null,
  };
}

/* ------------------------- Transitions de statut --------------------------- */

const statusSchema = z.object({
  orderId: z.string().min(1),
  to: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

export async function updateMarketOrderStatus(body: unknown, adminId: string): Promise<R> {
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'Requête invalide.');
  const { orderId, to, note } = parsed.data;
  if (!isMarketStatus(to)) return fail(400, 'Statut inconnu.');
  return serialTransaction(async tx => {
    const order = await tx.marketOrder.findUnique({ where: { id: orderId }, include: { items: { select: { unitPrice: true, quantity: true } } } });
    if (!order) return fail(404, 'Commande introuvable.');
    if (!canTransition(order.status as MarketOrderStatus, to)) {
      return fail(409, `Transition refusée : ${MARKET_STATUS_LABELS[order.status as MarketOrderStatus]} → ${MARKET_STATUS_LABELS[to]}.`);
    }
    // Garde-fou métier : pas de confirmation sans prix final, pas de livraison sans paiement vérifié.
    if (to === 'CONFIRMED' && order.items.some((i) => i.unitPrice == null)) {
      return fail(409, 'Confirmez d’abord le prix final de chaque article (devis).');
    }
    if (to === 'DELIVERED') {
      const paid = (await tx.marketPayment.findMany({ where: { orderId, status: 'CONFIRMED' } })).reduce((s, p) => s + p.amount, 0);
      const full = order.items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0) + (order.deliveryFee ?? 0);
      if (paid < full) return fail(409, 'Le paiement confirmé doit couvrir le total avant la clôture.');
    }
    await tx.marketOrder.update({
      where: { id: orderId },
      data: {
        status: to,
        confirmedAt: to === 'CONFIRMED' ? new Date() : order.confirmedAt,
        deliveredAt: to === 'DELIVERED' ? new Date() : order.deliveredAt,
      },
    });
    await tx.marketOrderEvent.create({ data: { orderId, from: order.status, to, note: note ?? null, actorId: adminId } });
    return ok();
  });
}

/* ---------------------- Confirmation du prix final ------------------------- */

const priceSchema = z.object({
  orderId: z.string().min(1),
  deliveryFee: z.number().int().min(0).max(500_000),
  items: z.array(z.object({ itemId: z.string().min(1), unitPrice: z.number().int().min(0).max(50_000_000) })).min(1),
  note: z.string().trim().max(500).optional(),
});

export async function confirmMarketPrice(body: unknown, adminId: string): Promise<R> {
  const parsed = priceSchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  return serialTransaction(async tx => {
    const order = await tx.marketOrder.findUnique({ where: { id: d.orderId }, include: { items: { select: { id: true } } } });
    if (!order) return fail(404, 'Commande introuvable.');
    if (!['REQUESTED', 'SUPPLIER_CHECK', 'AWAITING_CLIENT', 'DELAYED'].includes(order.status)) {
      return fail(409, 'Le prix final est déjà confirmé pour cette commande.');
    }
    if (d.items.length !== order.items.length || order.items.some((i) => !d.items.find((x) => x.itemId === i.id))) {
      return fail(400, 'Renseignez le prix de chaque article.');
    }
    for (const item of d.items) {
      await tx.marketOrderItem.update({ where: { id: item.itemId }, data: { unitPrice: item.unitPrice } });
    }
    await tx.marketOrder.update({ where: { id: d.orderId }, data: { deliveryFee: d.deliveryFee, status: 'AWAITING_CLIENT' } });
    await tx.marketOrderEvent.create({
      data: {
        orderId: d.orderId, from: order.status, to: 'AWAITING_CLIENT', actorId: adminId,
        note: d.note ?? 'Prix final et délai communiqués au client.',
      },
    });
    return ok();
  });
}

/* -------------------------------- Devis ------------------------------------ */

const quoteSchema = z.object({
  orderId: z.string().min(1),
  validDays: z.number().int().min(1).max(90).optional(),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Crée le devis depuis les prix confirmés de la commande : snapshot verrouillé
 * (nom, référence, variante, quantité, prix unitaire), frais, total, validité.
 * La commande passe en AWAITING_CLIENT (attente de la réponse du client).
 */
export async function createMarketQuote(body: unknown, adminId: string): Promise<R> {
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  return serialTransaction(async tx => {
    const order = await tx.marketOrder.findUnique({
      where: { id: d.orderId },
      include: { items: { include: { product: { select: { reference: true } } } } },
    });
    if (!order) return fail(404, 'Commande introuvable.');
    if (!['REQUESTED', 'SUPPLIER_CHECK', 'AWAITING_CLIENT', 'DELAYED'].includes(order.status)) {
      return fail(409, 'Un devis ne peut être créé qu’avant la confirmation de la commande.');
    }
    if (order.items.length === 0) return fail(400, 'Commande sans article.');
    if (order.items.some((i) => i.unitPrice == null) || order.deliveryFee == null) {
      return fail(409, 'Confirmez d’abord le prix final de chaque article et les frais de livraison.');
    }
    const items = order.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      reference: i.product?.reference ?? null,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      unitPrice: i.unitPrice!,
    }));
    const totalAmount = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) + order.deliveryFee;
    const validUntil = new Date(Date.now() + (d.validDays ?? MARKET_QUOTE_VALIDITY_DAYS) * 24 * 3600 * 1000);
    const quote = await tx.marketQuote.create({
      data: {
        quoteNumber: await nextDocumentNumber(tx, 'MQT'),
        orderId: order.id,
        status: 'SENT',
        items,
        deliveryFee: order.deliveryFee,
        totalAmount,
        note: d.note ?? null,
        validUntil,
        sentAt: new Date(),
        createdById: adminId,
      },
      select: { quoteNumber: true, validUntil: true, totalAmount: true },
    });
    if (order.status !== 'AWAITING_CLIENT') {
      await tx.marketOrder.update({ where: { id: order.id }, data: { status: 'AWAITING_CLIENT' } });
    }
    await tx.marketOrderEvent.create({
      data: {
        orderId: order.id, from: order.status, to: 'AWAITING_CLIENT', actorId: adminId,
        note: `Devis ${quote.quoteNumber} envoyé au client (valable jusqu’au ${validUntil.toLocaleDateString('fr-FR')}).`,
      },
    });
    return ok({ quoteNumber: quote.quoteNumber, totalAmount: quote.totalAmount, validUntil: validUntil.toISOString() });
  });
}

const quoteResponseSchema = z.object({
  quoteId: z.string().min(1),
  action: z.enum(['ACCEPTED', 'REJECTED']),
  note: z.string().trim().max(500).optional(),
});

/**
 * Enregistre la réponse du client (reçue par WhatsApp/téléphone — décision D5).
 * ACCEPTED → la commande attend le paiement. REJECTED → la commande reste en
 * attente ; l'admin décide ensuite (relance, nouveau devis, annulation).
 */
export async function respondMarketQuote(body: unknown, adminId: string): Promise<R> {
  const parsed = quoteResponseSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'Requête invalide.');
  const { quoteId, action, note } = parsed.data;
  return serialTransaction(async tx => {
    const quote = await tx.marketQuote.findUnique({ where: { id: quoteId }, include: { order: true } });
    if (!quote) return fail(404, 'Devis introuvable.');
    if (!isQuoteRespondable({ status: quote.status as 'SENT', validUntil: quote.validUntil ?? null })) {
      return fail(409, quote.status === 'EXPIRED'
        ? 'Ce devis a expiré. Créez un nouveau devis.'
        : 'Ce devis a déjà reçu une réponse.');
    }
    const order = quote.order;
    if (action === 'ACCEPTED') {
      if (!['AWAITING_CLIENT', 'DELAYED'].includes(order.status)) {
        return fail(409, `Réponse impossible : commande ${MARKET_STATUS_LABELS[order.status as MarketOrderStatus]}.`);
      }
      await tx.marketQuote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      await tx.marketOrder.update({ where: { id: order.id }, data: { status: 'AWAITING_PAYMENT' } });
      await tx.marketOrderEvent.create({
        data: {
          orderId: order.id, from: order.status, to: 'AWAITING_PAYMENT', actorId: adminId,
          note: note ?? `Devis ${quote.quoteNumber} accepté par le client — en attente de paiement.`,
        },
      });
      return ok({ status: 'AWAITING_PAYMENT' });
    }
    await tx.marketQuote.update({ where: { id: quoteId }, data: { status: 'REJECTED', rejectedAt: new Date() } });
    await tx.marketOrderEvent.create({
      data: {
        orderId: order.id, from: order.status, to: order.status, actorId: adminId,
        note: note ?? `Devis ${quote.quoteNumber} refusé par le client.`,
      },
    });
    return ok({ status: order.status });
  });
}

/* -------------------------------- Paiements -------------------------------- */

const paymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().int().min(100).max(50_000_000),
  method: z.enum(['MTN_MOMO', 'ORANGE_MONEY', 'CASH']),
  reference: z.string().trim().max(80).optional(),
  /* Relevés : le fondateur qui écrit un encaissement déjà reçu le confirme
     directement (une seule écriture au lieu de saisir puis confirmer). */
  confirm: z.boolean().default(false),
});

export async function recordMarketPayment(body: unknown, adminId: string): Promise<R> {
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  return serialTransaction(async tx => {
    const order = await tx.marketOrder.findUnique({ where: { id: d.orderId } });
    if (!order) return fail(404, 'Commande introuvable.');
    const payment = await tx.marketPayment.create({
      data: {
        orderId: d.orderId, amount: d.amount, method: d.method, reference: d.reference ?? null,
        status: d.confirm ? 'CONFIRMED' : 'PENDING', createdById: adminId,
        confirmedById: d.confirm ? adminId : null, confirmedAt: d.confirm ? new Date() : null,
      },
    });
    // Première confirmation : la commande devient ferme (même logique que la revue).
    if (d.confirm && ['AWAITING_CLIENT', 'AWAITING_PAYMENT'].includes(order.status)) {
      await tx.marketOrder.update({ where: { id: order.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
      await tx.marketOrderEvent.create({ data: { orderId: order.id, from: order.status, to: 'CONFIRMED', actorId: adminId, note: 'Paiement vérifié (relevé).' } });
    }
    return ok({ paymentId: payment.id });
  });
}

const paymentReviewSchema = z.object({
  paymentId: z.string().min(1),
  action: z.enum(['CONFIRM', 'REJECT']),
});

export async function reviewMarketPayment(body: unknown, adminId: string): Promise<R> {
  const parsed = paymentReviewSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'Requête invalide.');
  const { paymentId, action } = parsed.data;
  return serialTransaction(async tx => {
    const payment = await tx.marketPayment.findUnique({ where: { id: paymentId } });
    if (!payment) return fail(404, 'Paiement introuvable.');
    if (payment.status !== 'PENDING') return fail(409, 'Ce paiement a déjà été traité.');
    await tx.marketPayment.update({
      where: { id: paymentId },
      data: action === 'CONFIRM'
        ? { status: 'CONFIRMED', confirmedById: adminId, confirmedAt: new Date() }
        : { status: 'REJECTED' },
    });
    // Première vérification de paiement : la commande devient ferme
    // (depuis AWAITING_CLIENT — sans devis — ou AWAITING_PAYMENT — devis accepté).
    if (action === 'CONFIRM' && payment.orderId) {
      const order = await tx.marketOrder.findUnique({ where: { id: payment.orderId } });
      if (order && ['AWAITING_CLIENT', 'AWAITING_PAYMENT'].includes(order.status)) {
        await tx.marketOrder.update({ where: { id: order.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
        await tx.marketOrderEvent.create({ data: { orderId: order.id, from: order.status, to: 'CONFIRMED', actorId: adminId, note: 'Paiement vérifié.' } });
      }
    }
    return ok();
  });
}

/* ---------------------------- Remboursements ------------------------------- */

const refundSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().int().min(100).max(50_000_000),
  method: z.enum(['MTN_MOMO', 'ORANGE_MONEY', 'CASH']).optional(),
  reference: z.string().trim().max(80).optional(),
  reason: z.string().trim().max(500).optional(),
});

/** Enregistre un remboursement réellement effectué — plafonné aux paiements vérifiés. */
export async function recordMarketRefund(body: unknown, adminId: string): Promise<R> {
  const parsed = refundSchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  return serialTransaction(async tx => {
    const [order, payments, refunds] = await Promise.all([
      tx.marketOrder.findUnique({ where: { id: d.orderId } }),
      tx.marketPayment.findMany({ where: { orderId: d.orderId, status: 'CONFIRMED' } }),
      tx.marketRefund.findMany({ where: { orderId: d.orderId } }),
    ]);
    if (!order) return fail(404, 'Commande introuvable.');
    const confirmed = payments.reduce((s, p) => s + p.amount, 0);
    const alreadyRefunded = refunds.reduce((s, r) => s + r.amount, 0);
    if (d.amount + alreadyRefunded > confirmed) {
      return fail(409, `Remboursement impossible : ${confirmed - alreadyRefunded} F maximum (paiements vérifiés).`);
    }
    await tx.marketRefund.create({
      data: {
        orderId: d.orderId, amount: d.amount, method: d.method ?? null,
        reference: d.reference ?? null, reason: d.reason ?? null, recordedById: adminId,
      },
    });
    await tx.marketOrderEvent.create({
      data: { orderId: d.orderId, from: order.status, to: order.status, actorId: adminId, note: `Remboursement de ${d.amount.toLocaleString('fr-FR')} F enregistré.` },
    });
    return ok({ refundableLeft: confirmed - alreadyRefunded - d.amount });
  });
}

/* --------------------------- Approvisionnement ----------------------------- */

const batchSchema = z.object({
  reference: z.string().trim().min(2).max(40),
  supplierId: z.string().max(60).nullable().optional(),
  totalCost: z.number().int().min(0).max(100_000_000).default(0),
  note: z.string().trim().max(1000).optional(),
});

export async function listMarketBatches(): Promise<unknown[]> {
  const rows = await prisma.marketProcurementBatch.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { items: true } },
      supplier: { select: { name: true } },
      expenses: { orderBy: { createdAt: 'desc' } },
    },
  });
  return rows.map((b) => ({
    ...b,
    itemCount: b._count.items,
    supplierName: b.supplier?.name ?? null,
    expensesTotal: b.expenses.reduce((s, e) => s + e.amount, 0),
    statusLabel: MARKET_BATCH_LABELS[b.status as MarketBatchStatusV2] ?? b.status,
    expenses: b.expenses.map((e) => ({ ...e, categoryLabel: e.category, incurredAt: e.incurredAt.toISOString(), createdAt: e.createdAt.toISOString() })),
  }));
}

export async function saveMarketBatch(body: unknown): Promise<R> {
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  try {
    await prisma.marketProcurementBatch.create({
      data: { reference: d.reference, supplierId: d.supplierId ?? null, totalCost: d.totalCost, note: d.note ?? null },
    });
    return ok();
  } catch (e) {
    if (typeof e === 'object' && e && 'code' in e && e.code === 'P2002') return fail(409, 'Cette référence de lot existe déjà.');
    throw e;
  }
}

const batchStatusSchema = z.object({
  batchId: z.string().min(1),
  to: z.string().min(1),
});

export async function updateMarketBatchStatus(body: unknown): Promise<R> {
  const parsed = batchStatusSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'Requête invalide.');
  const { batchId, to } = parsed.data;
  if (!isMarketBatchStatus(to)) return fail(400, 'Statut de lot inconnu.');
  const batch = await prisma.marketProcurementBatch.findUnique({ where: { id: batchId } });
  if (!batch) return fail(404, 'Lot introuvable.');
  if (!canTransitionBatch(batch.status as MarketBatchStatusV2, to)) {
    return fail(409, `Transition refusée : ${MARKET_BATCH_LABELS[batch.status as MarketBatchStatusV2]} → ${MARKET_BATCH_LABELS[to]}.`);
  }
  await prisma.marketProcurementBatch.update({
    where: { id: batchId },
    data: { status: to, receivedAt: to === 'RECEIVED' ? new Date() : batch.receivedAt },
  });
  return ok();
}

/** Affecte des articles de commande à un lot et enregistre le coût fournisseur unitaire. */
const assignSchema = z.object({
  itemId: z.string().min(1),
  batchId: z.string().nullable(),
  unitCostReal: z.number().int().min(0).max(50_000_000).nullable(),
});

export async function assignMarketItem(body: unknown): Promise<R> {
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  const item = await prisma.marketOrderItem.findUnique({ where: { id: d.itemId }, include: { order: { select: { status: true } } } });
  if (!item) return fail(404, 'Article introuvable.');
  if (d.batchId) {
    const batch = await prisma.marketProcurementBatch.findUnique({ where: { id: d.batchId } });
    if (!batch) return fail(400, 'Lot introuvable.');
  }
  await prisma.marketOrderItem.update({
    where: { id: d.itemId },
    data: { procurementBatchId: d.batchId, unitCostReal: d.unitCostReal ?? item.unitCostReal },
  });
  return ok();
}

/* ----------------------- Dépenses & allocation des lots -------------------- */

const expenseSchema = z.object({
  batchId: z.string().min(1).optional(),
  /* Relevés : dépense rattachée à une commande (coût payé pour elle). */
  orderId: z.string().min(1).optional(),
  label: z.string().trim().min(2).max(120),
  category: z.enum(['FREIGHT', 'INSURANCE', 'CUSTOMS', 'CLEARANCE', 'LOCAL_TRANSPORT', 'PACKAGING', 'PURCHASE', 'RENT', 'COMMUNICATION', 'OTHER']),
  amount: z.number().int().min(0).max(100_000_000),
  allocationMethod: z.enum(['VALUE', 'QUANTITY', 'FLAT']).default('VALUE'),
  note: z.string().trim().max(500).optional(),
});

export const MARKET_EXPENSE_LABELS: Record<string, string> = EXPENSE_CATEGORY_LABELS;

export async function saveMarketExpense(body: unknown, adminId: string): Promise<R> {
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  if (d.batchId) {
    const batch = await prisma.marketProcurementBatch.findUnique({ where: { id: d.batchId } });
    if (!batch) return fail(404, 'Lot introuvable.');
  }
  if (d.orderId) {
    const order = await prisma.marketOrder.findUnique({ where: { id: d.orderId } });
    if (!order) return fail(404, 'Commande introuvable.');
  }
  await prisma.marketExpense.create({
    data: {
      batchId: d.batchId ?? null, orderId: d.orderId ?? null,
      label: d.label, category: d.category, amount: d.amount,
      allocationMethod: d.allocationMethod, note: d.note ?? null, createdById: adminId,
    },
  });
  return ok();
}

const expenseDeleteSchema = z.object({ expenseId: z.string().min(1) });

export async function deleteMarketExpense(body: unknown): Promise<R> {
  const parsed = expenseDeleteSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'Requête invalide.');
  const expense = await prisma.marketExpense.findUnique({ where: { id: parsed.data.expenseId } });
  if (!expense) return fail(404, 'Dépense introuvable.');
  await prisma.marketExpense.delete({ where: { id: expense.id } });
  return ok();
}

async function computeBatchAllocation(batchId: string) {
  const [batch, expenses] = await Promise.all([
    prisma.marketProcurementBatch.findUnique({
      where: { id: batchId },
      include: { items: { include: { order: { select: { orderNumber: true, status: true } } } } },
    }),
    prisma.marketExpense.findMany({ where: { batchId } }),
  ]);
  if (!batch) return null;
  const items = batch.items.map((i) => ({
    itemId: i.id,
    orderNumber: i.order.orderNumber,
    productName: i.productName,
    variantLabel: i.variantLabel,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    unitCostReal: i.unitCostReal,
    value: (i.unitPrice ?? 0) * i.quantity,
  }));
  const shares = allocateMarketExpenses(
    expenses.map((e) => ({ amount: e.amount, allocationMethod: e.allocationMethod as MarketAllocationMethod })),
    items.map((i) => ({ itemId: i.itemId, quantity: i.quantity, value: i.value })),
  );
  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
  return {
    batch: { id: batch.id, reference: batch.reference, status: batch.status, statusLabel: MARKET_BATCH_LABELS[batch.status as MarketBatchStatusV2] ?? batch.status },
    expenses: expenses.map((e) => ({ id: e.id, label: e.label, category: e.category, categoryLabel: MARKET_EXPENSE_LABELS[e.category] ?? e.category, amount: e.amount, allocationMethod: e.allocationMethod })),
    expensesTotal,
    items: items.map((i) => {
      const share = shares.get(i.itemId) ?? 0;
      return {
        ...i,
        expenseShare: share,
        expenseSharePerUnit: i.quantity > 0 ? Math.round(share / i.quantity) : 0,
        suggestedLandedUnitCost: (i.unitCostReal ?? 0) + (i.quantity > 0 ? Math.round(share / i.quantity) : 0),
      };
    }),
  };
}

/** Projection de l'allocation (lecture seule, recalculée à la demande). */
export async function getMarketBatchAllocation(batchId: string): Promise<unknown | null> {
  return computeBatchAllocation(batchId);
}

/** Applique l'allocation : ajoute la quote-part de dépenses au coût rendu réel de chaque article. */
export async function applyMarketBatchAllocation(batchId: string, adminId: string): Promise<R> {
  const allocation = await computeBatchAllocation(batchId);
  if (!allocation) return fail(404, 'Lot introuvable.');
  const { items, expensesTotal } = allocation as { items: { itemId: string; orderNumber: string; expenseSharePerUnit: number; unitCostReal: number | null; quantity: number }[]; expensesTotal: number };
  if (items.length === 0) return fail(409, 'Aucun article affecté à ce lot.');
  if (expensesTotal === 0) return fail(409, 'Aucune dépense à allouer sur ce lot.');
  return serialTransaction(async tx => {
    for (const item of items) {
      if (item.expenseSharePerUnit > 0) {
        await tx.marketOrderItem.update({
          where: { id: item.itemId },
          data: { unitCostReal: (item.unitCostReal ?? 0) + item.expenseSharePerUnit },
        });
      }
    }
    // Journal : un événement par commande concernée.
    const byOrder = new Set(items.map((i) => i.orderNumber));
    for (const orderNumber of byOrder) {
      const order = await tx.marketOrder.findUnique({ where: { orderNumber } });
      if (!order) continue;
      await tx.marketOrderEvent.create({
        data: {
          orderId: order.id, from: order.status, to: order.status, actorId: adminId,
          note: `Dépenses du lot allouées (+coût rendu réel par article).`,
        },
      });
    }
    return ok({ itemsUpdated: items.length, expensesTotal });
  });
}

/* ------------------------------ Livraisons --------------------------------- */

const deliverySchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(['PENDING', 'SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'FAILED']),
  fee: z.number().int().min(0).max(500_000),
  cost: z.number().int().min(0).max(500_000),
  courier: z.string().trim().max(80).nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function saveMarketDelivery(body: unknown, adminId: string): Promise<R> {
  const parsed = deliverySchema.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;
  return serialTransaction(async tx => {
    const order = await tx.marketOrder.findUnique({ where: { id: d.orderId } });
    if (!order) return fail(404, 'Commande introuvable.');
    await tx.marketDelivery.upsert({
      where: { orderId: d.orderId },
      create: { orderId: d.orderId, status: d.status, fee: d.fee, cost: d.cost, courier: d.courier ?? null, note: d.note ?? null, deliveredAt: d.status === 'DELIVERED' ? new Date() : null },
      update: { status: d.status, fee: d.fee, cost: d.cost, courier: d.courier ?? null, note: d.note ?? null, deliveredAt: d.status === 'DELIVERED' ? new Date() : null },
    });
    await tx.marketOrderEvent.create({ data: { orderId: d.orderId, from: order.status, to: order.status, note: `Livraison mise à jour : ${d.status}.`, actorId: adminId } });
    return ok();
  });
}

/* ------------------------------ Indicateurs -------------------------------- */

export async function getMarketOverview(): Promise<Record<string, unknown>> {
  await expireStaleQuotes();
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [orders, products, quotes, payments, refunds, expenses, analytics] = await Promise.all([
    prisma.marketOrder.findMany({ include: { items: true, payments: true, refunds: true, delivery: true } }),
    prisma.marketProduct.findMany({ where: { active: true } }),
    prisma.marketQuote.findMany(),
    prisma.marketPayment.findMany({ where: { status: 'CONFIRMED' } }),
    prisma.marketRefund.findMany(),
    prisma.marketExpense.findMany(),
    prisma.marketAnalyticEvent.findMany({ where: { createdAt: { gte: since30 } } }),
  ]);
  const count = (s: string) => orders.filter((o) => o.status === s).length;
  const confirmed = orders.filter((o) => ['CONFIRMED', 'PROCURING', 'SHIPPED_INBOUND', 'RECEIVED', 'READY', 'DELIVERING', 'DELIVERED'].includes(o.status));
  const delivered = orders.filter((o) => o.status === 'DELIVERED');
  const revenue = confirmed.reduce((s, o) => s + o.items.reduce((x, i) => x + (i.unitPrice ?? 0) * i.quantity, 0) + (o.deliveryFee ?? 0), 0);
  const deliveredMargin = delivered.map((o) => {
    const rev = o.items.reduce((x, i) => x + (i.unitPrice ?? 0) * i.quantity, 0) + (o.deliveryFee ?? 0);
    const cost = o.items.reduce((x, i) => x + (i.unitCostReal ?? 0) * i.quantity, 0) + (o.delivery?.cost ?? 0);
    return rev - cost;
  });
  const cashConfirmed = payments.reduce((s, p) => s + p.amount, 0);
  const refundsTotal = refunds.reduce((s, r) => s + r.amount, 0);
  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const funnelCount = (t: string) => analytics.filter((a) => a.type === t).length;
  return {
    totalRequests: orders.length,
    byStatus: {
      requested: count('REQUESTED') + count('SUPPLIER_CHECK') + count('AWAITING_CLIENT'),
      awaitingPayment: count('AWAITING_PAYMENT'),
      confirmed: count('CONFIRMED'), procuring: count('PROCURING') + count('SHIPPED_INBOUND'),
      toDeliver: count('RECEIVED') + count('READY') + count('DELIVERING'),
      delivered: count('DELIVERED'), cancelled: count('CANCELLED'),
      delayed: count('DELAYED'), refunded: count('REFUND_PENDING') + count('REFUNDED'),
    },
    quotes: {
      sent: quotes.filter((q) => q.status === 'SENT').length,
      accepted: quotes.filter((q) => q.status === 'ACCEPTED').length,
      rejected: quotes.filter((q) => q.status === 'REJECTED').length,
      expired: quotes.filter((q) => q.status === 'EXPIRED').length,
    },
    paymentsPendingVerification: (await prisma.marketPayment.findMany({ where: { status: 'PENDING' } })).length,
    activeProducts: products.length,
    availableProducts: products.filter((p) => p.availability === 'AVAILABLE').length,
    confirmedCount: confirmed.length,
    revenue,
    avgOrderValue: confirmed.length ? Math.round(revenue / confirmed.length) : null,
    cashConfirmed,
    refundsTotal,
    cashNet: cashConfirmed - refundsTotal,
    expensesTotal,
    deliveredCount: delivered.length,
    deliveredMargin: deliveredMargin.length ? deliveredMargin.reduce((a, b) => a + b, 0) : null,
    avgDeliveredMargin: deliveredMargin.length ? Math.round(deliveredMargin.reduce((a, b) => a + b, 0) / deliveredMargin.length) : null,
    conversionRate: orders.length ? Math.round((confirmed.length / orders.length) * 1000) / 10 : null,
    // Funnel 30 jours (trafic ≠ performance commerciale — jamais mélangés).
    funnel30d: {
      shopViewed: funnelCount('SHOP_VIEWED'),
      productViewed: funnelCount('PRODUCT_VIEWED'),
      addToCart: funnelCount('ADD_TO_CART'),
      checkoutStarted: funnelCount('CHECKOUT_STARTED'),
      orderSubmitted: orders.filter((o) => o.createdAt >= since30).length,
    },
    topProducts: Object.entries(orders.flatMap((o) => o.items.map((i) => i.productName))
      .reduce<Record<string, number>>((acc, name) => { acc[name] = (acc[name] ?? 0) + 1; return acc; }, {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, count: n })),
  };
}

/* --------------------------------- Relevés --------------------------------- */

/**
 * GET /api/admin/market/ledger — relevés & marges.
 * Le fondateur écrit ses relevés (encaissements / coûts payés) ; cette vue
 * calcule directement : totaux, solde, ventilation par catégorie et marge
 * par commande. La marge n'est pas un « profit net » : les coûts partagés
 * (lots, charges générales) n'y sont pas alloués.
 */
export async function getMarketLedger(): Promise<
  { status: 200; body: {
    totals: { encaisse: number; depense: number; solde: number };
    byCategory: { category: string; label: string; total: number }[];
    orders: {
      id: string; orderNumber: string; customerName: string | null; status: string; statusLabel: string;
      encaisse: number; paye: number; marge: number;
    }[];
    payments: { id: string; orderNumber: string; amount: number; method: string; methodLabel: string; status: LedgerPaymentStatus; reference: string | null; createdAt: string }[];
    expenses: { id: string; orderNumber: string | null; label: string; category: string; categoryLabel: string; amount: number; note: string | null; incurredAt: string }[];
  } }
> {
  const [payments, expenses, orders] = await Promise.all([
    prisma.marketPayment.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, orderId: true, amount: true, method: true, status: true, reference: true, createdAt: true } }),
    prisma.marketExpense.findMany({ orderBy: { incurredAt: 'desc' }, select: { id: true, orderId: true, label: true, category: true, amount: true, note: true, incurredAt: true } }),
    prisma.marketOrder.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, orderNumber: true, status: true, createdAt: true, customer: { select: { name: true } } } }),
  ]);

  const numberById = new Map(orders.map((o) => [o.id, o.orderNumber]));
  const calc = computeLedger(
    payments.map((p) => ({ orderId: p.orderId, amount: p.amount, status: p.status, method: p.method })),
    expenses.map((e) => ({ orderId: e.orderId, amount: e.amount, category: e.category })),
    orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customer?.name ?? null, status: o.status })),
  );

  return {
    status: 200,
    body: {
      totals: calc.totals,
      byCategory: calc.byCategory,
      orders: calc.orders.map((o) => ({
        ...o, statusLabel: MARKET_STATUS_LABELS[o.status as MarketOrderStatus] ?? o.status,
      })),
      payments: payments.map((p) => ({
        id: p.id, orderNumber: numberById.get(p.orderId) ?? '—', amount: p.amount,
        method: p.method ?? '—', methodLabel: p.method ? (PAYMENT_METHOD_LABELS[p.method] ?? p.method) : '—',
        status: p.status, reference: p.reference, createdAt: p.createdAt.toISOString(),
      })),
      expenses: expenses.map((e) => ({
        id: e.id, orderNumber: e.orderId ? (numberById.get(e.orderId) ?? '—') : null,
        label: e.label, category: e.category, categoryLabel: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
        amount: e.amount, note: e.note, incurredAt: e.incurredAt.toISOString(),
      })),
    },
  };
}
