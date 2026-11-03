import { formatPriceFCFA } from '../pricing';
import { SITE_CITY, SITE_URL } from '../site';

/**
 * Moteur de messages WhatsApp — uniquement les messages réellement envoyés :
 * devis client, annonce du professionnel, confirmation de commande (conformité).
 * Les messages « catalogue » avec questions sans réponses ont été retirés :
 * la description du besoin passe par le formulaire /demande.
 */

export type WaContext =
  | 'service-page' | 'home-hero' | 'home-final' | 'home-pricing'
  | 'univers-cta' | 'services-page' | 'demande' | 'header';

/* ------------------------ Devis envoyé au client ------------------------- */

export interface QuoteMessageParams {
  orderNumber: string;
  quoteNumber: string;
  serviceName: string;
  /** Prix final client (coûts + marge), le seul montant communiqué. */
  clientPrice: number;
  /** true si le déplacement / la livraison est compris dans ce prix (toujours le cas d'un devis construit). */
  travelIncluded?: boolean;
  /** Précisions destinées au client (jamais la décomposition interne). */
  clientNotes?: string | null;
  validUntil?: string | null;
  city?: string;
}

/**
 * Message WhatsApp du devis : le client voit le prix final et ce qu'il couvre.
 * La décomposition (coût professionnel, marge Fika) reste dans l'administration.
 */
export function compileQuoteMessage(p: QuoteMessageParams): string {
  const lines: string[] = [
    `Bonjour 👋, voici le devis Fika pour votre demande ${p.orderNumber} :`,
    '',
    `• Prestation : ${p.serviceName}`,
    `• Prix total : ${formatPriceFCFA(p.clientPrice)} (TTC, francs CFA)`,
    p.travelIncluded === false
      ? `• Déplacement : organisé par Fika, précisé ci-dessous (${p.city ?? SITE_CITY})`
      : `• Déplacement / livraison et matériel prévus : compris dans ce prix (${p.city ?? SITE_CITY})`,
  ];
  const notes = p.clientNotes?.trim();
  if (notes) lines.push('', `Précisions : ${notes}`);
  if (p.validUntil) lines.push('', `Devis valable jusqu'au ${p.validUntil}.`);
  lines.push(
    '',
    'Rien n\'est engagé sans votre accord : répondez « OK » pour confirmer,',
    'ou posez-nous vos questions ici.',
    '',
    `Réf : ${p.quoteNumber} · ${p.orderNumber} · Fika`,
  );
  return lines.join('\n');
}

/* ------------------ Professionnel affecté (annonce au client) --------------- */

export interface ExpertAssignedMessageParams {
  orderNumber: string;
  serviceName: string;
  /** Prénom ou nom d'usage du professionnel (jamais son téléphone : le client passe par Fika). */
  expertFirstName: string;
  trade?: string | null;
  /** Signaux issus de publicTrustSignals() — seule source autorisée. */
  trustSignals: string[];
  scheduledLabel?: string | null;
}

/**
 * Annonce au client du professionnel missionné : uniquement des faits
 * (niveau atteint, interventions réellement terminées, zone). Aucun « vérifié »
 * qui ne viendrait pas de src/lib/trust.ts.
 */
export function compileExpertAssignedMessage(p: ExpertAssignedMessageParams): string {
  const who = p.trade ? `${p.expertFirstName}, ${p.trade.toLowerCase()}` : p.expertFirstName;
  const lines: string[] = [
    `Bonjour 👋, votre demande ${p.orderNumber} (${p.serviceName}) est confiée à ${who}, membre du réseau Fika.`,
  ];
  if (p.trustSignals.length) {
    lines.push('', 'Ce que nous pouvons vous dire de ce professionnel :', ...p.trustSignals.map((s) => `• ${s}`));
  } else {
    lines.push('', 'Ce professionnel rejoint le réseau Fika : Fika suit l\'intervention de bout en bout et reste votre seul interlocuteur.');
  }
  if (p.scheduledLabel) lines.push('', `Intervention prévue : ${p.scheduledLabel}.`);
  lines.push('', 'Fika coordonne, contrôle le résultat et reste joignable ici pour toute question.', '', `Réf : ${p.orderNumber} · Fika`);
  return lines.join('\n');
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
 * Rappel du prix (déplacement inclus), du délai, acceptation des CGV
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
    `• Déplacement / livraison : organisés par Fika, inclus dans le prix ci-dessus (${p.city ?? SITE_CITY})`,
    '',
    'En confirmant par « OK », vous acceptez nos Conditions Générales de Vente :',
    `${SITE_URL}/#/cgv`,
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
