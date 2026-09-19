import { z } from 'zod';

export const PAYMENT_METHODS = {
  MTN_MOMO: 'MTN Mobile Money', ORANGE_MONEY: 'Orange Money', CASH: 'Espèces',
} as const;
export const payableStatuses = ['QUOTED', 'AWAITING_CONFIRMATION', 'PAID', 'ASSIGNED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'DELIVERED'];

export const recordPaymentSchema = z.object({
  orderId: z.string().min(1).max(100),
  amount: z.number().int().positive().max(100_000_000),
  method: z.enum(['MTN_MOMO', 'ORANGE_MONEY', 'CASH']),
  reference: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9._/-]+$/).transform(s => s.toUpperCase()),
  idempotencyKey: z.string().uuid(),
});
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

export function paymentBalance(totalPrice: number | null, payments: { amount: number; status: string }[]) {
  const confirmed = payments.filter(p => p.status === 'CONFIRMED').reduce((sum, p) => sum + p.amount, 0);
  const pending = payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
  return {
    confirmed, pending,
    remaining: totalPrice === null ? null : Math.max(0, totalPrice - confirmed),
    available: totalPrice === null ? 0 : Math.max(0, totalPrice - confirmed - pending),
    fullyPaid: totalPrice !== null && totalPrice > 0 && confirmed >= totalPrice,
  };
}
