import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  task: { findUnique: vi.fn(), update: vi.fn() },
  taskAssignment: { update: vi.fn() },
  expert: { update: vi.fn() },
  orderEvent: { create: vi.fn() },
}));

vi.mock('../../src/lib/prisma', () => ({ prisma: db }));

import { handleRecordAssignmentResponse } from './admin-execution';

const task = {
  id: 'task-1',
  status: 'ASSIGNED',
  notes: null,
  order: { id: 'order-1', status: 'ASSIGNED' },
  assignments: [{
    id: 'assignment-1',
    status: 'ASSIGNED',
    expertId: 'expert-1',
    expert: { id: 'expert-1', status: 'ACTIVE' },
  }],
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db));
  db.task.findUnique.mockResolvedValue(task);
  db.taskAssignment.update.mockResolvedValue({});
  db.task.update.mockResolvedValue({});
  db.expert.update.mockResolvedValue({});
  db.orderEvent.create.mockResolvedValue({});
});

describe('réponse prestataire enregistrée par Fika', () => {
  it('exige une session administrateur', async () => {
    expect(await handleRecordAssignmentResponse({
      taskId: 'task-1', response: 'ACCEPTED', source: 'WHATSAPP',
    }, null)).toMatchObject({ status: 401 });
    expect(db.task.findUnique).not.toHaveBeenCalled();
  });

  it('refuse un refus sans motif exploitable', async () => {
    expect(await handleRecordAssignmentResponse({
      taskId: 'task-1', response: 'DECLINED', source: 'PHONE', reason: 'non',
    }, 'admin-1')).toMatchObject({ status: 400 });
    expect(db.taskAssignment.update).not.toHaveBeenCalled();
  });

  it('enregistre une acceptation et une trace horodatée', async () => {
    expect(await handleRecordAssignmentResponse({
      taskId: 'task-1', response: 'ACCEPTED', source: 'WHATSAPP',
    }, 'admin-1')).toMatchObject({ status: 200, body: { ok: true, response: 'ACCEPTED' } });
    expect(db.taskAssignment.update).toHaveBeenCalledWith({
      where: { id: 'assignment-1' }, data: { status: 'ACCEPTED' },
    });
    expect(db.task.update).not.toHaveBeenCalled();
    expect(db.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1', actorId: 'admin-1',
        note: expect.stringContaining('WhatsApp'),
      }),
    });
  });

  it('annule la tâche refusée, libère un expert actif et conserve le motif', async () => {
    expect(await handleRecordAssignmentResponse({
      taskId: 'task-1', response: 'DECLINED', source: 'PHONE', reason: 'Indisponible cette semaine',
    }, 'admin-1')).toMatchObject({ status: 200, body: { response: 'DECLINED' } });
    expect(db.taskAssignment.update).toHaveBeenCalledWith({
      where: { id: 'assignment-1' }, data: { status: 'DECLINED' },
    });
    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: 'task-1' }, data: { status: 'CANCELLED' },
    });
    expect(db.expert.update).toHaveBeenCalledWith({
      where: { id: 'expert-1' }, data: { availability: true },
    });
    expect(db.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ note: expect.stringContaining('Indisponible cette semaine') }),
    });
  });

  it('ne permet pas une seconde réponse ni une réponse après démarrage', async () => {
    db.task.findUnique.mockResolvedValueOnce({ ...task, status: 'IN_PROGRESS' });
    expect(await handleRecordAssignmentResponse({
      taskId: 'task-1', response: 'ACCEPTED', source: 'PHONE',
    }, 'admin-1')).toMatchObject({ status: 409 });
    expect(db.taskAssignment.update).not.toHaveBeenCalled();
  });

  it('ne réactive pas un professionnel en pause ou suspendu', async () => {
    db.task.findUnique.mockResolvedValueOnce({
      ...task, assignments: [{ ...task.assignments[0], expert: { id: 'expert-1', status: 'SUSPENDED' } }],
    });
    await handleRecordAssignmentResponse({
      taskId: 'task-1', response: 'DECLINED', source: 'IN_PERSON', reason: 'Autre mission engagée',
    }, 'admin-1');
    expect(db.expert.update).not.toHaveBeenCalled();
  });
});
