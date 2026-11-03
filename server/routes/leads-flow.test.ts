import { describe, it, expect, beforeEach, vi } from 'vitest';

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  city: { findFirst: vi.fn() },
  service: { findFirst: vi.fn() },
  customer: { upsert: vi.fn() },
  lead: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  order: { findUnique: vi.fn(), create: vi.fn() },
  leadEvent: { create: vi.fn() },
  orderEvent: { create: vi.fn() },
  documentCounter: { findUnique: vi.fn(), upsert: vi.fn() },
  serviceRequestFile: { updateMany: vi.fn() },
}));

vi.mock('../../src/lib/prisma', () => ({ prisma: db }));

import { handleCreateLead } from './leads';
import { leadPayloadSchema } from '../../src/lib/lead';
import { handleConvertLead } from './admin-leads';
import { simpleRequestSchema } from '../../src/lib/simple-request';

const adminId = 'admin-test-id';

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (fn) => fn(db));
  db.city.findFirst.mockResolvedValue({ id: 'city-ngaoundere', name: 'Ngaoundéré', active: true });
  db.customer.upsert.mockImplementation(async ({ create }) => ({ id: 'cust-1', ...create }));
  db.lead.create.mockImplementation(async ({ data }) => ({ id: 'lead-cuid-123456', ...data }));
  db.documentCounter.findUnique.mockResolvedValue({ key: 'counter', value: 1041 });
  db.documentCounter.upsert.mockResolvedValue({ value: 1042 });
  db.order.findUnique.mockResolvedValue(null);
});

describe('Parcours simple : formulaire → enregistrement → commande', () => {
  it('valide côté client : besoin, quartier, téléphone camerounais, consentement', () => {
    const ok = { need: 'Mon robinet fuit', zoneName: 'Baladji 1', phone: '6 77 12 34 56', name: 'Oumarou D.', urgency: 'URGENT', consent: true };
    expect(simpleRequestSchema.safeParse(ok).success).toBe(true);
    expect(simpleRequestSchema.safeParse({ ...ok, need: 'abc' }).success).toBe(false);
    expect(simpleRequestSchema.safeParse({ ...ok, zoneName: '' }).success).toBe(false);
    expect(simpleRequestSchema.safeParse({ ...ok, phone: '099999999' }).success).toBe(false);
    expect(simpleRequestSchema.safeParse({ ...ok, consent: false }).success).toBe(false);
  });

  it('lie les pièces jointes au lead créé, uniquement celles non encore attribuées (fileIds)', async () => {
    db.serviceRequestFile.updateMany.mockResolvedValue({ count: 2 });
    db.service.findFirst.mockResolvedValue({ id: 'svc-vitrine' });
    const created = await handleCreateLead({
      need: 'Je veux un site vitrine pour ma boutique', zoneName: 'Baladji 1',
      phone: '6 77 12 34 56', name: 'Aïcha M.', urgency: 'FEW_DAYS', consent: true,
      cityName: 'Ngaoundéré',
      serviceId: 'site-vitrine',
      fileIds: ['file-cuid-aaa', 'file-cuid-bbb'],
    }, 'ip-test');
    expect(created.status).toBe(200);
    // Liaison anti-détournement : where leadId: null — jamais d'écrasement d'une autre demande.
    expect(db.serviceRequestFile.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['file-cuid-aaa', 'file-cuid-bbb'] }, leadId: null },
      data: { leadId: 'lead-cuid-123456' },
    });
  });

  it('valide fileIds : 3 maximum, identifiants plausibles', () => {
    const base = { need: 'Besoin d’aide', zoneName: 'Baladji 1', phone: '6 77 12 34 56', consent: true };
    const ok = { ...base, fileIds: ['file-cuid-aaa', 'file-cuid-bbb', 'file-cuid-ccc'] };
    expect(leadPayloadSchema.safeParse(ok).success).toBe(true);
    expect(leadPayloadSchema.safeParse({ ...base, fileIds: ['a', 'b', 'c', 'd'] }).success).toBe(false);
    expect(leadPayloadSchema.safeParse({ ...base, fileIds: ['court'] }).success).toBe(false);
  });

  it('sans fileIds, aucune requête de liaison n’est envoyée', async () => {
    await handleCreateLead({
      need: 'Besoin d’un plombier demain', zoneName: 'Baladji 1',
      phone: '6 77 12 34 56', name: 'Paul T.', urgency: 'URGENT', consent: true,
      cityName: 'Ngaoundéré',
    }, 'ip-test');
    expect(db.serviceRequestFile.updateMany).not.toHaveBeenCalled();
  });

  it('enregistre la demande (handleCreateLead) puis la convertit en commande', async () => {
    // 1. Enregistrement serveur
    const created = await handleCreateLead({
      need: 'Mon robinet fuit sous l\'évier de la cuisine', zoneName: 'Baladji 1',
      phone: '6 77 12 34 56', name: 'Oumarou D.', urgency: 'URGENT', consent: true,
      cityName: 'Ngaoundéré', deadline: 'Très urgent',
    }, 'ip-test');
    expect(created.status).toBe(200);

    // 2. Conversion admin
    db.lead.findUnique.mockResolvedValue({
      id: 'lead-cuid-123456', status: 'NEW', customerId: 'cust-1', serviceId: null,
      cityId: 'city-ngaoundere', zoneName: 'Baladji 1', description: 'Mon robinet fuit', source: 'SITE',
      operationsNotes: null, lostReason: null, archiveBatchId: null,
    });
    db.order.create.mockImplementation(async ({ data }) => ({ id: 'order-1', orderNumber: 'CMD-2026-1042', ...data }));

    const converted = await handleConvertLead({ leadId: 'lead-cuid-123456' }, adminId);
    expect(converted.status).toBe(200);
    expect((converted as { body: { orderNumber: string } }).body.orderNumber).toBe('CMD-2026-1042');
    expect(db.order.create).toHaveBeenCalledWith({ data: expect.objectContaining({ customerId: 'cust-1', status: 'QUALIFYING' }) });
    expect(db.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-cuid-123456' },
      data: expect.objectContaining({
        status: 'CONVERTED', customerId: 'cust-1', archiveBatchId: null,
        history: { create: { actorId: adminId, changes: expect.objectContaining({ from: 'NEW', to: 'CONVERTED' }) } },
      }),
    });
  });

  it('rejouer une conversion retrouve la commande existante (idempotence)', async () => {
    db.order.findUnique.mockResolvedValue({ id: 'order-1', orderNumber: 'CMD-2026-1042' });
    const replay = await handleConvertLead({ leadId: 'lead-cuid-123456' }, adminId);
    expect(replay.status).toBe(200);
    expect((replay as { body: { orderNumber: string } }).body.orderNumber).toBe('CMD-2026-1042');
    expect(db.order.create).not.toHaveBeenCalled();
  });

  it('refuse de convertir une demande déjà convertie', async () => {
    db.order.findUnique.mockResolvedValue(null);
    db.lead.findUnique.mockResolvedValue({ id: 'lead-cuid-123456', status: 'LOST', customerId: 'cust-1', orders: [] });
    const refused = await handleConvertLead({ leadId: 'lead-cuid-123456' }, adminId);
    expect(refused.status).toBe(409);
  });
});
