import { describe, expect, it } from 'vitest';
import { renderLeadAlert, renderServiceOrderAlert, renderMarketOrderAlert, notifyRecipient, isNotifyConfigured, smtpSettings, getNotificationStatus } from './notify';

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

describe('renderServiceOrderAlert (e-mail conversion en commande Services)', () => {
  const alert = {
    orderNumber: 'CMD-2026-1042', leadCode: 'LEAD-ABCDEF', name: 'Oumarou D.',
    phone: '+237677123456', serviceName: 'Intervention plomberie',
    cityName: 'Ngaoundéré', zoneName: 'Baladji 1', description: 'Mon robinet fuit sous l’évier',
  };

  it('identifie la commande issue de la demande et donne le lien de traitement', () => {
    const { subject, text } = renderServiceOrderAlert(alert, 'https://fika.example');
    expect(subject).toContain('CMD-2026-1042');
    expect(text).toContain('LEAD-ABCDEF');
    expect(text).toContain('Intervention plomberie');
    expect(text).toContain('wa.me/237677123456');
    expect(text).toContain('https://fika.example/admin/orders');
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
    expect(text).toContain('Nouvelle commande Fika Market MKT-2026-0011');
  });

  it('prix unitaire affiché quand connu, absent sinon', () => {
    const { text } = renderMarketOrderAlert(alert, null);
    expect(text).toMatch(/Câble sata 3k ×2 — 4[\s,.]000\sF l'unité/);
    expect(text).toContain('Chargeur Lenovo USB (Connectique : Carré) ×1\n');
  });
});

describe('configuration des alertes', () => {
  it('utilise amaeldorian06@gmail.com par défaut', () => {
    expect(notifyRecipient({})).toBe('amaeldorian06@gmail.com');
  });

  it('NOTIFY_EMAIL surcharge le destinataire sans toucher à l’expéditeur', () => {
    expect(notifyRecipient({ NOTIFY_EMAIL: 'ops@fika.example' })).toBe('ops@fika.example');
    expect(notifyRecipient({ NOTIFY_EMAIL: '   ' })).toBe('amaeldorian06@gmail.com');
  });

  it('accepte un mot de passe Gmail copié avec des espaces', () => {
    expect(isNotifyConfigured({ GMAIL_USER: 'amaeldorian06@gmail.com', GMAIL_APP_PASSWORD: ' abcd efgh ijkl mnop ' })).toBe(true);
    expect(isNotifyConfigured({ GMAIL_USER: '', GMAIL_APP_PASSWORD: 'abcd' })).toBe(false);
  });
});

describe('smtpSettings (port, STARTTLS, priorité des modes)', () => {
  it('SMTP explicite : port 587 → STARTTLS, port 465 → TLS direct', () => {
    const a = smtpSettings({ SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587' } as NodeJS.ProcessEnv);
    expect([a.mode, a.host, a.port, a.secure]).toEqual(['smtp', 'smtp.example.com', 587, false]);
    expect(a.warnings).toEqual([]);
    const b = smtpSettings({ SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_PORT: '465' } as NodeJS.ProcessEnv);
    expect(b.secure).toBe(true);
  });

  it('corrige et signale un SMTP_SECURE incohérent avec le port', () => {
    const s = smtpSettings({ SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_PORT: '587', SMTP_SECURE: 'true' } as NodeJS.ProcessEnv);
    expect(s.secure).toBe(false);
    expect(s.warnings[0]).toMatch(/STARTTLS/);
  });

  it('SMTP explicite prioritaire sur Gmail', () => {
    const s = smtpSettings({
      SMTP_USER: 'smtp@fika.cm', SMTP_PASS: 'x', GMAIL_USER: 'g@gmail.com', GMAIL_APP_PASSWORD: 'y',
    } as NodeJS.ProcessEnv);
    expect([s.mode, s.user]).toEqual(['smtp', 'smtp@fika.cm']);
  });

  it('repli Gmail conservé pour les déploiements existants', () => {
    const s = smtpSettings({ GMAIL_USER: 'a@gmail.com', GMAIL_APP_PASSWORD: 'x' } as NodeJS.ProcessEnv);
    expect([s.mode, s.host, s.port, s.secure]).toEqual(['gmail', 'smtp.gmail.com', 587, false]);
  });

  it('aucune configuration → mode « aucun », sans lever d’erreur', () => {
    expect(smtpSettings({} as NodeJS.ProcessEnv).mode).toBe('aucun');
    expect(isNotifyConfigured({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('le statut exposé à l’admin ne contient aucun secret', () => {
    const previous = { ...process.env };
    process.env.SMTP_USER = 'u@fika.cm';
    process.env.SMTP_PASS = 'secret-a-ne-pas-exposer';
    process.env.SMTP_HOST = 'smtp.fika.cm';
    process.env.SMTP_PORT = '465';
    try {
      const status = getNotificationStatus();
      expect([status.mode, status.host, status.port, status.secure]).toEqual(['smtp', 'smtp.fika.cm', 465, true]);
      expect(JSON.stringify(status)).not.toContain('secret-a-ne-pas-exposer');
    } finally {
      process.env = previous;
    }
  });
});
