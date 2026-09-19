import { describe, expect, it } from 'vitest';
import {
  calculateQuotePricing,
  categoryPriceLabel,
  compareMarginToTarget,
  computeMargin,
  computePackageDetailTotal,
  computePackageSavings,
  displayPrice,
  formatPriceFCFA,
  getCityPricing,
  needsCityPricing,
  priceNote,
  pricingMode,
  quoteClientNotes,
  describeQuoteBreakdown,
  QUOTE_BREAKDOWN_MARKER,
  travelLabel,
  validatePriceConsistency,
} from './pricing';
import { SERVICES, UNIVERSE_PACKAGES, getServiceRef } from './catalog-data';
import type { Service } from './types';

/** Normalise les espaces insécables fr-FR (U+202F / U+00A0) pour les assertions. */
const flat = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatPriceFCFA', () => {
  it('formate un entier FCFA en fr-FR', () => {
    expect(flat(formatPriceFCFA(12500))).toBe('12 500 F');
    expect(flat(formatPriceFCFA(0))).toBe('0 F');
    expect(flat(formatPriceFCFA(7000))).toBe('7 000 F');
  });

  it('arrondit les montants (pas de centimes)', () => {
    expect(flat(formatPriceFCFA(12500.6))).toBe('12 501 F');
  });
});

describe('displayPrice', () => {
  const base: Pick<Service, 'priceType' | 'startingPrice' | 'priceMin' | 'priceMax'> = {
    priceType: 'FROM', startingPrice: 25000, priceMin: null, priceMax: null,
  };

  it('FROM → « À partir de X F »', () => {
    expect(flat(displayPrice({ ...base, priceType: 'FROM' }))).toBe('À partir de 25 000 F');
  });

  it('FIXED → « X F »', () => {
    expect(flat(displayPrice({ ...base, priceType: 'FIXED' }))).toBe('25 000 F');
  });

  it('PER_UNIT → « X F / unité »', () => {
    expect(flat(displayPrice({ ...base, priceType: 'PER_UNIT' }))).toBe('25 000 F / unité');
  });

  it('DIAGNOSTIC → « Diagnostic à partir de X F »', () => {
    expect(flat(displayPrice({ ...base, priceType: 'DIAGNOSTIC', startingPrice: 3000 })))
      .toBe('Diagnostic à partir de 3 000 F');
  });

  it('QUOTE/PROJECT → fourchette si min+max, sinon « Sur devis »', () => {
    expect(flat(displayPrice({ priceType: 'QUOTE', startingPrice: null, priceMin: 5000, priceMax: 50000 })))
      .toBe('Entre 5 000 F et 50 000 F');
    expect(displayPrice({ priceType: 'PROJECT', startingPrice: null, priceMin: null, priceMax: null }))
      .toBe('Sur devis');
  });

  it('la surcharge ville (priceMin) prime sur le prix de base', () => {
    const service = getServiceRef('s-num-1'); // CV : prix fixe réel 3 000 F
    expect(service).toBeDefined();
    expect(flat(displayPrice(service!, undefined))).toBe('3 000 F');
    expect(flat(displayPrice(service!, { ...getCityPricing('s-num-1'), priceMin: 3500 }))).toBe('3 500 F');
  });

  it('intervention sans tarif de diagnostic → aucun montant inventé', () => {
    expect(displayPrice({ priceType: 'DIAGNOSTIC', startingPrice: null, priceMin: null, priceMax: null }))
      .toBe('Diagnostic / intervention selon le problème');
    expect(displayPrice({ priceType: 'QUOTE', startingPrice: null, priceMin: null, priceMax: null, typeBesoin: 'Intervention' }))
      .toBe('Devis selon le besoin');
  });
});

