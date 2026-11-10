import { describe, it, expect } from 'vitest';
import {
  computeLedger, EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_OPTIONS, PAYMENT_METHOD_LABELS,
} from './market-ledger';

const orders = [
  { id: 'o1', orderNumber: 'MKT-2026-0001', customerName: 'Aïcha M.', status: 'DELIVERED' },
  { id: 'o2', orderNumber: 'MKT-2026-0002', customerName: 'Jean P.', status: 'CONFIRMED' },
];

/** Relevés & marges : chaque règle de calcul doit rester vraie (fonction pure). */
describe('computeLedger — relevés & marges', () => {
  it('totaux : encaissé = paiements CONFIRMÉS uniquement, PENDING/REJECTED exclus', () => {
    const r = computeLedger(
      [
        { orderId: 'o1', amount: 10_000, status: 'CONFIRMED', method: 'CASH' },
        { orderId: 'o1', amount: 5_000, status: 'PENDING', method: 'MTN_MOMO' },
        { orderId: 'o2', amount: 7_000, status: 'REJECTED', method: 'ORANGE_MONEY' },
      ],
      [],
      orders,
    );
    expect(r.totals.encaisse).toBe(10_000);
    expect(r.totals.depense).toBe(0);
    expect(r.totals.solde).toBe(10_000);
  });

  it('dépensé = toutes les dépenses (commande + générales) ; solde = encaissé − dépensé', () => {
    const r = computeLedger(
      [{ orderId: 'o1', amount: 20_000, status: 'CONFIRMED', method: 'CASH' }],
      [
        { orderId: 'o1', amount: 8_000, category: 'PURCHASE' },
        { orderId: null, amount: 2_000, category: 'RENT' },
      ],
      orders,
    );
    expect(r.totals.encaisse).toBe(20_000);
    expect(r.totals.depense).toBe(10_000);
    expect(r.totals.solde).toBe(10_000);
  });

  it('marge par commande = encaissements confirmés − dépenses rattachées', () => {
    const r = computeLedger(
      [
        { orderId: 'o1', amount: 20_000, status: 'CONFIRMED', method: 'CASH' },
        { orderId: 'o1', amount: 4_000, status: 'PENDING', method: 'CASH' },
      ],
      [{ orderId: 'o1', amount: 8_000, category: 'PURCHASE' }],
      orders,
    );
    const o1 = r.orders.find((o) => o.id === 'o1')!;
    expect(o1.encaisse).toBe(20_000); // le PENDING ne compte pas
    expect(o1.paye).toBe(8_000);
    expect(o1.marge).toBe(12_000);
    const o2 = r.orders.find((o) => o.id === 'o2')!;
    expect(o2.marge).toBe(0); // aucune écriture
  });

  it('ventilation par catégorie, triée par total décroissant, avec libellés français', () => {
    const r = computeLedger(
      [],
      [
        { orderId: null, amount: 1_000, category: 'COMMUNICATION' },
        { orderId: null, amount: 5_000, category: 'RENT' },
        { orderId: 'o1', amount: 3_000, category: 'PURCHASE' },
        { orderId: 'o1', amount: 4_000, category: 'PURCHASE' },
      ],
      orders,
    );
    expect(r.byCategory.map((c) => c.category)).toEqual(['PURCHASE', 'RENT', 'COMMUNICATION']);
    expect(r.byCategory[0].total).toBe(7_000);
    expect(r.byCategory[0].label).toBe('Achat marchandise');
    expect(r.byCategory.find((c) => c.category === 'COMMUNICATION')?.label).toBe('Data / téléphone');
  });

  it('dépense rattachée à une commande inconnue : compte dans le total, pas dans une marge', () => {
    const r = computeLedger(
      [],
      [{ orderId: 'inconnu', amount: 9_000, category: 'OTHER' }],
      orders,
    );
    expect(r.totals.depense).toBe(9_000);
    expect(r.orders.every((o) => o.paye === 0)).toBe(true);
  });

  it('catalogue de libellés complet : chaque catégorie proposée a un libellé', () => {
    for (const opt of EXPENSE_CATEGORY_OPTIONS) {
      expect(EXPENSE_CATEGORY_LABELS[opt.value]).toBeTruthy();
    }
    for (const m of ['MTN_MOMO', 'ORANGE_MONEY', 'CASH']) {
      expect(PAYMENT_METHOD_LABELS[m]).toBeTruthy();
    }
  });
});
