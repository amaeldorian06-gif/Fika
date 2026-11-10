import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests Fika Market : validation des payloads, idempotence des commandes,
 * projection publique sans coûts, transitions de statut et gardes métier
 * (prix complets avant confirmation, paiement couvrant avant livraison),
 * marges réelles.
 */

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  marketCategory: { findMany: vi.fn() },
  marketProduct: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  marketOrder: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  marketOrderItem: { findMany: vi.fn(), update: vi.fn() },
  marketOrderEvent: { create: vi.fn() },
  marketPayment: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  marketDelivery: { upsert: vi.fn() },
  marketQuote: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  marketRefund: { findMany: vi.fn(), create: vi.fn() },
  marketExpense: { findMany: vi.fn(), create: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  marketAnalyticEvent: { findMany: vi.fn(), create: vi.fn() },
  marketProcurementBatch: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  customer: { upsert: vi.fn() },
  documentCounter: { findUnique: vi.fn(), upsert: vi.fn() },
  quote: { findMany: vi.fn() },
}));

vi.mock('../../src/lib/prisma', () => ({ prisma: db }));

import { createMarketOrder, getMarketCatalog, recordMarketAnalyticEvent } from './market';
import {
  confirmMarketPrice, createMarketQuote, recordMarketRefund,
  respondMarketQuote, reviewMarketPayment, updateMarketOrderStatus,
} from './admin-market';
import {
  allocateMarketExpense, canTransitionBatch, computeMarketMargin, deriveMarketPaymentStatus,
  marketOrderPayloadSchema,
} from '../../src/lib/market';

const validPayload = {
  items: [{ productId: 'prod-1', quantity: 2 }],
  name: 'Aïcha M.',
  phone: '6 77 12 34 56',
  zoneName: 'Baladji 1',
  consent: true,
  requestKey: '11111111-1111-4111-8111-111111111111',
};

const productAvailable = { id: 'prod-1', name: 'Aspirateur compact', availability: 'AVAILABLE' };

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  db.marketProduct.findMany.mockResolvedValue([productAvailable]);
  db.marketOrder.findUnique.mockResolvedValue(null);
  db.customer.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({ id: 'cust-1', ...create }));
  db.documentCounter.findUnique.mockResolvedValue({ key: 'MKT-2026', value: 6 });
  db.documentCounter.upsert.mockResolvedValue({ key: 'MKT-2026', value: 7 });
  db.marketOrder.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'order-1', orderNumber: 'MKT-2026-0007', trackCode: 'AB12CD34EF', ...data,
  }));
});

/* ------------------------------ Validation --------------------------------- */

