import { describe, it, expect } from 'vitest';
import { compileQuoteMessage, compileExpertAssignedMessage, compileOrderConfirmation } from './engine';

describe('messages WhatsApp (devis, professionnel, confirmation)', () => {
  it('devis : prix final seul communiqué, jamais la marge ni les coûts internes', () => {
    const msg = compileQuoteMessage({ orderNumber: 'CMD-2026-0001', quoteNumber: 'DEV-2026-0001', serviceName: 'Réparation téléphone', clientPrice: 15000, validUntil: '2026-10-25' });
    expect(msg).toContain('15 000 F');
    expect(msg).toContain('CMD-2026-0001');
    expect(msg).toContain('compris dans ce prix');
    expect(msg).not.toContain('marge');
    expect(msg).not.toContain('coût professionnel');
  });

  it('devis : précisions client optionnelles incluses si présentes', () => {
    const msg = compileQuoteMessage({ orderNumber: 'CMD-1', quoteNumber: 'DEV-1', serviceName: 'S', clientPrice: 1000, clientNotes: '  Intervention après 17h  ' });
    expect(msg).toContain('Précisions : Intervention après 17h');
  });

  it('professionnel : uniquement des faits, aucun téléphone, signaux publiables seulement', () => {
    const msg = compileExpertAssignedMessage({ orderNumber: 'CMD-2', serviceName: 'Plomberie', expertFirstName: 'Oumarou', trade: 'Plombier', trustSignals: ['2 interventions terminées avec Fika'] });
    expect(msg).toContain('Oumarou, plombier');
    expect(msg).toContain('2 interventions terminées avec Fika');
    expect(msg).not.toMatch(/6\\d{8}|\\+237/);
  });

  it('professionnel : sans signaux, message honnête sans « vérifié »', () => {
    const msg = compileExpertAssignedMessage({ orderNumber: 'CMD-3', serviceName: 'S', expertFirstName: 'Ali', trustSignals: [] });
    expect(msg).toContain('rejoint le réseau Fika');
    expect(msg).not.toContain('vérifié');
  });

  it('confirmation : prix, délai, CGV et renonciation expresse si exécution immédiate', () => {
    const msg = compileOrderConfirmation({ orderNumber: 'CMD-4', serviceName: 'Livraison', price: '3 000 F', delay: '24 h', immediateExecution: true });
    expect(msg).toContain('Prix convenu : 3 000 F');
    expect(msg).toContain('/#/cgv');
    expect(msg).toContain('renoncez donc expressément');
    const sansReconduction = compileOrderConfirmation({ orderNumber: 'CMD-5', serviceName: 'S', price: '1 000 F', delay: '48 h' });
    expect(sansReconduction).not.toContain('renoncez');
  });
});
