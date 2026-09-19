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

/* ---------------------------- Type de client ------------------------------ */

export const CLIENT_TYPES = [
  { id: 'particulier', label: 'Particulier / famille' },
  { id: 'commercant', label: 'Commerçant / boutique' },
  { id: 'entreprise', label: 'Entreprise / PME' },
  { id: 'association', label: 'Association / église / école' },
] as const;

export type ClientType = (typeof CLIENT_TYPES)[number]['id'];
const CLIENT_TYPE_IDS = CLIENT_TYPES.map((c) => c.id) as [ClientType, ...ClientType[]];

export const clientTypeLabel = (id: string | null | undefined): string =>
  CLIENT_TYPES.find((c) => c.id === id)?.label ?? '—';

/* -------------------------- Contexte de collecte -------------------------- */

/** Données de contexte (sans cookie) : d'où vient le visiteur, sur quel appareil. */
export interface LeadContext {
  /** Provenance : ?campaign=… ou ?utm_source=… dans l'URL, sinon site référent, sinon « direct ». */
  campaign: string | null;
  referrer: string | null;
  /** Première page vue sur le site (hash inclus). */
  landing: string | null;
  device: 'mobile' | 'desktop' | null;
}

const CONTEXT_KEY = 'fika:ctx';

/** Mémorise (sessionStorage) la provenance dès la première page — best-effort. */
export function captureLeadContext(): LeadContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(CONTEXT_KEY);
    if (raw) return JSON.parse(raw) as LeadContext;
    const search = new URLSearchParams(window.location.search);
    const hashQuery = window.location.hash.split('?')[1];
    const hashParams = new URLSearchParams(hashQuery ?? '');
    const pick = (k: string) => search.get(k) ?? hashParams.get(k);
    const campaign = pick('campaign') ?? pick('utm_campaign') ?? pick('utm_source') ?? pick('ref') ?? pick('src') ?? pick('pack');
    let referrer: string | null = null;
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      referrer = ref && ref.hostname !== window.location.hostname ? ref.hostname : null;
    } catch { referrer = null; }
    const ctx: LeadContext = {
      campaign: campaign ? campaign.slice(0, 80) : null,
      referrer,
      landing: `${window.location.pathname}${window.location.hash}`.slice(0, 200) || null,
      device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    };
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
    return ctx;
  } catch {
    return null;
  }
}

/* ------------------------------ Urgence ----------------------------------- */

export type RequestTrack = 'RAPIDE' | 'TRAVAUX';
export type UrgencyLevel = 'URGENT' | 'TODAY' | 'FEW_DAYS' | 'FLEXIBLE';

export interface UrgencyOption {
  id: UrgencyLevel;
  label: string;
  sublabel: string;
  badge: string;
}

export const URGENCY_OPTIONS: UrgencyOption[] = [
  { id: 'URGENT', label: 'Très urgent', sublabel: 'Dès que possible, situation bloquante', badge: 'Urgent' },
  { id: 'TODAY', label: "Aujourd'hui", sublabel: 'Dans la journée', badge: "Aujourd'hui" },
  { id: 'FEW_DAYS', label: "D'ici 2 à 3 jours", sublabel: 'Dans les prochains jours', badge: '2-3 jours' },
  { id: 'FLEXIBLE', label: 'Flexible', sublabel: "Pas d'urgence particulière", badge: 'Flexible' },
];

export const getUrgencyOption = (id: string): UrgencyOption =>
  URGENCY_OPTIONS.find((u) => u.id === id) ?? URGENCY_OPTIONS[1];

