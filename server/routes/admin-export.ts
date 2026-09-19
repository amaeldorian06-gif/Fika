import { prisma } from '../../src/lib/prisma';
import { encodeCsv } from '../../src/lib/csv';
import { clientTypeLabel } from '../../src/lib/lead';
import { LEAD_STATUS_LABELS, orderStatusLabel } from '../../src/lib/admin/status';

/**
 * Export CSV complet (admin) — GET /api/admin/export/:dataset
 *
 * Datasets : leads (demandes), customers (clients), orders (commandes),
 * events (clics WhatsApp / vues services, anonymes).
 * Format : séparateur « ; », BOM UTF-8 → s'ouvre directement dans Excel.
 * Filtre optionnel ?from=YYYY-MM-DD&to=YYYY-MM-DD (dates de création).
 */

export const EXPORT_DATASETS = ['leads', 'customers', 'orders', 'events'] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export function isExportDataset(value: string): value is ExportDataset {
  return (EXPORT_DATASETS as readonly string[]).includes(value);
}

const dateFr = (d: Date) => d.toLocaleString('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'short', timeStyle: 'short' });

type LeadMeta = { clientType?: string | null; referrer?: string | null; landing?: string | null; device?: string | null; consentAt?: string | null } | null;

export function parseRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) range.lte = new Date(`${to}T23:59:59.999Z`);
  return range.gte || range.lte ? range : undefined;
}

export async function buildExport(dataset: ExportDataset, from?: string, to?: string): Promise<{ filename: string; csv: string; rows: number }> {
  const createdAt = parseRange(from, to);
  const where = createdAt ? { createdAt } : {};
  const stamp = new Date().toISOString().slice(0, 10);

  if (dataset === 'leads') {
    const rows = await prisma.lead.findMany({ where, include: { customer: true, service: true, city: true, orders: { select: { orderNumber: true } } }, orderBy: { createdAt: 'desc' } });
    const headers = ['Référence', 'Reçue le', 'Statut', 'Type de client', 'Nom', 'Téléphone', 'Service', 'Ville', 'Quartier', 'Besoin', 'Délai', 'Budget min (F)', 'Budget max (F)', 'Source', 'Campagne', 'Site référent', 'Page d\'entrée', 'Appareil', 'Consentement le', 'Commande'];
    const data = rows.map((l) => {
      const meta = (l.meta ?? null) as LeadMeta;
      return [
        `LEAD-${l.id.slice(-6).toUpperCase()}`, dateFr(l.createdAt), LEAD_STATUS_LABELS[l.status] ?? l.status,
        clientTypeLabel(meta?.clientType), l.customer?.name ?? '', l.customer?.phone ?? '',
        l.service?.name ?? '', l.city?.name ?? '', l.zoneName ?? '', l.description ?? '', l.deadline ?? '',
        l.budgetMin ?? '', l.budgetMax ?? '', l.source, l.campaign ?? '', meta?.referrer ?? '', meta?.landing ?? '', meta?.device ?? '',
        meta?.consentAt ? dateFr(new Date(meta.consentAt)) : '', l.orders.map((o) => o.orderNumber).join(' '),
      ];
    });
    return { filename: `fika-demandes-${stamp}.csv`, csv: encodeCsv(headers, data), rows: data.length };
  }

  if (dataset === 'customers') {
    const rows = await prisma.customer.findMany({ where, include: { leads: { select: { id: true, createdAt: true, meta: true } }, orders: { select: { status: true, totalPrice: true, createdAt: true } } }, orderBy: { createdAt: 'desc' } });
    const headers = ['Nom', 'Téléphone', 'E-mail', 'Type de client', 'Client depuis', 'Demandes', 'Commandes', 'Total facturé (F)', 'Dernière activité'];
    const data = rows.map((c) => {
      const lastLead = c.leads.reduce<Date | null>((acc, l) => (!acc || l.createdAt > acc ? l.createdAt : acc), null);
      const lastOrder = c.orders.reduce<Date | null>((acc, o) => (!acc || o.createdAt > acc ? o.createdAt : acc), null);
      const last = [lastLead, lastOrder].filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0];
      const clientType = (c.leads.map((l) => ((l.meta ?? null) as LeadMeta)?.clientType).find(Boolean)) ?? null;
      return [
        c.name ?? '', c.phone, c.email ?? '', clientTypeLabel(clientType), dateFr(c.createdAt),
        c.leads.length, c.orders.length, c.orders.reduce((sum, o) => sum + (o.totalPrice ?? 0), 0), last ? dateFr(last) : '',
      ];
    });
    return { filename: `fika-clients-${stamp}.csv`, csv: encodeCsv(headers, data), rows: data.length };
  }

  if (dataset === 'orders') {
    const rows = await prisma.order.findMany({ where, include: { customer: true, city: true, zone: true, costs: true, payments: true, items: { include: { service: { include: { category: true } } } }, tasks: { include: { assignments: { include: { expert: true } } } } }, orderBy: { createdAt: 'desc' } });
    const headers = ['Commande', 'Créée le', 'Statut', 'Client', 'Téléphone', 'Ville', 'Quartier', 'Type de service', 'Services', 'Professionnel', 'Prix client (F)', 'Encaissé (F)', 'Coût professionnel (F)', 'Déplacement (F)', 'Matériel (F)', 'Autres coûts (F)', 'Coût total (F)', 'Marge brute (F)', 'Marge (%)', 'Source', 'Terminée le'];
    const data = rows.map((o) => {
      const sum = (type?: string) => o.costs.filter((c) => !type || c.type === type).reduce((s, c) => s + c.amount, 0);
      const costs = sum();
      const paid = o.payments.filter((p) => p.status === 'CONFIRMED').reduce((s, p) => s + p.amount, 0);
      const margin = o.totalPrice != null ? o.totalPrice - costs : '';
      const marginPct = o.totalPrice ? Math.round(((o.totalPrice - costs) / o.totalPrice) * 1000) / 10 : '';
      const expert = o.tasks.flatMap((t) => t.assignments).find((a) => a.status !== 'DECLINED')?.expert.name ?? '';
      const category = o.items.map((i) => i.service?.category?.title).find(Boolean) ?? '';
      return [
        o.orderNumber, dateFr(o.createdAt), orderStatusLabel(o.status), o.customer.name ?? '', o.customer.phone,
        o.city?.name ?? '', o.zone?.name ?? '', category, o.items.map((i) => `${i.service?.name ?? i.customName ?? 'article'} ×${i.quantity}`).join(' | '), expert,
        o.totalPrice ?? '', paid, sum('EXPERT'), sum('DELIVERY'), sum('MATERIAL'), sum('OTHER'), costs, margin, marginPct, o.source, o.completedAt ? dateFr(o.completedAt) : '',
      ];
    });
    return { filename: `fika-commandes-${stamp}.csv`, csv: encodeCsv(headers, data), rows: data.length };
  }

  const rows = await prisma.event.findMany({ where, include: { service: true }, orderBy: { createdAt: 'desc' } });
  const headers = ['Date', 'Type', 'Service', 'Campagne', 'Contexte', 'Univers'];
  const data = rows.map((e) => {
    const meta = (e.meta ?? null) as { context?: string; universe?: string | null } | null;
    return [dateFr(e.createdAt), e.type === 'WACLICK' ? 'Clic WhatsApp' : 'Vue service', e.service?.name ?? '', e.campaign ?? '', meta?.context ?? '', meta?.universe ?? ''];
  });
  return { filename: `fika-evenements-${stamp}.csv`, csv: encodeCsv(headers, data), rows: data.length };
}
