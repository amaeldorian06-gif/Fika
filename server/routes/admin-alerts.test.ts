import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  lead: { count: vi.fn() },
  order: { count: vi.fn() },
  taskAssignment: { count: vi.fn() },
  task: { count: vi.fn() },
  marketOrder: { count: vi.fn() },
  payment: { count: vi.fn() },
  marketPayment: { count: vi.fn() },
}));

vi.mock('../../src/lib/prisma', () => ({ prisma: db }));

import { getAdminAlerts } from './admin-alerts';

beforeEach(() => {
  vi.resetAllMocks();
  for (const model of Object.values(db)) model.count.mockResolvedValue(0);
});

describe('alertes du pilotage prestataires', () => {
  it('signale les affectations sans réponse et les missions échues', async () => {
    db.taskAssignment.count.mockResolvedValue(2);
    db.task.count.mockResolvedValue(1);

    const alerts = await getAdminAlerts();

    expect(alerts).toContainEqual(expect.objectContaining({
      key: 'provider-response', count: 2, severity: 'action',
    }));
    expect(alerts).toContainEqual(expect.objectContaining({
      key: 'tasks-overdue', count: 1, severity: 'action',
    }));
    expect(db.taskAssignment.count).toHaveBeenCalledWith({
      where: { status: 'ASSIGNED', task: { status: 'ASSIGNED' } },
    });
    expect(db.task.count).toHaveBeenCalledWith({
      where: { deadline: { lt: expect.any(Date) }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    });
  });

  it('n’affiche aucune alerte de pilotage lorsque les compteurs sont nuls', async () => {
    expect(await getAdminAlerts()).toEqual([]);
  });
});
