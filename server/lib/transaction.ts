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

export async function nextDocumentNumber(tx: Prisma.TransactionClient, prefix: 'CMD' | 'DEV'): Promise<string> {
  const key = `${prefix}-${new Date().getFullYear()}`;
  const current = await tx.documentCounter.findUnique({ where: { key } });
  let initial = 0;
  if (!current) {
    const numbers = prefix === 'CMD'
      ? (await tx.order.findMany({ where: { orderNumber: { startsWith: `${key}-` } }, select: { orderNumber: true } })).map(o => o.orderNumber)
      : (await tx.quote.findMany({ where: { quoteNumber: { startsWith: `${key}-` } }, select: { quoteNumber: true } })).map(q => q.quoteNumber);
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
