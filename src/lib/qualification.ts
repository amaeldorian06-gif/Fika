import { z } from 'zod';
export const LOST_REASONS = { PRICE: 'Prix', NO_EXPERT: 'Aucun professionnel disponible', ABANDONED: 'Abandon / sans réponse', OUT_OF_ZONE: 'Hors zone', OTHER: 'Autre' } as const;
export const qualificationSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(['NEW', 'QUALIFYING', 'LOST']),
  serviceSlug: z.string().max(100).optional(),
  operationsNotes: z.string().trim().max(2000).default(''),
  lostReason: z.enum(['PRICE','NO_EXPERT','ABANDONED','OUT_OF_ZONE','OTHER']).nullable().default(null),
}).refine(v => v.status !== 'LOST' || !!v.lostReason, { path: ['lostReason'], message: 'Indiquez pourquoi la demande est perdue.' });
