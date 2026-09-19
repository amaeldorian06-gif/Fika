import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { serialTransaction, nextDocumentNumber } from '../lib/transaction';
import { paymentBalance } from '../../src/lib/admin/payments';
import { prisma } from '../../src/lib/prisma';
import { canTransition, type OrderStatus } from '../../src/lib/admin/status';
import { calculateQuotePricing, computeMargin, describeQuoteBreakdown } from '../../src/lib/pricing';

/**
 * Mutations commandes du back-office (P06) — implémentation de référence.
 * Toutes les mutations exigent une session admin (voir getCurrentAdmin) et
 * valident leur entrée avec zod. Chaque changement de statut écrit un
 * OrderEvent (historique append-only).
 */

export type MutationResult<T = unknown> =
  | { status: 200; body: { ok: true } & T }
  | { status: 400 | 401 | 404 | 409; body: { ok: false; code: string; message: string } };

const unauthorized = (): Extract<MutationResult, { status: 400 | 401 | 404 | 409 }> => ({
  status: 401, body: { ok: false, code: 'UNAUTHORIZED', message: 'Session expirée. Reconnectez-vous.' },
});

/* --------------------------- Changement de statut -------------------------- */

const statusSchema = z.object({
  orderId: z.string().min(1),
  to: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

export async function handleUpdateStatus(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult<{ status: OrderStatus }>> {
  if (!adminId) return unauthorized();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Requête invalide.' } };
  }

  return serialTransaction<MutationResult<{ status: OrderStatus }>>(async tx => {
    const order = await tx.order.findUnique({
      where: { id: parsed.data.orderId },
      include: {
        items: { select: { id: true } },
        payments: { select: { status: true, amount: true } },
        tasks: { include: { assignments: { where: { status: { not: 'DECLINED' } }, select: { id: true } } } },
      },
    });
    if (!order) {
      return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Commande introuvable.' } };
    }

    const from = order.status as OrderStatus;
    const to = parsed.data.to as OrderStatus;

    const check = canTransition(from, to, {
      hasItems: order.items.length > 0,
      hasConfirmedPayment: paymentBalance(order.totalPrice, order.payments).fullyPaid,
      hasAssignedExpert: order.tasks.some((t) => t.assignments.length > 0),
    });
    if (!check.ok) {
      return { status: 409, body: { ok: false, code: 'TRANSITION_REFUSED', message: check.reason ?? 'Transition refusée.' } };
    }

    await tx.order.update({ where: { id: order.id }, data: {
      status: to, completedAt: to === 'COMPLETED' ? new Date() : order.completedAt,
    } });
    await tx.orderEvent.create({ data: { orderId: order.id, from, to, note: parsed.data.note ?? null, actorId: adminId } });
    return { status: 200, body: { ok: true, status: to } };
  });
}

/* -------------------------------- Coûts ----------------------------------- */

const costSchema = z.object({
  orderId: z.string().min(1),
  type: z.enum(['EXPERT', 'MATERIAL', 'DELIVERY', 'OTHER']),
  amount: z.number().int().min(0, 'Montant invalide.').max(100_000_000),
  note: z.string().trim().max(200).optional(),
});

export interface MarginView {
  revenue: number;
  costsTotal: number;
  marginAmount: number;
  marginPercent: number;
}

/** Recalcule la marge d'une commande (jamais stockée — lib/pricing). */
export async function getOrderMargin(orderId: string, client: Prisma.TransactionClient = prisma): Promise<MarginView | null> {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: { totalPrice: true, costs: { select: { amount: true } } },
  });
  if (!order) return null;
  const revenue = order.totalPrice ?? 0;
  const { marginAmount, marginPercent } = computeMargin(revenue, order.costs);
  return {
    revenue,
    costsTotal: order.costs.reduce((s, c) => s + c.amount, 0),
    marginAmount,
    marginPercent,
  };
}

export async function handleAddCost(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult<{ margin: MarginView }>> {
  if (!adminId) return unauthorized();
  const parsed = costSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Ligne de coût invalide.' } };
  }

  const exists = await prisma.order.findUnique({ where: { id: parsed.data.orderId }, select: { id: true } });
  if (!exists) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Commande introuvable.' } };

  await prisma.cost.create({
    data: {
      orderId: parsed.data.orderId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      note: parsed.data.note ?? null,
    },
  });

  const margin = await getOrderMargin(parsed.data.orderId);
  return { status: 200, body: { ok: true, margin: margin! } };
}

/* -------------------------------- Devis ----------------------------------- */

const quoteSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().int().min(0).max(100_000_000),
  details: z.string().trim().max(2000).optional(),
  validUntil: z.string().datetime().optional(),
});