describe('Validation des commandes publiques', () => {
  it('accepte un payload complet et normalisable', () => {
    const parsed = marketOrderPayloadSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it('rejette téléphone invalide, consentement absent, panier vide, quantité nulle', () => {
    expect(marketOrderPayloadSchema.safeParse({ ...validPayload, phone: '099999999' }).success).toBe(false);
    expect(marketOrderPayloadSchema.safeParse({ ...validPayload, consent: false }).success).toBe(false);
    expect(marketOrderPayloadSchema.safeParse({ ...validPayload, items: [] }).success).toBe(false);
    expect(marketOrderPayloadSchema.safeParse({ ...validPayload, items: [{ productId: 'prod-1', quantity: 0 }] }).success).toBe(false);
    expect(marketOrderPayloadSchema.safeParse({ ...validPayload, items: [{ productId: 'prod-1', quantity: 21 }] }).success).toBe(false);
  });

  it('exige un requestKey UUID (idempotence par double-clic)', () => {
    expect(marketOrderPayloadSchema.safeParse({ ...validPayload, requestKey: 'pas-un-uuid' }).success).toBe(false);
  });

  it('accepte une variante par article (snapshot) et refuse les labels trop longs', () => {
    expect(marketOrderPayloadSchema.safeParse({ ...validPayload, items: [{ productId: 'prod-1', variantLabel: 'Couleur : Noir', quantity: 1 }] }).success).toBe(true);
    expect(marketOrderPayloadSchema.safeParse({ ...validPayload, items: [{ productId: 'prod-1', variantLabel: 'x'.repeat(121), quantity: 1 }] }).success).toBe(false);
  });
});

/* --------------------------- Création & idempotence ------------------------ */

describe('createMarketOrder', () => {
  it('crée la commande : numéro MKT, client upserté en E.164, événement initial', async () => {
    const res = await createMarketOrder(validPayload, 'ip-test');
    expect(res.status).toBe(200);
    if (res.status !== 200) return;
    expect(res.body.orderNumber).toBe('MKT-2026-0007');
    expect('trackCode' in res.body).toBe(false); // suivi public supprimé : jamais exposé au client

    expect(db.customer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { phone: '+237677123456' },
      create: expect.objectContaining({ phone: '+237677123456', name: 'Aïcha M.' }),
    }));
    const createArgs = db.marketOrder.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('REQUESTED');
    expect(createArgs.data.source).toBe('SITE');
    expect(createArgs.data.items.create).toEqual([{ productId: 'prod-1', productName: 'Aspirateur compact', variantLabel: null, quantity: 2 }]);
    expect(createArgs.data.events.create).toEqual({ to: 'REQUESTED', note: 'Demande reçue depuis la boutique.' });
  });

  it('est idempotent : même requestKey → même commande, aucune recréation', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ id: 'order-exist', orderNumber: 'MKT-2026-0003', trackCode: 'ZZ99YY88XX' });
    const res = await createMarketOrder(validPayload, 'ip-test-2');
    expect(res.status).toBe(200);
    if (res.status !== 200) return;
    expect(res.body.orderNumber).toBe('MKT-2026-0003');
    expect(db.marketOrder.create).not.toHaveBeenCalled();
    expect(db.customer.upsert).not.toHaveBeenCalled();
  });

  it('refuse un produit indisponible (précommande impossible)', async () => {
    db.marketProduct.findMany.mockResolvedValue([{ ...productAvailable, availability: 'UNAVAILABLE' }]);
    const res = await createMarketOrder(validPayload, 'ip-test-3');
    expect(res.status).toBe(400);
    if (res.status === 200) return;
    expect(res.body.code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('refuse un produit inconnu ou désactivé', async () => {
    db.marketProduct.findMany.mockResolvedValue([]);
    const res = await createMarketOrder(validPayload, 'ip-test-4');
    expect(res.status).toBe(400);
    if (res.status === 200) return;
    expect(res.body.code).toBe('PRODUCT_INVALID');
  });

  it('limite le débit par IP', async () => {
    for (let i = 0; i < 10; i++) await createMarketOrder({ ...validPayload, requestKey: undefined }, 'ip-flood');
    const res = await createMarketOrder({ ...validPayload, requestKey: undefined }, 'ip-flood');
    expect(res.status).toBe(429);
  });
});

/* --------------------------- Projection publique --------------------------- */

describe('Catalogue public : aucune fuite de coûts', () => {
  it('exclut supplierPrice et estimatedLandedCost des produits publics', async () => {
    db.marketCategory.findMany.mockResolvedValue([{ slug: 'maison', name: 'Maison' }]);
    db.marketProduct.findMany.mockResolvedValue([{
      id: 'prod-1', slug: 'aspirateur-compact', name: 'Aspirateur compact', reference: 'FK-MKT-001',
      description: null, specs: [{ label: 'Puissance', value: '700 W' }, { bad: true }],
      images: ['https://exemple.com/a.jpg', 'javascript:alert(1)'],
      priceSale: 45000, delayLabel: '2 à 3 semaines', availability: 'PREORDER', popular: true,
      category: { slug: 'maison', name: 'Maison' },
      // Champs pièges : ils ne doivent JAMAIS ressortir.
      supplierPrice: 12000, estimatedLandedCost: 20000,
    }]);
    const catalog = await getMarketCatalog();
    expect(catalog.products).toHaveLength(1);
    const p = catalog.products[0] as unknown as Record<string, unknown>;
    expect(p.supplierPrice).toBeUndefined();
    expect(p.estimatedLandedCost).toBeUndefined();
    expect(p.specs).toEqual([{ label: 'Puissance', value: '700 W' }]);
    expect(p.images).toEqual(['https://exemple.com/a.jpg']);
  });
});

const pricedOrder = {
  id: 'order-1', status: 'AWAITING_CLIENT', confirmedAt: null, deliveredAt: null,
  items: [{ unitPrice: 45000, quantity: 2 }],
  deliveryFee: 1000,
};

describe('updateMarketOrderStatus : gardes métier', () => {
  it('refuse une transition hors graphe (REQUESTED → DELIVERED)', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ ...pricedOrder, status: 'REQUESTED' });
    const res = await updateMarketOrderStatus({ orderId: 'order-1', to: 'DELIVERED' }, 'admin-1');
    expect(res.status).toBe(409);
    expect(db.marketOrder.update).not.toHaveBeenCalled();
  });

  it('refuse CONFIRMED tant qu’un prix final manque', async () => {
    db.marketOrder.findUnique.mockResolvedValue({
      ...pricedOrder, status: 'AWAITING_CLIENT',
      items: [{ unitPrice: null, quantity: 2 }],
    });
    const res = await updateMarketOrderStatus({ orderId: 'order-1', to: 'CONFIRMED' }, 'admin-1');
    expect(res.status).toBe(409);
    expect(db.marketOrder.update).not.toHaveBeenCalled();
  });

  it('accepte CONFIRMED avec des prix complets et trace l’événement', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ ...pricedOrder });
    const res = await updateMarketOrderStatus({ orderId: 'order-1', to: 'CONFIRMED', note: 'Client d’accord' }, 'admin-1');
    expect(res.status).toBe(200);
    expect(db.marketOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-1' },
      data: expect.objectContaining({ status: 'CONFIRMED', confirmedAt: expect.any(Date) }),
    }));
    expect(db.marketOrderEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { orderId: 'order-1', from: 'AWAITING_CLIENT', to: 'CONFIRMED', note: 'Client d’accord', actorId: 'admin-1' },
    }));
  });

  it('refuse DELIVERED si le paiement confirmé ne couvre pas le total', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ ...pricedOrder, status: 'DELIVERING' });
    db.marketPayment.findMany.mockResolvedValue([{ amount: 50000, status: 'CONFIRMED' }]); // total = 91 000
    const res = await updateMarketOrderStatus({ orderId: 'order-1', to: 'DELIVERED' }, 'admin-1');
    expect(res.status).toBe(409);
    expect(db.marketOrder.update).not.toHaveBeenCalled();
  });

  it('accepte DELIVERED quand le paiement confirmé couvre le total', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ ...pricedOrder, status: 'DELIVERING' });
    db.marketPayment.findMany.mockResolvedValue([{ amount: 91000, status: 'CONFIRMED' }]);
    const res = await updateMarketOrderStatus({ orderId: 'order-1', to: 'DELIVERED' }, 'admin-1');
    expect(res.status).toBe(200);
    expect(db.marketOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'DELIVERED', deliveredAt: expect.any(Date) }),
    }));
  });
});

