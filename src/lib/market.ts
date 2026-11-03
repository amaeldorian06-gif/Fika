import { z } from 'zod';
import { normalizePhoneE164 } from './lead';

/**
 * Domaine Fika Market — règles pures, aucune dépendance React ou Prisma.
 * Quatre cycles de vie distincts (exigence §8.3) :
 *   1. commande (statuts ci-dessous, transitions contrôlées serveur)
 *   2. paiement (DÉRIVÉ des paiements + remboursements, jamais stocké)
 *   3. approvisionnement (MarketBatchStatus)
 *   4. livraison (MarketDelivery.status)
 */

export type MarketOrderStatus =
  | 'REQUESTED' | 'SUPPLIER_CHECK' | 'AWAITING_CLIENT' | 'AWAITING_PAYMENT' | 'CONFIRMED'
  | 'PROCURING' | 'SHIPPED_INBOUND' | 'RECEIVED' | 'READY' | 'DELIVERING' | 'DELIVERED'
  | 'CANCELLED' | 'DELAYED' | 'REFUND_PENDING' | 'REFUNDED' | 'SUPPLY_FAILED';

export const MARKET_STATUS_LABELS: Record<MarketOrderStatus, string> = {
  REQUESTED: 'Demande reçue',
  SUPPLIER_CHECK: 'Vérification fournisseur',
  AWAITING_CLIENT: 'Devis envoyé — attente de votre réponse',
  AWAITING_PAYMENT: 'Devis accepté — en attente de paiement',
  CONFIRMED: 'Paiement vérifié — commande ferme',
  PROCURING: 'Approvisionnement en cours',
  SHIPPED_INBOUND: 'Expédition en cours',
  RECEIVED: 'Réception et contrôle',
  READY: 'Prête à livrer',
  DELIVERING: 'Livraison en cours',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  DELAYED: 'Retardée',
  REFUND_PENDING: 'Remboursement en attente',
  REFUNDED: 'Remboursée',
  SUPPLY_FAILED: 'Approvisionnement impossible',
};

/** Étapes principales montrées au client (les exceptions s'affichent à part). */
export const MARKET_MAIN_FLOW: MarketOrderStatus[] = [
  'REQUESTED', 'SUPPLIER_CHECK', 'AWAITING_CLIENT', 'AWAITING_PAYMENT', 'CONFIRMED',
  'PROCURING', 'SHIPPED_INBOUND', 'RECEIVED', 'READY', 'DELIVERING', 'DELIVERED',
];

