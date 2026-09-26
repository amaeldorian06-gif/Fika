import { describe, it, expect } from 'vitest';
import {
  leadFormSchema,
  toLeadPayload,
  buildStructuredNeedText,
  maskPhoneE164,
  normalizePhoneE164,
} from './lead';
import { compileLeadMessage } from './whatsapp/engine';

describe('Logique métier de qualification de demande Fika (lead.ts)', () => {
  it('normalise et masque les téléphones camerounais', () => {
    expect(normalizePhoneE164('677123456')).toBe('+237677123456');
    expect(normalizePhoneE164('+237 6 99 88 77 66')).toBe('+237699887766');
    expect(normalizePhoneE164('0677123456')).toBeNull(); // Numéro invalide

    expect(maskPhoneE164('+237677123456')).toBe('+2376••• •• 56');
  });

  it('génère un texte structuré pour une intervention rapide', () => {
    const text = buildStructuredNeedText({
      track: 'RAPIDE',
      clientType: 'particulier',
      need: "Mon robinet fuit sous l'évier",
      dontKnowPro: true,
      serviceId: '',
      urgency: 'URGENT',
      dimensions: '',
      landmark: '',
      photosCount: 2,
      photoNames: ['robinet1.jpg', 'robinet2.jpg'],
      citySlug: 'ngaoundere',
      zone: 'Baladji 1',
      zoneOther: '',
      deadline: '',
      budgetRange: 'unknown',
      name: '',
      phone: '677123456',
      consent: true,
    });

    expect(text).toContain('[Intervention rapide · Urgence : Très urgent]');
    expect(text).toContain("Problème : Mon robinet fuit sous l'évier");
    expect(text).toContain('Professionnel : Sélection confiée à Fika');
    expect(text).toContain('Photos : 2 photo(s) transmise(s) (robinet1.jpg, robinet2.jpg)');
  });

  it('génère un texte structuré pour un projet de travaux', () => {
    const text = buildStructuredNeedText({
      track: 'TRAVAUX',
      clientType: 'particulier',
      need: 'Construire un mur de clôture',
      dontKnowPro: true,
      serviceId: '',
      urgency: 'FEW_DAYS',
      dimensions: '15 mètres linéaires, 2m de hauteur',
      deadline: 'Dans les 2 prochaines semaines',
      landmark: '',
      photosCount: 1,
      photoNames: ['terrain.jpg'],
      citySlug: 'ngaoundere',
      zone: 'Bamyanga',
      zoneOther: '',
      budgetRange: 'unknown',
      name: '',
      phone: '677123456',
      consent: true,
    });

    expect(text).toContain('[Projet / Travaux');
    expect(text).toContain('Problème : Construire un mur de clôture');
    expect(text).toContain('Dimensions / Quantité : 15 mètres linéaires, 2m de hauteur');
    expect(text).toContain('Photos : 1 photo(s) transmise(s) (terrain.jpg)');
  });

  it('compile le message WhatsApp avec le format adapté et le repère local', () => {
    const formInput = {
      track: 'RAPIDE' as const,
      need: "Je n'ai plus d'électricité dans une chambre",
      dontKnowPro: true,
      serviceId: '',
      urgency: 'URGENT' as const,
      landmark: 'Près de la pharmacie du Grand Marché',
      photosCount: 1,
      photoNames: ['disjoncteur.jpg'],
      citySlug: 'ngaoundere',
      zone: 'Baladji 1',
      name: 'Salifou K.',
      phone: '6 55 44 33 22',
      consent: true,
    };

    const validated = leadFormSchema.parse(formInput);
    const payload = toLeadPayload(validated);

    const waMessage = compileLeadMessage({
      need: payload.need,
      city: payload.cityName,
      zone: payload.zoneName,
      deadline: payload.deadline,
      budgetLabel: 'Je ne sais pas encore',
      name: payload.name,
    });

    expect(waMessage).toContain('Bonjour Fika');
    expect(waMessage).toContain("Je n'ai plus d'électricité dans une chambre");
    expect(waMessage).toContain('Ngaoundéré');
    expect(waMessage).toContain('Baladji 1');
    expect(waMessage).toContain('Près de la pharmacie du Grand Marché');
    expect(waMessage).toContain('Salifou K.');
  });
});
