import type { CityPricing, Service, ServiceRequirement } from '../types';
import { displayPrice, formatPriceFCFA, getCityPricing } from '../pricing';
import { SITE_CITY } from '../site';

/**
 * Moteur de messages WhatsApp (P04) — types stricts, aucun `any`.
 * Génère un message prérempli intelligent par service : intro adaptée au
 * priceType, champs à compléter (ServiceRequirement), contexte d'attribution.
 */

export type WaContext =
  | 'service-page' | 'home-hero' | 'home-final' | 'home-pack' | 'home-pricing'
  | 'univers-cta' | 'univers-pack' | 'services-page' | 'search' | 'demande' | 'header';

export interface CompileOptions {
  /** Ville du client (défaut : Ngaoundéré, invariant). */
  city?: string;
  /** Quartier du client, si connu. */
  zone?: string;
  /** Réponses pré-remplies (label -> valeur) si déjà collectées. */
  fields?: Record<string, string>;
  /** Campagne d'attribution (ex. slug du pack). */
  campaign?: string | null;
  /** Contexte d'émission du clic (analytics P08). */
  context?: WaContext;
}

/* ------------------------------- Utilitaires ------------------------------- */

/** Nettoie une valeur injectée dans un message (pas d'injection de variables). */
function sanitize(value: string): string {
  return value.replace(/\{\{|\}\}/g, '').replace(/\r\n?/g, '\n').trim();
}

/** Référence d'attribution compacte, ajoutée en pied de message. */
function buildRef(service: Service | null, opts: CompileOptions): string {
  const base = service ? `fika:${service.slug}` : 'fika:hors-catalogue';
  const parts = [base];
  if (opts.context) parts.push(opts.context);
  if (opts.campaign) parts.push(opts.campaign);
  return parts.join(' · ');
}

const VAR_RE = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;

/**
 * Rendu de gabarit : remplacement GLOBAL de toutes les occurrences des
 * variables connues ; variables inconnues simplement effacées (jamais jetées).
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(VAR_RE, (_match, key: string) => vars[key] ?? '')
    .replace(/[ \t]+\n/g, '\n') // lignes vides laissées par des variables absentes
    .replace(/ {2,}/g, ' ') // espaces multiples laissés par des variables vides
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** « • Label : » (ou « • Label : valeur ») pour les champs à compléter. */
export function requirementsToQuestions(
  requirements: ServiceRequirement[],
  values?: Record<string, string>,
): string {
  if (!requirements.length) return '• Mon besoin :';
  return [...requirements]
    .sort((a, b) => a.position - b.position)
    .map((r) => {
      const value = values?.[r.label]?.trim();
      return `• ${r.label} :${value ? ` ${value}` : ''}`;
    })
    .join('\n');
}

/** Intro standard de commande, cohérente avec la charte existante. */
export function buildOrderIntro(service: Service, cityPricing?: CityPricing | null): string {
  return `Bonjour Fika 👋\n\nJe souhaite commander le service : ${service.name} (${displayPrice(service, cityPricing)}).`;
}

/** Gabarits de secours par priceType quand whatsappTemplate est vide. */
function autoTemplate(service: Service): string {
  switch (service.priceType) {
    case 'DIAGNOSTIC':
      return 'Bonjour Fika 👋\n\nJe souhaite un diagnostic pour : {{service}} ({{price}}).\n\nInformations :\n{{fields}}\n\nVille : {{city}}\nQuartier : {{zone}}\n\nMerci de me confirmer la prise en charge.';
    case 'QUOTE':
    case 'PROJECT':
      return 'Bonjour Fika 👋\n\nJe souhaite un devis pour : {{service}}.\n\n{{fields}}\n\nVille : {{city}}\nQuartier : {{zone}}\nDélai souhaité :\n\nMerci de me préciser le budget estimé.';
    default:
      return 'Bonjour Fika 👋\n\nJe souhaite commander le service : {{service}} ({{price}}).\n\nPour traiter ma demande :\n{{fields}}\n\nVille : {{city}}\nQuartier : {{zone}}\n\nMerci de me confirmer prix et délai.';
  }
}

/* ----------------------------- Point d'entrée ------------------------------ */

/**
 * Compile le message WhatsApp d'un service : template DB (whatsappTemplate)
 * si renseigné, sinon génération automatique par priceType.
 * Variables : {{service}} {{price}} {{priceFrom}} {{city}} {{zone}} {{delai}}
 * {{fields}} {{campaign}} {{ref}}.
 */
export function compileMessage(service: Service, opts: CompileOptions = {}): string {
  const cityPricing = getCityPricing(service.id);
  const priceMin = cityPricing.priceMin ?? service.startingPrice ?? null;

  const vars: Record<string, string> = {
    service: sanitize(service.name),
    price: displayPrice(service, cityPricing),
    priceFrom: priceMin != null ? formatPriceFCFA(priceMin) : '',
    city: sanitize(opts.city ?? SITE_CITY),
    zone: opts.zone ? sanitize(opts.zone) : '',
    delai: sanitize(service.estimatedDuration ?? ''),
    fields: requirementsToQuestions(service.requirements, opts.fields),
    campaign: opts.campaign ? sanitize(opts.campaign) : '',
    ref: buildRef(service, opts),
  };

  const template = service.whatsappTemplate?.trim() || autoTemplate(service);
  return `${renderTemplate(template, vars)}\n\n—\nRéf : ${vars.ref}`;
}