/** Transitions autorisées — tout autre changement est refusé côté serveur. */
export const MARKET_TRANSITIONS: Record<MarketOrderStatus, MarketOrderStatus[]> = {
  REQUESTED: ['SUPPLIER_CHECK', 'CANCELLED'],
  SUPPLIER_CHECK: ['AWAITING_CLIENT', 'SUPPLY_FAILED', 'DELAYED', 'CANCELLED'],
  // CONFIRMED conservé : chemin court sans devis (petites commandes déjà prixées).
  AWAITING_CLIENT: ['AWAITING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'DELAYED'],
  AWAITING_PAYMENT: ['CONFIRMED', 'DELAYED', 'CANCELLED'],
  CONFIRMED: ['PROCURING', 'DELAYED', 'CANCELLED', 'REFUND_PENDING'],
  PROCURING: ['SHIPPED_INBOUND', 'RECEIVED', 'SUPPLY_FAILED', 'DELAYED', 'CANCELLED', 'REFUND_PENDING'],
  SHIPPED_INBOUND: ['RECEIVED', 'DELAYED', 'SUPPLY_FAILED'],
  RECEIVED: ['READY', 'DELAYED'],
  READY: ['DELIVERING', 'DELAYED'],
  DELIVERING: ['DELIVERED', 'DELAYED'],
  DELIVERED: ['REFUND_PENDING'],
  CANCELLED: ['REFUND_PENDING'],
  DELAYED: ['AWAITING_CLIENT', 'AWAITING_PAYMENT', 'CONFIRMED', 'PROCURING', 'SHIPPED_INBOUND', 'RECEIVED', 'READY', 'DELIVERING', 'DELIVERED', 'CANCELLED', 'SUPPLY_FAILED'],
  REFUND_PENDING: ['REFUNDED', 'CANCELLED'],
  REFUNDED: [],
  SUPPLY_FAILED: ['REFUND_PENDING', 'CANCELLED'],
};

export function isMarketStatus(value: string): value is MarketOrderStatus {
  return Object.prototype.hasOwnProperty.call(MARKET_STATUS_LABELS, value);
}

export function canTransition(from: MarketOrderStatus, to: MarketOrderStatus): boolean {
  return MARKET_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuts qui comptent comme « engagés » (commande réelle, pas annulée/remboursée). */
export const MARKET_ACTIVE_STATUSES: MarketOrderStatus[] = [
  'CONFIRMED', 'PROCURING', 'SHIPPED_INBOUND', 'RECEIVED', 'READY', 'DELIVERING', 'DELIVERED',
];

/* --------------------------------- Devis ----------------------------------- */

export type MarketQuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export const MARKET_QUOTE_LABELS: Record<MarketQuoteStatus, string> = {
  DRAFT: 'Brouillon', SENT: 'Envoyé', ACCEPTED: 'Accepté',
  REJECTED: 'Refusé', EXPIRED: 'Expiré', CANCELLED: 'Annulé',
};

/** Validité par défaut d'un devis (jours) — configurable à la création. */
export const MARKET_QUOTE_VALIDITY_DAYS = 7;

export function isQuoteRespondable(quote: { status: MarketQuoteStatus; validUntil: Date | null }, now = new Date()): boolean {
  if (quote.status !== 'SENT') return false;
  return !quote.validUntil || quote.validUntil.getTime() > now.getTime();
}

/* --------------------- Approvisionnement (cycle du lot) --------------------- */

export type MarketBatchStatusV2 = 'PLANNED' | 'ORDERED' | 'SUPPLIER_PROCESSING' | 'SHIPPED' | 'CUSTOMS_PROCESSING' | 'RECEIVED' | 'INSPECTED' | 'CANCELLED';

export const MARKET_BATCH_LABELS: Record<MarketBatchStatusV2, string> = {
  PLANNED: 'Planifié',
  ORDERED: 'Commandé fournisseur',
  SUPPLIER_PROCESSING: 'Traitement fournisseur',
  SHIPPED: 'Expédié',
  CUSTOMS_PROCESSING: 'Dédouanement',
  RECEIVED: 'Reçu',
  INSPECTED: 'Contrôlé',
  CANCELLED: 'Annulé',
};

/** Cycle du lot : planifié → commandé → traitement → expédié → douane → reçu → contrôlé. */
export const MARKET_BATCH_TRANSITIONS: Record<MarketBatchStatusV2, MarketBatchStatusV2[]> = {
  PLANNED: ['ORDERED', 'CANCELLED'],
  ORDERED: ['SUPPLIER_PROCESSING', 'SHIPPED', 'CANCELLED'],
  SUPPLIER_PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['CUSTOMS_PROCESSING', 'RECEIVED'],
  CUSTOMS_PROCESSING: ['RECEIVED'],
  RECEIVED: ['INSPECTED'],
  INSPECTED: [],
  CANCELLED: [],
};

export function isMarketBatchStatus(value: string): value is MarketBatchStatusV2 {
  return Object.prototype.hasOwnProperty.call(MARKET_BATCH_LABELS, value);
}

export function canTransitionBatch(from: MarketBatchStatusV2, to: MarketBatchStatusV2): boolean {
  return MARKET_BATCH_TRANSITIONS[from]?.includes(to) ?? false;
}

/* --------------------- Cycle de vie paiement (dérivé) ----------------------- */

export type MarketPaymentStatus =
  | 'unpaid' | 'pending_verification' | 'failed' | 'partially_paid' | 'paid'
  | 'refund_pending' | 'partially_refunded' | 'refunded';

export const MARKET_PAYMENT_LABELS: Record<MarketPaymentStatus, string> = {
  unpaid: 'Non payé',
  pending_verification: 'Paiement à vérifier',
  failed: 'Paiement échoué',
  partially_paid: 'Partiellement payé',
  paid: 'Payé',
  refund_pending: 'Remboursement en attente',
  partially_refunded: 'Partiellement remboursé',
  refunded: 'Remboursé',
};

/**
 * Statut financier dérivé — jamais stocké, donc jamais désynchronisable.
 * total : total confirmé de la commande (null tant que le devis/prix n'est pas fixé).
 */
export function deriveMarketPaymentStatus(input: {
  orderStatus: MarketOrderStatus;
  total: number | null;
  confirmedPayments: number;
  pendingPayments: number;
  rejectedPayments: number;
  refunds: number;
}): MarketPaymentStatus {
  const { orderStatus, total, confirmedPayments, pendingPayments, rejectedPayments, refunds } = input;
  if (refunds > 0 && refunds >= confirmedPayments && confirmedPayments > 0) return 'refunded';
  if (refunds > 0) return 'partially_refunded';
  if (orderStatus === 'REFUND_PENDING') return 'refund_pending';
  if (confirmedPayments > 0 && total != null && confirmedPayments >= total) return 'paid';
  if (confirmedPayments > 0) return 'partially_paid';
  if (pendingPayments > 0) return 'pending_verification';
  if (rejectedPayments > 0) return 'failed';
  return 'unpaid';
}

/* ------------------------- Produit (forme publique) ------------------------ */

export type MarketAvailability = 'AVAILABLE' | 'PREORDER' | 'UNAVAILABLE';

export interface MarketProductVariant {
  name: string; // ex. « Couleur »
  values: string[]; // ex. ["Noir", "Blanc"]
}

export interface MarketProductPublic {
  id: string;
  slug: string;
  name: string;
  reference: string;
  category: { slug: string; name: string };
  description: string | null;
  specs: { label: string; value: string }[];
  images: string[];
  priceSale: number;
  delayLabel: string | null;
  availability: MarketAvailability;
  popular: boolean;
  variants: MarketProductVariant[];
}

export const AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  PREORDER: 'Précommande',
  UNAVAILABLE: 'Indisponible',
};

/* ------------------------- Dépenses & allocation --------------------------- */

export type MarketAllocationMethod = 'VALUE' | 'QUANTITY' | 'FLAT';

export interface MarketAllocationItem {
  itemId: string;
  quantity: number;
  /** Valeur confirmée de l'item (unitPrice × quantity) — base de l'allocation VALUE. */
  value: number;
}

/**
 * Quote-part d'une dépense partagée pour chaque item d'un lot.
 * VALUE (défaut) : prorata de la valeur — fret, douane.
 * QUANTITY : prorata des quantités — frais à l'unité.
 * FLAT : parts égales entre items distincts.
 * Montants entiers FCFA ; le reliquat éventuel va au dernier item (pas de centimes).
 */
export function allocateMarketExpense(
  amount: number,
  method: MarketAllocationMethod,
  items: MarketAllocationItem[],
): Map<string, number> {
  const shares = new Map<string, number>(items.map((i) => [i.itemId, 0]));
  if (items.length === 0 || amount <= 0) return shares;

  let weights: number[];
  if (method === 'QUANTITY') {
    weights = items.map((i) => i.quantity);
  } else if (method === 'FLAT') {
    weights = items.map(() => 1);
  } else {
    weights = items.map((i) => i.value);
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    // Aucune valeur/quantité exploitable : repli sur parts égales.
    weights = items.map(() => 1);
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  let distributed = 0;
  items.forEach((item, idx) => {
    const isLast = idx === items.length - 1;
    const share = isLast
      ? amount - distributed
      : Math.round((amount * weights[idx]) / sum);
    shares.set(item.itemId, share);
    distributed += share;
  });
  return shares;
}

/** Alloue toutes les dépenses d'un lot et retourne le total par item. */
export function allocateMarketExpenses(
  expenses: { amount: number; allocationMethod: MarketAllocationMethod }[],
  items: MarketAllocationItem[],
): Map<string, number> {
  const totals = new Map<string, number>(items.map((i) => [i.itemId, 0]));
  for (const expense of expenses) {
    const shares = allocateMarketExpense(expense.amount, expense.allocationMethod, items);
    for (const [itemId, share] of shares) totals.set(itemId, (totals.get(itemId) ?? 0) + share);
  }
  return totals;
}

/* ------------------------------ Marges ------------------------------------ */

export interface MarketMargin {
  revenue: number | null; // null tant que le prix final n'est pas confirmé
  realCost: number | null; // null tant que les coûts réels ne sont pas saisis
  margin: number | null;
  marginPercent: number | null;
}

/** Marge réelle d'une commande : prix confirmés + frais − coûts réels (coûts variables inclus, hors coûts fixes — jamais étiquetée « bénéfice net »). */
export function computeMarketMargin(items: { quantity: number; unitPrice: number | null; unitCostReal: number | null }[], deliveryFee: number | null, deliveryCost: number | null): MarketMargin {
  const priced = items.filter((i) => i.unitPrice != null);
  const revenue = priced.length === items.length
    ? priced.reduce((sum, i) => sum + i.unitPrice! * i.quantity, 0) + (deliveryFee ?? 0)
    : null;
  const costed = items.filter((i) => i.unitCostReal != null);
  const realCost = costed.length === items.length
    ? costed.reduce((sum, i) => sum + i.unitCostReal! * i.quantity, 0) + (deliveryCost ?? 0)
    : null;
  if (revenue == null || realCost == null) return { revenue, realCost, margin: null, marginPercent: null };
  return { revenue, realCost, margin: revenue - realCost, marginPercent: revenue > 0 ? Math.round(((revenue - realCost) / revenue) * 1000) / 10 : 0 };
}

/* ----------------------- Validation des payloads --------------------------- */

export const marketOrderPayloadSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1).max(60),
    variantLabel: z.string().trim().min(1).max(120).optional(),
    quantity: z.number().int().min(1).max(20),
  })).min(1, 'Sélectionnez au moins un produit.').max(10),
  name: z.string().trim().min(2, 'Votre nom est requis.').max(80),
  phone: z.string().trim().max(32),
  zoneName: z.string().trim().min(2, 'Indiquez votre quartier.').max(160),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  requestKey: z.string().uuid().optional(),
  consent: z.literal(true, { message: 'Votre accord est nécessaire pour être recontacté.' }),
}).superRefine((values, ctx) => {
  if (!normalizePhoneE164(values.phone)) {
    ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Numéro invalide. Format attendu : 6 XX XX XX XX.' });
  }
});

export type MarketOrderPayload = z.input<typeof marketOrderPayloadSchema>;

/** Variantes produit : forme admin/public validée. */
export const marketVariantsSchema = z.array(z.object({
  name: z.string().trim().min(1).max(60),
  values: z.array(z.string().trim().min(1).max(60)).min(1).max(12),
})).max(6);

/** Événements analytiques publics (funnel pré-commande uniquement). */
export const MARKET_ANALYTIC_TYPES = ['SHOP_VIEWED', 'CATEGORY_VIEWED', 'PRODUCT_VIEWED', 'ADD_TO_CART', 'CHECKOUT_STARTED'] as const;
export type MarketAnalyticType = typeof MARKET_ANALYTIC_TYPES[number];

export function isMarketAnalyticType(value: string): value is MarketAnalyticType {
  return (MARKET_ANALYTIC_TYPES as readonly string[]).includes(value);
}
