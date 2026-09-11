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

import { getJson } from './admin/api';

export function fetchAnalytics(period: AnalyticsPeriodKey): Promise<AnalyticsPayload | null> {
  return getJson(`/api/admin/analytics?period=${period}`);
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

export function fetchAnalyticsOrders(): Promise<AnalyticsOrderRow[]> {
  return getJson('/api/admin/analytics/orders');
}
