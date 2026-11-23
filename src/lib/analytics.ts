import { computeMargin } from './pricing';
import { REVENUE_STATUSES, TODO_STATUSES, ORDER_STATUS_META, type OrderStatus } from './admin/status';

/**
 * Analytics de pilotage (P08) — fonctions 100 % pures.
 * Les périodes sont relatives à la date du jour ; tous les montants sont des
 * entiers FCFA (formatage via lib/pricing). Aucune dépendance de graphing.
 */

/* -------------------------------- Périodes --------------------------------- */

export type PeriodKey = '7d' | '30d' | 'month';

export interface Period {
  key: PeriodKey;
  label: string;
  from: Date;
  to: Date;
  /** Période précédente de même durée pour comparaison. */
  previousFrom: Date;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function makePeriod(key: PeriodKey, now: Date = new Date()): Period {
  const to = new Date(now);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  switch (key) {
    case '7d': {
      from.setDate(from.getDate() - 6);
      return { key, label: '7 derniers jours', from, to, previousFrom: addDays(from, -7) };
    }
    case '30d': {
      from.setDate(from.getDate() - 29);
      return { key, label: '30 derniers jours', from, to, previousFrom: addDays(from, -30) };
    }
    case 'month':
    default: {
      const monthStart = new Date(to.getFullYear(), to.getMonth(), 1);
      const previous = new Date(to.getFullYear(), to.getMonth() - 1, 1);
      return { key, label: 'Mois en cours', from: monthStart, to, previousFrom: previous };
    }
  }
}

/* ------------------------------- Records d'entrée -------------------------- */

export interface AnalyticsOrder {
  id: string;
  status: OrderStatus;
  totalPrice: number | null;
  createdAt: Date;
  completedAt: Date | null;
  leadId: string | null;
  /** Attribution de secours quand les lignes de commande sont libres. */
  leadServiceId?: string | null;
  costs: { type: string; amount: number }[];
  payments: { amount: number; status: string }[];
  items: { serviceId: string | null; serviceName: string | null; price: number | null; quantity: number }[];
}

export interface AnalyticsLead {
  id: string;
  source: string;
  createdAt: Date;
  serviceId?: string | null;
  /** true lorsqu'une commande est reliée à cette demande, quel que soit son statut. */
  converted?: boolean;
}

export interface AnalyticsCatalogService {
  serviceId: string;
  slug: string;
  name: string;
  universeId: string;
  universeSlug: string;
  universeName: string;
  displayOrder: number;
}

export interface CommercialPerformanceMetrics {
  consultations: number;
  whatsappClicks: number;
  leads: number;
  convertedLeads: number;
  orders: number;
  revenue: number;
  /** Ratio de demandes enregistrées sur consultations de fiche (événements, pas visiteurs uniques). */
  leadPerConsultationPercent: number | null;
  /** Demandes créées sur la période qui ont ensuite été converties en commande. */
  leadToOrderPercent: number | null;
}

export interface ServicePerformanceRow extends CommercialPerformanceMetrics {
  serviceId: string;
  slug: string;
  name: string;
  universeId: string;
  universeSlug: string;
  universeName: string;
  displayOrder: number;
}

export interface UniversePerformanceRow extends CommercialPerformanceMetrics {
  universeId: string;
  universeSlug: string;
  universeName: string;
  serviceCount: number;
}

export interface AnalyticsEvent {
  id: string;
  type: string;
  createdAt: Date;
  serviceId: string | null;
  campaign: string | null;
  meta: { context?: string; ref?: string | null; query?: string; results?: number; step?: string; field?: string; universe?: string } | null;
}

export interface AnalyticsServiceMarginTarget {
  serviceId: string;
  name: string;
  targetMarginPercent: number | null;
}

/* --------------------------------- Agrégats -------------------------------- */

export interface FinanceSummary {
  /** CA confirmé : total des paiements confirmés. */
  revenueConfirmed: number;
  /** CA facturé : commandes payées → terminées. */
  revenueInvoiced: number;
  marginAmount: number;
  marginPercent: number;
  costsTotal: number;
}

const inRange = (d: Date, from: Date, to: Date) => d >= from && d <= to;

export function financeSummary(orders: AnalyticsOrder[]): FinanceSummary {
  const confirmed = orders
    .flatMap((o) => o.payments.filter((p) => p.status === 'CONFIRMED').map((p) => p.amount))
    .reduce((s, a) => s + a, 0);

  const invoiced = orders
    .filter((o) => REVENUE_STATUSES.includes(o.status))
    .reduce((s, o) => s + (o.totalPrice ?? 0), 0);

  const costs = orders
    .filter((o) => REVENUE_STATUSES.includes(o.status))
    .flatMap((o) => o.costs.map((c) => ({ amount: c.amount })));

  const { marginAmount, marginPercent } = computeMargin(invoiced, costs);

  return {
    revenueConfirmed: confirmed,
    revenueInvoiced: invoiced,
    marginAmount,
    marginPercent,
    costsTotal: costs.reduce((s, c) => s + c.amount, 0),
  };
}

/** Taux de conversion Lead → Order (leads créés sur la période). */
export function leadConversionRate(leads: AnalyticsLead[], orders: AnalyticsOrder[]): {
  percent: number | null;
  leads: number;
  converted: number;
} {
  if (leads.length === 0) return { percent: null, leads: 0, converted: 0 };
  const converted = orders.filter((o) => o.leadId != null).length;
  const percent = leads.length > 0 ? (converted / leads.length) * 100 : 0;
  return { percent: leads.length > 0 ? Math.round(percent * 10) / 10 : null, leads: leads.length, converted };
}

export interface FunnelStep {
  status: OrderStatus;
  label: string;
  count: number;
  step: number;
}

/** Funnel par statut, dans l'ordre du pipeline. */
export function statusFunnel(orders: AnalyticsOrder[]): FunnelStep[] {
  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  return (Object.keys(ORDER_STATUS_META) as OrderStatus[])
    .map((status) => ({
      status,
      label: ORDER_STATUS_META[status].label,
      step: ORDER_STATUS_META[status].step,
      count: counts[status] ?? 0,
    }))
    .sort((a, b) => a.step - b.step);
}

export interface SourceRow {
  source: string;
  kind: 'whatsapp' | 'lead' | 'order';
  count: number;
}

/** Ligne du tableau « recherches services » (admin analytics). */
export interface SearchQueryRow {
  query: string;
  count: number;
  lastResults: number;
  zeroResult: boolean;
}

/**
 * Agrège les événements SERVICE_SEARCH : requêtes les plus tapées, dernière
 * compte de résultats, marquage « sans résultat » (signal d'expansion du
 * catalogue — la demande existe, le service n'existe pas encore).
 */
export function searchQueriesBreakdown(events: AnalyticsEvent[], limit = 10): SearchQueryRow[] {
  const byQuery = new Map<string, { count: number; lastResults: number }>();
  for (const e of events) {
    if (e.type !== 'SERVICE_SEARCH') continue;
    const query = e.meta?.query ?? null;
    const results = e.meta?.results ?? null;
    if (typeof query !== 'string' || typeof results !== 'number') continue;
    const cur = byQuery.get(query) ?? { count: 0, lastResults: results };
    cur.count += 1;
    cur.lastResults = results; // les événements arrivent par ordre chronologique
    byQuery.set(query, cur);
  }
  return [...byQuery.entries()]
    .map(([query, v]) => ({ query, count: v.count, lastResults: v.lastResults, zeroResult: v.lastResults === 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Ligne du tableau funnel admin : une étape de parcours, son volume. */
export interface FunnelRow {
  step: string;
  label: string;
  count: number;
}

/** Libellés français des étapes de parcours (FUNNEL_STEP). */
const FUNNEL_STEP_LABELS: Record<string, string> = {
  PATH_SELECTED: 'Chemin choisi (accueil)',
  FORM_STARTED: 'Formulaire besoin commencé',
  VALIDATION_ERROR: 'Erreur de validation',
  REQUEST_SUBMITTED: 'Demande envoyée',
  INQUIRY_STARTED: 'Formulaire produit commencé',
  INQUIRY_SUBMITTED: 'Demande produit envoyée',
};

/**
 * Répartition des étapes de parcours (type FUNNEL_STEP). Aucune donnée
 * personnelle : les événements ne portent que l'étape et le champ en échec.
 */
export function funnelBreakdown(events: AnalyticsEvent[]): FunnelRow[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'FUNNEL_STEP') continue;
    const step = typeof e.meta?.step === 'string' ? e.meta.step : null;
    if (!step) continue;
    counts.set(step, (counts.get(step) ?? 0) + 1);
  }
  const ORDER = Object.keys(FUNNEL_STEP_LABELS);
  return [...counts.entries()]
    .map(([step, count]) => ({ step, label: FUNNEL_STEP_LABELS[step] ?? step, count }))
    .sort((a, b) => ORDER.indexOf(a.step) - ORDER.indexOf(b.step) || b.count - a.count);
}

/** Croise les clics WhatsApp (Event) et les origines de leads par source. */
export function sourceBreakdown(events: AnalyticsEvent[], leads: AnalyticsLead[]): SourceRow[] {
  const wa = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'WACLICK') continue;
    const ctx = e.meta?.context ?? 'inconnu';
    wa.set(ctx, (wa.get(ctx) ?? 0) + 1);
  }

  const leadSources = new Map<string, number>();
  for (const l of leads) {
    leadSources.set(l.source, (leadSources.get(l.source) ?? 0) + 1);
  }

  return [
    ...[...wa.entries()]
      .map(([source, count]) => ({ source, kind: 'whatsapp' as const, count }))
      .sort((a, b) => b.count - a.count),
    ...[...leadSources.entries()]
      .map(([source, count]) => ({ source, kind: 'lead' as const, count }))
      .sort((a, b) => b.count - a.count),
  ];
}

export interface TopServiceRow {
  serviceId: string | null;
  name: string;
  volume: number;
  revenue: number;
  marginAmount: number;
  marginPercent: number;
  targetMarginPercent: number | null;
  /** Écart en points vs cible (null si pas de cible). */
  marginGapPoints: number | null;
}

/** Top services : volume, CA, marge réelle et écart vs marge cible. */
export function topServices(
  orders: AnalyticsOrder[],
  targets: AnalyticsServiceMarginTarget[],
  limit = 6,
): TopServiceRow[] {
  const map = new Map<string, TopServiceRow & { _targetKey?: string }>();
  const targetByService = new Map(targets.map((t) => [t.serviceId, t]));

  for (const order of orders.filter((o) => REVENUE_STATUSES.includes(o.status))) {
    const orderTotal = order.items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);
    const orderCosts = order.costs.reduce((s, c) => s + c.amount, 0);

    for (const item of order.items) {
      const key = item.serviceId ?? `custom:${item.serviceName ?? 'Autre'}`;
      const target = item.serviceId ? targetByService.get(item.serviceId) : undefined;
      const entry = map.get(key) ?? {
        serviceId: item.serviceId,
        name: item.serviceName ?? 'Prestation sur mesure',
        volume: 0, revenue: 0, marginAmount: 0, marginPercent: 0,
        targetMarginPercent: target?.targetMarginPercent ?? null,
        marginGapPoints: null as number | null,
      };

      const lineRevenue = (item.price ?? 0) * item.quantity;
      const share = orderTotal > 0 ? lineRevenue / orderTotal : 0;
      entry.volume += item.quantity;
      entry.revenue += lineRevenue;
      entry.marginAmount += Math.round(lineRevenue - orderCosts * share);
      entry.targetMarginPercent = target?.targetMarginPercent ?? entry.targetMarginPercent;
      map.set(key, entry);
    }
  }

