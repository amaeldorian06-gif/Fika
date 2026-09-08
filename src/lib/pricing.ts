import type { CityPricing, Package, Service } from './types';
import { CITY_PRICES, DEFAULT_CITY_SLUG, getServiceRef } from './catalog-data';

/**
 * lib/pricing — SEULE source de vérité des prix, coûts et marges.
 * Fonctions pures, sans état. Montants entiers en FCFA.
 */

/* ------------------------------ Formatage --------------------------------- */

/** 12500 → « 12 500 F » (fr-FR, Int FCFA, pas de centimes). */
export function formatPriceFCFA(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} F`;
}

/**
 * Libellé d'affichage d'un service selon son priceType, avec surcharge ville
 * éventuelle (priceMin/priceMax de ServiceCityPrice, repli sur le service).
 * UNIQUE point de formatage des prix côté UI.
 */
export function displayPrice(
  service: Pick<Service, 'priceType' | 'startingPrice' | 'priceMin' | 'priceMax'>,
  cityPricing?: CityPricing | null,
): string {
  const min = cityPricing?.priceMin ?? service.priceMin ?? service.startingPrice ?? null;
  const max = cityPricing?.priceMax ?? service.priceMax ?? null;

  switch (service.priceType) {
    case 'FIXED':
      return min ? formatPriceFCFA(min) : 'Sur devis';
    case 'FROM':
      return min ? `À partir de ${formatPriceFCFA(min)}` : 'Sur devis';
    case 'PER_UNIT':
      return min ? `${formatPriceFCFA(min)} / unité` : 'Sur devis';
    case 'DIAGNOSTIC':
      return min ? `Diagnostic à partir de ${formatPriceFCFA(min)}` : 'Diagnostic sur devis';
    case 'QUOTE':
    case 'PROJECT':
      if (min && max) return `Entre ${formatPriceFCFA(min)} et ${formatPriceFCFA(max)}`;
      return 'Sur devis';
    default:
      return 'Sur devis';
  }
}

/* ---------------------------- Pricing par ville ---------------------------- */

/**
 * Lit la surcharge ServiceCityPrice d'un service pour une ville donnée
 * (défaut : Ngaoundéré, invariant inchangé).
 * Règle multi-ville : pour une ville AUTRE que la ville par défaut, l'absence
 * de lignes de prix ne doit JAMAIS retomber silencieusement sur le prix de
 * Ngaoundéré → priceMin/Max = null + missingPrices = true (l'UI affiche
 * « Sur devis » et l'admin est alerté).
 */
export function getCityPricing(serviceId: string, citySlug: string = DEFAULT_CITY_SLUG): CityPricing {
  const row = CITY_PRICES.find((c) => c.serviceId === serviceId && c.citySlug === citySlug);
  const service = getServiceRef(serviceId);

  if (row) return { ...row, missingPrices: false };

  if (citySlug !== DEFAULT_CITY_SLUG) {
    return {
      serviceId,
      citySlug,
      priceMin: null,
      priceMax: null,
      targetMarginPercent: null,
      deliveryIncluded: false, // inconnu → l'UI ne promet pas la gratuité
      missingPrices: true,
    };
  }

  return {
    serviceId,
    citySlug,
    priceMin: service?.startingPrice ?? null,
    priceMax: service?.priceMax ?? null,
    targetMarginPercent: null,
    deliveryIncluded: true, // Ngaoundéré : gratuité client par défaut (invariant)
    missingPrices: false,
  };
}

/** Vrai quand un service affiché à l'UI n'a pas de tarif pour la ville donnée. */
export function needsCityPricing(serviceId: string, citySlug: string): boolean {
  return getCityPricing(serviceId, citySlug).missingPrices === true;
}

/* ------------------------------- Marges ----------------------------------- */

export interface CostLine {
  amount: number;
}

export interface MarginResult {
  /** Marge brute en FCFA (peut être négative). */
  marginAmount: number;
  /** Marge brute en % du prix client (0 si total nul). */
  marginPercent: number;
}

/** Marge = prix client − Σ coûts internes (EXPERT/MATERIAL/DELIVERY/OTHER). */
export function computeMargin(customerTotal: number, costs: CostLine[]): MarginResult {
  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
  const marginAmount = customerTotal - totalCosts;
  const marginPercent = customerTotal > 0 ? (marginAmount / customerTotal) * 100 : 0;
  return { marginAmount, marginPercent };
}

/** Compare une marge réalisée (%) à la marge cible (%) : écart en points. */
export function compareMarginToTarget(
  actualMarginPercent: number,
  targetMarginPercent: number,
): { ok: boolean; deltaPoints: number } {
  const deltaPoints = actualMarginPercent - targetMarginPercent;
  return { ok: deltaPoints >= 0, deltaPoints };
}

/* ----------------------------- Cohérence packs ----------------------------- */

/** Total « à la carte » des lignes d'un pack (prix de base des services × quantités). */
export function computePackageDetailTotal(pkg: Pick<Package, 'services'>): number {
  return pkg.services.reduce((sum, line) => {
    const service = getServiceRef(line.serviceId);
    return sum + (service?.startingPrice ?? 0) * line.quantity;
  }, 0);
}

/** Remise réelle d'un pack (0 si le pack n'offre pas d'avantage). */
export function computePackageSavings(pkg: Pick<Package, 'services' | 'price'>): number {
  return Math.max(0, computePackageDetailTotal(pkg) - pkg.price);
}

export interface ConsistencyIssue {
  code: 'MIN_ABOVE_MAX' | 'PACK_NOT_CHEAPER';
  message: string;
}

/**
 * Vérifie la cohérence tarifaire d'un service (min ≤ max) ou d'un pack
 * (prix du pack strictement inférieur à la somme des prix détail).
 */
export function validatePriceConsistency(
  item: Pick<Service, 'name' | 'priceMin' | 'priceMax' | 'startingPrice'> | Package,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  if ('price' in item && 'services' in item) {
    // Pack
    const detail = computePackageDetailTotal(item);
    if (detail > 0 && item.price >= detail) {
      issues.push({
        code: 'PACK_NOT_CHEAPER',
        message: `Pack « ${item.title} » (${item.price} F) ≥ somme détail (${detail} F).`,
      });
    }
    return issues;
  }

  const min = item.priceMin ?? item.startingPrice ?? null;
  if (min != null && item.priceMax != null && min > item.priceMax) {
    issues.push({
      code: 'MIN_ABOVE_MAX',
      message: `Service « ${item.name} » : priceMin (${min} F) > priceMax (${item.priceMax} F).`,
    });
  }
  return issues;
}
