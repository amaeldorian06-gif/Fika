import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { zipSync, strToU8 } from 'fflate';
import { prisma } from '../../src/lib/prisma';
import { encodeCsv } from '../../src/lib/csv';
import { parseReportRange } from '../../src/lib/report-period';
import { buildExport, EXPORT_DATASETS } from './admin-export';

export class ReportError extends Error {}

const input = z.object({ from: z.string().min(10).max(10), to: z.string().min(10).max(10) });
const closed = ['COMPLETED', 'CANCELLED'] as const;
type Candidate = { id: string; updatedAt: string };
const selection = { id: true, fromDate: true, toDate: true, createdAt: true, downloadedAt: true, archivedAt: true, restoredAt: true, archivedOrders: true, archivedLeads: true };
export function listReports() { return prisma.exportBatch.findMany({ select: selection, orderBy: { createdAt: 'desc' }, take: 100 }); }

export async function createReport(body: unknown, actor: string) {
  const data = input.parse(body);
  let createdAt: NonNullable<ReturnType<typeof parseReportRange>>;
  try { createdAt = parseReportRange(data.from, data.to)!; } catch { throw new ReportError('Période invalide. Vérifiez les dates.'); }
  return prisma.$transaction(async tx => {
    const counts = await Promise.all(EXPORT_DATASETS.map(d => ({ leads: tx.lead, orders: tx.order, customers: tx.customer, payments: tx.payment, costs: tx.cost, events: tx.event }[d] as typeof tx.lead).count({ where: { createdAt } })));
    if (counts.reduce((a,b) => a+b,0) > 10000) throw new ReportError('Trop de lignes. Réduisez la période pour exporter sans perte.');
    const files: Record<string, string> = {};
    for (const dataset of EXPORT_DATASETS) {
      const file = await buildExport(dataset, data.from, data.to, tx);
      files[file.filename] = file.csv;
    }
    const orders = await tx.order.findMany({ where: { createdAt }, include: { costs: true, payments: true } });
    const leads = await tx.lead.findMany({ where: { createdAt }, include: { service: { include: { category: true } } } });
    const payments = await tx.payment.findMany({ where: { confirmedAt: createdAt, status: 'CONFIRMED' } });
    const incurredCosts = await tx.cost.findMany({ where: { createdAt } });
    const billable = orders.filter(o => !['NEW', 'QUALIFYING', 'QUOTED', 'AWAITING_CONFIRMATION', 'CANCELLED'].includes(o.status));
    const known = billable.filter(o => o.totalPrice != null);
    const revenue = known.reduce((n,o) => n + o.totalPrice!, 0);
    const cohortCosts = known.reduce((n,o) => n + o.costs.reduce((s,c) => s+c.amount,0),0);
    const metrics: (string | number)[][] = [
      ['Demandes créées', leads.length], ['Commandes créées', orders.length],
      ['Commandes créées puis terminées (état à l’export)', orders.filter(o => o.status === 'COMPLETED').length],
      ['CA des commandes engagées créées sur la période (hors annulées)', revenue],
      ['Commandes engagées sans prix renseigné', billable.length-known.length],
      ['Coûts des commandes entrant dans le CA (toutes dates)', cohortCosts],
      ['Marge brute de ces commandes', revenue-cohortCosts],
      ['Panier moyen de ces commandes (FCFA arrondis)', known.length ? Math.round(revenue/known.length) : '—'],
      ['Encaissements confirmés pendant la période', payments.reduce((s,p) => s+p.amount,0)],
      ['Coûts enregistrés pendant la période', incurredCosts.reduce((s,c) => s+c.amount,0)],
    ];
    files['statistiques.csv'] = encodeCsv(['Indicateur', 'Valeur'], metrics);
    const groups = new Map<string, number>();
    for (const l of leads) {
      const key = JSON.stringify([l.service?.category.title ?? 'Non qualifié', l.service?.name ?? 'Besoin libre', l.zoneName ?? 'Non renseigné', l.source, l.status, l.lostReason ?? '']);
      groups.set(key, (groups.get(key) ?? 0)+1);
    }
    files['besoins.csv'] = encodeCsv(['Catégorie','Service','Zone','Source','Statut','Motif de perte','Demandes'], [...groups].map(([k,n]) => [...JSON.parse(k),n]));
    files['LIRE-MOI.txt'] = `Fika — export du ${data.from} au ${data.to}, journées Africa/Douala (UTC+1).\nChaque CSV filtre la date de création, sauf les indicateurs explicitement datés autrement.\nLes statistiques sont une photographie à cet instant, pas un audit comptable. Un montant inconnu reste vide. Les lignes archivées restent incluses.\nCet export contient des données personnelles : conserver dans un emplacement protégé. Vérifiez le fichier avant de confirmer l'archivage. Les commandes en cours ne sont jamais archivées.\nCe dossier ne remplace pas une sauvegarde PostgreSQL complète.\n`;
    const eligibleOrders = orders.filter(o => !o.archiveBatchId && closed.includes(o.status as typeof closed[number]));
    const eligibleLeads = leads.filter(l => !l.archiveBatchId && ['LOST','CONVERTED'].includes(l.status));
    const candidates = { orders: eligibleOrders.map(o => ({ id: o.id, updatedAt: o.updatedAt.toISOString() })), leads: eligibleLeads.map(l => ({ id: l.id, updatedAt: l.updatedAt.toISOString() })) };
    // Protect Vercel response/memory limits. Nothing is silently truncated.
    if (JSON.stringify(files).length > 8_000_000 || zipSync(Object.fromEntries(Object.entries(files).map(([k,v]) => [k,strToU8(v)]))).length > 4_000_000) throw new ReportError('Export trop volumineux. Réduisez la période.');
    return tx.exportBatch.create({ data: { fromDate: data.from, toDate: data.to, createdById: actor, files, candidates }, select: selection });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
}

export async function downloadReport(id: string) {
  const report = await prisma.exportBatch.findUnique({ where: { id } });
  if (!report) return null;
  const files = report.files as Record<string, string>;
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k,v]) => [k, strToU8(v)])));
  // Means delivery initiated, NOT proof the file is saved on the administrator's device.
  await prisma.exportBatch.update({ where: { id }, data: { downloadedAt: new Date() } });
  return { zip: Buffer.from(zip), filename: `fika-${report.fromDate}-${report.toDate}-${id.slice(-6)}.zip` };
}

