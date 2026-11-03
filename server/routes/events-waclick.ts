import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';

/**
 * POST /api/events/waclick — implémentation de référence (P04, consommé par
 * lib/tracking.ts quand l'endpoint est exposé ; P08 branchera le dashboard).
 *
 * Contrat cible Next.js (App Router) :
 *
 *   // app/api/events/waclick/route.ts
 *   import { handleWaClick } from '@/server/routes/events-waclick';
 *   export async function POST(req: Request) {
 *     return Response.json(await handleWaClick(await req.json().catch(() => null)));
 *   }
 *
 * Règles : validation zod stricte du corps, échec = 400 (pas de fuite
 * d'information), écriture Event best-effort côté appelant (noop si l'API
 * est absente — voir lib/tracking.ts).
 */

const waClickSchema = z.object({
  serviceSlug: z.string().min(1).max(120).optional(),
  context: z.string().min(1).max(60),
  campaign: z.string().max(120).nullish(),
  ref: z.string().max(200).optional(),
});

export type WaClickBody = z.infer<typeof waClickSchema>;

export interface WaClickResponse {
  ok: boolean;
}

export async function handleWaClick(body: unknown): Promise<WaClickResponse> {
  const parsed = waClickSchema.safeParse(body);
  if (!parsed.success) return { ok: false };

  const { serviceSlug, context, campaign, ref } = parsed.data;

  // Un slug inconnu n'invalide pas l'événement : on trace sans FK service.
  let serviceId: string | null = null;
  if (serviceSlug) {
    const service = await prisma.service.findUnique({
      where: { slug: serviceSlug },
      select: { id: true },
    });
    serviceId = service?.id ?? null;
  }

  await prisma.event.create({
    data: {
      type: 'WACLICK',
      serviceId,
      campaign: campaign ?? null,
      source: 'site',
      meta: { context, ref: ref ?? null },
    },
  });

  return { ok: true };
}
