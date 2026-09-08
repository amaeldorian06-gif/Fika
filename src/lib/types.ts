/**
 * Types DTO du front Fika — alignés sur prisma/schema.prisma (P03).
 * Les valeurs françaises (budget/delai/typeBesoin) sont produites par
 * lib/catalog.ts à partir des enums DB (FAIBLE → 'Faible', etc.).
 */

export type PriceType = 'FIXED' | 'FROM' | 'PER_UNIT' | 'QUOTE' | 'DIAGNOSTIC' | 'PROJECT';

export type BudgetLevel = 'Faible' | 'Moyen' | 'Élevé';
export type DelayLevel = 'Rapide' | 'Standard' | 'Long';
export type NeedType = 'Création' | 'Optimisation' | 'Consulting' | 'Production' | 'Support' | 'Intervention';

export type RequirementKind = 'TEXT' | 'FILE' | 'OPTION' | 'QUANTITY';

/** Champ à compléter par le client (ServiceRequirement en base). */
export interface ServiceRequirement {
  label: string;
  kind: RequirementKind;
  required: boolean;
  options?: string[];
  position: number;
}

/** Surcharge tarifaire ville (ServiceCityPrice), déjà fusionnée au service. */
export interface CityPricing {
  serviceId: string;
  citySlug: string;
  priceMin: number | null;
  priceMax: number | null;
  /** Marge brute cible en % (ex. 45), si définie. */
  targetMarginPercent: number | null;
  deliveryIncluded: boolean;
  /**
   * true = ville active SANS lignes ServiceCityPrice : l'UI affiche
   * « Sur devis » et l'admin est alerté — jamais de repli silencieux sur
   * le prix d'une autre ville (invariant tarification par ville).
   */
  missingPrices?: boolean;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  fullDescription?: string;
  priceType: PriceType;
  startingPrice?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  estimatedDuration?: string | null;
  deliveryIncluded: boolean;
  complexity?: string | null;
  requiredInformation?: string | null;
  /** Champs structurés à compléter (moteur WhatsApp P04). */
  requirements: ServiceRequirement[];
  howItWorks?: { title: string; description: string }[];
  faqs?: { q: string; a: string }[];
  /** Visuel local de marque (/fika/*.svg). Photos réelles : TODO_PROD. */
  image?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  displayOrder: number;
  includedItems: string[];
  excludedItems: string[];
  whatsappTemplate?: string | null;
  active: boolean;
  featured: boolean;
  popular: boolean;
  budget: BudgetLevel;
  delai: DelayLevel;
  typeBesoin: NeedType;
}

export interface Category {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  promise: string;
  icon?: string | null;
  examples?: string;
  featured: boolean;
  color: string;
}

/** Ligne de composition d'un pack (PackageService en base). */
export interface PackageLine {
  serviceId: string;
  quantity: number;
  customName?: string | null;
}

export interface Package {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  price: number;
  targetCustomer?: string | null;
  services: PackageLine[];
  whatsappTemplate?: string | null;
  active: boolean;
  categoryId?: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  serviceId?: string | null;
  description?: string | null;
  image: string;
  clientType?: string | null;
  date?: string | null;
  active: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  role?: string | null;
  city?: string | null;
  content: string;
  service?: string | null;
  verified: boolean;
  active: boolean;
}
