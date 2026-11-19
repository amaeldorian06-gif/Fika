import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';

/**
 * Annuaire clients unifié (CRM) — un seul référentiel pour Fika Services et
 * Fika Market. Recherche côté serveur (nom, téléphone, e-mail), segments
 * calculés exclusivement depuis les enregistrements réels, pagination serveur.
 * Aucun indicateur inventé : chaque nombre provient d'une requête vérifiable.
 */

export type CustomerSegment = 'all' | 'services' | 'market' | 'both' | 'new' | 'active';

export interface CustomerRowDto {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  createdAt: string;
  /** Commandes Fika Services (devis confirmés ou en cours). */
  ordersCount: number;
  /** Commandes Fika Market. */
  marketOrdersCount: number;
  /** Demandes de service enregistrées (historique complet, converties ou non). */
  leadsCount: number;
  lastOrderAt: string | null;
  lastMarketOrderAt: string | null;
}

export interface CustomersPayload {
  rows: CustomerRowDto[];
  /** Total correspondant à la recherche + segment (pour la pagination). */
  total: number;
  page: number;
  pageSize: number;
  /** Taille réelle de chaque segment, non filtrée par la recherche. */
  segments: Record<CustomerSegment, number>;
}

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;
const NEW_CUSTOMER_DAYS = 30;
const ACTIVE_CUSTOMER_DAYS = 90;

function isSegment(value: unknown): value is CustomerSegment {
  return typeof value === 'string' && ['all', 'services', 'market', 'both', 'new', 'active'].includes(value);
}

/**
 * Recherche par téléphone insensible au format : « 622 36 87 90 » doit
 * retrouver « +237622368790 ». On compare sur les chiffres seulement.
 */
function phoneNeedle(q: string): string | null {
  const digits = q.replace(/[^0-9]/g, '');
  return digits.length >= 2 ? digits : null;
}

function segmentWhere(segment: CustomerSegment, now: Date): Prisma.CustomerWhereInput {
  const activeSince = new Date(now.getTime() - ACTIVE_CUSTOMER_DAYS * 24 * 3600 * 1000);
  switch (segment) {
    case 'services':
      return { orders: { some: {} } };
    case 'market':
      return { marketOrders: { some: {} } };
    case 'both':
      return { AND: [{ orders: { some: {} } }, { marketOrders: { some: {} } }] };
    case 'new':
      return { createdAt: { gte: new Date(now.getTime() - NEW_CUSTOMER_DAYS * 24 * 3600 * 1000) } };
    case 'active':
      return {
        OR: [
          { orders: { some: { createdAt: { gte: activeSince } } } },
          { marketOrders: { some: { createdAt: { gte: activeSince } } } },
        ],
      };
    case 'all':
    default:
      return {};
  }
}

async function countSegments(now: Date): Promise<Record<CustomerSegment, number>> {
  const [all, servicesIds, marketIds, newCount, active] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.findMany({ where: { orders: { some: {} } }, select: { id: true } }),
    prisma.customer.findMany({ where: { marketOrders: { some: {} } }, select: { id: true } }),
    prisma.customer.count({
      where: { createdAt: { gte: new Date(now.getTime() - NEW_CUSTOMER_DAYS * 24 * 3600 * 1000) } },
    }),
    prisma.customer.count({ where: segmentWhere('active', now) }),
  ]);
  const marketSet = new Set(marketIds.map((c) => c.id));
  return {
    all,
    services: servicesIds.length,
    market: marketIds.length,
    both: servicesIds.filter((c) => marketSet.has(c.id)).length,
    new: newCount,
    active,
  };
}

export async function getCustomers(params: {
  q?: string;
  segment?: string;
  page?: string;
  pageSize?: string;
}): Promise<CustomersPayload> {
  const now = new Date();
  const segment = isSegment(params.segment) ? params.segment : 'all';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(params.pageSize ?? '', 10) || PAGE_SIZE_DEFAULT));

  const q = (params.q ?? '').trim();
  const needle = phoneNeedle(q);
  const search: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          ...(needle ? [{ phone: { contains: needle } }] : []),
        ],
      }
    : {};

  const where: Prisma.CustomerWhereInput = { AND: [search, segmentWhere(segment, now)] };

  const [rows, total, segments] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, phone: true, email: true, createdAt: true,
        _count: { select: { orders: true, marketOrders: true, leads: true } },
        orders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        marketOrders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.customer.count({ where }),
    countSegments(now),
  ]);

  return {
    rows: rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      createdAt: c.createdAt.toISOString(),
      ordersCount: c._count.orders,
      marketOrdersCount: c._count.marketOrders,
      leadsCount: c._count.leads,
      lastOrderAt: c.orders[0]?.createdAt.toISOString() ?? null,
      lastMarketOrderAt: c.marketOrders[0]?.createdAt.toISOString() ?? null,
    })),
    total,
    page,
    pageSize,
    segments,
  };
}

