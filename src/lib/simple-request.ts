import { z } from 'zod';
import { normalizePhoneE164 } from './lead';

export const simpleRequestSchema = z.object({
  need: z.string().trim().min(5, 'Décrivez votre besoin en quelques mots.').max(2000, '2 000 caractères maximum.'),
  zoneName: z.string().trim().min(2, 'Indiquez votre quartier ou un repère.').max(160),
  phone: z.string().trim().refine(v => !!normalizePhoneE164(v), 'Utilisez un numéro comme 6 XX XX XX XX.'),
  name: z.string().trim().max(80).default(''),
  urgency: z.enum(['URGENT', 'TODAY', 'FEW_DAYS', 'FLEXIBLE']).default('FLEXIBLE'),
  consent: z.literal(true, { message: 'Votre accord est nécessaire pour être recontacté.' }),
});