describe('confirmMarketPrice', () => {
  it('fixe les prix, les frais, passe en AWAITING_CLIENT et trace', async () => {
    db.marketOrder.findUnique.mockResolvedValue({
      id: 'order-1', status: 'REQUESTED', deliveryFee: null,
      items: [{ id: 'item-1' }, { id: 'item-2' }],
    });
    const res = await confirmMarketPrice({
      orderId: 'order-1', deliveryFee: 1500,
      items: [{ itemId: 'item-1', unitPrice: 45000 }, { itemId: 'item-2', unitPrice: 12000 }],
    }, 'admin-1');
    expect(res.status).toBe(200);
    expect(db.marketOrderItem.update).toHaveBeenCalledTimes(2);
    expect(db.marketOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-1' },
      data: expect.objectContaining({ deliveryFee: 1500, status: 'AWAITING_CLIENT' }),
    }));
  });

  it('refuse si la commande est déjà confirmée', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'CONFIRMED', items: [{ id: 'item-1' }] });
    const res = await confirmMarketPrice({ orderId: 'order-1', deliveryFee: 0, items: [{ itemId: 'item-1', unitPrice: 1000 }] }, 'admin-1');
    expect(res.status).toBe(409);
  });

  it('refuse s’il manque le prix d’un article', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'REQUESTED', items: [{ id: 'item-1' }, { id: 'item-2' }] });
    const res = await confirmMarketPrice({
      orderId: 'order-1', deliveryFee: 0, items: [{ itemId: 'item-1', unitPrice: 5000 }],
    }, 'admin-1');
    expect(res.status).toBe(400);
  });
});

