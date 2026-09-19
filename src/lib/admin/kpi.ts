import { computeMargin } from '../pricing';
import { REVENUE_STATUSES, TODO_STATUSES, type OrderStatus } from './status';

/**
 * Agrégats du back-office (P06) — fonctions pures, aucune constante métier.
 * Les montants sont des entiers FCFA ; la marge passe par lib/pricing.
 */

export interface KpiOrderCost {
  type: string;
  amount: number;
}

export interface KpiOrder {
  id: string;
  status: OrderStatus;
  totalPrice: number | null;
  createdAt: Date;
  costs: KpiOrderCost[];
  items: { serviceId: string | null; serviceName: string | null; price: number | null; quantity: number }[];
}

export interface KpiSummary {
  /** CA réalisé : commandes payées → terminées. */
  revenue: number;
  marginAmount: number;
  marginPercent: number;
  /** Commandes nécessitant une action (nouvelles, qualification, confirmation). */
  todoCount: number;
  ordersCount: number;
  averageBasket: number;
}

const isRevenue = (o: KpiOrder) => REVENUE_STATUSES.includes(o.status);

export function inPeriod(date: Date, from: Date, to: Date): boolean {
  return date >= from && date < to;
}

/** Bornes du mois d'une date (début inclus, mois suivant exclu). */
export function monthBounds(ref: Date): { from: Date; to: Date } {
  const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return { from, to };
}

/** Libellé de période « Septembre 2026 » calculé (jamais codé en dur). */
export function formatMonthLabel(ref: Date): string {
  const label = ref.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function computeKpis(orders: KpiOrder[]): KpiSummary {
  const revenueOrders = orders.filter(isRevenue);
  const revenue = revenueOrders.reduce((sum, o) => sum + (o.totalPrice ?? 0), 0);
  const costs = revenueOrders.flatMap((o) => o.costs.map((c) => ({ amount: c.amount })));
  const { marginAmount, marginPercent } = computeMargin(revenue, costs);

  return {
    revenue,
    marginAmount,
    marginPercent,
    todoCount: orders.filter((o) => TODO_STATUSES.includes(o.status)).length,
    ordersCount: revenueOrders.length,
    averageBasket: revenueOrders.length > 0 ? Math.round(revenue / revenueOrders.length) : 0,
  };
}

export interface Trend {
  /** Variation en % vs période précédente (null si base nulle). */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
}

export function computeTrend(current: number, previous: number): Trend {
  if (previous <= 0) return { percent: null, direction: current > 0 ? 'up' : 'flat' };
  const percent = ((current - previous) / previous) * 100;
  return {
    percent,
    direction: percent > 0.5 ? 'up' : percent < -0.5 ? 'down' : 'flat',
  };
}

export interface TopService {
  serviceId: string | null;
  name: string;
  volume: number;
  revenue: number;
  marginAmount: number;
}

/** Top services par volume, avec CA et marge répartie au prorata des lignes. */
export function computeTopServices(orders: KpiOrder[], limit = 5): TopService[] {
  const map = new Map<string, TopService>();

  for (const order of orders.filter(isRevenue)) {
    const orderTotal = order.items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);
    const orderCosts = order.costs.reduce((s, c) => s + c.amount, 0);

    for (const item of order.items) {
      const key = item.serviceId ?? `custom:${item.serviceName ?? 'Autre'}`;
      const lineRevenue = (item.price ?? 0) * item.quantity;
      const share = orderTotal > 0 ? lineRevenue / orderTotal : 0;
      const entry = map.get(key) ?? {
        serviceId: item.serviceId,
        name: item.serviceName ?? 'Prestation sur mesure',
        volume: 0, revenue: 0, marginAmount: 0,
      };
      entry.volume += item.quantity;
      entry.revenue += lineRevenue;
      entry.marginAmount += Math.round(lineRevenue - orderCosts * share);
      map.set(key, entry);
    }
  }

  return [...map.values()]
    .sort((a, b) => b.volume - a.volume || b.revenue - a.revenue)
    .slice(0, limit);
}

/** Comptage par statut pour le pipeline opérationnel. */
export function countByStatus(orders: KpiOrder[]): Record<string, number> {
  return orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
}