export const leadFormSchema = z.object({
  track: z.enum(['RAPIDE', 'TRAVAUX']).default('RAPIDE'),
  clientType: z.enum(CLIENT_TYPE_IDS).default('particulier'),
  need: z
    .string({ message: 'Décrivez votre problème ou besoin.' })
    .trim()
    .min(5, 'Décrivez votre besoin en au moins 5 caractères.')
    .max(2000, '2 000 caractères maximum.'),
  dontKnowPro: z.boolean().default(true),
  serviceId: z.string().optional().default(''),
  urgency: z.enum(['URGENT', 'TODAY', 'FEW_DAYS', 'FLEXIBLE']).default('TODAY'),
  dimensions: z.string().trim().max(160, '160 caractères maximum.').optional().default(''),
  landmark: z.string().trim().max(160, '160 caractères maximum.').optional().default(''),
  photosCount: z.number().int().min(0).default(0),
  photoNames: z.array(z.string()).default([]),
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
  if (!values.phone || values.phone.trim().length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['phone'],
      message: 'Renseignez un numéro WhatsApp ou téléphone pour que nous puissions vous recontacter.',
    });
  } else if (!normalizePhoneE164(values.phone)) {
    ctx.addIssue({
      code: 'custom',
      path: ['phone'],
      message: 'Numéro invalide. Format attendu : 6 XX XX XX XX ou +237 6 XX XX XX XX.',
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
  need: z.string().trim().min(5).max(3000),
  serviceId: z.string().max(60).optional(),
  serviceName: z.string().max(160).optional(),
  cityName: z.string().trim().min(2).max(80).default('Ngaoundéré'),
  zoneName: z.string().trim().min(2).max(160),
  deadline: z.string().trim().max(120).optional(),
  budgetMin: z.number().int().min(0).nullish(),
  budgetMax: z.number().int().min(0).nullish(),
  name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(32).optional(),
  clientType: z.enum(CLIENT_TYPE_IDS).optional(),
  context: z.object({
    campaign: z.string().max(80).nullish(),
    referrer: z.string().max(120).nullish(),
    landing: z.string().max(200).nullish(),
    device: z.enum(['mobile', 'desktop']).nullish(),
  }).optional(),
});

export type LeadPayload = z.input<typeof leadPayloadSchema>;

/** Construit une synthèse claire et exploitable du problème pour le backend et l'admin. */
export function buildStructuredNeedText(values: LeadFormValues, serviceName?: string): string {
  const parts: string[] = [];
  const trackLabel = values.track === 'TRAVAUX' ? 'Projet / Travaux' : 'Intervention rapide';
  const urgencyLabel = getUrgencyOption(values.urgency).label;

  parts.push(`[${trackLabel} · Urgence : ${urgencyLabel}]`);
  parts.push(`Problème : ${values.need.trim()}`);

  if (serviceName) {
    parts.push(`Service pressenti : ${serviceName}`);
  }
  if (values.dontKnowPro) {
    parts.push('Professionnel : Sélection confiée à Fika (le client ne sait pas quel métier choisir)');
  }
  if (values.dimensions && values.dimensions.trim()) {
    parts.push(`Dimensions / Quantité : ${values.dimensions.trim()}`);
  }
  if (values.landmark && values.landmark.trim()) {
    parts.push(`Repère : ${values.landmark.trim()}`);
  }
  if (values.photosCount > 0) {
    parts.push(`Photos : ${values.photosCount} photo(s) transmise(s)${values.photoNames.length ? ` (${values.photoNames.join(', ')})` : ''}`);
  }

  return parts.join('\n');
}

/** traduit les valeurs du formulaire en payload API (téléphone normalisé). */
export function toLeadPayload(values: LeadFormValues, serviceName?: string, context?: LeadContext | null): LeadPayload {
  const budget = getBudgetRange(values.budgetRange);
  const fullZone = values.zone === OTHER_ZONE_VALUE ? values.zoneOther.trim() : values.zone;
  const zoneWithLandmark = values.landmark.trim() ? `${fullZone} (Repère : ${values.landmark.trim()})` : fullZone;

  // Calcul du délai pour le champ deadline de la base
  let effectiveDeadline = values.deadline?.trim() || undefined;
  if (!effectiveDeadline && values.track === 'RAPIDE') {
    effectiveDeadline = getUrgencyOption(values.urgency).label;
  }

  const structuredDescription = buildStructuredNeedText(values, serviceName);

  return {
    need: structuredDescription,
    serviceId: values.serviceId || undefined,
    serviceName,
    cityName: getCityBySlug(values.citySlug)?.name ?? 'Ngaoundéré',
    zoneName: zoneWithLandmark.slice(0, 160),
    deadline: effectiveDeadline,
    budgetMin: budget.min ?? undefined,
    budgetMax: budget.max ?? undefined,
    name: values.name || undefined,
    phone: values.phone ? normalizePhoneE164(values.phone) ?? undefined : undefined,
    clientType: values.clientType,
    context: context ?? undefined,
  };
}
