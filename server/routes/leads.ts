import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';
import {
  leadPayloadSchema, maskPhoneE164, normalizePhoneE164,
} from '../../src/lib/lead';

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

  // Téléphone : normalisation E.164 obligatoire s'il est fourni.
  let phone: string | null = null;
  if (data.phone) {
    phone = normalizePhoneE164(data.phone);
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
  }

  // Ville active (Ngaoundéré aujourd'hui) ; quartier libre (Fine mapping Zone ultérieur).
  const city = await prisma.city.findFirst({ where: { name: data.cityName, active: true } });

  // Service optionnel mais vérifié (un id inconnu ne bloque pas la demande).
  let serviceId: string | null = null;
  if (data.serviceId) {
    const service = await prisma.service.findUnique({ where: { id: data.serviceId }, select: { id: true } });
    serviceId = service?.id ?? null;
  }

  // Customer : upsert sur le téléphone unique (ou lead sans compte).
  let customerId: string | null = null;
  if (phone) {
    const customer = await prisma.customer.upsert({
      where: { phone },
      create: { phone, name: data.name ?? null },
      update: data.name ? { name: data.name } : {},
    });
    customerId = customer.id;
  }

  const lead = await prisma.lead.create({
    data: {
      customerId,
      serviceId,
      cityId: city?.id ?? null,
      zoneName: data.zoneName,
      description: data.need,
      deadline: data.deadline ?? null,
      budgetMin: data.budgetMin ?? null,
      budgetMax: data.budgetMax ?? null,
      source: 'SITE',
      status: 'NEW',
    },
  });

  // Code de référence déterministe (retrouvable dans l'admin et WhatsApp).
  const leadCode = `LEAD-${lead.id.slice(-6).toUpperCase()}`;

  // Jamais le numéro complet en clair : masqué systématiquement.
  if (phone) {
    console.info(`[leads] Nouveau lead ${leadCode} — contact ${maskPhoneE164(phone)}`);
  } else {
    console.info(`[leads] Nouveau lead ${leadCode} — sans téléphone déclaré`);
  }

  return { status: 200, body: { ok: true, leadId: lead.id, leadCode } };
}