describe('modèle économique — 3 familles de prix publics', () => {
  it('classe chaque service du catalogue dans une famille cohérente avec son affichage', () => {
    for (const s of SERVICES) {
      const mode = pricingMode(s);
      const label = displayPrice(s, getCityPricing(s.id));
      if (mode === 'STANDARD') expect(label).toMatch(/\d/); // un vrai montant
      if (mode === 'INTERVENTION') expect(label).toMatch(/^(Devis selon le besoin|Diagnostic)/);
      if (mode === 'PROJECT') expect(label).toBe('Sur devis');
    }
  });

  it('interventions et travaux : aucun startingPrice inventé', () => {
    for (const s of SERVICES.filter((x) => pricingMode(x) !== 'STANDARD')) {
      expect(s.startingPrice ?? null).toBeNull();
    }
  });

  it('services de lancement : plomberie/électricité au devis, maçonnerie/peinture/carrelage/toiture sur devis, CV à prix fixe', () => {
    expect(displayPrice(getServiceRef('s-mai-1')!)).toBe('Devis selon le besoin');
    expect(displayPrice(getServiceRef('s-mai-2')!)).toBe('Devis selon le besoin');
    for (const id of ['s-mai-3', 's-mai-4', 's-mai-7', 's-mai-8']) expect(displayPrice(getServiceRef(id)!)).toBe('Sur devis');
    expect(flat(displayPrice(getServiceRef('s-num-1')!))).toBe('3 000 F');
  });

  it('note de prix et promesse logistique selon la famille', () => {
    expect(priceNote(getServiceRef('s-num-1')!)).toMatch(/confirmé avant lancement/);
    expect(priceNote(getServiceRef('s-mai-1')!)).toMatch(/après diagnostic/);
    expect(priceNote(getServiceRef('s-mai-3')!)).toMatch(/Devis écrit/);
    expect(travelLabel(getServiceRef('s-num-1')!)).toBe('Livraison incluse à Ngaoundéré');
    expect(travelLabel(getServiceRef('s-mai-1')!)).toBe('Déplacement organisé par Fika, intégré au devis');
    expect(travelLabel(getServiceRef('s-tra-1')!)).not.toMatch(/gratuit/i);
  });

  it('carte catégorie : « dès X F » seulement avec un vrai prix standard', () => {
    expect(flat(categoryPriceLabel(SERVICES.filter((s) => s.categoryId === 'numerique-documents')))).toBe('dès 500 F');
    expect(categoryPriceLabel(SERVICES.filter((s) => s.categoryId === 'maison-travaux'))).toBe('Diagnostic ou devis selon le besoin');
    expect(categoryPriceLabel(SERVICES.filter((s) => s.categoryId === 'reparation-maintenance'))).toBe('Devis selon le besoin');
    expect(categoryPriceLabel([])).toBe('Sur devis');
  });
});

describe('calculateQuotePricing — coût pro + déplacement + matériel + marge = prix client', () => {
  it('marge en % du prix client', () => {
    const r = calculateQuotePricing({ expertCost: 6000, deliveryCost: 1000, materialCost: 500, marginPercent: 25 });
    expect(r.totalOperatingCosts).toBe(7500);
    expect(r.clientFinalPrice).toBe(10000);
    expect(r.marginAmount).toBe(2500);
    expect(r.marginPercent).toBe(25);
  });

  it('marge fixe en FCFA (petites interventions)', () => {
    const r = calculateQuotePricing({ expertCost: 4000, deliveryCost: 1000, marginAmount: 1500 });
    expect(r.clientFinalPrice).toBe(6500);
    expect(r.marginPercent).toBe(23.1);
  });

  it('prix client imposé : la marge devient prix − coûts (négative possible, jamais cachée)', () => {
    expect(calculateQuotePricing({ expertCost: 8000, clientPriceOverride: 12000 }).marginAmount).toBe(4000);
    expect(calculateQuotePricing({ expertCost: 8000, clientPriceOverride: 7000 }).marginAmount).toBe(-1000);
  });

  it('marge par défaut 25 % ; valeurs négatives neutralisées', () => {
    const r = calculateQuotePricing({ expertCost: 7500, deliveryCost: -100 });
    expect(r.deliveryCost).toBe(0);
    expect(r.clientFinalPrice).toBe(10000);
    expect(calculateQuotePricing({ expertCost: 0 }).clientFinalPrice).toBe(0);
  });
});

describe('getCityPricing', () => {
  it('lit la ligne ServiceCityPrice quand elle existe ou retombe sur le tarif de base', () => {
    const pricing = getCityPricing('s-num-1', 'ngaoundere');
    expect(pricing.priceMin).toBe(3000);
    expect(pricing.deliveryIncluded).toBe(true); // documents : livraison incluse
    expect(pricing.missingPrices).toBe(false);
  });

  it('repli sur le service : une intervention ne promet ni prix ni livraison gratuite', () => {
    const pricing = getCityPricing('s-mai-1', 'ngaoundere');
    expect(pricing.priceMin).toBeNull();
    expect(pricing.targetMarginPercent).toBeNull();
    expect(pricing.deliveryIncluded).toBe(false);
    expect(pricing.missingPrices).toBe(false);
  });

  it('NON-RÉGRESSION Ngaoundéré : le paramétrage multi-ville ne touche à rien', () => {
    // Même résultat qu'avant P11 pour chaque service avec prix de base.
    const svc = getServiceRef('s-mai-1');
    const fromBase = displayPrice(svc!, undefined);
    const fromCity = displayPrice(svc!, getCityPricing('s-mai-1'));
    expect(fromCity).toBe(fromBase);
  });
});

