import { describe, expect, it } from 'vitest';
import {
  compareMarginToTarget,
  computeMargin,
  computePackageDetailTotal,
  computePackageSavings,
  displayPrice,
  formatPriceFCFA,
  getCityPricing,
  needsCityPricing,
  validatePriceConsistency,
} from './pricing';
import { UNIVERSE_PACKAGES, getServiceRef } from './catalog-data';
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
    const city = getCityPricing('s-dig-1');
    const service = getServiceRef('s-dig-1');
    expect(service).toBeDefined();
    expect(flat(displayPrice(service!, undefined))).toBe('À partir de 25 000 F');
    expect(city.priceMin).toBe(25000);
  });
});

describe('getCityPricing', () => {
  it('lit la ligne ServiceCityPrice quand elle existe', () => {
    const pricing = getCityPricing('s-dig-1', 'ngaoundere');
    expect(pricing.priceMin).toBe(25000);
    expect(pricing.priceMax).toBe(75000);
    expect(pricing.targetMarginPercent).toBe(45);
    expect(pricing.deliveryIncluded).toBe(true);
    expect(pricing.missingPrices).toBe(false);
  });

  it('repli sur le service (deliveryIncluded=true — invariant Ngaoundéré)', () => {
    const pricing = getCityPricing('s-des-2', 'ngaoundere');
    expect(pricing.priceMin).toBe(5000);
    expect(pricing.targetMarginPercent).toBeNull();
    expect(pricing.deliveryIncluded).toBe(true);
    expect(pricing.missingPrices).toBe(false);
  });

  it('NON-RÉGRESSION Ngaoundéré : le paramétrage multi-ville ne touche à rien', () => {
    // Même résultat qu'avant P11 pour chaque service avec prix de base.
    const svc = getServiceRef('s-dig-1');
    const fromBase = displayPrice(svc!, undefined);
    const fromCity = displayPrice(svc!, getCityPricing('s-dig-1'));
    expect(fromCity).toBe(fromBase);
  });
});

describe('ville sans tarifs (P11)', () => {
  it('une autre ville sans ServiceCityPrice → repli explicite « Sur devis » + alerte', () => {
    const svc = getServiceRef('s-dig-1');
    const pricing = getCityPricing('s-dig-1', 'garoua');

    expect(pricing.missingPrices).toBe(true);
    expect(pricing.deliveryIncluded).toBe(false);
    expect(pricing.priceMin).toBeNull();
    // jamais de repli silencieux sur le prix Ngaoundéré
    expect(flat(displayPrice(svc!, pricing))).toBe('Sur devis');
    expect(needsCityPricing('s-dig-1', 'garoua')).toBe(true);
  });

  it('une future ville tarifée reprendrait ses propres prix', () => {
    // Simule une ligne ville présente : la surcharge passe (uniquement) par ServiceCityPrice.
    const pricing = {
      serviceId: 's-dig-1', citySlug: 'garoua',
      priceMin: 30000, priceMax: null, targetMarginPercent: 40,
      deliveryIncluded: false, missingPrices: false,
    };
    expect(flat(displayPrice({ priceType: 'FROM', startingPrice: 25000, priceMin: null, priceMax: null }, pricing)))
      .toBe('À partir de 30 000 F');
  });

  it('la ville inconnue ne « promet » rien (pas de deliveryIncluded par défaut)', () => {
    expect(getCityPricing('s-des-2', 'maroua').deliveryIncluded).toBe(false);
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
  it('Pack Étudiant : détail 10 500 F, remise 3 500 F', () => {
    const pack = UNIVERSE_PACKAGES.find((p) => p.slug === 'pack-etudiant')!;
    expect(computePackageDetailTotal(pack)).toBe(10500);
    expect(computePackageSavings(pack)).toBe(3500);
  });

  it('Pack Lancement : détail 32 500 F, remise 7 500 F', () => {
    const pack = UNIVERSE_PACKAGES.find((p) => p.slug === 'pack-lancement')!;
    expect(computePackageDetailTotal(pack)).toBe(32500);
    expect(computePackageSavings(pack)).toBe(7500);
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
      services: [{ serviceId: 's-doc-1', quantity: 1 }],
    };
    const issues = validatePriceConsistency(bad);
    expect(issues.map((i) => i.code)).toContain('PACK_NOT_CHEAPER');
  });
});
