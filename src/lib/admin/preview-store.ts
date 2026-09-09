import { computeKpis, computeTopServices, countByStatus, formatMonthLabel, type KpiOrder } from './kpi';
import type { OrderStatus } from './status';
import { computeMargin } from '../pricing';
import type {
  AdminCustomer, AdminIdentity, AdminLead, AdminOrderDetail,
  AdminOrderSummary, AdminOverviewData, AssignableExpertDto,
} from './api';

/**
 * Magasin de données pour la prévisualisation (preview / standalone).
 * Données d'interface utilisées après authentification pour prévisualiser les
 * écrans. Aucun identifiant ni mot de passe n'est embarqué côté navigateur :
 * la connexion passe exclusivement par l'API sécurisée et PostgreSQL.
 */

const SESSION_KEY = 'fika_preview_admin_session';
const ORDERS_KEY = 'fika_preview_orders_v1';
const LEADS_KEY = 'fika_preview_leads_v1';
const EXPERTS_KEY = 'fika_preview_experts_v1';

/* -------------------------------- Session --------------------------------- */

export function getPreviewSession(): AdminIdentity | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AdminIdentity) : null;
  } catch {
    return null;
  }
}

export function setPreviewSession(identity: AdminIdentity | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (identity) sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

/* ------------------------------- État initial ----------------------------- */

interface StoredOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerId: string;
  customerName: string;
  customerPhone: string;
  cityName: string;
  zoneName: string;
  clientAddress: string;
  totalPrice: number | null;
  createdAt: string;
  completedAt: string | null;
  targetMarginPercent: number | null;
  items: { id: string; serviceId: string | null; serviceName: string; price: number | null; quantity: number }[];
  costs: { id: string; type: string; amount: number; note: string | null }[];
  events: { id: string; from: OrderStatus | null; to: OrderStatus; note: string | null; actorEmail: string | null; createdAt: string }[];
  tasks: { id: string; status: string; deliverables: string | null; notes: string | null; internalCompensation: number | null; expertName: string | null; expertId: string | null }[];
  payments: { id: string; amount: number; method: string | null; status: string }[];
  deliveries: { id: string; status: string; fee: number; zoneName: string | null; proofUrl: string | null }[];
  quotes: { id: string; quoteNumber: string; amount: number; status: string }[];
  hasReview: boolean;
}