describe('reviewMarketPayment', () => {
  it('la première confirmation de paiement fait passer AWAITING_CLIENT → CONFIRMED', async () => {
    db.marketPayment.findUnique.mockResolvedValue({ id: 'pay-1', orderId: 'order-1', status: 'PENDING', amount: 91000 });
    db.marketOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'AWAITING_CLIENT' });
    const res = await reviewMarketPayment({ paymentId: 'pay-1', action: 'CONFIRM' }, 'admin-1');
    expect(res.status).toBe(200);
    expect(db.marketPayment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pay-1' },
      data: expect.objectContaining({ status: 'CONFIRMED' }),
    }));
    expect(db.marketOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-1' },
      data: expect.objectContaining({ status: 'CONFIRMED' }),
    }));
    expect(db.marketOrderEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ orderId: 'order-1', to: 'CONFIRMED', note: 'Paiement vérifié.' }),
    }));
  });

  it('rejette un paiement déjà traité', async () => {
    db.marketPayment.findUnique.mockResolvedValue({ id: 'pay-1', orderId: 'order-1', status: 'CONFIRMED' });
    const res = await reviewMarketPayment({ paymentId: 'pay-1', action: 'REJECT' }, 'admin-1');
    expect(res.status).toBe(409);
  });
});

/* ------------------------------ Marge réelle -------------------------------- */

describe('computeMarketMargin', () => {
  const items = [
    { quantity: 2, unitPrice: 45000, unitCostReal: 20000 },
    { quantity: 1, unitPrice: 12000, unitCostReal: 5000 },
  ];

  it('null tant que le prix ou les coûts réels sont incomplets', () => {
    expect(computeMarketMargin([{ quantity: 1, unitPrice: null, unitCostReal: 100 }], 500, 0).margin).toBeNull();
    expect(computeMarketMargin([{ quantity: 1, unitPrice: 1000, unitCostReal: null }], 500, 0).margin).toBeNull();
  });

  it('calcule revenu, coût et marge réelle avec les frais de livraison', () => {
    // revenu = 2×45000 + 12000 + 1500 = 103 500 ; coût = 2×20000 + 5000 + 800 = 45 800
    const m = computeMarketMargin(items, 1500, 800);
    expect(m.revenue).toBe(103500);
    expect(m.realCost).toBe(45800);
    expect(m.margin).toBe(57700);
    expect(m.marginPercent).toBeCloseTo(55.7, 1);
  });
});

/* ------------------------------ Devis V2 ----------------------------------- */

const quoteableOrder = {
  id: 'order-1', status: 'AWAITING_CLIENT', deliveryFee: 1000,
  items: [
    { id: 'item-1', productId: 'prod-1', productName: 'Écouteurs Pro', variantLabel: 'Couleur : Noir', quantity: 2, unitPrice: 15000, unitCostReal: null, product: { reference: 'FK-MKT-001' } },
  ],
};

describe('createMarketQuote', () => {
  beforeEach(() => {
    db.marketQuote.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      quoteNumber: 'MQT-2026-0001', validUntil: new Date('2026-11-07T00:00:00Z'), totalAmount: 31000, ...data,
    }));
    db.marketQuote.findMany.mockResolvedValue([]);
    db.documentCounter.findUnique.mockResolvedValue(null);
    db.documentCounter.upsert.mockResolvedValue({ value: 1 });
  });

  it('crée un devis : snapshot verrouillé, total, validité, commande en attente client', async () => {
    db.marketOrder.findUnique.mockResolvedValue(quoteableOrder);
    const res = await createMarketQuote({ orderId: 'order-1', validDays: 7 }, 'admin-1');
    expect(res.status).toBe(200);
    const createArgs = db.marketQuote.create.mock.calls[0][0];
    expect(createArgs.data.quoteNumber).toBe('MQT-2026-0001');
    expect(createArgs.data.items).toEqual([{ productId: 'prod-1', productName: 'Écouteurs Pro', reference: 'FK-MKT-001', variantLabel: 'Couleur : Noir', quantity: 2, unitPrice: 15000 }]);
    expect(createArgs.data.deliveryFee).toBe(1000);
    expect(createArgs.data.totalAmount).toBe(31000); // 2×15000 + 1000
    expect(createArgs.data.status).toBe('SENT');
    expect(db.marketOrderEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ to: 'AWAITING_CLIENT', note: expect.stringContaining('MQT-2026-0001') }),
    }));
  });

  it('refuse sans prix complets', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ ...quoteableOrder, items: [{ ...quoteableOrder.items[0], unitPrice: null }] });
    const res = await createMarketQuote({ orderId: 'order-1' }, 'admin-1');
    expect(res.status).toBe(409);
    expect(db.marketQuote.create).not.toHaveBeenCalled();
  });

  it('refuse si la commande est déjà confirmée', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ ...quoteableOrder, status: 'CONFIRMED' });
    const res = await createMarketQuote({ orderId: 'order-1' }, 'admin-1');
    expect(res.status).toBe(409);
  });
});