describe('ville sans tarifs (P11)', () => {
  it('une autre ville sans ServiceCityPrice → repli explicite « Sur devis » + alerte', () => {
    const svc = getServiceRef('s-mai-1');
    const pricing = getCityPricing('s-mai-1', 'garoua');

    expect(pricing.missingPrices).toBe(true);
    expect(pricing.deliveryIncluded).toBe(false);
    expect(pricing.priceMin).toBeNull();
    // jamais de repli silencieux sur le prix Ngaoundéré
    expect(flat(displayPrice(svc!, pricing))).toBe('Sur devis');
    expect(needsCityPricing('s-mai-1', 'garoua')).toBe(true);
  });

  it('une future ville tarifée reprendrait ses propres prix', () => {
    // Simule une ligne ville présente : la surcharge passe (uniquement) par ServiceCityPrice.
    const pricing = {
      serviceId: 's-mai-1', citySlug: 'garoua',
      priceMin: 30000, priceMax: null, targetMarginPercent: 40,
      deliveryIncluded: false, missingPrices: false,
    };
    expect(flat(displayPrice({ priceType: 'FROM', startingPrice: 25000, priceMin: null, priceMax: null }, pricing)))
      .toBe('À partir de 30 000 F');
  });

  it('la ville inconnue ne « promet » rien (pas de deliveryIncluded par défaut)', () => {
    expect(getCityPricing('s-mai-1', 'maroua').deliveryIncluded).toBe(false);
  });
});

describe('computeMargin / compareMarginToTarget', () => {
  it('marge = prix client − Σ coûts, en FCFA et %', () => {
    const m = computeMargin(35000, [{ amount: 18000 }, { amount: 2000 }]);
    expect(m.marginAmount).toBe(15000);
    expect(m.marginPercent).toBeCloseTo(42.857, 2);
  });

  it('total nul → 0 % sans exception', () => {
    const m = computeMargin(0, [{ amount: 100 }]);
    expect(m.marginAmount).toBe(-100);
    expect(m.marginPercent).toBe(0);
  });

  it('compare la marge réalisée à la cible en points', () => {
    expect(compareMarginToTarget(45.9, 45).ok).toBe(true);
    expect(compareMarginToTarget(40, 45).ok).toBe(false);
    expect(compareMarginToTarget(40, 45).deltaPoints).toBe(-5);
  });
});

describe('packs — remises réelles', () => {
  it('Pack Visibilité Commerce : détail 33 000 F (25 000 + 3 000 + 10 × 500), remise 3 000 F', () => {
    const pack = UNIVERSE_PACKAGES.find((p) => p.slug === 'pack-visibilite-commerce')!;
    expect(computePackageDetailTotal(pack)).toBe(33000);
    expect(computePackageSavings(pack)).toBe(3000);
  });

  it('aucun pack ne contient de service au devis (prix non standard)', () => {
    for (const pack of UNIVERSE_PACKAGES) {
      for (const line of pack.services) expect(pricingMode(getServiceRef(line.serviceId)!)).toBe('STANDARD');
    }
  });

  it('tous les packs du catalogue sont cohérents', () => {
    for (const pack of UNIVERSE_PACKAGES) {
      expect(validatePriceConsistency(pack)).toEqual([]);
    }
  });
});

describe('validatePriceConsistency', () => {
  it('détecte priceMin > priceMax', () => {
    const issues = validatePriceConsistency({
      name: 'Test', startingPrice: null, priceMin: 10000, priceMax: 5000,
    });
    expect(issues.map((i) => i.code)).toContain('MIN_ABOVE_MAX');
  });

  it('détecte un pack plus cher que la somme détail', () => {
    const bad = {
      id: 'bad', slug: 'bad', title: 'Bad pack', price: 999000, active: true,
      services: [{ serviceId: 's-num-1', quantity: 1 }],
    };
    const issues = validatePriceConsistency(bad);
    expect(issues.map((i) => i.code)).toContain('PACK_NOT_CHEAPER');
  });
});

describe('quoteClientNotes — séparation précisions client / décomposition interne', () => {
  it('ne renvoie que la partie destinée au client', () => {
    const pricing = calculateQuotePricing({ expertCost: 6000, deliveryCost: 1000, materialCost: 500, otherCost: 0, marginPercent: 25 });
    const details = ['Intervention prévue demain matin.', describeQuoteBreakdown(pricing)].join('\n\n');
    expect(details).toContain(QUOTE_BREAKDOWN_MARKER);
    expect(quoteClientNotes(details)).toBe('Intervention prévue demain matin.');
    expect(quoteClientNotes(describeQuoteBreakdown(pricing))).toBe('');
    expect(quoteClientNotes(null)).toBe('');
    expect(quoteClientNotes('Devis négocié par téléphone.')).toBe('Devis négocié par téléphone.');
  });
});
