import { describe, expect, it } from 'vitest';
import {
  averageCompletionDays, costBreakdown, financeSummary, leadConversionRate,
  makePeriod, sourceBreakdown, statusFunnel, topServices, weeklyRevenue,
  type AnalyticsEvent, type AnalyticsLead, type AnalyticsOrder,
} from './analytics';

const d = (s: string) => new Date(s);

function order(p: Partial<AnalyticsOrder> & { status: AnalyticsOrder['status'] }): AnalyticsOrder {
  return {
    id: 'o1', totalPrice: 10000, createdAt: d('2026-09-10'), completedAt: null,
    leadId: null, costs: [], payments: [], items: [], ...p,
  };
}

describe('makePeriod', () => {
  it('périodes relatives à la date du jour', () => {
    const p7 = makePeriod('7d', d('2026-09-15T12:00'));
    expect(p7.from.getDate()).toBe(9); // 15 - 6
    expect(p7.label).toBe('7 derniers jours');

    const p30 = makePeriod('30d', d('2026-09-15T12:00'));
    expect(p30.from.getDate()).toBe(17); // 15 - 29 → 17 août

    const month = makePeriod('month', d('2026-09-15T12:00'));
    expect(month.from.getMonth()).toBe(8);
    expect(month.previousFrom.getMonth()).toBe(7);
  });
});

describe('financeSummary', () => {
  it('CA confirmé = paiements confirmés uniquement', () => {
    const s = financeSummary([
      order({ status: 'PAID', totalPrice: 15000, payments: [{ amount: 10000, status: 'CONFIRMED' }, { amount: 5000, status: 'PENDING' }] }),
    ]);
    expect(s.revenueConfirmed).toBe(10000);
  });

  it('marge réelle = totalPrice − coûts, en FCFA et %', () => {
    const s = financeSummary([
      order({ status: 'COMPLETED', totalPrice: 20000, costs: [{ type: 'EXPERT', amount: 8000 }, { type: 'DELIVERY', amount: 2000 }] }),
    ]);
    expect(s.revenueInvoiced).toBe(20000);
    expect(s.costsTotal).toBe(10000);
    expect(s.marginAmount).toBe(10000);
    expect(s.marginPercent).toBe(50);
  });

  it('exclut les commandes non facturables du calcul de marge', () => {
    const s = financeSummary([
      order({ status: 'NEW', totalPrice: 99000, costs: [{ type: 'EXPERT', amount: 1000 }] }),
    ]);
    expect(s.revenueInvoiced).toBe(0);
    expect(s.marginAmount).toBe(0);
  });
});

describe('conversion Lead → Order', () => {
  it('calcule le taux sur les leads de la période', () => {
    const leads: AnalyticsLead[] = [
      { id: 'l1', source: 'SITE', createdAt: d('2026-09-01') },
      { id: 'l2', source: 'SITE', createdAt: d('2026-09-02') },
      { id: 'l3', source: 'WHATSAPP', createdAt: d('2026-09-03') },
      { id: 'l4', source: 'WHATSAPP', createdAt: d('2026-09-04') },
    ];
    const orders = [order({ status: 'QUALIFYING', leadId: 'l1' }), order({ status: 'PAID', leadId: 'l3' })];
    const r = leadConversionRate(leads, orders);
    expect(r.leads).toBe(4);
    expect(r.converted).toBe(2);
    expect(r.percent).toBe(50);
  });

  it('sans lead → null (pas de division par zéro)', () => {
    expect(leadConversionRate([], [order({ status: 'NEW' })]).percent).toBeNull();
  });
});

