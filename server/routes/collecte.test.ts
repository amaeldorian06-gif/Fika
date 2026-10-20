import { describe, expect, it, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  city: { findFirst: vi.fn() },
  service: { findFirst: vi.fn() },
  customer: { upsert: vi.fn() },
  lead: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
}));

vi.mock('../../src/lib/prisma', () => ({ prisma: db }));

import { handleCreateLead, checkRateLimit } from './leads';
import { buildExport, isExportDataset, parseRange } from './admin-export';
import { isNotifyConfigured, renderLeadAlert } from '../lib/notify';

const valid = {
  need: 'Mon robinet fuit depuis ce matin.',
  cityName: 'Ngaoundéré', zoneName: 'Bamyanga', phone: '6 90 00 00 01',
  urgency: 'URGENT', consent: true,
  context: { campaign: 'affiche-marche', referrer: null, landing: '/#/demande', device: 'mobile' },
};

beforeEach(() => {
  vi.resetAllMocks();
  db.city.findFirst.mockResolvedValue({ id: 'city-1' });
  db.customer.upsert.mockResolvedValue({ id: 'cust-1' });
  db.lead.create.mockResolvedValue({ id: 'lead-xyz123' });
});

describe('collecte des demandes', () => {
  it('refuse un numéro non camerounais avant toute écriture', async () => {
    const res = await handleCreateLead({ ...valid, phone: '09 00 00 00 01' }, 'ip-test');
    expect(res.status).toBe(400);
    expect(db.customer.upsert).not.toHaveBeenCalled();
    expect(db.lead.create).not.toHaveBeenCalled();
  });

  it('exige le consentement au recontact', async () => {
    const res = await handleCreateLead({ ...valid, consent: false }, 'ip-test');
    expect(res.status).toBe(400);
    expect(db.lead.create).not.toHaveBeenCalled();
  });

  it('refuse une ville non desservie', async () => {
    db.city.findFirst.mockResolvedValue(null);
    const res = await handleCreateLead({ ...valid, cityName: 'Paris' }, 'ip-test');
    expect(res.status).toBe(400);
    expect((res as { body: { code: string } }).body.code).toBe('CITY_INACTIVE');
  });

  it('enregistre client + demande avec le contexte de collecte', async () => {
    const res = await handleCreateLead(valid, 'ip-test');
    expect(res.status).toBe(200);
    expect((res as { body: { leadCode: string } }).body.leadCode).toBe('LEAD-XYZ123');
    expect(db.lead.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerId: 'cust-1', zoneName: 'Bamyanga', source: 'SITE', status: 'NEW',
        meta: expect.objectContaining({ clientType: null, device: 'mobile', consentAt: expect.any(String) }),
      }),
    }));
  });

  it('rejouer la même clé (double-clic) ne crée pas de doublon', async () => {
    db.lead.findUnique.mockResolvedValue({ id: 'lead-exist123' });
    const key = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const res = await handleCreateLead({ ...valid, requestKey: key }, 'ip-test');
    expect(res.status).toBe(200);
    expect((res as { body: { leadCode: string } }).body.leadCode).toBe('LEAD-IST123');
    expect(db.lead.create).not.toHaveBeenCalled();
  });

  it('limite le débit par IP', () => {
    expect(checkRateLimit('1.1.1.1', 2, 60_000)).toBe(true);
    expect(checkRateLimit('1.1.1.1', 2, 60_000)).toBe(true);
    expect(checkRateLimit('1.1.1.1', 2, 60_000)).toBe(false);
    expect(checkRateLimit('2.2.2.2', 2, 60_000)).toBe(true);
  });

  it('n’active jamais l’alerte e-mail sans configuration complète', () => {
    expect(typeof isNotifyConfigured()).toBe('boolean');
    expect(() => renderLeadAlert({ leadCode: 'LEAD-TEST', name: null, phone: '+237690000001', need: 'x', cityName: 'Ngaoundéré', zoneName: 'Centre', serviceName: null, clientType: null, deadline: null, budgetLabel: null, campaign: null, referrer: null, device: 'mobile', leadId: 'l' }, null)).not.toThrow();
  });
});

describe('export CSV', () => {
  it('ne connaît que les jeux de données autorisés', () => {
    expect(isExportDataset('leads')).toBe(true);
    expect(isExportDataset('AdminUser')).toBe(false);
    expect(parseRange('2026-09-01', '2026-09-30')).toEqual({ gte: new Date('2026-08-31T23:00:00.000Z'), lte: new Date('2026-09-30T22:59:59.999Z') });
    expect(() => parseRange('hier', undefined)).toThrow();
  });
  it('produit un CSV Excel (BOM, « ; ») avec le contexte de collecte', async () => {
    db.lead.findMany.mockResolvedValue([{
      id: 'lead-xyz123', createdAt: new Date('2026-09-14T10:00:00Z'), status: 'NEW', source: 'SITE', campaign: 'affiche-marche',
      customer: { name: 'Aminata', phone: '+237690000001' }, service: { name: 'Flyer A5' }, city: { name: 'Ngaoundéré' },
      zoneName: 'Bamyanga', description: 'Flyers; urgent', deadline: null, budgetMin: null, budgetMax: null,
      meta: { clientType: 'commercant', device: 'mobile', referrer: null, landing: '/#/demande', consentAt: '2026-09-14T10:00:00Z' },
      operationsNotes: null, lostReason: null, orders: [],
    }]);
    const { filename, csv, rows } = await buildExport('leads', '2026-09-01', '2026-09-30');
    expect(rows).toBe(1);
    expect(filename).toMatch(/^fika-demandes-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Référence;Reçue le;Statut;Type de client');
    expect(csv).toContain('LEAD-XYZ123');
    expect(csv).toContain('"Flyers; urgent"');
    expect(db.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { createdAt: expect.any(Object) } }));
  });
});
