import { describe, expect, it } from 'vitest';
import { paymentBalance, recordPaymentSchema } from './payments';
import { createExpertSchema, updateExpertSchema } from './experts';
import { getCustomerWALink } from './whatsapp';

const receipt = { orderId: 'order', amount: 1000, method: 'MTN_MOMO', reference: 'tx-001', idempotencyKey: 'feff30c0-1ac6-40a7-b01c-1df8f3ee3161' };
describe('paiements', () => {
  it.each([0, -1, 1.5, 100000001, NaN])('refuse le montant %s', amount => {
    expect(recordPaymentSchema.safeParse({ ...receipt, amount }).success).toBe(false);
  });
  it('normalise la référence et refuse les identifiants incomplets', () => {
    expect(recordPaymentSchema.parse(receipt).reference).toBe('TX-001');
    expect(recordPaymentSchema.safeParse({ ...receipt, idempotencyKey: '' }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...receipt, reference: '' }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...receipt, method: 'FAKE' }).success).toBe(false);
  });
  it('ne confond pas acompte, reçu et encaissement confirmé', () => {
    expect(paymentBalance(10000, [{ amount: 2000, status: 'CONFIRMED' }, { amount: 3000, status: 'PENDING' }, { amount: 10000, status: 'FAILED' }])).toEqual({ confirmed: 2000, pending: 3000, remaining: 8000, available: 5000, fullyPaid: false });
    expect(paymentBalance(10000, [{ amount: 2000, status: 'CONFIRMED' }, { amount: 8000, status: 'CONFIRMED' }]).fullyPaid).toBe(true);
  });
  it('un devis absent ou nul ne débloque pas le statut Payée', () => {
    expect(paymentBalance(null, []).fullyPaid).toBe(false);
    expect(paymentBalance(0, []).fullyPaid).toBe(false);
  });
});
describe('partenaires', () => {
  it('normalise le téléphone local lors de la création', () => {
    expect(createExpertSchema.parse({ name: 'Expert Test', phone: '6 12 34 56 78' })).toMatchObject({ phone: '+237612345678', availability: true, status: 'ACTIVE', skills: [] });
  });
  it('une mise à jour partielle ne réinitialise pas les autres champs', () => {
    expect(updateExpertSchema.parse({ expertId: 'expert', name: 'Nouveau nom' })).toEqual({ expertId: 'expert', name: 'Nouveau nom' });
  });
  it('refuse un coût négatif, un numéro invalide et un statut libre', () => {
    const base = { name: 'Expert Test', phone: '+237612345678' };
    expect(createExpertSchema.safeParse({ ...base, usualCost: -1 }).success).toBe(false);
    expect(createExpertSchema.safeParse({ ...base, phone: '123' }).success).toBe(false);
    expect(createExpertSchema.safeParse({ ...base, status: 'ADMIN' }).success).toBe(false);
  });
});
describe('WhatsApp back-office', () => {
  it('adresse le message au client sélectionné', () => {
    expect(getCustomerWALink('+237612345678', 'Bonjour client !')).toBe('https://wa.me/237612345678?text=Bonjour%20client%20!');
  });
  it('ne redirige jamais silencieusement un numéro invalide vers Fika', () => {
    expect(getCustomerWALink('invalid', 'Message')).toBeUndefined();
  });
});