describe('respondMarketQuote', () => {
  it('ACCEPTED → commande AWAITING_PAYMENT', async () => {
    db.marketQuote.findUnique.mockResolvedValue({
      id: 'quote-1', status: 'SENT', validUntil: new Date(Date.now() + 86_400_000),
      order: { id: 'order-1', status: 'AWAITING_CLIENT' },
    });
    const res = await respondMarketQuote({ quoteId: 'quote-1', action: 'ACCEPTED' }, 'admin-1');
    expect(res.status).toBe(200);
    expect(db.marketQuote.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) }));
    expect(db.marketOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'AWAITING_PAYMENT' }) }));
  });

  it('REJECTED → devis refusé, commande inchangée', async () => {
    db.marketQuote.findUnique.mockResolvedValue({
      id: 'quote-1', status: 'SENT', validUntil: new Date(Date.now() + 86_400_000),
      order: { id: 'order-1', status: 'AWAITING_CLIENT' },
    });
    const res = await respondMarketQuote({ quoteId: 'quote-1', action: 'REJECTED' }, 'admin-1');
    expect(res.status).toBe(200);
    expect(db.marketQuote.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }));
    expect(db.marketOrder.update).not.toHaveBeenCalled();
  });

  it('refuse un devis expiré', async () => {
    db.marketQuote.findUnique.mockResolvedValue({
      id: 'quote-1', status: 'SENT', validUntil: new Date(Date.now() - 1000),
      order: { id: 'order-1', status: 'AWAITING_CLIENT' },
    });
    const res = await respondMarketQuote({ quoteId: 'quote-1', action: 'ACCEPTED' }, 'admin-1');
    expect(res.status).toBe(409);
  });

  it('refuse un devis déjà traité', async () => {
    db.marketQuote.findUnique.mockResolvedValue({
      id: 'quote-1', status: 'ACCEPTED', validUntil: null,
      order: { id: 'order-1', status: 'AWAITING_PAYMENT' },
    });
    const res = await respondMarketQuote({ quoteId: 'quote-1', action: 'REJECTED' }, 'admin-1');
    expect(res.status).toBe(409);
  });
});

/* -------------------------- Remboursements V2 ------------------------------- */

describe('recordMarketRefund', () => {
  it('plafonne le remboursement aux paiements vérifiés', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'DELIVERED' });
    db.marketPayment.findMany.mockResolvedValue([{ amount: 31000, status: 'CONFIRMED' }]);
    db.marketRefund.findMany.mockResolvedValue([{ amount: 10000 }]);
    // déjà remboursé 10 000 → max 21 000
    const res = await recordMarketRefund({ orderId: 'order-1', amount: 25000 }, 'admin-1');
    expect(res.status).toBe(409);
    expect(db.marketRefund.create).not.toHaveBeenCalled();
  });

  it('enregistre un remboursement valide et trace l’événement', async () => {
    db.marketOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'DELIVERED' });
    db.marketPayment.findMany.mockResolvedValue([{ amount: 31000, status: 'CONFIRMED' }]);
    db.marketRefund.findMany.mockResolvedValue([]);
    const res = await recordMarketRefund({ orderId: 'order-1', amount: 5000, method: 'MTN_MOMO', reason: 'Produit endommagé' }, 'admin-1');
    expect(res.status).toBe(200);
    expect(db.marketRefund.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 5000, reason: 'Produit endommagé', recordedById: 'admin-1' }),
    }));
    expect(db.marketOrderEvent.create).toHaveBeenCalled();
  });
});

/* --------------------- Cycle de vie paiement (dérivé) ----------------------- */

