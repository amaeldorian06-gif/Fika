import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  payment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  lead: { findUnique: vi.fn(), update: vi.fn() },
  customer: { upsert: vi.fn() },
  orderEvent: { create: vi.fn() },
  expert: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  quote: { findMany: vi.fn(), create: vi.fn() },
  documentCounter: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock('../../src/lib/prisma', () => ({ prisma: db }));
import { handleRecordPayment, handleReviewPayment } from './admin-payments';
import { handleConvertLead, handleUpdateLeadStatus } from './admin-leads';
import { handleCreateQuote, handleUpdateStatus } from './admin-orders';
import { handleCreateExpert, handleUpdateExpert } from './admin-experts';
import { handleAssignExpert } from './admin-execution';
import { serialTransaction } from '../lib/transaction';

const receipt = { orderId: 'order', amount: 10000, method: 'MTN_MOMO', reference: 'TX-001', idempotencyKey: 'feff30c0-1ac6-40a7-b01c-1df8f3ee3161' };
const order = { id: 'order', status: 'QUOTED', totalPrice: 10000, payments: [], items: [{ id: 'item' }], tasks: [], completedAt: null };
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async fn => fn(db));
  db.order.findUnique.mockResolvedValue(order);
  db.payment.findUnique.mockResolvedValue(null);
  db.payment.create.mockImplementation(async ({ data }) => ({ id: 'payment', ...data }));
  db.documentCounter.findUnique.mockResolvedValue({ key: 'counter', value: 3 });
  db.documentCounter.upsert.mockResolvedValue({ value: 4 });
});

describe('reçus manuels', () => {
  it('exige la session et valide le montant avant toute écriture', async () => {
    expect((await handleRecordPayment(receipt, null)).status).toBe(401);
    expect((await handleRecordPayment({ ...receipt, amount: 0 }, 'admin')).status).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('crée uniquement PENDING et trace l’acteur dans la même transaction', async () => {
    expect((await handleRecordPayment(receipt, 'admin')).status).toBe(200);
    expect(db.payment.create).toHaveBeenCalledWith({ data: { ...receipt, status: 'PENDING', createdById: 'admin' } });
    expect(db.orderEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: 'admin', orderId: 'order' }) });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(db.order.update).not.toHaveBeenCalled();
  });
  it('la même requête rejouée ne crée rien', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'payment', ...receipt });
    expect(await handleRecordPayment(receipt, 'admin')).toMatchObject({ status: 200, body: { paymentId: 'payment' } });
    expect(db.payment.create).not.toHaveBeenCalled();
  });
  it('une clé réutilisée avec un autre montant est refusée', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'payment', ...receipt, amount: 9000 });
    expect(await handleRecordPayment(receipt, 'admin')).toMatchObject({ status: 409, body: { code: 'IDEMPOTENCY_CONFLICT' } });
  });
  it('refuse le doublon de référence même avec une autre clé', async () => {
    db.payment.create.mockRejectedValue({ code: 'P2002' });
    expect(await handleRecordPayment(receipt, 'admin')).toMatchObject({ status: 409, body: { code: 'DUPLICATE_REFERENCE' } });
  });
  it('refuse un excédent, en tenant compte des reçus en attente', async () => {
    db.order.findUnique.mockResolvedValue({ ...order, payments: [{ amount: 1000, status: 'PENDING' }] });
    expect(await handleRecordPayment(receipt, 'admin')).toMatchObject({ status: 409, body: { code: 'EXCESS_PAYMENT' } });
    expect(db.payment.create).not.toHaveBeenCalled();
  });
  it.each(['CANCELLED', 'COMPLETED', 'DISPUTED', 'QUALIFYING'])('refuse une commande %s', async status => {
    db.order.findUnique.mockResolvedValue({ ...order, status });
    expect((await handleRecordPayment(receipt, 'admin')).status).toBe(409);
  });
  it('signale une commande inexistante', async () => {
    db.order.findUnique.mockResolvedValue(null);
    expect((await handleRecordPayment(receipt, 'admin')).status).toBe(404);
  });
  it('exige une attestation avant de confirmer et un motif avant de rejeter', async () => {
    expect((await handleReviewPayment({ paymentId: 'payment', action: 'CONFIRM' }, 'admin')).status).toBe(400);
    expect((await handleReviewPayment({ paymentId: 'payment', action: 'REJECT' }, 'admin')).status).toBe(400);
    expect(db.payment.update).not.toHaveBeenCalled();
  });
  it('confirme avec l’acteur, l’horodatage et un événement, sans changer automatiquement la commande', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'payment', ...receipt, status: 'PENDING', order });
    expect((await handleReviewPayment({ paymentId: 'payment', action: 'CONFIRM', receivedVerified: true }, 'admin')).status).toBe(200);
    expect(db.payment.update).toHaveBeenCalledWith({ where: { id: 'payment' }, data: { status: 'CONFIRMED', confirmedById: 'admin', confirmedAt: expect.any(Date) } });
    expect(db.order.update).not.toHaveBeenCalled();
  });
  it('une double confirmation ne double pas l’historique', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'payment', ...receipt, status: 'CONFIRMED', order });
    expect((await handleReviewPayment({ paymentId: 'payment', action: 'CONFIRM', receivedVerified: true }, 'admin')).status).toBe(200);
    expect(db.payment.update).not.toHaveBeenCalled();
    expect(db.orderEvent.create).not.toHaveBeenCalled();
  });
  it('interdit de rejeter un encaissement déjà confirmé', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'payment', status: 'CONFIRMED', order });
    expect((await handleReviewPayment({ paymentId: 'payment', action: 'REJECT', reason: 'erreur' }, 'admin')).status).toBe(409);
  });
  it('permet de rejeter un reçu non encaissé même après annulation de commande', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'payment', status: 'PENDING', order: { ...order, status: 'CANCELLED' } });
    expect((await handleReviewPayment({ paymentId: 'payment', action: 'REJECT', reason: 'fonds non reçus' }, 'admin')).status).toBe(200);
    expect(db.payment.update).toHaveBeenCalledWith({ where: { id: 'payment' }, data: { status: 'FAILED' } });
  });
  it('un acompte ne débloque pas Payée, le cumul intégral oui', async () => {
    db.order.findUnique.mockResolvedValue({ ...order, payments: [{ amount: 2000, status: 'CONFIRMED' }] });
    expect((await handleUpdateStatus({ orderId: 'order', to: 'PAID' }, 'admin')).status).toBe(409);
    db.order.findUnique.mockResolvedValue({ ...order, payments: [{ amount: 2000, status: 'CONFIRMED' }, { amount: 8000, status: 'CONFIRMED' }] });
    expect((await handleUpdateStatus({ orderId: 'order', to: 'PAID' }, 'admin')).status).toBe(200);
  });
});

