import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';
import type { MutationResult } from './admin-orders';

/**
 * Leads du back-office (P06) : file « à qualifier » → conversion en commande.
 * La conversion pré-remplit la commande depuis le lead (client, service,
 * ville/zone, adresse) ; le budget du lead reste un simple repère et n'est
 * JAMAIS transformé en prix client (le prix vient du devis).
 */

const convertSchema = z.object({
  leadId: z.string().min(1),
  /** Téléphone requis si le lead n'a pas de client rattaché. */
  phone: z.string().regex(/^\+2376\d{8}$/, 'Téléphone E.164 attendu.').optional(),
  name: z.string().trim().max(80).optional(),
});

/** Numéro de commande séquentiel par année : CMD-2026-0001. */
export async function nextOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.order.count({ where: { orderNumber: { startsWith: `CMD-${year}-` } } });
  return `CMD-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function handleConvertLead(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult<{ orderId: string; orderNumber: string }>> {
  if (!adminId) {
    return { status: 401, body: { ok: false, code: 'UNAUTHORIZED', message: 'Session expirée. Reconnectez-vous.' } };
  }
  const parsed = convertSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Requête invalide.' } };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: parsed.data.leadId },
    include: { customer: true, service: true, city: true },
  });
  if (!lead) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Demande introuvable.' } };
  if (lead.status === 'CONVERTED') {
    return { status: 409, body: { ok: false, code: 'ALREADY_CONVERTED', message: 'Cette demande est déjà convertie.' } };
  }

  // Client : celui du lead, sinon upsert sur le téléphone fourni.
  let customerId = lead.customerId;
  if (!customerId) {
    if (!parsed.data.phone) {
      return {
        status: 400,
        body: { ok: false, code: 'PHONE_REQUIRED', message: 'Renseignez le téléphone du client pour convertir.' },
      };
    }
    const customer = await prisma.customer.upsert({
      where: { phone: parsed.data.phone },
      create: { phone: parsed.data.phone, name: parsed.data.name ?? null },
      update: parsed.data.name ? { name: parsed.data.name } : {},
    });
    customerId = customer.id;
  }

  const orderNumber = await nextOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId,
      status: 'QUALIFYING',
      source: 'SITE',
      cityId: lead.cityId,
      clientAddress: lead.zoneName,
      leadId: lead.id,
      // Prix volontairement nul : il sera fixé par le devis.
      totalPrice: null,
      items: lead.serviceId
        ? { create: [{ serviceId: lead.serviceId, quantity: 1, price: null }] }
        : { create: [{ customName: lead.description?.slice(0, 120) ?? 'Demande sur mesure', quantity: 1, price: null }] },
      events: {
        create: [{
          to: 'QUALIFYING',
          note: `Créée depuis la demande LEAD-${lead.id.slice(-6).toUpperCase()}.`,
          actorId: adminId,
        }],
      },
    },
  });

  await prisma.lead.update({ where: { id: lead.id }, data: { status: 'CONVERTED' } });

  return { status: 200, body: { ok: true, orderId: order.id, orderNumber } };
}

const leadStatusSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(['NEW', 'QUALIFYING', 'CONVERTED', 'LOST']),
});

export async function handleUpdateLeadStatus(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult> {
  if (!adminId) {
    return { status: 401, body: { ok: false, code: 'UNAUTHORIZED', message: 'Session expirée. Reconnectez-vous.' } };
  }
  const parsed = leadStatusSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Requête invalide.' } };
  }
  await prisma.lead.update({ where: { id: parsed.data.leadId }, data: { status: parsed.data.status } });
  return { status: 200, body: { ok: true } };
}
