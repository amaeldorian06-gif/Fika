import { z } from 'zod';
import { OTHER_ZONE_VALUE, getCityBySlug, getZoneNamesForCity } from './city';

/**
 * Tunnel de demande (P05) — schémas zod partagés client/serveur et
 * normalisation du téléphone E.164. Aucune logique dupliquée ailleurs.
 */

/* ------------------------------ Téléphone --------------------------------- */

export const PHONE_E164_RE = /^\+2376\d{8}$/;

/**
 * Normalise en E.164 (+2376XXXXXXXX). Accepte « 6 12 34 56 78 »,
 * « 237 612 345 678 », « +237612345678 », etc. Retourne null si invalide.
 */
export function normalizePhoneE164(raw: string): string | null {
  const digits = raw.replace(/[\s.\-()]/g, '').replace(/^\+/, '');
  const local = digits.startsWith('237') ? digits.slice(3) : digits;
  if (!/^6\d{8}$/.test(local)) return null;
  return `+237${local}`;
}

/** Jamais de numéro complet en clair (logs, récap) : +2376••• •• 78. */
export function maskPhoneE164(phone: string): string {
  if (!PHONE_E164_RE.test(phone)) return phone.slice(0, 4) + '•••';
  return `${phone.slice(0, 5)}••• •• ${phone.slice(-2)}`;
}

/* ------------------------------ Budgets ----------------------------------- */

export interface BudgetRange {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
}

export const BUDGET_RANGES: BudgetRange[] = [
  { id: 'unknown', label: 'Je ne sais pas encore', min: null, max: null },
  { id: 'lt5k', label: 'Moins de 5 000 F', min: 0, max: 5000 },
  { id: '5-15k', label: 'Entre 5 000 et 15 000 F', min: 5000, max: 15000 },
  { id: '15-50k', label: 'Entre 15 000 et 50 000 F', min: 15000, max: 50000 },
  { id: 'gt50k', label: 'Plus de 50 000 F', min: 50000, max: null },
];

export const getBudgetRange = (id: string): BudgetRange =>
  BUDGET_RANGES.find((b) => b.id === id) ?? BUDGET_RANGES[0];

/* ------------------------------ Formulaire -------------------------------- */

export const leadFormSchema = z.object({
  need: z
    .string({ message: 'Décrivez votre besoin.' })
    .trim()
    .min(10, 'Décrivez votre besoin en au moins 10 caractères.')
    .max(2000, '2 000 caractères maximum.'),
  serviceId: z.string().optional().default(''),
  citySlug: z
    .string()
    .min(1)
    .refine((v) => getCityBySlug(v)?.active === true, 'Ville non desservie pour le moment.'),
  zone: z
    .string({ message: 'Sélectionnez votre quartier.' })
    .min(1, 'Sélectionnez votre quartier.'),
  zoneOther: z.string().trim().max(120, '120 caractères maximum.').optional().default(''),
  deadline: z.string().trim().max(120, '120 caractères maximum.').optional().default(''),
  budgetRange: z.string().optional().default('unknown'),
  name: z.string().trim().max(80, '80 caractères maximum.').optional().default(''),
  phone: z.string().trim().optional().default(''),
  consent: z.boolean(),
}).superRefine((values, ctx) => {
  // Quartier valide pour la VILLE choisie (refinement ville-aware, P11).
  if (values.zone !== OTHER_ZONE_VALUE && !getZoneNamesForCity(values.citySlug).includes(values.zone)) {
    ctx.addIssue({ code: 'custom', path: ['zone'], message: 'Quartier invalide pour cette ville.' });
  }
  if (values.zone === OTHER_ZONE_VALUE && values.zoneOther.trim().length < 2) {
    ctx.addIssue({ code: 'custom', path: ['zoneOther'], message: 'Précisez votre quartier.' });
  }
  if (values.phone && !normalizePhoneE164(values.phone)) {
    ctx.addIssue({
      code: 'custom',
      path: ['phone'],
      message: 'Numéro invalide. Format attendu : +237 6 XX XX XX XX.',
    });
  }
  if (!values.consent) {
    ctx.addIssue({
      code: 'custom',
      path: ['consent'],
      message: 'Votre accord est nécessaire pour être recontacté.',
    });
  }
});

export type LeadFormValues = z.output<typeof leadFormSchema>;

/** Forme brute des champs (avant defaults) — utilisée par react-hook-form. */
export type LeadFormInput = z.input<typeof leadFormSchema>;

/* --------------------------- Payload serveur ------------------------------ */

export const leadPayloadSchema = z.object({
  need: z.string().trim().min(10).max(2000),
  serviceId: z.string().max(60).optional(),
  serviceName: z.string().max(160).optional(),
  cityName: z.string().trim().min(2).max(80).default('Ngaoundéré'),
  zoneName: z.string().trim().min(2).max(120),
  deadline: z.string().trim().max(120).optional(),
  budgetMin: z.number().int().min(0).nullish(),
  budgetMax: z.number().int().min(0).nullish(),
  name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(32).optional(),
});

export type LeadPayload = z.input<typeof leadPayloadSchema>;

/** traduit les valeurs du formulaire en payload API (téléphone normalisé). */
export function toLeadPayload(values: LeadFormValues, serviceName?: string): LeadPayload {
  const budget = getBudgetRange(values.budgetRange);
  return {
    need: values.need,
    serviceId: values.serviceId || undefined,
    serviceName,
    cityName: getCityBySlug(values.citySlug)?.name ?? 'Ngaoundéré',
    zoneName: values.zone === OTHER_ZONE_VALUE ? values.zoneOther.trim() : values.zone,
    deadline: values.deadline || undefined,
    budgetMin: budget.min ?? undefined,
    budgetMax: budget.max ?? undefined,
    name: values.name || undefined,
    phone: values.phone ? normalizePhoneE164(values.phone) ?? undefined : undefined,
  };
}
