import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';

/**
 * POST /api/events/funnel — étapes du parcours client (mesure d'usage).
 *
 * Règle absolue : AUCUNE donnée personnelle ni contenu de formulaire.
 * Seuls l'étape, l'univers éventuel et le NOM du champ en échec (jamais sa
 * valeur) sont enregistrés — la mesure ne doit jamais devenir de la
 * surveillance. Même politique best-effort que WACLICK / SERVICE_SEARCH.
 */

export const FUNNEL_STEPS = [
  'PATH_SELECTED',        // un des deux chemins choisi depuis l'accueil
  'FORM_STARTED',         // formulaire de demande de service commencé
  'VALIDATION_ERROR',     // validation refusée (champ en échec, nom seulement)
  'REQUEST_SUBMITTED',    // demande de service confirmée par le serveur
  'INQUIRY_STARTED',      // formulaire produit commencé
  'INQUIRY_SUBMITTED',    // demande produit confirmée par le serveur
] as const;

const funnelSchema = z.object({
  step: z.enum(FUNNEL_STEPS),
  /** Univers d'origine ('services' | 'market'). */
  universe: z.enum(['services', 'market']).optional(),
  /** Nom technique du champ en échec (ex. 'phone') — jamais sa valeur. */
  field: z.string().trim().max(40).regex(/^[a-zA-Z]+$/).optional(),
});

export type FunnelBody = z.infer<typeof funnelSchema>;

export async function handleFunnelEvent(body: unknown): Promise<{ ok: boolean }> {
  const parsed = funnelSchema.safeParse(body);
  if (!parsed.success) return { ok: false };

  await prisma.event.create({
    data: {
      type: 'FUNNEL_STEP',
      source: 'site',
      meta: parsed.data,
    },
  });

  return { ok: true };
}
