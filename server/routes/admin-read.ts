import { paymentBalance } from '../../src/lib/admin/payments';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import type { AdminOrderDetail, AdminOrderSummary, AdminOverviewData, AdminLead, AdminCustomer, AssignableExpertDto } from '../../src/lib/admin/api';
import { computeKpis, computeTopServices, countByStatus, formatMonthLabel, inPeriod, monthBounds } from '../../src/lib/admin/kpi';
import { REVENUE_STATUSES } from '../../src/lib/admin/status';
import { computeMargin } from '../../src/lib/pricing';
import { effectiveLevel, publicTrustSignals, type VerificationLevel } from '../../src/lib/trust';
import { loadExpertMetrics, snapshotFromMetrics } from '../lib/expert-trust';

const orderInclude = {
  customer: true, city: true, zone: true, costs: true,
  items: { include: { service: { include: { cityPrices: true } } } },
  tasks: { include: { assignments: { include: { expert: true } } } },
  events: { include: { actor: true }, orderBy: { createdAt: 'desc' } },
  payments: true, deliveries: { include: { zone: true } }, quotes: { orderBy: { createdAt: 'desc' } }, review: true,
} satisfies Prisma.OrderInclude;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function summary(o: OrderRow): AdminOrderSummary {
  return {
    id: o.id, orderNumber: o.orderNumber, status: o.status,
    customerName: o.customer.name, customerPhone: o.customer.phone,
    totalPrice: o.totalPrice, costsTotal: o.costs.reduce((sum, c) => sum + c.amount, 0),
    cityName: o.city?.name ?? null, zoneName: o.zone?.name ?? null,
    createdAt: o.createdAt.toISOString(),
    expertName: o.tasks.flatMap(t => t.assignments).find(a => a.status !== 'DECLINED')?.expert.name ?? null,
    serviceName: o.items.map(i => i.service?.name ?? i.customName).find(Boolean) ?? null,
    ...orderMargin(o),
  };
}

/** Marge brute d'une commande (prix client − Σ coûts) ; null tant que le prix n'est pas fixé. */
function orderMargin(o: Pick<OrderRow, 'totalPrice' | 'costs'>): { marginAmount: number | null; marginPercent: number | null } {
  if (o.totalPrice == null) return { marginAmount: null, marginPercent: null };
  const { marginAmount, marginPercent } = computeMargin(o.totalPrice, o.costs);
  return { marginAmount, marginPercent: Math.round(marginPercent * 10) / 10 };
}

async function orderRows() {
  return prisma.order.findMany({ include: orderInclude, orderBy: { createdAt: 'desc' } });
}

export async function getOrders(status?: string, q?: string): Promise<AdminOrderSummary[]> {
  const search = q?.trim().toLocaleLowerCase('fr');
  return (await orderRows()).map(summary).filter(o =>
    (!status || o.status === status) && (!search || [o.orderNumber, o.customerName, o.customerPhone]
      .some(value => value?.toLocaleLowerCase('fr').includes(search))));
}

export async function getOrder(id: string): Promise<AdminOrderDetail | null> {
  const o = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!o) return null;
  const expertIds = [...new Set(o.tasks.flatMap(t => t.assignments.filter(a => a.status !== 'DECLINED').map(a => a.expertId)))];
  const expertSignals = new Map<string, string[]>();
  for (const id of expertIds) {
    const e = o.tasks.flatMap(t => t.assignments).find(a => a.expertId === id)?.expert;
    if (!e) continue;
    const m = await loadExpertMetrics(prisma, id);
    const level = effectiveLevel(e.verificationLevel as VerificationLevel, snapshotFromMetrics(m));
    expertSignals.set(id, publicTrustSignals({ level, zone: e.zone, completedTasks: m.completedTasks, averageRating: m.averageRating, reviewCount: m.reviewCount }).map(s => s.label));
  }
  return {
    ...summary(o), clientAddress: o.clientAddress,
    items: o.items.map(i => ({ id: i.id, serviceId: i.serviceId, serviceName: i.service?.name ?? null, customName: i.customName, price: i.price, quantity: i.quantity })),
    costs: o.costs.map(c => ({ id: c.id, type: c.type, amount: c.amount, note: c.note })),
    events: o.events.map(e => ({ id: e.id, from: e.from, to: e.to, note: e.note, actorEmail: e.actor?.email ?? null, createdAt: e.createdAt.toISOString() })),
    tasks: o.tasks.map(t => {
      const assignment = t.assignments.find(a => a.status !== 'DECLINED');
      return { id: t.id, status: t.status, deliverables: t.deliverables, notes: t.notes, internalCompensation: t.internalCompensation, expertName: assignment?.expert.name ?? null, expertId: assignment?.expertId ?? null, expertTrade: assignment?.expert.trade ?? null, expertPublicSignals: expertSignals.get(assignment?.expertId ?? '') ?? [] };
    }),
    payments: o.payments.map(p => ({ id: p.id, amount: p.amount, method: p.method, status: p.status, reference: p.reference, confirmedAt: p.confirmedAt?.toISOString() ?? null })),
    deliveries: o.deliveries.map(d => ({ id: d.id, status: d.status, fee: d.fee, zoneName: d.zone?.name ?? null, proofUrl: d.proofUrl })),
    quotes: o.quotes.map(q => ({ id: q.id, quoteNumber: q.quoteNumber, amount: q.amount, status: q.status, details: q.details ?? null, validUntil: q.validUntil ? q.validUntil.toISOString() : null })),
    hasAssignedExpert: o.tasks.some(t => t.assignments.some(a => a.status !== 'DECLINED')),
    hasConfirmedPayment: paymentBalance(o.totalPrice, o.payments).fullyPaid,
    targetMarginPercent: o.items[0]?.service?.cityPrices.find(p => p.cityId === o.cityId)?.targetMargin ?? null,
    hasReview: o.review !== null,
  };
}

