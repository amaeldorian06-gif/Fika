import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';

/**
 * POST /api/events/leadview — trace la consultation d'une fiche service
 * (attribution des sources, P08). Même politique que WACLICK : best-effort,
 * aucune donnée personnelle, slug inconnu toléré (événement sans FK).
 */

const leadViewSchema = z.object({
  serviceSlug: z.string().min(1).max(120),
  universeSlug: z.string().max(120).nullish(),
});

export async function handleLeadView(body: unknown): Promise<{ ok: boolean }> {
  const parsed = leadViewSchema.safeParse(body);
  if (!parsed.success) return { ok: false };

  let serviceId: string | null = null;
  const service = await prisma.service.findUnique({
    where: { slug: parsed.data.serviceSlug },
    select: { id: true },
  });
  serviceId = service?.id ?? null;

  await prisma.event.create({
    data: {
      type: 'LEAD_VIEW',
      serviceId,
      source: 'site',
      meta: { universe: parsed.data.universeSlug ?? null },
    },
  });

  return { ok: true };
}
