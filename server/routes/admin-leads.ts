import { z } from 'zod';
import { serialTransaction, nextDocumentNumber, hasPrismaCode } from '../lib/transaction';
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

  type Result = MutationResult<{ orderId: string; orderNumber: string }>;
  const success = (order: { id: string; orderNumber: string }): Result => ({ status: 200, body: { ok: true, orderId: order.id, orderNumber: order.orderNumber } });
  try {
    return await serialTransaction<Result>(async tx => {
      const existing = await tx.order.findUnique({ where: { leadId: parsed.data.leadId } });
      if (existing) return success(existing); // Replayed request: no second order.
      const lead = await tx.lead.findUnique({ where: { id: parsed.data.leadId } });
      if (!lead) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Demande introuvable.' } };
      if (!['NEW', 'QUALIFYING'].includes(lead.status)) {
        return { status: 409, body: { ok: false, code: 'INVALID_STATUS', message: 'Seule une demande nouvelle ou en qualification peut être convertie.' } };
      }
      let customerId = lead.customerId;
      if (!customerId) {
        if (!parsed.data.phone) return { status: 400, body: { ok: false, code: 'PHONE_REQUIRED', message: 'Renseignez le téléphone du client pour convertir.' } };
        const customer = await tx.customer.upsert({
          where: { phone: parsed.data.phone },
          create: { phone: parsed.data.phone, name: parsed.data.name || null },
          update: {}, // Do not overwrite another existing customer name from an unqualified lead.
        });
        customerId = customer.id;
      }
      const orderNumber = await nextDocumentNumber(tx, 'CMD');
      const order = await tx.order.create({ data: {
        orderNumber, customerId, status: 'QUALIFYING', source: lead.source,
        cityId: lead.cityId, clientAddress: lead.zoneName, leadId: lead.id, totalPrice: null,
        items: lead.serviceId
          ? { create: [{ serviceId: lead.serviceId, quantity: 1, price: null }] }
          : { create: [{ customName: lead.description?.slice(0, 120) ?? 'Demande sur mesure', quantity: 1, price: null }] },
        events: { create: [{ to: 'QUALIFYING', note: `Créée depuis la demande LEAD-${lead.id.slice(-6).toUpperCase()}.`, actorId: adminId }] },
      } });
      await tx.lead.update({ where: { id: lead.id }, data: { status: 'CONVERTED', customerId } });
      return success(order);
    });
  } catch (error) {
    if (!hasPrismaCode(error, 'P2002')) throw error;
    const existing = await prisma.order.findUnique({ where: { leadId: parsed.data.leadId } });
    if (existing) return success(existing);
    return { status: 409, body: { ok: false, code: 'CONFLICT', message: 'Une autre opération est en cours. Réessayez.' } };
  }
}

const leadStatusSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(['NEW', 'QUALIFYING', 'LOST']),
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
  return serialTransaction<MutationResult>(async tx => {
    const lead = await tx.lead.findUnique({ where: { id: parsed.data.leadId }, include: { orders: { select: { id: true } } } });
    if (!lead) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Demande introuvable.' } };
    if (lead.status === 'CONVERTED' || lead.orders.length) return { status: 409, body: { ok: false, code: 'CONVERTED', message: 'Une demande convertie ne peut plus être requalifiée.' } };
    await tx.lead.update({ where: { id: lead.id }, data: { status: parsed.data.status } });
    return { status: 200, body: { ok: true } };
  });
}
