import { describe, expect, it } from 'vitest';
import {
  buildOrderIntro,
  compileCustomNeedMessage,
  compileLeadMessage,
  compileMessage,
  compileOrderConfirmation,
  compileSearchMessage,
  renderTemplate,
  requirementsToQuestions,
} from './engine';
import { getServiceRef } from '../catalog-data';
import type { Service } from '../types';

const flat = (s: string) => s.replace(/[  ]/g, ' ');

function fakeService(overrides: Partial<Service>): Service {
  return {
    id: 'test-1', slug: 'test', name: 'Service test', categoryId: 'digital',
    shortDescription: 'Test', priceType: 'FROM', startingPrice: 5000,
    deliveryIncluded: false, requirements: [], includedItems: [], excludedItems: [],
    active: true, featured: false, popular: false, displayOrder: 0,
    budget: 'Faible', delai: 'Rapide', typeBesoin: 'Création',
    ...overrides,
  };
}

describe('renderTemplate', () => {
  it('remplace globalement les variables connues (occurrences multiples)', () => {
    const out = renderTemplate('{{service}} et encore {{service}} ({{price}})', {
      service: 'Logo', price: '15 000 F',
    });
    expect(out).toBe('Logo et encore Logo (15 000 F)');
  });

  it('efface les variables inconnues sans planter', () => {
    expect(renderTemplate('A {{inconnue}} B', {})).toBe('A B');
  });

  it('nettoie les lignes laissées vides par des variables absentes', () => {
    const out = renderTemplate('Ville : {{city}}\nQuartier : {{zone}}\nFin', { city: 'Ngaoundéré', zone: '', });
    expect(out).toBe('Ville : Ngaoundéré\nQuartier :\nFin');
  });
});

describe('requirementsToQuestions', () => {
  it('produit des lignes « • Label : » dans l\u2019ordre de position', () => {
    const out = requirementsToQuestions([
      { label: 'Logo', kind: 'FILE', required: true, position: 2 },
      { label: 'Texte', kind: 'TEXT', required: true, position: 1 },
    ]);
    expect(out).toBe('• Texte :\n• Logo :');
  });

  it('injecte les valeurs fournies', () => {
    const out = requirementsToQuestions(
      [{ label: 'Modèle', kind: 'TEXT', required: true, position: 1 }],
      { Modèle: 'iPhone 12' },
    );
    expect(out).toBe('• Modèle : iPhone 12');
  });

  it('fallback « Mon besoin » quand aucun requirement', () => {
    expect(requirementsToQuestions([])).toBe('• Mon besoin :');
  });
});

describe('buildOrderIntro', () => {
  it('intro standard avec nom et prix formaté', () => {
    const intro = buildOrderIntro(fakeService({}), null);
    expect(intro).toContain('Je souhaite commander le service : Service test');
    expect(flat(intro)).toContain('(À partir de 5 000 F)');
  });
});

describe('compileMessage', () => {
  it('utilise whatsappTemplate quand renseigné (variables multiples)', () => {
    const svc = fakeService({
      whatsappTemplate: 'Bonjour 👋\n\nDevis {{service}} ({{price}}), ville {{city}}, ville {{city}}.',
    });
    const msg = compileMessage(svc, { context: 'service-page' });
    expect(flat(msg)).toContain('Devis Service test (À partir de 5 000 F), ville Ngaoundéré, ville Ngaoundéré.');
    expect(msg).toContain('Réf : fika:test · service-page');
  });

  it('DIAGNOSTIC sans template → gabarit appareil/problème/urgence', () => {
    const svc = fakeService({
      priceType: 'DIAGNOSTIC', startingPrice: 3000,
      requirements: [
        { label: 'Modèle exact', kind: 'TEXT', required: true, position: 1 },
        { label: 'Problème', kind: 'TEXT', required: true, position: 2 },
        { label: 'Urgence', kind: 'OPTION', required: true, position: 3, options: ['Oui', 'Non'] },
      ],
    });
    const msg = flat(compileMessage(svc));
    expect(msg).toContain('Je souhaite un diagnostic pour : Service test (Diagnostic à partir de 3 000 F).');
    expect(msg).toContain('• Modèle exact :');
    expect(msg).toContain('• Urgence :');
    expect(msg).toContain('Ville : Ngaoundéré');
  });

  it('QUOTE sans template → gabarit devis (projet/ville/délai)', () => {
    const svc = fakeService({ priceType: 'QUOTE', startingPrice: null, priceMin: null, priceMax: null });
    const msg = compileMessage(svc);
    expect(msg).toContain('Je souhaite un devis pour : Service test.');
    expect(msg).toContain('Délai souhaité :');
    expect(msg).toContain('budget estimé');
  });

  it('commande standard : prix + champs à compléter + campagne', () => {
    const svc = fakeService({
      requirements: [{ label: 'Votre logo', kind: 'FILE', required: true, position: 1 }],
    });
    const msg = compileMessage(svc, { campaign: 'pack-lancement', context: 'service-page' });
    expect(msg).toContain('• Votre logo :');
    expect(msg).toContain('Réf : fika:test · service-page · pack-lancement');
  });

  it('service réel du catalogue (site-vitrine) : message complet et borné', () => {
    const svc = getServiceRef('s-dig-1');
    expect(svc).toBeDefined();
    const msg = compileMessage(svc!, { context: 'service-page' });
    expect(msg.length).toBeGreaterThan(80);
    expect(msg.length).toBeLessThan(900); // tient sur mobile
    expect(msg).toContain('• Votre logo :');
    expect(msg.startsWith('Bonjour Fika')).toBe(true);
  });
});