export async function getOverview(): Promise<AdminOverviewData> {
  const rows = await orderRows();
  const kpiRows = rows.map(o => ({ ...o, items: o.items.map(i => ({ ...i, serviceName: i.service?.name ?? i.customName })) }));
  const now = new Date();
  const current = monthBounds(now);
  const previous = monthBounds(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const period = kpiRows.filter(o => inPeriod(o.createdAt, current.from, current.to));
  return {
    ...computeKpis(period), monthLabel: formatMonthLabel(now),
    previousRevenue: computeKpis(kpiRows.filter(o => inPeriod(o.createdAt, previous.from, previous.to))).revenue,
    pipeline: countByStatus(kpiRows), todoCount: computeKpis(kpiRows).todoCount,
    topServices: computeTopServices(period), recentOrders: rows.slice(0, 5).map(summary),
  };
}

const leadMeta = (meta: unknown): { clientType?: string | null; referrer?: string | null; device?: string | null } =>
  (meta && typeof meta === 'object' ? meta : {}) as { clientType?: string | null; referrer?: string | null; device?: string | null };

export async function getLeads(): Promise<AdminLead[]> {
  const rows = await prisma.lead.findMany({ include: { customer: true, service: true, city: true }, orderBy: { createdAt: 'desc' } });
  return rows.map(l => ({
    id: l.id, code: `LEAD-${l.id.slice(-6).toUpperCase()}`, description: l.description,
    serviceName: l.service?.name ?? null, cityName: l.city?.name ?? null, zoneName: l.zoneName,
    deadline: l.deadline, budgetMin: l.budgetMin, budgetMax: l.budgetMax,
    customerName: l.customer?.name ?? null, customerPhone: l.customer?.phone ?? null,
    clientType: leadMeta(l.meta).clientType ?? null, campaign: l.campaign ?? leadMeta(l.meta).referrer ?? null, device: leadMeta(l.meta).device ?? null,
    status: l.status, createdAt: l.createdAt.toISOString(),
  }));
}

export async function getCustomers(): Promise<AdminCustomer[]> {
  const rows = await prisma.customer.findMany({ include: { orders: { select: { status: true, totalPrice: true } } }, orderBy: { createdAt: 'desc' } });
  return rows.map(c => ({ id: c.id, name: c.name, phone: c.phone, ordersCount: c.orders.length,
    totalSpent: c.orders.filter(o => REVENUE_STATUSES.includes(o.status)).reduce((sum, o) => sum + (o.totalPrice ?? 0), 0) }));
}

export async function getExperts(assignable = false): Promise<AssignableExpertDto[]> {
  const rows = await prisma.expert.findMany({
    include: {
      assignments: { include: { task: true } },
      verifications: { orderBy: { createdAt: 'desc' }, take: 20, include: { actor: { select: { email: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  const out: AssignableExpertDto[] = [];
  for (const e of rows) {
    if (assignable && !(e.availability && ['ACTIVE', 'BACKUP'].includes(e.status))) continue;
    const metrics = await loadExpertMetrics(prisma, e.id);
    const level = effectiveLevel(e.verificationLevel as VerificationLevel, snapshotFromMetrics(metrics));
    out.push({
      id: e.id, name: e.name, phone: e.phone, skills: e.skills, zone: e.zone, usualCost: e.usualCost,
      availability: e.availability, status: e.status,
      completedOrders: metrics.completedTasks, reliabilityScore: e.reliabilityScore,
      activeTaskCount: metrics.activeTasks,
      trade: e.trade, internalNotes: e.internalNotes, references: e.references, documents: e.documents,
      verificationLevel: level,
      storedVerificationLevel: e.verificationLevel,
      lastVerifiedAt: e.lastVerifiedAt?.toISOString() ?? null,
      lastVerificationType: e.lastVerificationType,
      firstAssignedAt: e.firstAssignedAt?.toISOString() ?? null,
      metrics: {
        completedTasks: metrics.completedTasks, cancelledTasks: metrics.cancelledTasks, activeTasks: metrics.activeTasks,
        cancellationRate: metrics.cancellationRate, reworkRate: metrics.reworkRate,
        avgResponseHours: metrics.avgResponseHours, avgCompletionHours: metrics.avgCompletionHours,
        averageRating: metrics.averageRating, reviewCount: metrics.reviewCount,
        lastCompletedAt: metrics.lastCompletedAt?.toISOString() ?? null,
      },
      publicSignals: publicTrustSignals({ level, zone: e.zone, completedTasks: metrics.completedTasks, averageRating: metrics.averageRating, reviewCount: metrics.reviewCount }).map(s => s.label),
      history: e.verifications.map(v => ({ id: v.id, from: v.from, to: v.to, type: v.type, note: v.note, actorEmail: v.actor?.email ?? null, createdAt: v.createdAt.toISOString() })),
    });
  }
  return out;
}

export async function getAnalyticsOrders() {
  return (await getOrders()).map(o => ({ orderNumber: o.orderNumber, status: o.status, customerName: o.customerName ?? '', customerPhone: o.customerPhone, serviceName: o.serviceName, expertName: o.expertName, totalPrice: o.totalPrice, costsTotal: o.costsTotal, marginAmount: o.marginAmount, marginPercent: o.marginPercent, createdAt: o.createdAt }));
}