const INITIAL_ORDERS: StoredOrder[] = [
  {
    id: 'ord-1002',
    orderNumber: 'CMD-2026-0001',
    status: 'IN_PROGRESS',
    customerId: 'c-1',
    customerName: 'Aminata T.',
    customerPhone: '+237 671 164 936',
    cityName: 'Ngaoundéré',
    zoneName: 'Bamyanga',
    clientAddress: 'Face pharmacie du Plateau, Bamyanga',
    totalPrice: 5000,
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    completedAt: null,
    targetMarginPercent: 45,
    items: [{ id: 'i-1', serviceId: 's-des-2', serviceName: 'Flyer professionnel', price: 5000, quantity: 1 }],
    costs: [{ id: 'co-1', type: 'EXPERT', amount: 2000, note: 'Création graphique (Jean-Marc)' }, { id: 'co-2', type: 'DELIVERY', amount: 500, note: 'Transport interne' }],
    events: [
      { id: 'ev-1', from: null, to: 'NEW', note: 'Créée depuis demande WhatsApp.', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString() },
      { id: 'ev-2', from: 'NEW', to: 'QUALIFYING', note: 'Brief validé.', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 32 * 3600 * 1000).toISOString() },
      { id: 'ev-3', from: 'QUALIFYING', to: 'PAID', note: 'Paiement MoMo confirmé.', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString() },
      { id: 'ev-4', from: 'PAID', to: 'ASSIGNED', note: 'Expert assigné : Jean-Marc.', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
      { id: 'ev-5', from: 'ASSIGNED', to: 'IN_PROGRESS', note: 'Première ébauche transmise.', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
    ],
    tasks: [{ id: 't-1', status: 'IN_PROGRESS', deliverables: 'Flyer A5 HD', notes: 'Logo vectoriel reçu', internalCompensation: 2000, expertName: 'Jean-Marc', expertId: 'e-1' }],
    payments: [{ id: 'pay-1', amount: 5000, method: 'MTN Mobile Money', status: 'CONFIRMED' }],
    deliveries: [{ id: 'del-1', status: 'PENDING', fee: 500, zoneName: 'Bamyanga', proofUrl: null }],
    quotes: [{ id: 'q-1', quoteNumber: 'DEV-2026-0001', amount: 5000, status: 'ACCEPTED' }],
    hasReview: false,
  },
  {
    id: 'ord-1003',
    orderNumber: 'CMD-2026-0002',
    status: 'QUOTED',
    customerId: 'c-2',
    customerName: 'Ousmane D.',
    customerPhone: '+237 690 000 001',
    cityName: 'Ngaoundéré',
    zoneName: 'Centre administratif',
    clientAddress: 'Avenue Ahidjo, immeuble CNPS',
    totalPrice: 35000,
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    completedAt: null,
    targetMarginPercent: 45,
    items: [{ id: 'i-2', serviceId: 's-dig-1', serviceName: 'Création de site vitrine', price: 35000, quantity: 1 }],
    costs: [{ id: 'co-3', type: 'EXPERT', amount: 18000, note: 'Développement (Ibrahim)' }],
    events: [
      { id: 'ev-6', from: null, to: 'NEW', note: 'Demande site reçue.', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString() },
      { id: 'ev-7', from: 'NEW', to: 'QUALIFYING', note: 'Besoins détaillés.', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 40 * 3600 * 1000).toISOString() },
      { id: 'ev-8', from: 'QUALIFYING', to: 'QUOTED', note: 'Devis DEV-2026-0002 émis (35 000 F).', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
    ],
    tasks: [],
    payments: [{ id: 'pay-2', amount: 35000, method: 'Orange Money', status: 'PENDING' }],
    deliveries: [],
    quotes: [{ id: 'q-2', quoteNumber: 'DEV-2026-0002', amount: 35000, status: 'SENT' }],
    hasReview: false,
  },
  {
    id: 'ord-1004',
    orderNumber: 'CMD-2026-0003',
    status: 'COMPLETED',
    customerId: 'c-3',
    customerName: 'Sarah B.',
    customerPhone: '+237 670 123 456',
    cityName: 'Ngaoundéré',
    zoneName: 'Madagascar',
    clientAddress: 'Derrière lycée bilingue',
    totalPrice: 12000,
    createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    targetMarginPercent: 45,
    items: [{ id: 'i-3', serviceId: 's-tec-1', serviceName: 'Réparation téléphone', price: 12000, quantity: 1 }],
    costs: [{ id: 'co-4', type: 'EXPERT', amount: 5500, note: 'Écran + pose (Amadou)' }, { id: 'co-5', type: 'DELIVERY', amount: 500, note: 'Course gratuite client' }],
    events: [
      { id: 'ev-9', from: null, to: 'NEW', note: 'Appareil déposé.', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString() },
      { id: 'ev-10', from: 'NEW', to: 'COMPLETED', note: 'Réparé et livré avec succès.', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
    ],
    tasks: [{ id: 't-2', status: 'COMPLETED', deliverables: 'Écran remplacé & testé', notes: 'Batterie vérifiée OK', internalCompensation: 5500, expertName: 'Amadou', expertId: 'e-2' }],
    payments: [{ id: 'pay-3', amount: 12000, method: 'Espèces', status: 'CONFIRMED' }],
    deliveries: [{ id: 'del-2', status: 'DELIVERED', fee: 500, zoneName: 'Madagascar', proofUrl: '/fika/portfolio-1.svg' }],
    quotes: [{ id: 'q-3', quoteNumber: 'DEV-2026-0003', amount: 12000, status: 'ACCEPTED' }],
    hasReview: true,
  },
  {
    id: 'ord-1005',
    orderNumber: 'CMD-2026-0004',
    status: 'COMPLETED',
    customerId: 'c-4',
    customerName: 'Paul N.',
    customerPhone: '+237 679 888 777',
    cityName: 'Ngaoundéré',
    zoneName: 'Haut Plateau',
    clientAddress: 'Cité universitaire',
    totalPrice: 3000,
    createdAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    targetMarginPercent: 45,
    items: [{ id: 'i-4', serviceId: 's-doc-1', serviceName: 'CV professionnel', price: 3000, quantity: 1 }],
    costs: [{ id: 'co-6', type: 'EXPERT', amount: 800, note: 'Mise en page (Marie)' }, { id: 'co-7', type: 'DELIVERY', amount: 200, note: 'Livraison imprimée' }],
    events: [{ id: 'ev-11', from: null, to: 'COMPLETED', note: 'CV livré et validé par le client.', actorEmail: 'admin@fika.cm', createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString() }],
    tasks: [{ id: 't-3', status: 'COMPLETED', deliverables: 'PDF HD + Word', notes: 'Relu 2x', internalCompensation: 800, expertName: 'Marie', expertId: 'e-3' }],
    payments: [{ id: 'pay-4', amount: 3000, method: 'MTN MoMo', status: 'CONFIRMED' }],
    deliveries: [{ id: 'del-3', status: 'DELIVERED', fee: 200, zoneName: 'Haut Plateau', proofUrl: null }],
    quotes: [],
    hasReview: false,
  },
];

const INITIAL_LEADS: AdminLead[] = [
  {
    id: 'lead-1',
    code: 'LEAD-B4F1A9',
    description: 'Besoin d\u2019une traduction rapide français -> anglais pour mon dossier de bourse (15 pages).',
    serviceName: 'Traduction de documents',
    cityName: 'Ngaoundéré',
    zoneName: 'Haut Plateau',
    deadline: 'Sous 4 jours',
    budgetMin: 15000,
    budgetMax: 25000,
    customerName: 'Fatimatou M.',
    customerPhone: '+237 671 164 936',
    status: 'NEW',
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: 'lead-2',
    code: 'LEAD-9C2E71',
    description: 'Installation Wi-Fi et caméras pour ma nouvelle boutique au marché central.',
    serviceName: 'Installation Wi-Fi & réseau',
    cityName: 'Ngaoundéré',
    zoneName: 'Centre administratif',
    deadline: 'La semaine prochaine',
    budgetMin: 30000,
    budgetMax: 50000,
    customerName: 'Aboubakar S.',
    customerPhone: '+237 699 112 233',
    status: 'QUALIFYING',
    createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
  },
  {
    id: 'lead-3',
    code: 'LEAD-1A8D45',
    description: 'Flyer pour l\u2019ouverture d\u2019un salon de coiffure.',
    serviceName: 'Flyer professionnel',
    cityName: 'Ngaoundéré',
    zoneName: 'Bamyanga',
    deadline: 'Urgent (48h)',
    budgetMin: 5000,
    budgetMax: 7000,
    customerName: 'Aminata T.',
    customerPhone: '+237 671 164 936',
    status: 'CONVERTED',
    createdAt: new Date(Date.now() - 40 * 3600 * 1000).toISOString(),
  },
];

const INITIAL_EXPERTS: AssignableExpertDto[] = [
  {
    id: 'e-1',
    name: 'Jean-Marc T.',
    phone: '+237 671 000 001',
    skills: ['Design graphique', 'Flyers', 'Logos'],
    zone: 'Bamyanga',
    usualCost: 2000,
    availability: false, // en cours sur CMD-2026-0001
    status: 'ACTIVE',
    completedOrders: 42,
    reliabilityScore: 4.9,
    activeTaskCount: 1,
  },
  {
    id: 'e-2',
    name: 'Amadou B.',
    phone: '+237 671 000 002',
    skills: ['Réparation mobile', 'Écrans', 'Batteries'],
    zone: 'Madagascar',
    usualCost: 5500,
    availability: true,
    status: 'ACTIVE',
    completedOrders: 38,
    reliabilityScore: 4.8,
    activeTaskCount: 0,
  },
  {
    id: 'e-3',
    name: 'Marie N.',
    phone: '+237 671 000 003',
    skills: ['Rédaction', 'CV', 'Mise en page', 'Traduction'],
    zone: 'Haut Plateau',
    usualCost: 1000,
    availability: true,
    status: 'ACTIVE',
    completedOrders: 31,
    reliabilityScore: 5.0,
    activeTaskCount: 0,
  },
  {
    id: 'e-4',
    name: 'Ibrahim S.',
    phone: '+237 671 000 004',
    skills: ['Développement web', 'Sites vitrines', 'SEO'],
    zone: 'Centre administratif',
    usualCost: 18000,
    availability: true,
    status: 'ACTIVE',
    completedOrders: 14,
    reliabilityScore: 4.7,
    activeTaskCount: 0,
  },
];

/* ------------------------------- Lecture / Écriture ----------------------- */

function getStoredOrders(): StoredOrder[] {
  try {
    const raw = sessionStorage.getItem(ORDERS_KEY);
    if (!raw) {
      sessionStorage.setItem(ORDERS_KEY, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    return JSON.parse(raw) as StoredOrder[];
  } catch {
    return INITIAL_ORDERS;
  }
}

function saveStoredOrders(orders: StoredOrder[]): void {
  try { sessionStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); } catch { /* noop */ }
}

function getStoredLeads(): AdminLead[] {
  try {
    const raw = sessionStorage.getItem(LEADS_KEY);
    if (!raw) {
      sessionStorage.setItem(LEADS_KEY, JSON.stringify(INITIAL_LEADS));
      return INITIAL_LEADS;
    }
    return JSON.parse(raw) as AdminLead[];
  } catch {
    return INITIAL_LEADS;
  }
}

function saveStoredLeads(leads: AdminLead[]): void {
  try { sessionStorage.setItem(LEADS_KEY, JSON.stringify(leads)); } catch { /* noop */ }
}

function getStoredExperts(): AssignableExpertDto[] {
  try {
    const raw = sessionStorage.getItem(EXPERTS_KEY);
    if (!raw) {
      sessionStorage.setItem(EXPERTS_KEY, JSON.stringify(INITIAL_EXPERTS));
      return INITIAL_EXPERTS;
    }
    return JSON.parse(raw) as AssignableExpertDto[];
  } catch {
    return INITIAL_EXPERTS;
  }
}

export function saveStoredExperts(experts: AssignableExpertDto[]): void {
  try { sessionStorage.setItem(EXPERTS_KEY, JSON.stringify(experts)); } catch { /* noop */ }
}

/* ------------------------------ API Handlers (Preview) --------------------- */

export function previewGetOverview(): AdminOverviewData {
  const orders = getStoredOrders();
  const kpiOrders: KpiOrder[] = orders.map((o) => ({
    id: o.id,
    status: o.status,
    totalPrice: o.totalPrice,
    createdAt: new Date(o.createdAt),
    costs: o.costs,
    items: o.items.map((i) => ({
      serviceId: i.serviceId,
      serviceName: i.serviceName,
      price: i.price,
      quantity: i.quantity,
    })),
  }));

  const kpis = computeKpis(kpiOrders);
  const pipeline = countByStatus(kpiOrders);
  const top = computeTopServices(kpiOrders, 5);

  const summaries: AdminOrderSummary[] = orders.slice(0, 5).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    totalPrice: o.totalPrice,
    costsTotal: o.costs.reduce((s, c) => s + c.amount, 0),
    cityName: o.cityName,
    zoneName: o.zoneName,
    createdAt: o.createdAt,
    expertName: o.tasks[0]?.expertName ?? null,
  }));

  return {
    monthLabel: formatMonthLabel(new Date()),
    revenue: kpis.revenue,
    previousRevenue: 48000,
    marginAmount: kpis.marginAmount,
    marginPercent: kpis.marginPercent,
    todoCount: kpis.todoCount,
    ordersCount: kpis.ordersCount,
    averageBasket: kpis.averageBasket,
    pipeline,
    topServices: top,
    recentOrders: summaries,
  };
}

