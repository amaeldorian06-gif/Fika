import { prisma } from '../../src/lib/prisma';
import {
  makePeriod, financeSummary, leadConversionRate, averageCompletionDays,
  statusFunnel, sourceBreakdown, topServices, costBreakdown, weeklyRevenue,
  topExperts, filterOrdersByPeriod, filterLeadsByPeriod,
  type AnalyticsOrder, type AnalyticsLead, type AnalyticsEvent,
  type AnalyticsServiceMarginTarget, type SourceRow, type PeriodKey,
} from '../../src/lib/analytics';

/**
 * Agrégats de pilotage (P08) — requêtes Prisma vérifiables (spot-check).
 * Toute la mise en forme (périodes, %, tris) vit dans lib/analytics.ts (pur).
 */

export interface AnalyticsPayload {
  period: { key: PeriodKey; label: string; from: string; to: string };
  current: {
    finance: {
      revenueConfirmed: number;
      revenueInvoiced: number;
      marginAmount: number;
      marginPercent: number;
      costsTotal: number;
    };
    leads: { total: number; converted: number; percent: number | null };
    conversionFromLead: number | null;
    completionDays: number | null;
    funnel: { status: string; label: string; count: number }[];
    sources: SourceRow[];
    topServices: {
      serviceId: string | null; name: string; volume: number; revenue: number;
      marginAmount: number; marginPercent: number; targetMarginPercent: number | null;
      marginGapPoints: number | null;
    }[];
    costs: { type: string; amount: number; percent: number }[];
    weekly: { label: string; revenue: number }[];
    experts: { expertId: string; name: string; completedOrders: number; reworkRate: number }[];
  };
  previous: {
    revenueInvoiced: number;
    marginAmount: number;
    leads: number;
  };
}

const PERIODS: PeriodKey[] = ['7d', '30d', 'month'];

export function isPeriodKey(value: string | null): value is PeriodKey {
  return value != null && (PERIODS as string[]).includes(value);
}

/* -------- Frontières typées (le client Prisma peut être non synchronisé) ---- */

interface OrderRow {
  id: string; status: string; totalPrice: number | null;
  createdAt: Date; completedAt: Date | null; leadId: string | null;
  costs: { type: string; amount: number }[];
  payments: { amount: number; status: string }[];
  items: { serviceId: string | null; customName: string | null; price: number | null; quantity: number; service: { name: string } | null }[];
}

interface LeadRow { id: string; source: string; createdAt: Date }
interface EventRow {
  id: string; type: string; createdAt: Date; serviceId: string | null;
  campaign: string | null; meta: unknown;
}
interface ExpertRow { id: string; name: string; completedOrders: number; reworkRate: number }
interface TargetRow { serviceId: string; targetMargin: number | null; service: { name: string } }

export async function getAnalytics(periodKey: PeriodKey): Promise<AnalyticsPayload> {
  // Fenêtre : 12 semaines (série hebdo) + période de comparaison.
  const since = new Date();
  since.setDate(since.getDate() - 12 * 7);
  since.setHours(0, 0, 0, 0);

  const ordersRaw = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true, status: true, totalPrice: true, createdAt: true, completedAt: true, leadId: true,
      costs: { select: { type: true, amount: true } },
      payments: { select: { amount: true, status: true } },
      items: { select: { serviceId: true, customName: true, price: true, quantity: true, service: { select: { name: true } } } },
    },
  }) as unknown as OrderRow[];

  const leadsRaw = await prisma.lead.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, source: true, createdAt: true },
  }) as unknown as LeadRow[];

  const eventsRaw = await prisma.event.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, type: true, createdAt: true, serviceId: true, campaign: true, meta: true },
  }) as unknown as EventRow[];

  const expertsRaw = await prisma.expert.findMany({
    select: { id: true, name: true, completedOrders: true, reworkRate: true },
  }) as unknown as ExpertRow[];

  const targetsRaw = await prisma.serviceCityPrice.findMany({
    select: { serviceId: true, targetMargin: true, service: { select: { name: true } } },
  }) as unknown as TargetRow[];

  /* ------------------------- Projection vers le pur ------------------------ */

  const ordersIn: AnalyticsOrder[] = ordersRaw.map((o) => ({
    id: o.id,
    status: o.status as AnalyticsOrder['status'],
    totalPrice: o.totalPrice,
    createdAt: o.createdAt,
    completedAt: o.completedAt,
    leadId: o.leadId,
    costs: o.costs,
    payments: o.payments,
    items: o.items.map((i) => ({
      serviceId: i.serviceId,
      serviceName: i.service?.name ?? i.customName,
      price: i.price,
      quantity: i.quantity,
    })),
  }));

  const leadsIn: AnalyticsLead[] = leadsRaw;
  const eventsIn: AnalyticsEvent[] = eventsRaw.map((e) => ({
    id: e.id,
    type: e.type,
    createdAt: e.createdAt,
    serviceId: e.serviceId,
    campaign: e.campaign,
    meta: (e.meta ?? null) as AnalyticsEvent['meta'],
  }));

  const targets: AnalyticsServiceMarginTarget[] = targetsRaw.map((t) => ({
    serviceId: t.serviceId,
    name: t.service.name,
    targetMarginPercent: t.targetMargin != null ? Math.round(t.targetMargin * 100) : null,
  }));

  /* ----------------------------- Agrégats P08 ------------------------------ */

  const period = makePeriod(periodKey);
  const currentOrders = filterOrdersByPeriod(ordersIn, period);
  const previousOrders = filterOrdersByPeriod(ordersIn, period, true);
  const currentLeads = filterLeadsByPeriod(leadsIn, period);
  const previousLeads = filterLeadsByPeriod(leadsIn, period, true);
  const periodEvents = eventsIn.filter((e) => e.createdAt >= period.from && e.createdAt <= period.to);

  const finance = financeSummary(currentOrders);
  const conversion = leadConversionRate(currentLeads, currentOrders);
  const previousFinance = financeSummary(previousOrders);

  return {
    period: {
      key: period.key, label: period.label,
      from: period.from.toISOString(), to: period.to.toISOString(),
    },
    current: {
      finance,
      leads: { total: conversion.leads, converted: conversion.converted, percent: conversion.percent },
      conversionFromLead: conversion.percent,
      completionDays: averageCompletionDays(currentOrders),
      funnel: statusFunnel(currentOrders),
      sources: sourceBreakdown(periodEvents, currentLeads),
      topServices: topServices(currentOrders, targets),
      costs: costBreakdown(currentOrders),
      weekly: weeklyRevenue(ordersIn, 12, period.to),
      experts: topExperts(expertsRaw.map((e) => ({
        expertId: e.id, name: e.name, completedOrders: e.completedOrders, reworkRate: e.reworkRate,
      }))),
    },
    previous: {
      revenueInvoiced: previousFinance.revenueInvoiced,
      marginAmount: previousFinance.marginAmount,
      leads: previousLeads.length,
    },
  };
}
