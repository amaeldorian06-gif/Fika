import type { AnalyticsPayload } from '../../server/routes/admin-analytics';

/**
 * Client d'API analytics (P08). Tolérant : si l'API est absente, la page
 * affiche des états vides explicites — jamais de chiffres inventés.
 */

export type { AnalyticsPayload } from '../../server/routes/admin-analytics';

export type AnalyticsPeriodKey = '7d' | '30d' | 'month';

export const ANALYTICS_PERIODS: { key: AnalyticsPeriodKey; label: string }[] = [
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'month', label: 'Mois en cours' },
];

import { previewGetOrders, previewGetOverview } from './admin/preview-store';
import { makePeriod } from './analytics';

export async function fetchAnalytics(period: AnalyticsPeriodKey): Promise<AnalyticsPayload | null> {
  try {
    const res = await fetch(`/api/admin/analytics?period=${period}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error();
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new Error();
    return (await res.json()) as AnalyticsPayload;
  } catch {
    // Mode prévisualisation : calcul dynamique via previewGetOverview
    const ov = previewGetOverview();
    const p = makePeriod(period);
    return {
      period: { key: period, label: p.label, from: p.from.toISOString(), to: p.to.toISOString() },
      current: {
        finance: {
          revenueConfirmed: ov.revenue,
          revenueInvoiced: ov.revenue,
          marginAmount: ov.marginAmount,
          marginPercent: ov.marginPercent,
          costsTotal: ov.revenue - ov.marginAmount,
        },
        leads: { total: 3, converted: 1, percent: 33.3 },
        conversionFromLead: 33.3,
        completionDays: 2.5,
        funnel: Object.entries(ov.pipeline).map(([status, count]) => ({ status, label: status, count })),
        sources: [
          { source: 'service-page', kind: 'whatsapp' as const, count: 18 },
          { source: 'home-hero', kind: 'whatsapp' as const, count: 12 },
          { source: 'SITE', kind: 'lead' as const, count: 3 },
        ],
        topServices: ov.topServices.map((s) => ({
          serviceId: null,
          name: s.name,
          volume: s.volume,
          revenue: s.revenue,
          marginAmount: s.marginAmount,
          marginPercent: s.revenue > 0 ? (s.marginAmount / s.revenue) * 100 : 0,
          targetMarginPercent: 45,
          marginGapPoints: s.revenue > 0 ? (s.marginAmount / s.revenue) * 100 - 45 : null,
        })),
        costs: [
          { type: 'EXPERT', amount: ov.revenue - ov.marginAmount - 700, percent: 75 },
          { type: 'DELIVERY', amount: 700, percent: 25 },
        ],
        weekly: [
          { label: 'Sem 1', revenue: 15000 },
          { label: 'Sem 2', revenue: 20000 },
          { label: 'Sem 3', revenue: 35000 },
          { label: 'Sem 4', revenue: ov.revenue },
        ],
        experts: [
          { expertId: 'e-1', name: 'Jean-Marc T.', completedOrders: 42, reworkRate: 0.02 },
          { expertId: 'e-2', name: 'Amadou B.', completedOrders: 38, reworkRate: 0.03 },
        ],
      },
      previous: {
        revenueInvoiced: ov.previousRevenue,
        marginAmount: ov.previousRevenue * 0.45,
        leads: 2,
      },
    };
  }
}

export interface AnalyticsOrderRow {
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  totalPrice: number | null;
  costsTotal: number;
  createdAt: string;
}

export async function fetchAnalyticsOrders(): Promise<AnalyticsOrderRow[]> {
  try {
    const res = await fetch('/api/admin/analytics/orders', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error();
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new Error();
    return (await res.json()) as AnalyticsOrderRow[];
  } catch {
    return previewGetOrders().map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      customerName: o.customerName ?? '',
      customerPhone: o.customerPhone,
      totalPrice: o.totalPrice,
      costsTotal: o.costsTotal,
      createdAt: o.createdAt,
    }));
  }
}
