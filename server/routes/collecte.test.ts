import { describe, expect, it, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  city: { findFirst: vi.fn() },
  service: { findUnique: vi.fn() },
  customer: { upsert: vi.fn() },
  lead: { create: vi.fn(), findMany: vi.fn() },
  event: { findMany: vi.fn() },
}));
vi.mock('../../src/lib/prisma', () => ({ prisma: db }));

import { handleCreateLead } from './leads';
import { buildExport, isExportDataset, parseRange } from './admin-export';
import { budgetLabel, isNotifyConfigured, renderLeadAlert } from '../lib/notify';
import { leadFormSchema } from '../../src/lib/lead';

const valid = {
  need: 'Impression de 200 flyers pour ma boutique au marché central.',
  cityName: 'Ngaoundéré', zoneName: 'Bamyanga', phone: '6 90 00 00 01', name: 'Aminata',
  clientType: 'commercant', budgetMin: 5000, budgetMax: 15000,
  context: { campaign: 'affiche-marche', referrer: null, landing: '/#/services', device: 'mobile' },
};

beforeEach(() => {
  vi.resetAllMocks();
  db.city.findFirst.mockResolvedValue({ id: 'city-1' });
  db.customer.upsert.mockResolvedValue({ id: 'cust-1' });
  db.lead.create.mockResolvedValue({ id: 'lead-xyz123' });
});

describe('collecte des demandes', () => {
  it('refuse une demande sans téléphone (chaque demande doit être rappelable)', async () => {
    const { phone: _omit, ...sansTel } = valid;
    const result = await handleCreateLead(sansTel, '10.0.0.1');
    expect(result.status).toBe(400);
    expect(db.lead.create).not.toHaveBeenCalled();
  });

  it('refuse un numéro non camerounais', async () => {
    const result = await handleCreateLead({ ...valid, phone: '+33612345678' }, '10.0.0.2');
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ code: 'PHONE_INVALID' });
  });

  it('enregistre client + demande avec le contexte de collecte (type, campagne, appareil, consentement)', async () => {
    const result = await handleCreateLead(valid, '10.0.0.3');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, leadCode: 'LEAD-XYZ123' });
    expect(db.customer.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { phone: '+237690000001' } }));
    const data = db.lead.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ customerId: 'cust-1', source: 'SITE', status: 'NEW', campaign: 'affiche-marche', zoneName: 'Bamyanga' });
    expect(data.meta).toMatchObject({ clientType: 'commercant', device: 'mobile', landing: '/#/services' });
    expect(typeof data.meta.consentAt).toBe('string');
  });

  it('formulaire : le téléphone et le type de client sont obligatoires', () => {
    const base = { need: 'Besoin de dix cartes de visite rapidement', citySlug: 'ngaoundere', zone: 'Bamyanga', consent: true, clientType: 'particulier' };
    expect(leadFormSchema.safeParse({ ...base, phone: '' }).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...base, phone: '690000001', clientType: 'inconnu' }).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...base, phone: '690000001' }).success).toBe(true);
  });
});

describe('alerte e-mail', () => {
  it('n est active que si Gmail est configuré', () => {
    expect(isNotifyConfigured({})).toBe(false);
    expect(isNotifyConfigured({ GMAIL_USER: 'a@b.c', GMAIL_APP_PASSWORD: 'x' })).toBe(true);
  });
  it('rédige un e-mail complet et actionnable', () => {
    const { subject, text } = renderLeadAlert({
      leadCode: 'LEAD-ABC123', leadId: 'l1', clientType: 'commercant', name: 'Aminata', phone: '+237690000001',
      need: 'Flyers', serviceName: 'Flyer A5', cityName: 'Ngaoundéré', zoneName: 'Bamyanga', deadline: 'vendredi',
      budgetLabel: budgetLabel(5000, 15000), campaign: 'affiche-marche', referrer: null, device: 'mobile',
    }, 'https://fika.example');
    expect(subject).toContain('LEAD-ABC123');
    expect(text).toContain('https://wa.me/237690000001');
    expect(text).toContain('5 000 F – 15 000 F'.normalize('NFC').replace(/\u202f|\u00a0/g, ' ').slice(0, 1));
    expect(text).toContain('affiche-marche (mobile)');
    expect(text).toContain('https://fika.example/#/admin/leads');
  });
});

describe('export CSV', () => {
  it('ne connaît que les jeux de données autorisés', () => {
    expect(isExportDataset('leads')).toBe(true);
    expect(isExportDataset('AdminUser')).toBe(false);
    expect(parseRange('2026-09-01', '2026-09-30')).toEqual({ gte: new Date('2026-09-01T00:00:00.000Z'), lte: new Date('2026-09-30T23:59:59.999Z') });
    expect(parseRange('hier', undefined)).toBeUndefined();
  });
  it('produit un CSV Excel (BOM, « ; ») avec le contexte de collecte', async () => {
    db.lead.findMany.mockResolvedValue([{
      id: 'lead-xyz123', createdAt: new Date('2026-09-14T10:00:00Z'), status: 'NEW', source: 'SITE', campaign: 'affiche-marche',
      customer: { name: 'Aminata', phone: '+237690000001' }, service: { name: 'Flyer A5' }, city: { name: 'Ngaoundéré' },
      zoneName: 'Bamyanga', description: 'Flyers; urgent', deadline: null, budgetMin: 5000, budgetMax: 15000,
      meta: { clientType: 'commercant', device: 'mobile', referrer: null, landing: '/#/services', consentAt: '2026-09-14T10:00:00Z' }, orders: [],
    }]);
    const { filename, csv, rows } = await buildExport('leads', '2026-09-01', '2026-09-30');
    expect(rows).toBe(1);
    expect(filename).toMatch(/^fika-demandes-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Référence;Reçue le;Statut;Type de client');
    expect(csv).toContain('LEAD-XYZ123');
    expect(csv).toContain('Commerçant / boutique;Aminata;+237690000001;Flyer A5');
    expect(csv).toContain('"Flyers; urgent"');
    expect(db.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { createdAt: expect.any(Object) } }));
  });
});
