import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';

export function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

/** Retry serialization conflicts; the entire callback must contain DB operations only. */
export async function serialTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt >= 2 || !hasPrismaCode(error, 'P2034')) throw error;
    }
  }
}

/**
 * Chaque préfixe compte dans SA table source (l'initialisation ne doit jamais
 * lire les numéros d'un autre domaine — audit Fika 2.0 §8.3).
 */
export type DocumentPrefix = 'CMD' | 'DEV' | 'MKT' | 'MQT' | 'APR';

const DOCUMENT_SOURCES: Record<DocumentPrefix, (tx: Prisma.TransactionClient, startsWith: string) => Promise<string[]>> = {
  CMD: async (tx, startsWith) => (await tx.order.findMany({ where: { orderNumber: { startsWith } }, select: { orderNumber: true } })).map((o) => o.orderNumber),
  DEV: async (tx, startsWith) => (await tx.quote.findMany({ where: { quoteNumber: { startsWith } }, select: { quoteNumber: true } })).map((q) => q.quoteNumber),
  MKT: async (tx, startsWith) => (await tx.marketOrder.findMany({ where: { orderNumber: { startsWith } }, select: { orderNumber: true } })).map((o) => o.orderNumber),
  MQT: async (tx, startsWith) => (await tx.marketQuote.findMany({ where: { quoteNumber: { startsWith } }, select: { quoteNumber: true } })).map((q) => q.quoteNumber),
  APR: async (tx, startsWith) => (await tx.marketProcurementBatch.findMany({ where: { reference: { startsWith } }, select: { reference: true } })).map((b) => b.reference),
};

export async function nextDocumentNumber(tx: Prisma.TransactionClient, prefix: DocumentPrefix): Promise<string> {
  const key = `${prefix}-${new Date().getFullYear()}`;
  const current = await tx.documentCounter.findUnique({ where: { key } });
  let initial = 0;
  if (!current) {
    const numbers = await DOCUMENT_SOURCES[prefix](tx, `${key}-`);
    for (const number of numbers) {
      const suffix = number.slice(key.length + 1);
      if (/^\d+$/.test(suffix)) initial = Math.max(initial, Number(suffix));
    }
  }
  const counter = await tx.documentCounter.upsert({
    where: { key }, create: { key, value: initial + 1 }, update: { value: { increment: 1 } },
  });
  return `${key}-${String(counter.value).padStart(4, '0')}`;
}
