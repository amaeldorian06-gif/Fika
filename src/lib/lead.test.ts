import { describe, it, expect } from 'vitest';
import { normalizePhoneE164, clientTypeLabel, URGENCY_OPTIONS, leadPayloadSchema } from './lead';

describe('collecte des demandes (lead.ts)', () => {
  it('normalise les téléphones camerounais et refuse les invalides', () => {
    expect(normalizePhoneE164('677123456')).toBe('+237677123456');
    expect(normalizePhoneE164('+237 6 99 88 77 66')).toBe('+237699887766');
    expect(normalizePhoneE164('237 612 34 56 78')).toBe('+237612345678');
    expect(normalizePhoneE164('0677123456')).toBeNull();
    expect(normalizePhoneE164('6771234')).toBeNull();
    expect(normalizePhoneE164('')).toBeNull();
  });

  it('libelle les types de clients sans inventer de valeur', () => {
    expect(clientTypeLabel('commercant')).toBe('Commerçant / boutique');
    expect(clientTypeLabel(null)).toBe('—');
    expect(clientTypeLabel('inconnu')).toBe('—');
  });

  it('propose les quatre niveaux d’urgence', () => {
    expect(URGENCY_OPTIONS.map((u) => u.id)).toEqual(['URGENT', 'TODAY', 'FEW_DAYS', 'FLEXIBLE']);
  });

  it('valide le payload serveur : consentement exigé, urgence et ville par défaut', () => {
    const base = { need: 'Mon robinet fuit', zoneName: 'Baladji', phone: '677123456' };
    expect(leadPayloadSchema.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(leadPayloadSchema.safeParse({ ...base }).success).toBe(false); // consent absent
    expect(leadPayloadSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    const parsed = leadPayloadSchema.parse({ ...base, consent: true });
    expect(parsed.cityName).toBe('Ngaoundéré');
    expect(parsed.urgency).toBe('FLEXIBLE');
    expect(leadPayloadSchema.safeParse({ ...base, consent: true, requestKey: 'pas-un-uuid' }).success).toBe(false);
  });
});