async function createQuoteForOrder(
  data: { orderId: string; amount: number; details?: string | null; validUntil?: string },
  adminId: string,
  extraCosts: { type: 'EXPERT' | 'MATERIAL' | 'DELIVERY' | 'OTHER'; amount: number; note: string }[] = [],
): Promise<MutationResult<{ quoteNumber: string; margin: MarginView }>> {
  return serialTransaction<MutationResult<{ quoteNumber: string; margin: MarginView }>>(async tx => {
    const order = await tx.order.findUnique({ where: { id: data.orderId }, include: { payments: true, items: true } });
    if (!order) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Commande introuvable.' } };
    if (!['QUALIFYING', 'QUOTED', 'AWAITING_CONFIRMATION'].includes(order.status) || !order.items.length ||
      order.payments.some(p => ['PENDING', 'CONFIRMED'].includes(p.status))) {
      return { status: 409, body: { ok: false, code: 'QUOTE_LOCKED', message: 'Devis impossible : vérifiez les prestations, le statut et les paiements déjà saisis.' } };
    }
    const quoteNumber = await nextDocumentNumber(tx, 'DEV');
    await tx.quote.create({ data: {
      quoteNumber, orderId: order.id, amount: data.amount, details: data.details ?? null,
      status: 'SENT', validUntil: data.validUntil ? new Date(data.validUntil) : null,
    } });
    // Un nouveau devis remplace le précédent : les anciens SENT deviennent EXPIRED.
    await tx.quote.updateMany({ where: { orderId: order.id, quoteNumber: { not: quoteNumber }, status: { in: ['DRAFT', 'SENT'] } }, data: { status: 'EXPIRED' } });
    // Coûts prévisionnels issus du constructeur de devis : remplacent ceux du devis précédent (même origine).
    if (extraCosts.length) {
      await tx.cost.deleteMany({ where: { orderId: order.id, note: { startsWith: 'Devis ' } } });
      await tx.cost.createMany({ data: extraCosts.filter(c => c.amount > 0).map(c => ({ orderId: order.id, type: c.type, amount: c.amount, note: `Devis ${quoteNumber} — ${c.note}` })) });
    }
    // Ligne unique : le prix client se reporte sur la prestation (cohérence devis ↔ commande ↔ analytics).
    if (order.items.length === 1) {
      await tx.orderItem.update({ where: { id: order.items[0].id }, data: { price: data.amount, quantity: 1 } });
    }
    await tx.order.update({ where: { id: order.id }, data: { totalPrice: data.amount, status: 'QUOTED' } });
    await tx.orderEvent.create({ data: { orderId: order.id, from: order.status, to: 'QUOTED', note: `Devis ${quoteNumber} envoyé (${data.amount.toLocaleString('fr-FR')} F).`, actorId: adminId } });
    const margin = (await getOrderMargin(order.id, tx))!;
    return { status: 200, body: { ok: true, quoteNumber, margin } };
  });
}

/** Devis « montant libre » (compatibilité) : le prix client est saisi directement. */
export async function handleCreateQuote(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult<{ quoteNumber: string; margin: MarginView }>> {
  if (!adminId) return unauthorized();
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Devis invalide.' } };
  }
  return createQuoteForOrder(parsed.data, adminId);
}

/* ----------------------- Constructeur de devis (coûts) --------------------- */

const quoteBuilderSchema = z.object({
  orderId: z.string().min(1),
  expertCost: z.number().int().min(0).max(100_000_000),
  deliveryCost: z.number().int().min(0).max(100_000_000).default(0),
  materialCost: z.number().int().min(0).max(100_000_000).default(0),
  otherCost: z.number().int().min(0).max(100_000_000).default(0),
  marginPercent: z.number().min(0).max(95).optional(),
  marginAmount: z.number().int().min(0).max(100_000_000).optional(),
  clientPrice: z.number().int().min(0).max(100_000_000).optional(),
  details: z.string().trim().max(1500).optional(),
  validUntil: z.string().datetime().optional(),
});

export type QuoteBuilderInput = z.input<typeof quoteBuilderSchema>;

/**
 * POST /api/admin/orders/quotes/build — modèle économique Fika :
 * coût professionnel + déplacement + matériel/autres + marge = prix client.
 * Écrit le devis (Quote), reporte le prix client (Order.totalPrice) et trace
 * chaque composante de coût (Cost EXPERT/DELIVERY/MATERIAL/OTHER) pour que la
 * marge réelle soit lisible dans l'administration et les exports.
 */
export async function handleBuildQuote(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult<{ quoteNumber: string; margin: MarginView; pricing: ReturnType<typeof calculateQuotePricing> }>> {
  if (!adminId) return unauthorized();
  const parsed = quoteBuilderSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Constructeur de devis : valeurs invalides.' } };
  }
  const d = parsed.data;
  const pricing = calculateQuotePricing({
    expertCost: d.expertCost, deliveryCost: d.deliveryCost, materialCost: d.materialCost, otherCost: d.otherCost,
    marginPercent: d.marginPercent, marginAmount: d.marginAmount, clientPriceOverride: d.clientPrice,
  });
  if (pricing.clientFinalPrice <= 0) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Le prix client doit être supérieur à 0 F.' } };
  }
  const details = [d.details?.trim(), describeQuoteBreakdown(pricing)].filter(Boolean).join('\n\n');
  const result = await createQuoteForOrder(
    { orderId: d.orderId, amount: pricing.clientFinalPrice, details, validUntil: d.validUntil },
    adminId,
    [
      { type: 'EXPERT', amount: pricing.expertCost, note: 'coût professionnel' },
      { type: 'DELIVERY', amount: pricing.deliveryCost, note: 'déplacement / transport' },
      { type: 'MATERIAL', amount: pricing.materialCost, note: 'matériel / pièces' },
      { type: 'OTHER', amount: pricing.otherCost, note: 'autres coûts' },
    ],
  );
  if (result.status !== 200) return result;
  return { status: 200, body: { ...result.body, pricing } };
}
