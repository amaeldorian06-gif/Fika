import { z } from 'zod';
import { normalizePhoneE164 } from '../lead';
import { VERIFICATION_LEVELS, VERIFICATION_TYPE_LABELS } from '../trust';

const fields = z.object({
  name: z.string().trim().min(2, 'Nom : 2 caractères minimum.').max(80),
  phone: z.string().transform(v => normalizePhoneE164(v) ?? '').pipe(z.string().regex(/^\+2376\d{8}$/, 'Numéro camerounais invalide.')),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  cityId: z.string().min(1).nullish(),
  zone: z.string().trim().max(120).nullish(),
  usualCost: z.number().int().min(0).max(100_000_000).nullish(),
  availability: z.boolean(),
  status: z.enum(['ACTIVE', 'PAUSED', 'SUSPENDED', 'BACKUP']),
  // Dossier de confiance (interne, jamais public)
  trade: z.string().trim().max(80).nullish(),
  internalNotes: z.string().trim().max(4000).nullish(),
  references: z.string().trim().max(4000).nullish(),
  documents: z.string().trim().max(4000).nullish(),
});

const LEVELS = VERIFICATION_LEVELS.map((l) => l.level) as [string, ...string[]];
const TYPES = Object.keys(VERIFICATION_TYPE_LABELS) as [string, ...string[]];

/** Changement de niveau de vérification (admin) : niveau visé + ce qui a réellement été fait. */
export const verifyExpertSchema = z.object({
  expertId: z.string().min(1),
  to: z.enum(LEVELS),
  type: z.enum(TYPES),
  note: z.string().trim().max(1000).optional(),
});
export const createExpertSchema = fields.extend({ skills: fields.shape.skills.default([]), availability: fields.shape.availability.default(true), status: fields.shape.status.default('ACTIVE') });
// Do not inherit create defaults: an update of the phone must not reset availability/skills.
export const updateExpertSchema = fields.partial().extend({ expertId: z.string().min(1) });