export function previewGetOrders(params: { status?: string; q?: string } = {}): AdminOrderSummary[] {
  const orders = getStoredOrders();
  return orders
    .filter((o) => {
      if (params.status && o.status !== params.status) return false;
      if (params.q) {
        const q = params.q.toLowerCase();
        const hay = `${o.orderNumber} ${o.customerName} ${o.customerPhone} ${o.items.map((i) => i.serviceName).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      totalPrice: o.totalPrice,
      costsTotal: o.costs.reduce((s, c) => s + c.amount, 0),
      cityName: o.cityName,
      zoneName: o.zoneName,
      createdAt: o.createdAt,
      expertName: o.tasks[0]?.expertName ?? null,
    }));
}

export function previewGetOrder(id: string): AdminOrderDetail | null {
  const o = getStoredOrders().find((item) => item.id === id || item.orderNumber === id);
  if (!o) return null;

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    totalPrice: o.totalPrice,
    costsTotal: o.costs.reduce((s, c) => s + c.amount, 0),
    cityName: o.cityName,
    zoneName: o.zoneName,
    clientAddress: o.clientAddress,
    createdAt: o.createdAt,
    expertName: o.tasks[0]?.expertName ?? null,
    items: o.items.map((i) => ({ ...i, customName: null })),
    costs: o.costs,
    events: o.events,
    tasks: o.tasks,
    payments: o.payments,
    deliveries: o.deliveries,
    quotes: o.quotes,
    hasAssignedExpert: o.tasks.length > 0,
    hasConfirmedPayment: o.payments.some((p) => p.status === 'CONFIRMED'),
    targetMarginPercent: o.targetMarginPercent,
    hasReview: o.hasReview,
  };
}

export function previewGetLeads(): AdminLead[] {
  return getStoredLeads();
}

export function previewGetExperts(): AssignableExpertDto[] {
  return getStoredExperts();
}

export function previewGetCustomers(): AdminCustomer[] {
  const orders = getStoredOrders();
  const map = new Map<string, AdminCustomer>();
  for (const o of orders) {
    const key = o.customerPhone;
    const entry = map.get(key) ?? {
      id: o.customerId,
      name: o.customerName,
      phone: o.customerPhone,
      ordersCount: 0,
      totalSpent: 0,
    };
    entry.ordersCount += 1;
    entry.totalSpent += o.totalPrice ?? 0;
    map.set(key, entry);
  }
  return [...map.values()];
}

/* ------------------------------- Mutations (Preview) ---------------------- */

export function previewUpdateOrderStatus(orderId: string, to: OrderStatus, note?: string): void {
  const orders = getStoredOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return;

  const current = orders[idx];
  const updated: StoredOrder = {
    ...current,
    status: to,
    completedAt: to === 'COMPLETED' ? new Date().toISOString() : current.completedAt,
    events: [
      {
        id: `ev-${Date.now()}`,
        from: current.status,
        to,
        note: note ?? null,
        actorEmail: 'admin@fika.cm',
        createdAt: new Date().toISOString(),
      },
      ...current.events,
    ],
  };
  orders[idx] = updated;
  saveStoredOrders(orders);
}

export function previewAddOrderCost(orderId: string, type: string, amount: number, note?: string) {
  const orders = getStoredOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return;

  const current = orders[idx];
  const newCost = { id: `co-${Date.now()}`, type, amount, note: note ?? null };
  const updatedCosts = [...current.costs, newCost];
  orders[idx] = { ...current, costs: updatedCosts };
  saveStoredOrders(orders);

  const revenue = current.totalPrice ?? 0;
  const { marginAmount, marginPercent } = computeMargin(revenue, updatedCosts);
  return {
    revenue,
    costsTotal: updatedCosts.reduce((s, c) => s + c.amount, 0),
    marginAmount,
    marginPercent,
  };
}

export function previewCreateQuote(orderId: string, amount: number, details?: string): string {
  const orders = getStoredOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return 'DEV-2026-0000';

  const current = orders[idx];
  const quoteNumber = `DEV-2026-${String(current.quotes.length + 1).padStart(4, '0')}`;
  orders[idx] = {
    ...current,
    totalPrice: amount,
    quotes: [...current.quotes, { id: `q-${Date.now()}`, quoteNumber, amount, status: 'SENT' }],
    events: [
      {
        id: `ev-${Date.now()}`,
        from: current.status,
        to: current.status,
        note: `Devis ${quoteNumber} émis (${amount} F).${details ? ` ${details}` : ''}`,
        actorEmail: 'admin@fika.cm',
        createdAt: new Date().toISOString(),
      },
      ...current.events,
    ],
  };
  saveStoredOrders(orders);
  return quoteNumber;
}

export function previewConvertLead(leadId: string): { orderId: string; orderNumber: string } {
  const leads = getStoredLeads();
  const leadIdx = leads.findIndex((l) => l.id === leadId);
  const lead = leads[leadIdx];

  const orders = getStoredOrders();
  const orderNumber = `CMD-2026-${String(orders.length + 1).padStart(4, '0')}`;
  const newOrderId = `ord-${Date.now()}`;

  const newOrder: StoredOrder = {
    id: newOrderId,
    orderNumber,
    status: 'QUALIFYING',
    customerId: `c-${Date.now()}`,
    customerName: lead?.customerName ?? 'Nouveau client',
    customerPhone: lead?.customerPhone ?? '+237 671 164 936',
    cityName: lead?.cityName ?? 'Ngaoundéré',
    zoneName: lead?.zoneName ?? 'Centre',
    clientAddress: lead?.zoneName ?? '',
    totalPrice: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    targetMarginPercent: 45,
    items: [{ id: `i-${Date.now()}`, serviceId: null, serviceName: lead?.serviceName ?? lead?.description?.slice(0, 40) ?? 'Prestation', price: null, quantity: 1 }],
    costs: [],
    events: [{ id: `ev-${Date.now()}`, from: null, to: 'QUALIFYING', note: `Créée depuis la demande ${lead?.code ?? ''}.`, actorEmail: 'admin@fika.cm', createdAt: new Date().toISOString() }],
    tasks: [],
    payments: [],
    deliveries: [],
    quotes: [],
    hasReview: false,
  };

  orders.unshift(newOrder);
  saveStoredOrders(orders);

  if (leadIdx >= 0) {
    leads[leadIdx] = { ...leads[leadIdx], status: 'CONVERTED' };
    saveStoredLeads(leads);
  }

  return { orderId: newOrderId, orderNumber };
}

export function previewAssignExpert(orderId: string, expertId: string, compensation?: number): string {
  const orders = getStoredOrders();
  const orderIdx = orders.findIndex((o) => o.id === orderId);
  const experts = getStoredExperts();
  const expert = experts.find((e) => e.id === expertId);
  if (orderIdx < 0 || !expert) return '';

  const current = orders[orderIdx];
  const taskId = `t-${Date.now()}`;
  const comp = compensation ?? expert.usualCost ?? 0;

  orders[orderIdx] = {
    ...current,
    tasks: [...current.tasks, {
      id: taskId,
      status: 'ASSIGNED',
      deliverables: current.items.map((i) => i.serviceName).join(', '),
      notes: null,
      internalCompensation: comp,
      expertName: expert.name,
      expertId: expert.id,
    }],
    costs: comp > 0 ? [...current.costs, { id: `co-${Date.now()}`, type: 'EXPERT', amount: comp, note: `Mission ${expert.name}` }] : current.costs,
    events: [{ id: `ev-${Date.now()}`, from: current.status, to: current.status, note: `Expert assigné : ${expert.name}.`, actorEmail: 'admin@fika.cm', createdAt: new Date().toISOString() }, ...current.events],
  };
  saveStoredOrders(orders);
  return taskId;
}

export function previewUpdateTask(taskId: string, status: string, notes?: string): void {
  const orders = getStoredOrders();
  for (const o of orders) {
    const t = o.tasks.find((task) => task.id === taskId);
    if (t) {
      t.status = status;
      if (notes) t.notes = notes;
      saveStoredOrders(orders);
      return;
    }
  }
}

export function previewSaveDelivery(payload: { orderId: string; status: string; internalCost: number; proofUrl?: string }): void {
  const orders = getStoredOrders();
  const o = orders.find((order) => order.id === payload.orderId);
  if (!o) return;

  const existing = o.deliveries[0];
  if (existing) {
    existing.status = payload.status;
    existing.fee = payload.internalCost;
    if (payload.proofUrl) existing.proofUrl = payload.proofUrl;
  } else {
    o.deliveries.push({
      id: `del-${Date.now()}`,
      status: payload.status,
      fee: payload.internalCost,
      zoneName: o.zoneName,
      proofUrl: payload.proofUrl ?? null,
    });
  }
  saveStoredOrders(orders);
}

export function previewCreateReview(orderId: string): void {
  const orders = getStoredOrders();
  const o = orders.find((order) => order.id === orderId);
  if (o) {
    o.hasReview = true;
    saveStoredOrders(orders);
  }
}