export async function archiveReport(id: string, confirmed: boolean) {
  if (!confirmed) throw new ReportError('Confirmez avoir téléchargé et vérifié le dossier.');
  return prisma.$transaction(async tx => {
    const r = await tx.exportBatch.findUnique({ where: { id } });
    if (!r?.downloadedAt) throw new ReportError('Téléchargez le dossier avant de l’archiver.');
    if (r.archivedAt || r.restoredAt) throw new ReportError('Ce dossier a déjà été traité. Créez un nouvel export.');
    const candidates = r.candidates as unknown as { orders: Candidate[]; leads: Candidate[] };
    const orders = await tx.order.updateMany({ where: { archiveBatchId: null, status: { in: [...closed] }, OR: candidates.orders.map(c => ({ id: c.id, updatedAt: new Date(c.updatedAt) })) }, data: { archiveBatchId: id } });
    const leads = await tx.lead.updateMany({ where: { archiveBatchId: null, status: { in: ['LOST','CONVERTED'] }, OR: candidates.leads.map(c => ({ id: c.id, updatedAt: new Date(c.updatedAt) })), orders: { every: { archiveBatchId: { not: null }, status: { in: [...closed] } } } }, data: { archiveBatchId: id } });
    return tx.exportBatch.update({ where: { id }, data: { archivedAt: new Date(), archivedOrders: orders.count, archivedLeads: leads.count }, select: selection });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function restoreReport(id: string) {
  return prisma.$transaction(async tx => {
    const r = await tx.exportBatch.findUnique({ where: { id } });
    if (!r?.archivedAt || r.restoredAt) throw new ReportError('Ce dossier ne peut pas être restauré.');
    await tx.order.updateMany({ where: { archiveBatchId: id }, data: { archiveBatchId: null } });
    await tx.lead.updateMany({ where: { archiveBatchId: id }, data: { archiveBatchId: null } });
    return tx.exportBatch.update({ where: { id }, data: { restoredAt: new Date() }, select: selection });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