/* ------------------------- Profil client unifié ---------------------------- */

import { z } from 'zod';

export interface CustomerTimelineEventDto {
  at: string;
  universe: 'services' | 'market' | 'interne';
  kind: 'demande' | 'commande' | 'paiement' | 'note';
  label: string;
  detail: string | null;
  link: string | null;
}

export interface CustomerProfilePayload {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  createdAt: string;
  tags: string[];
  notes: { id: string; author: string | null; body: string; createdAt: string }[];
  counts: {
    orders: number;
    marketOrders: number;
    leads: number;
    ordersCompleted: number;
    ordersCancelled: number;
  };
  finance: {
    /** Fika Services : somme des paiements confirmés (encaissé vérifié). */
    servicesConfirmed: number;
    /** Fika Services : reçus déclarés en attente de vérification. */
    servicesPending: number;
    /** Fika Market : paiements vérifiés. */
    marketConfirmed: number;
    /** Fika Market : paiements déclarés en attente. */
    marketPending: number;
  };
  lastActivityAt: string | null;
  timeline: CustomerTimelineEventDto[];
  /** Clients partageant le même nom normalisé (examen manuel requis). */
  duplicates: { id: string; name: string | null; phone: string; createdAt: string }[];
}

function normalizeName(name: string | null): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function getCustomerProfile(id: string): Promise<CustomerProfilePayload | null> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: 'desc' } },
      orders: {
        select: { id: true, orderNumber: true, status: true, totalPrice: true, createdAt: true,
          payments: { select: { amount: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      },
      marketOrders: {
        select: { id: true, orderNumber: true, status: true, createdAt: true,
          payments: { select: { amount: true, status: true } },
          quotes: { select: { totalAmount: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
      },
      leads: { select: { id: true, status: true, createdAt: true, description: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!customer) return null;

  const servicesConfirmed = customer.orders
    .flatMap((o) => o.payments.filter((p) => p.status === 'CONFIRMED'))
    .reduce((s, p) => s + p.amount, 0);
  const servicesPending = customer.orders
    .flatMap((o) => o.payments.filter((p) => p.status === 'PENDING'))
    .reduce((s, p) => s + p.amount, 0);
  const marketConfirmed = customer.marketOrders
    .flatMap((o) => o.payments.filter((p) => p.status === 'CONFIRMED'))
    .reduce((s, p) => s + p.amount, 0);
  const marketPending = customer.marketOrders
    .flatMap((o) => o.payments.filter((p) => p.status === 'PENDING'))
    .reduce((s, p) => s + p.amount, 0);

  const timeline: CustomerTimelineEventDto[] = [
    ...customer.leads.map((l) => ({
      at: l.createdAt.toISOString(), universe: 'services' as const, kind: 'demande' as const,
      label: 'Demande de service', detail: l.description?.slice(0, 120) ?? null, link: '/admin/leads',
    })),
    ...customer.orders.map((o) => ({
      at: o.createdAt.toISOString(), universe: 'services' as const, kind: 'commande' as const,
      label: `Commande ${o.orderNumber}`,
      detail: `${o.status}${o.totalPrice != null ? ` · ${(o.totalPrice / 1000).toFixed(0)} 000 F` : ''}`,
      link: `/admin/orders/${o.id}`,
    })),
    ...customer.marketOrders.map((o) => ({
      at: o.createdAt.toISOString(), universe: 'market' as const, kind: 'commande' as const,
      label: `Commande ${o.orderNumber}`,
      detail: `${o.status}${o.quotes[0]?.totalAmount != null ? ` · ${(o.quotes[0].totalAmount / 1000).toFixed(0)} 000 F` : ''}`,
      link: `/admin/market/orders/${o.id}`,
    })),
    ...customer.notes.map((n) => ({
      at: n.createdAt.toISOString(), universe: 'interne' as const, kind: 'note' as const,
      label: 'Note interne', detail: n.body.slice(0, 120), link: null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // Doublons potentiels : même nom normalisé, téléphone différent (le téléphone
  // étant unique, un doublon ne peut exister que sous un autre numéro).
  const duplicates = normalizeName(customer.name)
    ? await prisma.customer.findMany({
        where: { id: { not: customer.id }, name: { equals: customer.name, mode: 'insensitive' } },
        select: { id: true, name: true, phone: true, createdAt: true },
      })
    : [];

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    createdAt: customer.createdAt.toISOString(),
    tags: customer.tags,
    notes: customer.notes.map((n) => ({ id: n.id, author: n.author, body: n.body, createdAt: n.createdAt.toISOString() })),
    counts: {
      orders: customer.orders.length,
      marketOrders: customer.marketOrders.length,
      leads: customer.leads.length,
      ordersCompleted: customer.orders.filter((o) => o.status === 'COMPLETED').length,
      ordersCancelled: customer.orders.filter((o) => o.status === 'CANCELLED').length,
    },
    finance: { servicesConfirmed, servicesPending, marketConfirmed, marketPending },
    lastActivityAt: timeline[0]?.at ?? null,
    timeline,
    duplicates: duplicates.map((d) => ({ id: d.id, name: d.name, phone: d.phone, createdAt: d.createdAt.toISOString() })),
  };
}

const updateSchema = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().email('E-mail invalide.').max(160).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export type MutationResult = { status: number; body: { ok: boolean; message?: string } };

export async function updateCustomer(id: string, body: unknown): Promise<MutationResult> {
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { ok: false, message: parsed.error.issues[0]?.message ?? 'Requête invalide.' } };
  const d = parsed.data;
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return { status: 404, body: { ok: false, message: 'Client introuvable.' } };
  const data: { name?: string | null; email?: string | null; tags?: string[] } = {};
  if (d.name !== undefined) data.name = d.name || null;
  if (d.email !== undefined) data.email = d.email || null;
  if (d.tags !== undefined) data.tags = [...new Set(d.tags)];
  await prisma.customer.update({ where: { id }, data });
  return { status: 200, body: { ok: true } };
}

const noteSchema = z.object({ body: z.string().trim().min(3, 'La note est trop courte.').max(2000) });

export async function addCustomerNote(id: string, body: unknown, authorEmail: string | null): Promise<MutationResult> {
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { ok: false, message: parsed.error.issues[0]?.message ?? 'Requête invalide.' } };
  const existing = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { status: 404, body: { ok: false, message: 'Client introuvable.' } };
  await prisma.customerNote.create({ data: { customerId: id, author: authorEmail, body: parsed.data.body } });
  return { status: 200, body: { ok: true } };
}

const mergeSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
});

/**
 * Fusion contrôlée : le client « source » disparaît, tout son historique
 * (commandes des deux univers, demandes, avis, notes) est réattribué au
 * client « cible ». Transaction : tout ou rien. Le téléphone unique de la
 * source est perdu (doublon volontairement regroupé) — l'opération est
 * irréversible et ne se fait jamais automatiquement.
 */
export async function mergeCustomers(body: unknown): Promise<MutationResult> {
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { ok: false, message: 'Requête invalide.' } };
  const { sourceId, targetId } = parsed.data;
  if (sourceId === targetId) return { status: 400, body: { ok: false, message: 'La source et la cible doivent être différentes.' } };
  const [source, target] = await Promise.all([
    prisma.customer.findUnique({ where: { id: sourceId }, include: { notes: true } }),
    prisma.customer.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) return { status: 404, body: { ok: false, message: 'Client source ou cible introuvable.' } };
  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({ where: { customerId: sourceId }, data: { customerId: targetId } });
    await tx.marketOrder.updateMany({ where: { customerId: sourceId }, data: { customerId: targetId } });
    await tx.lead.updateMany({ where: { customerId: sourceId }, data: { customerId: targetId } });
    await tx.review.updateMany({ where: { customerId: sourceId }, data: { customerId: targetId } });
    if (source.notes.length) {
      await tx.customerNote.createMany({
        data: source.notes.map((n) => ({ customerId: targetId, author: n.author, body: n.body, createdAt: n.createdAt })),
      });
    }
    const mergedTags = [...new Set([...source.tags, ...target.tags])];
    await tx.customer.update({ where: { id: targetId }, data: { tags: mergedTags } });
    await tx.customer.delete({ where: { id: sourceId } });
  });
  return { status: 200, body: { ok: true } };
}
