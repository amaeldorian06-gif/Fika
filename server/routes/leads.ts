import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';
import {
  leadPayloadSchema, maskPhoneE164, normalizePhoneE164,
} from '../../src/lib/lead';
import { getServiceRef } from '../../src/lib/catalog-data';
import { budgetLabel, sendLeadAlert } from '../lib/notify';

/**
 * POST /api/leads — implémentation de référence (tunnel P05).
 *
 * Flux : validation zod → normalisation téléphone → upsert Customer (phone
 * unique) → création Lead (source SITE, status NEW) → { ok, leadId, leadCode }.
 *
 * Sécurité : limite de débit par IP en mémoire (remplacer par un vrai
 * rate-limiter en prod), aucun log du numéro complet (masquage systématique).
 */

/* Limite de débit simple : 10 requêtes/min/IP. NOTE_PROD : remplacer par un
 * store partagé (Redis) derrière plusieurs instances. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export type CreateLeadResult =
  | { status: 200; body: { ok: true; leadId: string; leadCode: string } }
  | { status: 400 | 429; body: { ok: false; code: string; message: string; issues?: Record<string, string[] | undefined> } };

export async function handleCreateLead(body: unknown, ip: string): Promise<CreateLeadResult> {
  if (!checkRateLimit(ip || 'unknown')) {
    return {
      status: 429,
      body: { ok: false, code: 'RATE_LIMITED', message: 'Trop de demandes. Réessayez dans une minute.' },
    };
  }

  const parsed = leadPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        ok: false,
        code: 'VALIDATION',
        message: 'Demande invalide. Vérifiez les champs.',
        issues: z.flattenError(parsed.error).fieldErrors,
      },
    };
  }

  const data = parsed.data;

  // Téléphone : obligatoire (chaque demande doit être rappelable), normalisé E.164.
  const phone = data.phone ? normalizePhoneE164(data.phone) : null;
  if (!phone) {
    return {
      status: 400,
      body: {
        ok: false,
        code: 'PHONE_INVALID',
        message: 'Numéro invalide. Format attendu : +237 6 XX XX XX XX.',
      },
    };
  }

  // Ville active (Ngaoundéré aujourd'hui) ; quartier libre (Fine mapping Zone ultérieur).
  const city = await prisma.city.findFirst({ where: { name: data.cityName, active: true } });

  // Service optionnel mais vérifié : le front envoie l'id catalogue (ex. s-mai-1) ou un slug ;
  // la base est indexée par slug (seule clé stable). Un id inconnu ne bloque pas la demande.
  let serviceId: string | null = null;
  if (data.serviceId) {
    const slug = getServiceRef(data.serviceId)?.slug ?? data.serviceId;
    const service = await prisma.service.findFirst({ where: { OR: [{ slug }, { id: data.serviceId }] }, select: { id: true } });
    serviceId = service?.id ?? null;
  }

  // Customer : upsert sur le téléphone unique (un client = un numéro).
  const customer = await prisma.customer.upsert({
    where: { phone },
    create: { phone, name: data.name ?? null },
    update: data.name ? { name: data.name } : {},
  });

  // Contexte de collecte (sans cookie) : type de client, provenance, appareil, consentement.
  const meta = {
    clientType: data.clientType ?? null,
    referrer: data.context?.referrer ?? null,
    landing: data.context?.landing ?? null,
    device: data.context?.device ?? null,
    serviceName: data.serviceName ?? null,
    consentAt: new Date().toISOString(),
  };

  const lead = await prisma.lead.create({
    data: {
      customerId: customer.id,
      serviceId,
      cityId: city?.id ?? null,
      zoneName: data.zoneName,
      description: data.need,
      deadline: data.deadline ?? null,
      budgetMin: data.budgetMin ?? null,
      budgetMax: data.budgetMax ?? null,
      campaign: data.context?.campaign ?? null,
      meta,
      source: 'SITE',
      status: 'NEW',
    },
  });

  // Code de référence déterministe (retrouvable dans l'admin et WhatsApp).
  const leadCode = `LEAD-${lead.id.slice(-6).toUpperCase()}`;

  // Jamais le numéro complet en clair dans les logs : masqué systématiquement.
  console.info(`[leads] Nouveau lead ${leadCode} — contact ${maskPhoneE164(phone)}`);

  // Alerte e-mail (best-effort : n'empêche jamais l'enregistrement).
  await sendLeadAlert({
    leadCode, leadId: lead.id, clientType: meta.clientType, name: data.name ?? null, phone,
    need: data.need, serviceName: data.serviceName ?? null, cityName: data.cityName, zoneName: data.zoneName,
    deadline: data.deadline ?? null, budgetLabel: budgetLabel(data.budgetMin, data.budgetMax),
    campaign: data.context?.campaign ?? null, referrer: meta.referrer, device: meta.device,
  });

  return { status: 200, body: { ok: true, leadId: lead.id, leadCode } };
}
