import type { CityPricing, Package, Service } from './types';
import { CITY_PRICES, DEFAULT_CITY_SLUG, getServiceRef } from './catalog-data';

/**
 * lib/pricing — SEULE source de vérité des prix, coûts et marges.
 * Fonctions pures, sans état. Montants entiers en FCFA.
 */

/* ------------------------------ Formatage --------------------------------- */

/** 12500 → « 12 500 F » (fr-FR, Int FCFA, pas de centimes). */
export function formatPriceFCFA(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR').replace(/\s/g, ' ')} F`;
}

/* --------------------------- Mode de tarification -------------------------- */

/**
 * Trois familles de prix publics (modèle économique Fika) :
 *  - STANDARD     : service simple / standardisable (CV, impression, saisie…)
 *                   → prix fixe ou « à partir de » réellement pratiqué.
 *  - INTERVENTION : plomberie, électricité, réparation, dépannage
 *                   → « Devis selon le besoin » / « Diagnostic / intervention selon le problème ».
 *  - PROJECT      : travaux / projets (maçonnerie, peinture, carrelage, toiture, menuiserie)
 *                   → « Sur devis ».
 * Le prix final client = coût professionnel + déplacement + matériel/autres + marge Fika
 * (calculateQuotePricing) ; il n'est jamais inventé pour remplir une carte.
 */
export type PricingMode = 'STANDARD' | 'INTERVENTION' | 'PROJECT';

export function pricingMode(
  service: Pick<Service, 'priceType'> & { typeBesoin?: string },
): PricingMode {
  switch (service.priceType) {
    case 'FIXED':
    case 'FROM':
    case 'PER_UNIT':
      return 'STANDARD';
    case 'DIAGNOSTIC':
      return 'INTERVENTION';
    case 'QUOTE':
      return service.typeBesoin === 'Intervention' ? 'INTERVENTION' : 'PROJECT';
    case 'PROJECT':
    default:
      return 'PROJECT';
  }
}

/**
 * Libellé d'affichage d'un service selon son priceType, avec surcharge ville
 * éventuelle (priceMin/priceMax de ServiceCityPrice, repli sur le service).
 * UNIQUE point de formatage des prix côté UI (cartes, fiches, recherche,
 * WhatsApp, JSON-LD). Aucun montant n'est affiché s'il n'existe pas en donnée.
 */
export function displayPrice(
  service: Pick<Service, 'priceType' | 'startingPrice' | 'priceMin' | 'priceMax'> & { typeBesoin?: string },
  cityPricing?: CityPricing | null,
): string {
  if (cityPricing?.missingPrices) {
    return 'Sur devis';
  }

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
      // Intervention : frais de diagnostic affichés seulement s'ils existent vraiment.
      return min ? `Diagnostic à partir de ${formatPriceFCFA(min)}` : 'Diagnostic / intervention selon le problème';
    case 'QUOTE':
      if (service.typeBesoin === 'Intervention') return 'Devis selon le besoin';
      if (min && max) return `Entre ${formatPriceFCFA(min)} et ${formatPriceFCFA(max)}`;
      return 'Sur devis';
    case 'PROJECT':
      if (min && max) return `Entre ${formatPriceFCFA(min)} et ${formatPriceFCFA(max)}`;
      return 'Sur devis';
    default:
      return 'Sur devis';
  }
}

/** Phrase courte sous le prix : ce que le montant affiché signifie réellement. */
export function priceNote(service: Pick<Service, 'priceType'> & { typeBesoin?: string }): string {
  switch (pricingMode(service)) {
    case 'STANDARD':
      return 'Prix confirmé avant lancement. Aucune surprise.';
    case 'INTERVENTION':
      return 'Le prix est établi après diagnostic : coût du professionnel, déplacement et matériel éventuel, validé avec vous avant intervention.';
    case 'PROJECT':
    default:
      return 'Devis écrit après visite ou échange détaillé. Aucun démarrage sans votre accord.';
  }
}

/**
 * Promesse logistique cohérente avec le type de service : pas de « livraison
 * gratuite » pour une intervention technique.
 */
export function travelLabel(
  service: Pick<Service, 'priceType' | 'deliveryIncluded'> & { typeBesoin?: string },
): string {
  if (pricingMode(service) === 'STANDARD') {
    return service.deliveryIncluded ? 'Livraison incluse à Ngaoundéré' : 'Déplacement organisé par Fika';
  }
  return 'Déplacement organisé par Fika, intégré au devis';
}

/**
 * Libellé de prix d'une catégorie (carte univers) : « dès X F » uniquement si
 * un service standard affiche un vrai prix ; sinon la formule de la famille
 * dominante. Jamais de montant inventé.
 */
export function categoryPriceLabel(
  services: (Pick<Service, 'priceType' | 'startingPrice' | 'priceMin' | 'priceMax'> & { typeBesoin?: string })[],
): string {
  const standardPrices = services
    .filter((s) => pricingMode(s) === 'STANDARD')
    .map((s) => s.priceMin ?? s.startingPrice ?? null)
    .filter((p): p is number => p != null && p > 0);
  if (standardPrices.length) return `dès ${formatPriceFCFA(Math.min(...standardPrices))}`;
  const modes = services.map(pricingMode);
  if (modes.length && modes.every((m) => m === 'INTERVENTION')) return 'Devis selon le besoin';
  if (modes.some((m) => m === 'INTERVENTION')) return 'Diagnostic ou devis selon le besoin';
  return 'Sur devis';
}

