import type { PriceType } from './types';
import { WA_PHONE_DIGITS } from './site';

/**
 * Configuration WhatsApp — façade unique.
 * Le numéro provient exclusivement de lib/site.ts (variable d'env).
 * La GÉNÉRATION de messages vit dans lib/whatsapp/engine.ts (P04) ;
 * ce module ne gère que le lien wa.me et le libellé des CTA.
 */

export const getWALink = (message: string): string => {
  return `https://wa.me/${WA_PHONE_DIGITS}?text=${encodeURIComponent(message)}`;
};

/** Libellé du CTA selon le type de tarification. */
export const getServiceCTA = (priceType: PriceType): string => {
  switch (priceType) {
    case 'QUOTE':
    case 'PROJECT':
      return 'Demander un devis';
    case 'DIAGNOSTIC':
      return 'Demander un diagnostic';
    default:
      return 'Commander en 1 message';
  }
};
