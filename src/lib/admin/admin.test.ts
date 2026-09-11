import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS, canTransition, orderStatusLabel, transitionOptions,
  type OrderStatus,
} from './status';
import {
  computeKpis, computeTopServices, computeTrend, countByStatus,
  formatMonthLabel, monthBounds, type KpiOrder,
} from './kpi';

const ctx = { hasAssignedExpert: true, hasConfirmedPayment: true, hasItems: true };

function order(partial: Partial<KpiOrder> & { status: OrderStatus }): KpiOrder {
  return {
    id: 'o1', totalPrice: 10000, createdAt: new Date('2026-09-10'),
    costs: [], items: [], ...partial,
  };
}

describe('libellés de statut', () => {
  it('traduit tous les statuts en français (aucun label brut)', () => {
    const statuses = Object.keys(ALLOWED_TRANSITIONS) as OrderStatus[];
    for (const s of statuses) {
      const label = orderStatusLabel(s);
      expect(label).not.toBe(s);
      expect(label).not.toMatch(/_/);
    }
    expect(orderStatusLabel('QUALITY_CHECK')).toBe('Contrôle qualité');
    expect(orderStatusLabel('IN_PROGRESS')).toBe('En cours');
  });
});

describe('canTransition', () => {
  it('refuse une transition hors graphe', () => {
    const res = canTransition('NEW', 'COMPLETED', ctx);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('Transition impossible');
  });

  it('refuse le même statut', () => {
    expect(canTransition('PAID', 'PAID', ctx).ok).toBe(false);
  });

  it('ASSIGNED exige un expert', () => {
    const res = canTransition('PAID', 'ASSIGNED', { ...ctx, hasAssignedExpert: false });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('Assignez un expert');
  });

  it('PAID exige un paiement confirmé', () => {
    const res = canTransition('QUOTED', 'PAID', { ...ctx, hasConfirmedPayment: false });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('paiement confirmé');
  });

  it('COMPLETED exige un paiement confirmé', () => {
    expect(canTransition('DELIVERED', 'COMPLETED', { ...ctx, hasConfirmedPayment: false }).ok).toBe(false);
    expect(canTransition('DELIVERED', 'COMPLETED', ctx).ok).toBe(true);
  });

  it('QUOTED exige au moins une ligne', () => {
    expect(canTransition('QUALIFYING', 'QUOTED', { ...ctx, hasItems: false }).ok).toBe(false);
  });

  it('chemin nominal complet autorisé', () => {
    const path: OrderStatus[] = ['NEW', 'QUALIFYING', 'QUOTED', 'PAID', 'ASSIGNED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'DELIVERED', 'COMPLETED'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1], ctx).ok).toBe(true);
    }
  });

  it('transitionOptions expose le motif de blocage', () => {
    const opts = transitionOptions('PAID', { ...ctx, hasAssignedExpert: false });
    const assigned = opts.find((o) => o.status === 'ASSIGNED');
    expect(assigned?.check.ok).toBe(false);
    expect(assigned?.label).toBe('Assignée');
  });
});

describe('KPIs', () => {
  it('CA = commandes payées→terminées uniquement', () => {
    const kpis = computeKpis([
      order({ status: 'COMPLETED', totalPrice: 20000 }),
      order({ status: 'PAID', totalPrice: 15000 }),
      order({ status: 'NEW', totalPrice: 99000 }),      // exclue
      order({ status: 'CANCELLED', totalPrice: 50000 }), // exclue
    ]);
    expect(kpis.revenue).toBe(35000);
    expect(kpis.ordersCount).toBe(2);
    expect(kpis.averageBasket).toBe(17500);
  });

  it('marge = CA − coûts internes, en FCFA et %', () => {
    const kpis = computeKpis([
      order({ status: 'COMPLETED', totalPrice: 20000, costs: [{ type: 'EXPERT', amount: 8000 }, { type: 'DELIVERY', amount: 2000 }] }),
    ]);
    expect(kpis.marginAmount).toBe(10000);
    expect(kpis.marginPercent).toBe(50);
  });

  it('compte les commandes à traiter', () => {
    const kpis = computeKpis([
      order({ status: 'NEW' }), order({ status: 'QUALIFYING' }),
      order({ status: 'AWAITING_CONFIRMATION' }), order({ status: 'IN_PROGRESS' }),
    ]);
    expect(kpis.todoCount).toBe(3);
  });

  it('aucune commande → tout à zéro (pas de division par zéro)', () => {
    const kpis = computeKpis([]);
    expect(kpis).toMatchObject({ revenue: 0, marginAmount: 0, marginPercent: 0, averageBasket: 0 });
  });
});

describe('tendance et périodes', () => {
  it('calcule la variation vs période précédente', () => {
    expect(computeTrend(112, 100).percent).toBeCloseTo(12, 5);
    expect(computeTrend(112, 100).direction).toBe('up');
    expect(computeTrend(90, 100).direction).toBe('down');
    expect(computeTrend(50, 0).percent).toBeNull();
  });

  it('libellé de mois calculé et capitalisé', () => {
    expect(formatMonthLabel(new Date('2026-09-15'))).toBe('Septembre 2026');
  });

  it('bornes du mois', () => {
    const { from, to } = monthBounds(new Date('2026-09-15'));
    expect(from.getMonth()).toBe(8);
    expect(to.getMonth()).toBe(9);
  });
});

describe('top services & pipeline', () => {
  it('agrège volume, CA et marge au prorata', () => {
    const top = computeTopServices([
      order({
        status: 'COMPLETED', totalPrice: 30000,
        costs: [{ type: 'EXPERT', amount: 10000 }],
        items: [
          { serviceId: 's-des-1', serviceName: 'Création de logo', price: 15000, quantity: 1 },
          { serviceId: 's-des-2', serviceName: 'Flyer professionnel', price: 5000, quantity: 3 },
        ],
      }),
    ]);
    expect(top[0].name).toBe('Flyer professionnel');
    expect(top[0].volume).toBe(3);
    expect(top[0].revenue).toBe(15000);
    expect(top.reduce((s, t) => s + t.marginAmount, 0)).toBe(20000);
  });

  it('compte par statut', () => {
    const counts = countByStatus([order({ status: 'NEW' }), order({ status: 'NEW' }), order({ status: 'PAID' })]);
    expect(counts.NEW).toBe(2);
    expect(counts.PAID).toBe(1);
  });
});
