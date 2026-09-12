/// <reference types="vite/client" />

import { DEFAULT_CITY_SLUG, getActiveCities as getCities, getCityBySlug } from './city';

/**
 * Configuration unique du site Fika.
 * Source de vérité pour le domaine, la ville, la promesse livraison et le
 * numéro WhatsApp. Ne jamais dupliquer ces valeurs ailleurs dans le code.
 */

export const SITE_NAME = 'Fika';

// TODO_PROD : domaine de production retenu par défaut, à confirmer par le fondateur.
export const SITE_DOMAIN = 'fika.cm';
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const SITE_CITY = 'Ngaoundéré';
export const SITE_DESCRIPTION =
  'Des services numériques, techniques et pratiques, réunis au même endroit à Ngaoundéré. Vous faites votre demande, nous trouvons la solution.';

/**
 * Promesse réelle et opposable (invariant métier #2) :
 * le client ne paie jamais de livraison à Ngaoundéré.
 * Formulation LITTÉRALE liée à Ngaoundéré : si une autre ville est activée
 * avec une règle différente, utilisez getDeliveryPromise(slug) — jamais cette
 * constante seule (pas de promesse générale fausse).
 */
export const DELIVERY_PROMISE = 'Livraison gratuite dans toute la ville de Ngaoundéré';

/* --------------------------- Paramétrage ville (P11) ------------------------ */

/** Ville par défaut (et aujourd'hui la seule opérée). */
export const DEFAULT_CITY = { slug: DEFAULT_CITY_SLUG, name: SITE_CITY } as const;

/** Villes réellement opérées — le seul endroit lu par les formulaires/fiches. */
export function getActiveCities() {
  return getCities();
}

/**
 * Promesse EXACTE par ville. Ngaoundéré → littérale et inconditionnelle ;
 * toute autre ville sans règle « gratuite dans toute la ville » reçoit une
 * formulation neutre et honnête (jamais la promesse Ngaoundéré).
 */
export function getDeliveryPromise(citySlug: string = DEFAULT_CITY_SLUG): string {
  const city = getCityBySlug(citySlug);
  if (city?.deliveryFreeCityWide) return DELIVERY_PROMISE;
  return 'Livraison organisée avec Fika';
}

/**
 * Numéro WhatsApp de production, format E.164 (+237 686382354).
 * VALIDÉ par le fondateur (2026-01-08). Une variable d'env VITE_WA_PHONE /
 * NEXT_PUBLIC_WA_PHONE peut le surcharger sans toucher au code.
 */
const envPhone = import.meta.env.VITE_WA_PHONE as string | undefined;

function isValidE164(phone: string): boolean {
  return /^\+2376\d{8}$/.test(phone);
}

export const WHATSAPP_PHONE_E164: string =
  envPhone && isValidE164(envPhone) ? envPhone : '+237686382354';

/** wa.me exige le numéro sans le préfixe « + ». */
export const WA_PHONE_DIGITS: string = WHATSAPP_PHONE_E164.replace(/^\+/, '');
