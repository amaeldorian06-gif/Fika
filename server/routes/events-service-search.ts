import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';

/**
 * POST /api/events/service-search — recherche tapée sur /services.
 *
 * Objectif produit : mesurer l'efficacité de la recherche et capter les
 * demandes sans résultat (signal d'expansion du catalogue). Même politique
 * que WACLICK/LEAD_VIEW : best-effort, aucune donnée personnelle — la
 * requête est tronquée et aucun identifiant client n'est envoyé.
 */

const serviceSearchSchema = z.object({
  query: z.string().trim().min(2).max(80),
  results: z.number().int().min(0).max(500),
});

export type ServiceSearchBody = z.infer<typeof serviceSearchSchema>;

export async function handleServiceSearch(body: unknown): Promise<{ ok: boolean }> {
  const parsed = serviceSearchSchema.safeParse(body);
  if (!parsed.success) return { ok: false };

  await prisma.event.create({
    data: {
      type: 'SERVICE_SEARCH',
      source: 'site',
      meta: { query: parsed.data.query, results: parsed.data.results },
    },
  });

  return { ok: true };
}
