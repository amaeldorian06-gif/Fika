import { z } from 'zod';
import { hasPrismaCode, serialTransaction } from '../lib/transaction';
import { prisma } from '../../src/lib/prisma';
import { payableStatuses, paymentBalance, recordPaymentSchema } from '../../src/lib/admin/payments';
import type { MutationResult } from './admin-orders';

type Result = MutationResult<{ paymentId: string }>;
const fail = (status: 400 | 401 | 404 | 409, code: string, message: string): Result => ({ status, body: { ok: false, code, message } });

/** Records an unverified receipt only. Never initiates or simulates a provider transfer. */
export async function handleRecordPayment(body: unknown, adminId: string | null): Promise<Result> {
  if (!adminId) return fail(401, 'UNAUTHORIZED', 'Session expirée. Reconnectez-vous.');
  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'VALIDATION', 'Montant entier positif, méthode et référence de reçu valides requis.');
  const data = parsed.data;
  const replay = (p: { id: string; orderId: string; amount: number; method: string | null; reference: string | null }): Result =>
    p.orderId === data.orderId && p.amount === data.amount && p.method === data.method && p.reference === data.reference
      ? { status: 200, body: { ok: true, paymentId: p.id } }
      : fail(409, 'IDEMPOTENCY_CONFLICT', 'Cette requête correspond déjà à un autre paiement. Actualisez la commande.');
  try {
    return await serialTransaction<Result>(async tx => {
      const existing = await tx.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (existing) return replay(existing);
      const order = await tx.order.findUnique({ where: { id: data.orderId }, include: { payments: true } });
      if (!order) return fail(404, 'NOT_FOUND', 'Commande introuvable.');
      if (!payableStatuses.includes(order.status) || order.totalPrice === null || order.totalPrice <= 0) {
        return fail(409, 'NOT_PAYABLE', 'Émettez un devis positif pour une commande ouverte avant de saisir un paiement.');
      }
      if (data.amount > paymentBalance(order.totalPrice, order.payments).available) {
        return fail(409, 'EXCESS_PAYMENT', 'Ce montant dépasse le solde disponible, paiements en attente inclus.');
      }
      const payment = await tx.payment.create({ data: { ...data, status: 'PENDING', createdById: adminId } });
      await tx.orderEvent.create({ data: {
        orderId: order.id, from: order.status, to: order.status, actorId: adminId,
        note: `Reçu ${payment.reference} saisi : ${payment.amount} F (${payment.method}), en attente de vérification.`,
      } });
      return { status: 200, body: { ok: true, paymentId: payment.id } };
    });
  } catch (error) {
    if (!hasPrismaCode(error, 'P2002')) throw error;
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (existing) return replay(existing);
    return fail(409, 'DUPLICATE_REFERENCE', 'Cette référence est déjà enregistrée pour cette méthode de paiement.');
  }
}

const reviewSchema = z.object({
  paymentId: z.string().min(1).max(100),
  action: z.enum(['CONFIRM', 'REJECT']),
  receivedVerified: z.boolean().optional(),
  reason: z.string().trim().max(300).optional(),
}).superRefine((v, ctx) => {
  if (v.action === 'CONFIRM' && v.receivedVerified !== true) ctx.addIssue({ code: 'custom', message: 'Vérifiez la réception effective des fonds.' });
  if (v.action === 'REJECT' && (!v.reason || v.reason.length < 3)) ctx.addIssue({ code: 'custom', message: 'Motif requis.' });
});

/** Separate explicit human verification; no external provider API is connected. */
export async function handleReviewPayment(body: unknown, adminId: string | null): Promise<Result> {
  if (!adminId) return fail(401, 'UNAUTHORIZED', 'Session expirée. Reconnectez-vous.');
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'VALIDATION', 'Attestez la réception des fonds ou renseignez le motif du rejet.');
  const { paymentId, action, reason } = parsed.data;
  return serialTransaction<Result>(async tx => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: { include: { payments: true } } } });
    if (!payment) return fail(404, 'NOT_FOUND', 'Paiement introuvable.');
    const target = action === 'CONFIRM' ? 'CONFIRMED' : 'FAILED';
    if (payment.status === target) return { status: 200, body: { ok: true, paymentId } };
    if (payment.status !== 'PENDING') return fail(409, 'ALREADY_REVIEWED', 'Ce paiement a déjà été traité.');
    const order = payment.order;
    if (action === 'CONFIRM') {
      if (!payableStatuses.includes(order.status) || !order.totalPrice || payment.amount <= 0) {
        return fail(409, 'NOT_PAYABLE', 'Cette commande ne permet pas de confirmer un paiement.');
      }
      if (payment.amount > (paymentBalance(order.totalPrice, order.payments).remaining ?? 0)) {
        return fail(409, 'EXCESS_PAYMENT', 'Ce paiement dépasse le solde restant.');
      }
    }
    await tx.payment.update({ where: { id: paymentId }, data: {
      status: target,
      ...(action === 'CONFIRM' ? { confirmedAt: new Date(), confirmedById: adminId } : {}),
    } });
    await tx.orderEvent.create({ data: {
      orderId: order.id, from: order.status, to: order.status, actorId: adminId,
      note: action === 'CONFIRM'
        ? `Réception de ${payment.amount} F confirmée manuellement (${payment.method}, réf. ${payment.reference ?? payment.id}).`
        : `Reçu ${payment.reference ?? payment.id} rejeté : ${reason}`,
    } });
    // The operator changes the order status explicitly once the full amount is confirmed.
    return { status: 200, body: { ok: true, paymentId } };
  });
}
