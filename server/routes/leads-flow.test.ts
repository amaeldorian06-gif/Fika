import { describe, it, expect, beforeEach, vi } from 'vitest';

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  city: { findFirst: vi.fn() },
  service: { findUnique: vi.fn() },
  customer: { upsert: vi.fn() },
  lead: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  order: { findUnique: vi.fn(), create: vi.fn() },
  documentCounter: { findUnique: vi.fn(), upsert: vi.fn() },
  orderEvent: { create: vi.fn() },
}));

vi.mock('../../src/lib/prisma', () => ({ prisma: db }));

import { handleCreateLead } from './leads';
import { handleConvertLead } from './admin-leads';
import { leadFormSchema, toLeadPayload } from '../../src/lib/lead';

describe('Parcours de demande Fika orienté problème (Lead -> Order)', () => {
  const adminId = 'admin-test-id';

  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation(async (fn) => fn(db));
    db.city.findFirst.mockResolvedValue({ id: 'city-ngaoundere', name: 'Ngaoundéré', active: true });
    db.customer.upsert.mockImplementation(async ({ create }) => ({ id: 'cust-1', ...create }));
    db.documentCounter.findUnique.mockResolvedValue({ key: 'counter', value: 1041 });
    db.documentCounter.upsert.mockResolvedValue({ value: 1042 });
    db.order.findUnique.mockResolvedValue(null);
  });

  it('Parcours 1 : Intervention rapide (robinet qui fuit, Fika sélectionne le professionnel)', async () => {
    // 1. Validation du formulaire côté client
    const formInput = {
      track: 'RAPIDE' as const,
      need: "Mon robinet fuit sous l'évier de la cuisine",
      dontKnowPro: true,
      serviceId: '',
      urgency: 'URGENT' as const,
      landmark: 'Face station Total Dang',
      photosCount: 1,
      photoNames: ['photo_fuite.jpg'],
      citySlug: 'ngaoundere',
      zone: 'Baladji 1',
      name: 'Oumarou D.',
      phone: '6 77 12 34 56',
      consent: true,
    };

    const validatedForm = leadFormSchema.parse(formInput);
    expect(validatedForm.dontKnowPro).toBe(true);
    expect(validatedForm.track).toBe('RAPIDE');

    const payload = toLeadPayload(validatedForm);
    expect(payload.phone).toBe('+237677123456');
    expect(payload.zoneName).toContain('Baladji 1 (Repère : Face station Total Dang)');
    expect(payload.need).toContain('[Intervention rapide · Urgence : Très urgent]');
    expect(payload.need).toContain("Problème : Mon robinet fuit sous l'évier de la cuisine");
    expect(payload.need).toContain('Professionnel : Sélection confiée à Fika');

    // Mock de la création du lead
    const createdLead = {
      id: 'lead-cuid-123456',
      customerId: 'cust-1',
      serviceId: null,
      cityId: 'city-ngaoundere',
      zoneName: payload.zoneName,
      description: payload.need,
      deadline: payload.deadline,
      budgetMin: null,
      budgetMax: null,
      source: 'SITE',
      status: 'NEW',
    };
    db.lead.create.mockResolvedValue(createdLead);

    // 2. Traitement serveur de la création
    const createRes = await handleCreateLead(payload, '127.0.0.1');
    expect(createRes.status).toBe(200);
    if (createRes.status !== 200) return;

    expect(createRes.body.ok).toBe(true);
    expect(createRes.body.leadCode).toBe('LEAD-123456');
    expect(db.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'cust-1',
        serviceId: null,
        description: expect.stringContaining('[Intervention rapide · Urgence : Très urgent]'),
        status: 'NEW',
      }),
    });

    // 3. Conversion de la demande en commande par l'admin
    db.lead.findUnique.mockResolvedValue(createdLead);
    db.order.create.mockImplementation(async ({ data }) => ({
      id: 'order-1042',
      orderNumber: 'CMD-2026-1042',
      ...data,
    }));

    const convertRes = await handleConvertLead(
      { leadId: 'lead-cuid-123456' },
      adminId,
    );

    expect(convertRes.status).toBe(200);
    if (convertRes.status !== 200) return;

    expect(convertRes.body.ok).toBe(true);
    expect(convertRes.body.orderNumber).toBe('CMD-2026-1042');

    // Vérifier que la commande a été créée avec l'item personnalisé dérivé du problème
    expect(db.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderNumber: 'CMD-2026-1042',
        customerId: 'cust-1',
        status: 'QUALIFYING',
        items: {
          create: [{
            customName: "Mon robinet fuit sous l'évier de la cuisine", // libellé court = ligne « Problème : … »
            quantity: 1,
            price: null,
          }],
        },
      }),
    });

    // Vérifier que le statut du lead passe à CONVERTED
    expect(db.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-cuid-123456' },
      data: { status: 'CONVERTED', customerId: 'cust-1' },
    });
  });

  it('Parcours 2 : Projet travaux (carrelage avec dimensions, délai et budget indicatif)', async () => {
    const formInput = {
      track: 'TRAVAUX' as const,
      need: "Je cherche quelqu'un pour poser du carrelage dans le salon et le couloir",
      dontKnowPro: true,
      serviceId: '',
      dimensions: 'Environ 40 m²',
      deadline: 'Dès cette semaine',
      landmark: 'Près du carrefour Bamyanga',
      photosCount: 2,
      photoNames: ['salon.jpg', 'couloir.jpg'],
      citySlug: 'ngaoundere',
      zone: 'Bamyanga',
      budgetRange: 'gt50k',
      name: 'Aminata B.',
      phone: '+237 6 99 88 77 66',
      consent: true,
    };

    const validated = leadFormSchema.parse(formInput);
    const payload = toLeadPayload(validated);

    expect(payload.need).toContain('[Projet / Travaux');
    expect(payload.need).toContain('Dimensions / Quantité : Environ 40 m²');
    expect(payload.deadline).toBe('Dès cette semaine');
    expect(payload.budgetMin).toBe(50000);

    const createdLead = {
      id: 'lead-travaux-789012',
      customerId: 'cust-2',
      serviceId: null,
      cityId: 'city-ngaoundere',
      zoneName: payload.zoneName,
      description: payload.need,
      deadline: 'Dès cette semaine',
      budgetMin: 50000,
      budgetMax: null,
      source: 'SITE',
      status: 'NEW',
    };
    db.lead.create.mockResolvedValue(createdLead);

    const createRes = await handleCreateLead(payload, '127.0.0.1');
    expect(createRes.status).toBe(200);
    if (createRes.status !== 200) return;

    expect(createRes.body.leadCode).toBe('LEAD-789012');
    expect(db.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: expect.stringContaining('Dimensions / Quantité : Environ 40 m²'),
        deadline: 'Dès cette semaine',
        budgetMin: 50000,
      }),
    });
  });
});