/* -------------------- Calcul de devis & Modèle économique ----------------- */

export interface QuoteCalculationInput {
  /** Coût du professionnel (rémunération convenue). */
  expertCost: number;
  /** Déplacement / transport réellement supporté par Fika. */
  deliveryCost?: number;
  /** Matériel, pièces, consommables. */
  materialCost?: number;
  /** Autres coûts opérationnels. */
  otherCost?: number;
  /** Marge Fika en FCFA (prioritaire sur marginPercent). */
  marginAmount?: number;
  /** Marge Fika en % du prix client (ex. 15 pour les gros travaux). */
  marginPercent?: number;
  /** Prix client imposé (arrondi commercial) : la marge devient prix − coûts. */
  clientPriceOverride?: number;
}

export interface QuoteCalculationResult {
  expertCost: number;
  deliveryCost: number;
  materialCost: number;
  otherCost: number;
  totalOperatingCosts: number;
  marginAmount: number;
  marginPercent: number;
  clientFinalPrice: number;
}

/** Marge par défaut (% du prix client) quand rien n'est précisé. */
export const DEFAULT_QUOTE_MARGIN_PERCENT = 25;

const nonNegInt = (v: number | undefined | null) => Math.max(0, Math.round(Number(v) || 0));

/**
 * Formule économique Fika :
 * Coût professionnel + Déplacement + Matériel/autres + Marge Fika = Prix final client.
 * Fonction pure, entiers FCFA ; utilisée par le constructeur de devis (admin)
 * et par le serveur (même résultat des deux côtés).
 */
export function calculateQuotePricing(input: QuoteCalculationInput): QuoteCalculationResult {
  const expertCost = nonNegInt(input.expertCost);
  const deliveryCost = nonNegInt(input.deliveryCost);
  const materialCost = nonNegInt(input.materialCost);
  const otherCost = nonNegInt(input.otherCost);
  const totalOperatingCosts = expertCost + deliveryCost + materialCost + otherCost;

  let clientFinalPrice: number;
  if (input.clientPriceOverride != null && input.clientPriceOverride > 0) {
    clientFinalPrice = nonNegInt(input.clientPriceOverride);
  } else if (input.marginAmount != null && input.marginAmount >= 0 && input.marginPercent == null) {
    clientFinalPrice = totalOperatingCosts + nonNegInt(input.marginAmount);
  } else {
    const pct = Math.min(95, Math.max(0, input.marginPercent ?? DEFAULT_QUOTE_MARGIN_PERCENT));
    clientFinalPrice = pct > 0 ? Math.round(totalOperatingCosts / (1 - pct / 100)) : totalOperatingCosts;
  }

  const marginAmount = clientFinalPrice - totalOperatingCosts; // peut être négatif si prix imposé trop bas
  const marginPercent = clientFinalPrice > 0 ? (marginAmount / clientFinalPrice) * 100 : 0;

  return {
    expertCost,
    deliveryCost,
    materialCost,
    otherCost,
    totalOperatingCosts,
    marginAmount,
    marginPercent: Math.round(marginPercent * 10) / 10,
    clientFinalPrice,
  };
}

/** Séparateur entre les précisions destinées au client et la décomposition interne dans Quote.details. */
export const QUOTE_BREAKDOWN_MARKER = '--- Décomposition interne (ne pas transmettre au client) ---';

/** Partie de Quote.details destinée au client (tout ce qui précède la décomposition interne). */
export function quoteClientNotes(details: string | null | undefined): string {
  if (!details) return '';
  const idx = details.indexOf(QUOTE_BREAKDOWN_MARKER);
  return (idx >= 0 ? details.slice(0, idx) : details).trim();
}

/** Lignes lisibles du détail d'un devis (stockées dans Quote.details, visibles admin). */
export function describeQuoteBreakdown(r: QuoteCalculationResult): string {
  const lines = [
    QUOTE_BREAKDOWN_MARKER,
    `Coût professionnel : ${formatPriceFCFA(r.expertCost)}`,
    `Déplacement / transport : ${formatPriceFCFA(r.deliveryCost)}`,
    `Matériel / pièces : ${formatPriceFCFA(r.materialCost)}`,
    `Autres coûts : ${formatPriceFCFA(r.otherCost)}`,
    `Total coûts : ${formatPriceFCFA(r.totalOperatingCosts)}`,
    `Marge Fika : ${formatPriceFCFA(r.marginAmount)} (${r.marginPercent} %)`,
    `Prix client : ${formatPriceFCFA(r.clientFinalPrice)}`,
  ];
  return lines.join('\n');
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
      deliveryIncluded: false, // inconnu → aucune promesse logistique
      missingPrices: true,
    };
  }

  return {
    serviceId,
    citySlug,
    priceMin: service?.startingPrice ?? null,
    priceMax: service?.priceMax ?? null,
    targetMarginPercent: null,
    deliveryIncluded: service?.deliveryIncluded ?? false, // promesse portée par le service (documents), jamais par défaut
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