  return [...map.values()]
    .map((e) => {
      const percent = e.revenue > 0 ? (e.marginAmount / e.revenue) * 100 : 0;
      return {
        ...e,
        marginPercent: Math.round(percent * 10) / 10,
        marginGapPoints: e.targetMarginPercent != null ? Math.round((percent - e.targetMarginPercent) * 10) / 10 : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/**
 * Performance commerciale par service et par univers.
 *
 * Les consultations et clics sont des événements bruts : ils ne représentent
 * PAS des visiteurs uniques. Le taux demande/consultation est donc directionnel.
 * Le taux demande→commande est calculé sur les demandes créées dans la période,
 * à partir de leur relation réelle avec une commande.
 */
export function commercialPerformanceBreakdown(
  services: AnalyticsCatalogService[],
  leads: AnalyticsLead[],
  events: AnalyticsEvent[],
  orders: AnalyticsOrder[],
): { services: ServicePerformanceRow[]; universes: UniversePerformanceRow[] } {
  const serviceRows = new Map<string, ServicePerformanceRow>();

  for (const service of services) {
    serviceRows.set(service.serviceId, {
      ...service,
      consultations: 0,
      whatsappClicks: 0,
      leads: 0,
      convertedLeads: 0,
      orders: 0,
      revenue: 0,
      leadPerConsultationPercent: null,
      leadToOrderPercent: null,
    });
  }

  for (const lead of leads) {
    if (!lead.serviceId) continue;
    const row = serviceRows.get(lead.serviceId);
    if (!row) continue;
    row.leads += 1;
    if (lead.converted) row.convertedLeads += 1;
  }

  for (const event of events) {
    if (!event.serviceId) continue;
    const row = serviceRows.get(event.serviceId);
    if (!row) continue;
    if (event.type === 'LEAD_VIEW') row.consultations += 1;
    if (event.type === 'WACLICK') row.whatsappClicks += 1;
  }

  for (const order of orders) {
    const itemServiceIds = new Set(order.items.flatMap((item) => item.serviceId ? [item.serviceId] : []));
    // When an order has only custom/free-text lines, retain the original
    // service attribution from its lead without guessing line-level revenue.
    const attributedServiceIds = itemServiceIds.size > 0
      ? itemServiceIds
      : new Set(order.leadServiceId ? [order.leadServiceId] : []);

    for (const serviceId of attributedServiceIds) {
      const row = serviceRows.get(serviceId);
      if (!row) continue;
      row.orders += 1;
      if (REVENUE_STATUSES.includes(order.status)) {
        row.revenue += order.items
          .filter((item) => item.serviceId === serviceId)
          .reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
      }
    }
  }

  const roundRate = (numerator: number, denominator: number): number | null =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;

  const serviceResults = [...serviceRows.values()].map((row) => ({
    ...row,
    leadPerConsultationPercent: roundRate(row.leads, row.consultations),
    leadToOrderPercent: roundRate(row.convertedLeads, row.leads),
  })).sort((a, b) =>
    b.convertedLeads - a.convertedLeads ||
    b.leads - a.leads ||
    b.revenue - a.revenue ||
    b.consultations - a.consultations ||
    a.displayOrder - b.displayOrder ||
    a.name.localeCompare(b.name, 'fr'),
  );

  const universeMap = new Map<string, UniversePerformanceRow>();
  for (const service of serviceResults) {
    const row = universeMap.get(service.universeId) ?? {
      universeId: service.universeId,
      universeSlug: service.universeSlug,
      universeName: service.universeName,
      serviceCount: 0,
      consultations: 0,
      whatsappClicks: 0,
      leads: 0,
      convertedLeads: 0,
      orders: 0,
      revenue: 0,
      leadPerConsultationPercent: null,
      leadToOrderPercent: null,
    };
    row.serviceCount += 1;
    row.consultations += service.consultations;
    row.whatsappClicks += service.whatsappClicks;
    row.leads += service.leads;
    row.convertedLeads += service.convertedLeads;
    row.revenue += service.revenue;
    universeMap.set(service.universeId, row);
  }

  // Count each order once per universe, even when it contains multiple services
  // from that same universe.
  const serviceUniverse = new Map(services.map((service) => [service.serviceId, service.universeId]));
  const ordersByUniverse = new Map<string, Set<string>>();
  for (const order of orders) {
    const itemServiceIds = new Set(order.items.flatMap((item) => item.serviceId ? [item.serviceId] : []));
    const attributedServiceIds = itemServiceIds.size > 0
      ? itemServiceIds
      : new Set(order.leadServiceId ? [order.leadServiceId] : []);
    const universeIds = new Set([...attributedServiceIds].map((id) => serviceUniverse.get(id)).filter((id): id is string => Boolean(id)));
    for (const universeId of universeIds) {
      const ids = ordersByUniverse.get(universeId) ?? new Set<string>();
      ids.add(order.id);
      ordersByUniverse.set(universeId, ids);
    }
  }

  const universeResults = [...universeMap.values()].map((row) => ({
    ...row,
    orders: ordersByUniverse.get(row.universeId)?.size ?? 0,
    leadPerConsultationPercent: roundRate(row.leads, row.consultations),
    leadToOrderPercent: roundRate(row.convertedLeads, row.leads),
  })).sort((a, b) =>
    b.convertedLeads - a.convertedLeads ||
    b.leads - a.leads ||
    b.revenue - a.revenue ||
    b.consultations - a.consultations ||
    a.universeName.localeCompare(b.universeName, 'fr'),
  );

  return { services: serviceResults, universes: universeResults };
}

/** Délai moyen (en jours) entre création et complétion des commandes terminées. */
export function averageCompletionDays(orders: AnalyticsOrder[]): number | null {
  const completed = orders.filter((o) => o.completedAt != null);
  if (completed.length === 0) return null;
  const totalMs = completed.reduce((s, o) => s + (o.completedAt!.getTime() - o.createdAt.getTime()), 0);
  return Math.round((totalMs / completed.length / 86400000) * 10) / 10;
}

/** Répartition des coûts internes en % (EXPERT/MATERIAL/DELIVERY/OTHER). */
/** Répartition des coûts, sur le même périmètre que le CA (commandes confirmées/payées) : un devis encore ouvert n'entre ni au CA ni aux coûts. */
export function costBreakdown(orders: AnalyticsOrder[]): { type: string; amount: number; percent: number }[] {
  const byType = new Map<string, number>();
  for (const c of orders.filter((o) => REVENUE_STATUSES.includes(o.status)).flatMap((o) => o.costs)) {
    byType.set(c.type, (byType.get(c.type) ?? 0) + c.amount);
  }
  const total = [...byType.values()].reduce((s, a) => s + a, 0);
  if (total === 0) return [];
  return [...byType.entries()]
    .map(([type, amount]) => ({ type, amount, percent: Math.round((amount / total) * 1000) / 10 }))
    .sort((a, b) => b.amount - a.amount);
}

/* --------------------------- Série temporelle (CA) ------------------------- */

export interface WeeklyPoint {
  /** Label court « 12 janv. » du lundi de la semaine. */
  label: string;
  weekStart: Date;
  revenue: number;
}

/** CA facturé par semaine sur les N dernières semaines. */
export function weeklyRevenue(orders: AnalyticsOrder[], weeks = 12, now: Date = new Date()): WeeklyPoint[] {
  const points: WeeklyPoint[] = [];
  const currentMonday = new Date(now);
  currentMonday.setHours(0, 0, 0, 0);
  currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentMonday, -7 * i);
    const weekEnd = addDays(weekStart, 7);
    const revenue = orders
      .filter((o) => REVENUE_STATUSES.includes(o.status) && inRange(o.createdAt, weekStart, weekEnd))
      .reduce((s, o) => s + (o.totalPrice ?? 0), 0);
    points.push({
      weekStart,
      label: weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      revenue,
    });
  }
  return points;
}

/* --------------------------------- Experts --------------------------------- */

export interface ExpertRow {
  expertId: string;
  name: string;
  completedOrders: number;
  reworkRate: number;
}

export function topExperts<T extends ExpertRow>(experts: T[], limit = 5): T[] {
  return [...experts].sort((a, b) => b.completedOrders - a.completedOrders || a.reworkRate - b.reworkRate).slice(0, limit);
}

/* --------------------------------- Filtres --------------------------------- */

export function filterOrdersByPeriod(orders: AnalyticsOrder[], p: Period, usePrevious = false): AnalyticsOrder[] {
  const from = usePrevious ? p.previousFrom : p.from;
  return orders.filter((o) => o.createdAt >= from && (usePrevious ? o.createdAt < p.from : o.createdAt <= p.to));
}

export function filterLeadsByPeriod(leads: AnalyticsLead[], p: Period, usePrevious = false): AnalyticsLead[] {
  const from = usePrevious ? p.previousFrom : p.from;
  return leads.filter((l) => l.createdAt >= from && (usePrevious ? l.createdAt < p.from : l.createdAt <= p.to));
}

export function filterEventsByPeriod(events: AnalyticsEvent[], p: Period): AnalyticsEvent[] {
  return events.filter((e) => e.createdAt >= p.from && e.createdAt <= p.to);
}

/** Commandes nécessitant une action (badge sidebar). */
export function todoCount(orders: AnalyticsOrder[]): number {
  return orders.filter((o) => TODO_STATUSES.includes(o.status)).length;
}