describe('messages hors catalogue', () => {
  it('compileCustomNeedMessage reprend description/ville/quartier/délai', () => {
    const msg = compileCustomNeedMessage({
      need: 'Traduire 10 pages', zone: 'Bamyanga', deadline: 'Vendredi', context: 'demande',
    });
    expect(msg).toContain('- Description : Traduire 10 pages');
    expect(msg).toContain('- Ville : Ngaoundéré');
    expect(msg).toContain('- Quartier : Bamyanga');
    expect(msg).toContain('- Délai souhaité : Vendredi');
    expect(msg).toContain('Réf : fika:hors-catalogue · demande');
  });

  it('compileSearchMessage force le contexte search', () => {
    const msg = compileSearchMessage('Réparer mon téléphone');
    expect(msg).toContain('Je cherche : Réparer mon téléphone');
    expect(msg).toContain('Réf : fika:hors-catalogue · search');
  });

  it('échappe les variables injectées par un utilisateur', () => {
    const msg = compileSearchMessage('{{service}} gratuit');
    expect(msg).not.toContain('Réparation téléphone');
    expect(msg).toContain('Je cherche : service gratuit');
  });
});

describe('compileLeadMessage (tunnel P05)', () => {
  it('avec leadCode → récap + « demande site enregistrée » + réf', () => {
    const msg = compileLeadMessage({
      need: 'Faire imprimer et relier mon mémoire',
      serviceName: 'Impression & reliure',
      zone: 'Bamyanga',
      deadline: 'Avant vendredi',
      budgetLabel: 'Entre 5 000 et 15 000 F',
      name: 'Aminata',
      leadCode: 'LEAD-AB12CD',
    });
    expect(msg).toContain('demande site enregistrée');
    expect(msg).toContain('- Besoin : Faire imprimer et relier mon mémoire');
    expect(msg).toContain('- Service concerné : Impression & reliure');
    expect(msg).toContain('- Ville : Ngaoundéré / Quartier : Bamyanga');
    expect(msg).toContain('- Budget estimé : Entre 5 000 et 15 000 F');
    expect(msg).toContain('Réf : demande #LEAD-AB12CD');
  });

  it('sans leadCode → mention « non enregistrée » (repli hors-ligne)', () => {
    const msg = compileLeadMessage({ need: 'Réparer mon Wi-Fi', leadCode: null });
    expect(msg).toContain('demande site, non enregistrée');
    expect(msg).toContain('Réf : fika:hors-catalogue · demande');
  });
});

describe('compileOrderConfirmation (conformité)', () => {
  it('récapitule commande, prix, délai et livraison gratuite + CGV', () => {
    const msg = compileOrderConfirmation({
      orderNumber: 'CMD-2026-0001',
      serviceName: 'Flyer professionnel',
      price: '5 000 F',
      delay: '48 heures',
    });
    expect(msg).toContain('CMD-2026-0001');
    expect(msg).toContain('Prestation : Flyer professionnel');
    expect(msg).toContain('5 000 F (TTC, francs CFA)');
    expect(msg).toContain('Délai estimé : 48 heures');
    expect(msg).toContain('gratuite dans toute la ville de Ngaoundéré');
    expect(msg).toContain('Conditions Générales de Vente');
    expect(msg).not.toContain('renoncez donc expressément');
  });

  it('exécution immédiate → renonciation expresse au droit de rétractation', () => {
    const msg = compileOrderConfirmation({
      orderNumber: 'CMD-2026-0002',
      serviceName: 'Réparation téléphone',
      price: '12 000 F',
      delay: '24 heures',
      immediateExecution: true,
    });
    expect(msg).toContain('exécution immédiate');
    expect(msg).toContain('renoncez donc expressément');
    expect(msg).toContain('2010/021');
  });
});