describe('conversion atomique et numérotation', () => {
  beforeEach(() => { db.order.findUnique.mockResolvedValue(null); db.lead.findUnique.mockResolvedValue({ id: 'lead', status: 'NEW', customerId: null, source: 'SITE', description: 'Besoin sur mesure' }); });
  it('bloque une demande sans client ni téléphone avant toute écriture', async () => {
    expect((await handleConvertLead({ leadId: 'lead' }, 'admin')).status).toBe(400);
    expect(db.customer.upsert).not.toHaveBeenCalled();
  });
  it('crée client et commande puis rattache le lead dans une transaction', async () => {
    db.customer.upsert.mockResolvedValue({ id: 'customer' });
    db.order.create.mockResolvedValue({ id: 'new-order', orderNumber: 'CMD-test' });
    expect((await handleConvertLead({ leadId: 'lead', phone: '+237612345678', name: 'Client' }, 'admin')).status).toBe(200);
    expect(db.customer.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { phone: '+237612345678' }, update: {} }));
    expect(db.order.create).toHaveBeenCalledWith({ data: expect.objectContaining({ customerId: 'customer', leadId: 'lead', totalPrice: null }) });
    expect(db.lead.update).toHaveBeenCalledWith({ where: { id: 'lead' }, data: { status: 'CONVERTED', customerId: 'customer' } });
  });
  it('rejouer une conversion retrouve la commande existante', async () => {
    db.order.findUnique.mockResolvedValue({ id: 'existing', orderNumber: 'CMD-existing' });
    expect(await handleConvertLead({ leadId: 'lead' }, 'admin')).toMatchObject({ status: 200, body: { orderId: 'existing' } });
    expect(db.order.create).not.toHaveBeenCalled();
  });
  it('propage un échec pour que Prisma annule toute la transaction', async () => {
    db.customer.upsert.mockResolvedValue({ id: 'customer' });
    db.order.create.mockRejectedValue(new Error('write failed'));
    await expect(handleConvertLead({ leadId: 'lead', phone: '+237612345678' }, 'admin')).rejects.toThrow('write failed');
    expect(db.lead.update).not.toHaveBeenCalled();
  });
  it('interdit le statut Converti hors du parcours de conversion', async () => {
    expect((await handleUpdateLeadStatus({ leadId: 'lead', status: 'CONVERTED' }, 'admin')).status).toBe(400);
  });
  it('interdit de remettre à Nouveau une demande convertie', async () => {
    db.lead.findUnique.mockResolvedValue({ id: 'lead', status: 'CONVERTED', orders: [{ id: 'order' }] });
    expect((await handleUpdateLeadStatus({ leadId: 'lead', status: 'NEW' }, 'admin')).status).toBe(409);
  });
  it('initialise les numéros depuis le maximum existant, pas le nombre de lignes', async () => {
    const year = new Date().getFullYear();
    db.order.findUnique.mockResolvedValue({ ...order, status: 'QUALIFYING' });
    db.documentCounter.findUnique.mockResolvedValue(null);
    db.quote.findMany.mockResolvedValue([{ quoteNumber: `DEV-${year}-0001` }, { quoteNumber: `DEV-${year}-0010` }]);
    db.documentCounter.upsert.mockResolvedValue({ value: 11 });
    expect(await handleCreateQuote({ orderId: 'order', amount: 15000 }, 'admin')).toMatchObject({ status: 200, body: { quoteNumber: `DEV-${year}-0011` } });
    expect(db.documentCounter.upsert).toHaveBeenCalledWith({ where: { key: `DEV-${year}` }, create: { key: `DEV-${year}`, value: 11 }, update: { value: { increment: 1 } } });
    expect(db.order.update).toHaveBeenCalledWith({ where: { id: 'order' }, data: { totalPrice: 15000, status: 'QUOTED' } });
  });
  it('ne modifie pas un devis après saisie de paiement', async () => {
    db.order.findUnique.mockResolvedValue({ ...order, payments: [{ amount: 1000, status: 'PENDING' }] });
    expect((await handleCreateQuote({ orderId: 'order', amount: 15000 }, 'admin')).status).toBe(409);
    expect(db.quote.create).not.toHaveBeenCalled();
  });
  it('réessaie un conflit sérialisable mais pas une erreur arbitraire', async () => {
    db.$transaction.mockRejectedValueOnce({ code: 'P2034' }).mockImplementation(async fn => fn(db));
    expect(await serialTransaction(async () => 'ok')).toBe('ok');
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    db.$transaction.mockRejectedValueOnce(new Error('bad'));
    await expect(serialTransaction(async () => 'ok')).rejects.toThrow('bad');
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });
});

