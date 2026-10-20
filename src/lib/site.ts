/// <reference types="vite/client" />

import { DEFAULT_CITY_SLUG, getActiveCities as getCities, getCityBySlug } from './city';

/**
 * Configuration unique du site Fika.
 * Source de vérité pour le domaine, la ville, la promesse livraison et le
 * numéro WhatsApp. Ne jamais dupliquer ces valeurs ailleurs dans le code.
 */

export const SITE_NAME = 'Fika';

// Domaine actuel (Vercel). Quand fika.cm sera acheté : changer ici + index.html + public/sitemap.xml + public/robots.txt.
export const SITE_DOMAIN = 'fika00.vercel.app';
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const SITE_CITY = 'Ngaoundéré';
export const SITE_DESCRIPTION =
  'Fika vous aide à résoudre vos besoins du quotidien en trouvant et en coordonnant le bon professionnel à Ngaoundéré. Vous avez un besoin, nous nous occupons du reste.';

/**
 * Promesse logistique réelle et opposable :
 *  - interventions / travaux / transport : le déplacement du professionnel est
 *    organisé par Fika et intégré au devis validé par le client (jamais « gratuit ») ;
 *  - petites commandes numériques (documents) : livraison incluse à Ngaoundéré.
 * Le libellé par service est calculé par lib/pricing.travelLabel().
 */
export const DELIVERY_PROMISE = 'Déplacement organisé par Fika, intégré au devis · Ngaoundéré';
export const DISPLACEMENT_PROMISE = 'Déplacement organisé par Fika';
export const DOCUMENT_DELIVERY_PROMISE = 'Livraison incluse pour vos documents à Ngaoundéré';

/* --------------------------- Paramétrage ville (P11) ------------------------ */

/** Ville par défaut (et aujourd'hui la seule opérée). */
export const DEFAULT_CITY = { slug: DEFAULT_CITY_SLUG, name: SITE_CITY } as const;

/** Villes réellement opérées — le seul endroit lu par les formulaires/fiches. */
export function getActiveCities() {
  return getCities();
}

/**
 * Promesse EXACTE par ville.
 */
export function getDeliveryPromise(citySlug: string = DEFAULT_CITY_SLUG): string {
  const city = getCityBySlug(citySlug);
  if (city?.active) return DELIVERY_PROMISE;
  return 'Déplacement et logistique organisés par Fika';
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
