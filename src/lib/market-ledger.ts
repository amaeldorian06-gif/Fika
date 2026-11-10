/**
 * Relevés & marges Fika Market — calculs purs (testables sans base).
 *
 * Le fondateur écrit ses relevés dans l'admin : encaissements (paiements
 * confirmés) et coûts payés (dépenses, rattachées ou non à une commande).
 * Le logiciel calcule directement : totaux, solde, ventilation par
 * catégorie et marge par commande.
 *
 * Règles :
 * - Encaissé = paiements CONFIRMÉS uniquement (un PENDING n'est pas de l'argent reçu).
 * - Dépensé = toutes les dépenses (par commande, par lot ou générales).
 * - Solde = encaissé − dépensé.
 * - Marge d'une commande = encaissements confirmés de la commande − dépenses
 *   rattachées à cette commande. Ce n'est PAS un « profit net » : les coûts
 *   partagés (lots, charges générales) ne sont pas alloués ici.
 */

export type LedgerPaymentStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface LedgerPaymentInput {
  orderId: string;
  amount: number;
  status: LedgerPaymentStatus;
  method: string | null;
}

export interface LedgerExpenseInput {
  orderId: string | null;
  amount: number;
  category: string;
}

export interface LedgerOrderInput {
  id: string;
  orderNumber: string;
  customerName: string | null;
  status: string;
}

/** Libellés français des catégories de dépenses (unique source, client + serveur). */
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  FREIGHT: 'Fret international',
  INSURANCE: 'Assurance',
  CUSTOMS: 'Droits et taxes',
  CLEARANCE: 'Dédouanement',
  LOCAL_TRANSPORT: 'Transport local',
  PACKAGING: 'Emballage',
  PURCHASE: 'Achat marchandise',
  RENT: 'Loyer',
  COMMUNICATION: 'Data / téléphone',
  OTHER: 'Autre',
};

/** Catégories proposées dans le formulaire de relevé (ordre métier). */
export const EXPENSE_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'PURCHASE', label: EXPENSE_CATEGORY_LABELS.PURCHASE },
  { value: 'LOCAL_TRANSPORT', label: EXPENSE_CATEGORY_LABELS.LOCAL_TRANSPORT },
  { value: 'PACKAGING', label: EXPENSE_CATEGORY_LABELS.PACKAGING },
  { value: 'FREIGHT', label: EXPENSE_CATEGORY_LABELS.FREIGHT },
  { value: 'CUSTOMS', label: EXPENSE_CATEGORY_LABELS.CUSTOMS },
  { value: 'RENT', label: EXPENSE_CATEGORY_LABELS.RENT },
  { value: 'COMMUNICATION', label: EXPENSE_CATEGORY_LABELS.COMMUNICATION },
  { value: 'OTHER', label: EXPENSE_CATEGORY_LABELS.OTHER },
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  MTN_MOMO: 'MTN MoMo',
  ORANGE_MONEY: 'Orange Money',
  CASH: 'Espèces',
};

export interface LedgerOrderRow {
  id: string;
  orderNumber: string;
  customerName: string | null;
  status: string;
  encaisse: number;
  paye: number;
  marge: number;
}

export interface LedgerResult {
  totals: { encaisse: number; depense: number; solde: number };
  byCategory: { category: string; label: string; total: number }[];
  orders: LedgerOrderRow[];
}

export function computeLedger(
  payments: LedgerPaymentInput[],
  expenses: LedgerExpenseInput[],
  orders: LedgerOrderInput[],
): LedgerResult {
  const encaisse = payments
    .filter((p) => p.status === 'CONFIRMED')
    .reduce((sum, p) => sum + p.amount, 0);

  const depense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const byId = new Map(orders.map((o) => [o.id, o]));
  const encaisseParOrdre = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== 'CONFIRMED') continue;
    encaisseParOrdre.set(p.orderId, (encaisseParOrdre.get(p.orderId) ?? 0) + p.amount);
  }
  const payeParOrdre = new Map<string, number>();
  for (const e of expenses) {
    if (!e.orderId || !byId.has(e.orderId)) continue; // dépense générale ou lot : pas de marge par commande
    payeParOrdre.set(e.orderId, (payeParOrdre.get(e.orderId) ?? 0) + e.amount);
  }

  const rows: LedgerOrderRow[] = orders.map((o) => {
    const rec = encaisseParOrdre.get(o.id) ?? 0;
    const paid = payeParOrdre.get(o.id) ?? 0;
    return { id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, status: o.status, encaisse: rec, paye: paid, marge: rec - paid };
  });

  const parCategorie = new Map<string, number>();
  for (const e of expenses) {
    parCategorie.set(e.category, (parCategorie.get(e.category) ?? 0) + e.amount);
  }
  const byCategory = [...parCategorie.entries()]
    .map(([category, total]) => ({ category, label: EXPENSE_CATEGORY_LABELS[category] ?? category, total }))
    .sort((a, b) => b.total - a.total);

  return { totals: { encaisse, depense, solde: encaisse - depense }, byCategory, orders: rows };
}
