import type { Category, Package, Service } from './types';
import { UNIVERSES, SERVICES, UNIVERSE_PACKAGES, POPULAR_ORDER } from './catalog-data';

/**
 * lib/catalog — couche d'accès au catalogue (DTO typés).
 *
 * Contrat stable pour toutes les pages : dans l'app Next.js (P03), ces
 * fonctions deviennent des requêtes Prisma exécutées en Server Components,
 * avec les MÊMES signatures et le MÊME tri (displayOrder, puis slug).
 * Elles lisent ici le dataset canonique partagé avec prisma/seed-catalog.ts.
 */

const byDisplayOrder = (a: Service, b: Service): number =>
  a.displayOrder - b.displayOrder || a.slug.localeCompare(b.slug);

/** Tous les univers (catégories), triés dans l'ordre de présentation. */
export function getCategories(): Category[] {
  return UNIVERSES;
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return UNIVERSES.find((u) => u.slug === slug);
}

export function getServices(options: { categoryId?: string; activeOnly?: boolean } = {}): Service[] {
  const { categoryId, activeOnly = true } = options;
  return SERVICES
    .filter((s) => (!activeOnly || s.active) && (!categoryId || s.categoryId === categoryId))
    .sort(byDisplayOrder);
}

export function getServiceBySlug(slug: string): Service | undefined {
  return SERVICES.find((s) => s.slug === slug && s.active);
}

/** Vedettes d'un univers : featured puis popular, dédupliqué, ordre manuel. */
export function getFeaturedServices(categoryId: string): Service[] {
  const services = getServices({ categoryId });
  const featured = services.filter((s) => s.featured);
  const popular = services.filter((s) => s.popular);
  return [...new Set([...featured, ...popular])];
}

/** Les services « populaires » de la vitrine, dans l'ordre éditorial. */
export function getPopularServices(limit?: number): Service[] {
  const resolved = POPULAR_ORDER
    .map((slug) => getServiceBySlug(slug))
    .filter((s): s is Service => Boolean(s));
  return typeof limit === 'number' ? resolved.slice(0, limit) : resolved;
}

export function getPackages(options: { categoryId?: string; activeOnly?: boolean } = {}): Package[] {
  const { categoryId, activeOnly = true } = options;
  return UNIVERSE_PACKAGES.filter(
    (p) => (!activeOnly || p.active) && (!categoryId || p.categoryId === categoryId),
  );
}

/** Nombre de services actifs par univers (badges catalogue). */
export function getServiceCountByCategory(categoryId: string): number {
  return getServices({ categoryId }).length;
}

/** Équivalent generateStaticParams (Next) : toutes les routes résolubles. */
export function getStaticParams(): { services: string[]; univers: string[] } {
  return {
    services: getServices().map((s) => s.slug),
    univers: getCategories().map((u) => u.slug),
  };
}

/** Résolution par id (composition des packs, liaisons PackageService). */
export function getServiceById(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

/* ---------------------------------------------------------------------------
 * EXTENSION MULTI-VILLE (P11) — documentée, non construite.
 *
 * Quand une 2ᵉ ville devient active (ACTIVE_CITIES avec active: true) :
 *  1. Ajouter ses zones dans ZONE_GROUPS_BY_CITY (lib/city.ts) et ses lignes
 *     ServiceCityPrice (seed + CITY_PRICES) — SANS elles, l'UI affiche
 *     « Sur devis » et flagge needsCityPricing() côté admin.
 *  2. Le formulaire /demande re-affiche automatiquement le sélecteur de ville
 *     (masqué tant qu'une seule ville est active).
 *  3. Sélecteur de ville dans le Header : lire getActiveCities(), persister
 *     en URL.
 *  4. URLs prévues : /ville/[citySlug] arborant hero particulier + catalogue
 *     filtré par prix ville. Point d'ancrage ici :
 *       export function getServicesForCity(citySlug) — variantes de
 *       displayPrice(service, getCityPricing(id, citySlug)) + promesse
 *       getDeliveryPromise(citySlug) exacte par ville (lib/site.ts).
 *  5. Ne JAMAIS indexer une ville sans contenu (SEO : une page ville n'existe
 *     que si au moins 1 service est tarifé dans cette ville).
 * ------------------------------------------------------------------------- */