describe('gestion des partenaires', () => {
  it('signale le numéro déjà utilisé à la création et à la modification', async () => {
    db.expert.create.mockRejectedValue({ code: 'P2002' });
    expect((await handleCreateExpert({ name: 'Expert', phone: '+237612345678' }, 'admin')).status).toBe(409);
    db.expert.findUnique.mockResolvedValue({ id: 'expert', assignments: [] });
    db.expert.update.mockRejectedValue({ code: 'P2002' });
    expect((await handleUpdateExpert({ expertId: 'expert', phone: '+237612345678' }, 'admin')).status).toBe(409);
  });
  it('bloque la disponibilité si une mission est active', async () => {
    db.expert.findUnique.mockResolvedValue({ id: 'expert', assignments: [{ status: 'ASSIGNED', task: { status: 'IN_PROGRESS' } }] });
    expect((await handleUpdateExpert({ expertId: 'expert', availability: true }, 'admin')).status).toBe(409);
    expect(db.expert.update).not.toHaveBeenCalled();
  });
  it('une modification du nom préserve les champs non envoyés', async () => {
    db.expert.findUnique.mockResolvedValue({ id: 'expert', assignments: [] });
    expect((await handleUpdateExpert({ expertId: 'expert', name: 'Expert renommé' }, 'admin')).status).toBe(200);
    expect(db.expert.update).toHaveBeenCalledWith({ where: { id: 'expert' }, data: { name: 'Expert renommé' } });
  });
  it('refuse l’affectation avant paiement intégral et passage à Payée', async () => {
    db.expert.findUnique.mockResolvedValue({ id: 'expert' });
    expect((await handleAssignExpert({ orderId: 'order', expertId: 'expert' }, 'admin')).status).toBe(409);
  });
});