describe('funnel & sources', () => {
  it('funnel ordonné par étape du pipeline', () => {
    const funnel = statusFunnel([
      order({ status: 'NEW' }), order({ status: 'NEW' }),
      order({ status: 'PAID' }), order({ status: 'COMPLETED' }),
    ]);
    expect(funnel[0].status).toBe('NEW');
    expect(funnel.find((f) => f.status === 'NEW')?.count).toBe(2);
    expect(funnel.find((f) => f.status === 'PAID')?.count).toBe(1);
    // ordre croissant des steps
    expect(funnel.map((f) => f.step)).toEqual([...funnel.map((f) => f.step)].sort((a, b) => a - b));
  });

  it('croise les clics WhatsApp (contexte) et les sources de leads', () => {
    const events: AnalyticsEvent[] = [
      { id: '1', type: 'WACLICK', createdAt: d('2026-09-01'), serviceId: null, campaign: null, meta: { context: 'service-page' } },
      { id: '2', type: 'WACLICK', createdAt: d('2026-09-01'), serviceId: null, campaign: null, meta: { context: 'service-page' } },
      { id: '3', type: 'WACLICK', createdAt: d('2026-09-01'), serviceId: null, campaign: null, meta: { context: 'search' } },
      { id: '4', type: 'LEAD_VIEW', createdAt: d('2026-09-01'), serviceId: null, campaign: null, meta: null },
    ];
    const leads: AnalyticsLead[] = [
      { id: 'l1', source: 'SITE', createdAt: d('2026-09-01') },
      { id: 'l2', source: 'WHATSAPP', createdAt: d('2026-09-01') },
    ];
    const rows = sourceBreakdown(events, leads);
    expect(rows.find((r) => r.source === 'service-page')?.count).toBe(2);
    expect(rows.find((r) => r.source === 'search')?.count).toBe(1);
    expect(rows.find((r) => r.source === 'SITE' && r.kind === 'lead')?.count).toBe(1);
    // LEAD_VIEW n'est pas un WACLICK → absent
    expect(rows.find((r) => r.source === 'inconnu')).toBeUndefined();
  });
});

describe('top services avec écart vs cible', () => {
  it('marque l\u2019écart en points quand une cible existe', () => {
    const rows = topServices(
      [
        order({
          status: 'COMPLETED', totalPrice: 20000,
          costs: [{ type: 'EXPERT', amount: 10000 }],
          items: [{ serviceId: 's1', serviceName: 'Site vitrine', price: 20000, quantity: 1 }],
        }),
      ],
      [{ serviceId: 's1', name: 'Site vitrine', targetMarginPercent: 45 }],
    );
    expect(rows[0].marginPercent).toBe(50);
    expect(rows[0].marginGapPoints).toBe(5);
  });

  it('sans cible → écart null', () => {
    const rows = topServices(
      [order({ status: 'COMPLETED', totalPrice: 10000, items: [{ serviceId: null, serviceName: 'Autre', price: 10000, quantity: 1 }] })],
      [],
    );
    expect(rows[0].marginGapPoints).toBeNull();
  });
});

describe('délais et coûts', () => {
  it('délai moyen de complétion en jours', () => {
    const avg = averageCompletionDays([
      order({ status: 'COMPLETED', createdAt: d('2026-09-01'), completedAt: d('2026-09-04') }),
      order({ status: 'COMPLETED', createdAt: d('2026-09-01'), completedAt: d('2026-09-11') }),
    ]);
    expect(avg).toBe(6.5);
  });

  it('sans commande terminée → null', () => {
    expect(averageCompletionDays([order({ status: 'NEW' })])).toBeNull();
  });

  it('répartition des coûts en % triée', () => {
    const breakdown = costBreakdown([
      order({ status: 'COMPLETED', costs: [{ type: 'EXPERT', amount: 6000 }, { type: 'DELIVERY', amount: 2000 }, { type: 'MATERIAL', amount: 2000 }] }),
    ]);
    expect(breakdown[0].type).toBe('EXPERT');
    expect(breakdown[0].percent).toBe(60);
    expect(breakdown.find((c) => c.type === 'DELIVERY')?.percent).toBe(20);
  });

  it('aucun coût → liste vide', () => {
    expect(costBreakdown([])).toEqual([]);
  });
});

describe('série hebdomadaire', () => {
  it('12 points, CA cumulé par semaine', () => {
    const now = d('2026-09-16T12:00'); // mercredi
    const series = weeklyRevenue(
      [
        order({ status: 'PAID', totalPrice: 5000, createdAt: d('2026-09-15') }),
        order({ status: 'COMPLETED', totalPrice: 7000, createdAt: d('2026-09-16') }),
        order({ status: 'NEW', totalPrice: 99000, createdAt: d('2026-09-15') }), // exclue
      ],
      12,
      now,
    );
    expect(series).toHaveLength(12);
    expect(series.at(-1)?.revenue).toBe(12000); // semaine courante
    expect(series.at(-1)?.weekStart.getDay()).toBe(1); // lundi
  });
});
