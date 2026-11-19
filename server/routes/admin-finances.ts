import { prisma } from '../../src/lib/prisma';

/**
 * Résumé financier consolidé (phase 6) — Fika Services + Fika Market.
 * Concepts strictement séparés : encaissé vérifié (paiements confirmés) vs
 * reçus déclarés en attente de vérification (jamais comptés comme encaissés).
 * Remboursements Market séparés. Toutes les valeurs sont des agrégats SQL
 * réels — aucun montant estimé.
 */

export interface FinancesSummaryPayload {
  services: { confirmed: number; pending: number };
  market: { confirmed: number; pending: number };
  refunds: number;
  generatedAt: string;
}

export async function getFinancesSummary(): Promise<FinancesSummaryPayload> {
  const [svcConfirmed, svcPending, mktConfirmed, mktPending, refunds] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'CONFIRMED' } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PENDING' } }),
    prisma.marketPayment.aggregate({ _sum: { amount: true }, where: { status: 'CONFIRMED' } }),
    prisma.marketPayment.aggregate({ _sum: { amount: true }, where: { status: 'PENDING' } }),
    prisma.marketRefund.aggregate({ _sum: { amount: true } }),
  ]);
  return {
    services: { confirmed: svcConfirmed._sum.amount ?? 0, pending: svcPending._sum.amount ?? 0 },
    market: { confirmed: mktConfirmed._sum.amount ?? 0, pending: mktPending._sum.amount ?? 0 },
    refunds: refunds._sum.amount ?? 0,
    generatedAt: new Date().toISOString(),
  };
}
