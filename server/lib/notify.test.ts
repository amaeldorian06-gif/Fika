import { describe, expect, it } from 'vitest';
import { renderLeadAlert, renderMarketOrderAlert } from './notify';

describe('renderLeadAlert (e-mail demande de service)', () => {
  const alert = {
    leadCode: 'DEM-2026-0042', leadId: 'x', clientType: 'Particulier', name: 'Awa',
    phone: '+237690000001', need: 'Fuite d\'eau sous l\'évier', serviceName: 'Intervention plomberie',
    cityName: 'Ngaoundéré', zoneName: 'Manwi', deadline: null, budgetLabel: null,
    campaign: null, referrer: null, device: 'mobile',
  };

  it('pointe vers le vrai chemin /admin/leads (plus de fragment #/)', () => {
    const { text } = renderLeadAlert(alert, 'https://fika.example');
    expect(text).toContain('https://fika.example/admin/leads');
    expect(text).not.toContain('#/admin');
  });

  it('sans appUrl, indique le chemin dans l\'espace admin', () => {
    const { text } = renderLeadAlert(alert, null);
    expect(text).toContain("l'espace admin → Demandes");
  });

  it('inclut le lien WhatsApp du client', () => {
    const { text } = renderLeadAlert(alert, null);
    expect(text).toContain('https://wa.me/237690000001');
  });
});

describe('renderMarketOrderAlert (e-mail commande Fika Market)', () => {
  const alert = {
    orderNumber: 'MKT-2026-0011', name: 'Awa', phone: '+237690000001', zoneName: 'Manwi',
    address: 'près de la station Total', notes: 'Appeler avant de venir',
    items: [
      { productName: 'Câble sata 3k', variantLabel: null, quantity: 2, unitPrice: 4000 },
      { productName: 'Chargeur Lenovo USB', variantLabel: 'Connectique : Carré', quantity: 1, unitPrice: null },
    ],
    totalIndicatif: 8000,
  };

  it('résume la commande : client, WhatsApp, articles avec variantes, notes', () => {
    const { subject, text } = renderMarketOrderAlert(alert, 'https://fika.example');
    expect(subject).toBe('[Fika Market] Nouvelle commande MKT-2026-0011 — Awa');
    expect(text).toContain('wa.me/237690000001');
    expect(text).toContain('Manwi — près de la station Total');
    expect(text).toContain('Câble sata 3k ×2');
    expect(text).toContain('Chargeur Lenovo USB (Connectique : Carré) ×1');
    expect(text).toContain('Notes du client : Appeler avant de venir');
  });

  it('total indicatif signalé comme à confirmer avant paiement', () => {
    const { text } = renderMarketOrderAlert(alert, null);
    expect(text).toMatch(/Total indicatif\s*:\s*8[\s,.]000/);
    expect(text).toContain('avant tout paiement');
  });

  it('lien de traitement vers les commandes Market de l\'admin', () => {
    const { text } = renderMarketOrderAlert(alert, 'https://fika.example');
    expect(text).toContain('https://fika.example/admin/market/orders');
  });

  it('sans prix connu : pas de ligne total, commande toujours alertée', () => {
    const { text } = renderMarketOrderAlert({ ...alert, totalIndicatif: null }, null);
    expect(text).not.toMatch(/Total indicatif/);
    expect(text).toContain('Nouvelle commande MKT-2026-0011');
  });

  it('prix unitaire affiché quand connu, absent sinon', () => {
    const { text } = renderMarketOrderAlert(alert, null);
    expect(text).toMatch(/Câble sata 3k ×2 — 4[\s,.]000\sF l'unité/);
    expect(text).toContain('Chargeur Lenovo USB (Connectique : Carré) ×1\n');
  });
});