/* --------- Besoin hors catalogue (recherche, page demande) --------- */

export interface CustomNeedOptions extends CompileOptions {
  need: string;
  deadline?: string;
}

/** Message « besoin introuvable » — même moteur, contexte search/demande. */
export function compileCustomNeedMessage(opts: CustomNeedOptions): string {
  const lines = [
    'Bonjour Fika 👋',
    '',
    'Je ne trouve pas mon service dans le catalogue. Voici mon besoin :',
    `- Description : ${sanitize(opts.need)}`,
    `- Ville : ${sanitize(opts.city ?? SITE_CITY)}`,
    opts.zone ? `- Quartier : ${sanitize(opts.zone)}` : null,
    opts.deadline ? `- Délai souhaité : ${sanitize(opts.deadline)}` : null,
  ].filter((l): l is string => l !== null);

  return `${lines.join('\n')}\n\n—\nRéf : ${buildRef(null, opts)}`;
}

/** Message de recherche rapide (barre « Que souhaitez-vous faire ? »). */
export function compileSearchMessage(query: string, opts: CompileOptions = {}): string {
  const ref = buildRef(null, { ...opts, context: 'search' });
  return [
    'Bonjour Fika 👋',
    '',
    `Je cherche : ${sanitize(query)}`,
    '',
    "Pouvez-vous m'indiquer si vous pouvez m'aider ?",
    '',
    `—\nRéf : ${ref}`,
  ].join('\n');
}

/* --------- Confirmation de commande (conformité — loi 2010/021) ----------- */

export interface OrderConfirmationParams {
  orderNumber: string;
  serviceName: string;
  price: string;
  delay: string;
  city?: string;
  /** true si le client a demandé une exécution immédiate (renonciation). */
  immediateExecution?: boolean;
}

/**
 * Message de confirmation envoyé au client après validation de la commande.
 * Rappel du prix, du délai et de la livraison gratuite, acceptation des CGV
 * et — le cas échéant — renonciation expresse au droit de rétractation de
 * 15 jours (exécution immédiate demandée par le client).
 */
export function compileOrderConfirmation(p: OrderConfirmationParams): string {
  const lines: string[] = [
    `Bonjour 👋, confirmation de votre commande ${p.orderNumber} chez Fika :`,
    '',
    `• Prestation : ${p.serviceName}`,
    `• Prix convenu : ${p.price} (TTC, francs CFA)`,
    `• Délai estimé : ${p.delay}`,
    `• Livraison : gratuite dans toute la ville de ${p.city ?? SITE_CITY}`,
    '',
    'En confirmant par « OK », vous acceptez nos Conditions Générales de Vente :',
    'https://fika.cm/cgv',
  ];

  if (p.immediateExecution) {
    lines.push(
      '',
      'Vous avez demandé une exécution immédiate : vous renoncez donc expressément',
      'à votre droit de rétractation de 15 jours (loi n° 2010/021).',
    );
  }

  lines.push('', `Réf : ${p.orderNumber} · Fika`);
  return lines.join('\n');
}

export interface LeadMessageParams {
  need: string;
  city?: string;
  zone?: string;
  deadline?: string;
  serviceName?: string;
  budgetLabel?: string;
  name?: string;
  /** Code du lead enregistré (ex. LEAD-AB12CD) ; absent = repli non enregistré. */
  leadCode?: string | null;
}

/**
 * Message du tunnel /demande : récap complet. Avec leadCode → « demande site
 * enregistrée » + référence retrouvable en base ; sans → mention explicite
 * « non enregistrée » (repli hors-ligne).
 */
export function compileLeadMessage(p: LeadMessageParams): string {
  const lines: string[] = ['Bonjour Fika 👋,', ''];
  lines.push(
    p.leadCode
      ? 'Je viens de déposer une demande sur le site Fika (demande site enregistrée).'
      : 'Je souhaite faire une demande (demande site, non enregistrée).',
  );
  lines.push('', `- Besoin : ${sanitize(p.need)}`);
  if (p.serviceName) lines.push(`- Service concerné : ${sanitize(p.serviceName)}`);
  lines.push(`- Ville : ${sanitize(p.city ?? SITE_CITY)}${p.zone ? ` / Quartier : ${sanitize(p.zone)}` : ''}`);
  if (p.deadline) lines.push(`- Délai souhaité : ${sanitize(p.deadline)}`);
  if (p.budgetLabel) lines.push(`- Budget estimé : ${sanitize(p.budgetLabel)}`);
  if (p.name) lines.push(`- Nom : ${sanitize(p.name)}`);
  lines.push('', `Réf : ${p.leadCode ? `demande #${p.leadCode}` : 'fika:hors-catalogue · demande'}`);
  return lines.join('\n');
}
