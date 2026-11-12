import { z } from 'zod';

/**
 * Collecte des demandes — schémas zod partagés client/serveur.
 * Le formulaire public est volontairement minimal (besoin, quartier, téléphone) ;
 * la qualification fine (service, motif de perte, notes) se fait dans
 * l'administration, jamais en demandant plus au client.
 */

/* ------------------------------ Téléphone --------------------------------- */

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

export type UrgencyLevel = 'URGENT' | 'TODAY' | 'FEW_DAYS' | 'FLEXIBLE';

export interface UrgencyOption {
  id: UrgencyLevel;
  label: string;
}

export const URGENCY_OPTIONS: UrgencyOption[] = [
  { id: 'URGENT', label: 'Très urgent' },
  { id: 'TODAY', label: "Aujourd'hui" },
  { id: 'FEW_DAYS', label: "D'ici 2 à 3 jours" },
  { id: 'FLEXIBLE', label: 'Flexible' },
];

/* --------------------------- Payload serveur ------------------------------ */

export const leadPayloadSchema = z.object({
  need: z.string().trim().min(5).max(3000),
  /** Clé d'idempotence : un double-clic ne crée jamais deux demandes. */
  requestKey: z.string().uuid().optional(),
  serviceId: z.string().max(60).optional(),
  serviceName: z.string().max(160).optional(),
  cityName: z.string().trim().min(2).max(80).default('Ngaoundéré'),
  zoneName: z.string().trim().min(2).max(160),
  deadline: z.string().trim().max(120).optional(),
  urgency: z.enum(['URGENT', 'TODAY', 'FEW_DAYS', 'FLEXIBLE']).default('FLEXIBLE'),
  budgetMin: z.number().int().min(0).nullish(),
  budgetMax: z.number().int().min(0).nullish(),
  name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(32).optional(),
  clientType: z.enum(CLIENT_TYPE_IDS).optional(),
  /** Le consentement au recontact est obligatoire côté serveur aussi. */
  consent: z.literal(true),
  /** Fichiers déjà téléversés (POST /api/files/service-request), rattachés à la demande. */
  fileIds: z.array(z.string().min(10).max(60)).max(3).optional(),
  /**
   * Parcours produit (/demande-produit) : la demande reste un Lead (l'équipe
   * coordonne), marquée intention produit pour être traitée comme telle.
   */
  intent: z.enum(['SERVICE', 'PRODUCT']).optional(),
  productName: z.string().trim().min(2).max(160).optional(),
  productLink: z.string().trim().max(300).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  context: z.object({
    campaign: z.string().max(80).nullish(),
    referrer: z.string().max(120).nullish(),
    landing: z.string().max(200).nullish(),
    device: z.enum(['mobile', 'desktop']).nullish(),
  }).optional(),
});

export type LeadPayload = z.input<typeof leadPayloadSchema>;