describe('deriveMarketPaymentStatus', () => {
  const base = { orderStatus: 'AWAITING_PAYMENT' as const, total: 31000 };
  it('couvre tous les états sans jamais les stocker', () => {
    expect(deriveMarketPaymentStatus({ ...base, confirmedPayments: 0, pendingPayments: 0, rejectedPayments: 0, refunds: 0 })).toBe('unpaid');
    expect(deriveMarketPaymentStatus({ ...base, confirmedPayments: 0, pendingPayments: 1, rejectedPayments: 0, refunds: 0 })).toBe('pending_verification');
    expect(deriveMarketPaymentStatus({ ...base, confirmedPayments: 0, pendingPayments: 0, rejectedPayments: 2, refunds: 0 })).toBe('failed');
    expect(deriveMarketPaymentStatus({ ...base, confirmedPayments: 10000, pendingPayments: 0, rejectedPayments: 0, refunds: 0 })).toBe('partially_paid');
    expect(deriveMarketPaymentStatus({ ...base, confirmedPayments: 31000, pendingPayments: 0, rejectedPayments: 0, refunds: 0 })).toBe('paid');
    expect(deriveMarketPaymentStatus({ orderStatus: 'REFUND_PENDING', total: 31000, confirmedPayments: 31000, pendingPayments: 0, rejectedPayments: 0, refunds: 0 })).toBe('refund_pending');
    expect(deriveMarketPaymentStatus({ ...base, confirmedPayments: 31000, pendingPayments: 0, rejectedPayments: 0, refunds: 10000 })).toBe('partially_refunded');
    expect(deriveMarketPaymentStatus({ ...base, confirmedPayments: 31000, pendingPayments: 0, rejectedPayments: 0, refunds: 31000 })).toBe('refunded');
  });
});

/* ---------------------------- Allocation V2 --------------------------------- */

describe('allocateMarketExpense', () => {
  const items = [
    { itemId: 'a', quantity: 2, value: 30000 },
    { itemId: 'b', quantity: 1, value: 10000 },
  ];

  it('répartit au prorata de la valeur (défaut) — entier FCFA, reliquat au dernier', () => {
    const shares = allocateMarketExpense(8000, 'VALUE', items);
    expect(shares.get('a')).toBe(6000);
    expect(shares.get('b')).toBe(2000);
  });

  it('répartit au prorata des quantités', () => {
    const shares = allocateMarketExpense(9000, 'QUANTITY', items);
    expect(shares.get('a')).toBe(6000);
    expect(shares.get('b')).toBe(3000);
  });

  it('répartit en parts égales entre items distincts (FLAT)', () => {
    const shares = allocateMarketExpense(10000, 'FLAT', items);
    expect(shares.get('a')).toBe(5000);
    expect(shares.get('b')).toBe(5000);
  });

  it('repart en parts égales si aucune valeur exploitable', () => {
    const shares = allocateMarketExpense(1000, 'VALUE', [{ itemId: 'a', quantity: 0, value: 0 }, { itemId: 'b', quantity: 0, value: 0 }]);
    expect(shares.get('a')).toBe(500);
    expect(shares.get('b')).toBe(500);
  });
});

/* ------------------------ Transitions de lot V2 ----------------------------- */

describe('canTransitionBatch', () => {
  it('suit le cycle planifié → commandé → traitement → expédié → douane → reçu → contrôlé', () => {
    expect(canTransitionBatch('PLANNED', 'ORDERED')).toBe(true);
    expect(canTransitionBatch('ORDERED', 'SUPPLIER_PROCESSING')).toBe(true);
    expect(canTransitionBatch('SUPPLIER_PROCESSING', 'SHIPPED')).toBe(true);
    expect(canTransitionBatch('SHIPPED', 'CUSTOMS_PROCESSING')).toBe(true);
    expect(canTransitionBatch('CUSTOMS_PROCESSING', 'RECEIVED')).toBe(true);
    expect(canTransitionBatch('RECEIVED', 'INSPECTED')).toBe(true);
    // raccourcis et refus
    expect(canTransitionBatch('PLANNED', 'RECEIVED')).toBe(false);
    expect(canTransitionBatch('ORDERED', 'RECEIVED')).toBe(false);
    expect(canTransitionBatch('INSPECTED', 'PLANNED')).toBe(false);
    expect(canTransitionBatch('CANCELLED', 'ORDERED')).toBe(false);
  });
});

/* ------------------------ Événements analytiques ---------------------------- */

describe('recordMarketAnalyticEvent', () => {
  it('enregistre un événement de funnel sans données personnelles', async () => {
    db.marketProduct.findFirst.mockResolvedValue({ id: 'prod-1' });
    const res = await recordMarketAnalyticEvent({ type: 'PRODUCT_VIEWED', productId: 'prod-1' }, 'ip-a');
    expect(res.status).toBe(200);
    expect(db.marketAnalyticEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'PRODUCT_VIEWED', productId: 'prod-1' }),
    }));
  });

  it('rejette un type inconnu', async () => {
    const res = await recordMarketAnalyticEvent({ type: 'ORDER_DELIVERED' }, 'ip-b');
    expect(res.status).toBe(400);
  });
});
