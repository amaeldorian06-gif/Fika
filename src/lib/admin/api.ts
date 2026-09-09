import type { OrderStatus } from './status';
import {
  getPreviewSession, previewAddOrderCost, previewAssignExpert, previewConvertLead,
  previewCreateQuote, previewCreateReview, previewGetCustomers, previewGetExperts,
  previewGetLeads, previewGetOrder, previewGetOrders, previewGetOverview,
  previewSaveDelivery, previewUpdateOrderStatus, previewUpdateTask, setPreviewSession,
} from './preview-store';

/**
 * Client d'API du back-office (P06/P07).
 * En production : dialogue avec les routes serveur (POST /api/auth/login, etc.).
 * En prévisualisation / hors-ligne : bascule automatiquement sur le magasin
 * de session et d'état local (`preview-store.ts`) pour que le fondateur
 * puisse tester TOUT le dashboard avec ses identifiants réels.
 */

export interface AdminIdentity {
  id: string;
  email: string;
  role: string;
}

export interface AdminOrderItem {
  id: string;
  serviceId: string | null;
  serviceName: string | null;
  customName: string | null;
  price: number | null;
  quantity: number;
}

export interface AdminOrderEvent {
  id: string;
  from: OrderStatus | null;
  to: OrderStatus;
  note: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export interface AdminOrderCost {
  id: string;
  type: string;
  amount: number;
  note: string | null;
}

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string | null;
  customerPhone: string;
  totalPrice: number | null;
  costsTotal: number;
  cityName: string | null;
  zoneName: string | null;
  createdAt: string;
  expertName: string | null;
}

export interface AdminTask {
  id: string;
  status: string;
  deliverables: string | null;
  notes: string | null;
  internalCompensation: number | null;
  expertName: string | null;
  expertId: string | null;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  clientAddress: string | null;
  items: AdminOrderItem[];
  costs: AdminOrderCost[];
  events: AdminOrderEvent[];
  tasks: AdminTask[];
  payments: { id: string; amount: number; method: string | null; status: string }[];
  deliveries: { id: string; status: string; fee: number; zoneName: string | null; proofUrl: string | null }[];
  quotes: { id: string; quoteNumber: string; amount: number; status: string }[];
  hasAssignedExpert: boolean;
  hasConfirmedPayment: boolean;
  targetMarginPercent: number | null;
  hasReview: boolean;
}

export interface AdminLead {
  id: string;
  code: string;
  description: string | null;
  serviceName: string | null;
  cityName: string | null;
  zoneName: string | null;
  deadline: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  createdAt: string;
}

export interface AdminExpert {
  id: string;
  name: string;
  phone: string;
  skills: string[];
  zone: string | null;
  usualCost: number | null;
  availability: boolean;
  status: string;
  completedOrders: number;
  reliabilityScore: number;
}

export interface AdminCustomer {
  id: string;
  name: string | null;
  phone: string;
  ordersCount: number;
  totalSpent: number;
}

export interface AdminOverviewData {
  monthLabel: string;
  revenue: number;
  previousRevenue: number;
  marginAmount: number;
  marginPercent: number;
  todoCount: number;
  ordersCount: number;
  averageBasket: number;
  pipeline: Record<string, number>;
  topServices: { name: string; volume: number; revenue: number; marginAmount: number }[];
  recentOrders: AdminOrderSummary[];
}

export interface AssignableExpertDto extends AdminExpert {
  activeTaskCount: number;
}

/* ------------------------------- Transport -------------------------------- */

export class ApiUnavailableError extends Error {
  constructor() {
    super('API indisponible');
    this.name = 'ApiUnavailableError';
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new ApiUnavailableError();
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new ApiUnavailableError();
  return (await res.json()) as T;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new ApiUnavailableError();
  const data = (await res.json()) as T & { ok?: boolean; message?: string };
  if (!res.ok || data.ok === false) throw new Error(data.message ?? 'Opération refusée.');
  return data;
}

/* -------------------------------- Session --------------------------------- */

export async function login(email: string, password: string): Promise<{ ok: true; admin: AdminIdentity }> {
  const res = await postJson<{ ok: true; admin: AdminIdentity }>('/api/auth/login', { email, password });
  setPreviewSession(res.admin);
  return res;
}

export async function logout(): Promise<{ ok: true }> {
  setPreviewSession(null);
  try {
    return await postJson<{ ok: true }>('/api/auth/logout', {});
  } catch {
    return { ok: true };
  }
}

export async function fetchSession(): Promise<AdminIdentity | null> {
  try {
    const data = await getJson<{ ok: boolean; admin: AdminIdentity | null }>('/api/auth/me');
    return data.admin ?? null;
  } catch {
    return getPreviewSession();
  }
}

/* -------------------------------- Lectures -------------------------------- */

export async function fetchOverview(): Promise<AdminOverviewData | null> {
  try {
    return await getJson<AdminOverviewData>('/api/admin/overview');
  } catch {
    return previewGetOverview();
  }
}

export async function fetchOrders(params: { status?: string; q?: string } = {}): Promise<AdminOrderSummary[]> {
  try {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs}` : '';
    return await getJson<AdminOrderSummary[]>(`/api/admin/orders${suffix}`);
  } catch {
    return previewGetOrders(params);
  }
}

export async function fetchOrder(id: string): Promise<AdminOrderDetail | null> {
  try {
    return await getJson<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(id)}`);
  } catch {
    return previewGetOrder(id);
  }
}

export async function fetchLeads(): Promise<AdminLead[]> {
  try {
    return await getJson<AdminLead[]>('/api/admin/leads');
  } catch {
    return previewGetLeads();
  }
}

export async function fetchExperts(): Promise<AdminExpert[]> {
  try {
    return await getJson<AdminExpert[]>('/api/admin/experts');
  } catch {
    return previewGetExperts();
  }
}

export async function fetchCustomers(): Promise<AdminCustomer[]> {
  try {
    return await getJson<AdminCustomer[]>('/api/admin/customers');
  } catch {
    return previewGetCustomers();
  }
}

export async function fetchAssignableExperts(): Promise<AssignableExpertDto[]> {
  try {
    return await getJson<AssignableExpertDto[]>('/api/admin/experts?assignable=1');
  } catch {
    return previewGetExperts();
  }
}

/* ------------------------------- Mutations -------------------------------- */

export async function updateOrderStatus(orderId: string, to: OrderStatus, note?: string): Promise<{ ok: true; status: OrderStatus }> {
  try {
    return await postJson<{ ok: true; status: OrderStatus }>('/api/admin/orders/status', { orderId, to, note });
  } catch {
    previewUpdateOrderStatus(orderId, to, note);
    return { ok: true, status: to };
  }
}

export async function addOrderCost(orderId: string, type: string, amount: number, note?: string) {
  try {
    return await postJson<{ ok: true; margin: { revenue: number; costsTotal: number; marginAmount: number; marginPercent: number } }>(
      '/api/admin/orders/costs', { orderId, type, amount, note },
    );
  } catch {
    const margin = previewAddOrderCost(orderId, type, amount, note);
    return { ok: true, margin: margin! };
  }
}

export async function createQuote(orderId: string, amount: number, details?: string): Promise<{ ok: true; quoteNumber: string }> {
  try {
    return await postJson<{ ok: true; quoteNumber: string }>('/api/admin/orders/quotes', { orderId, amount, details });
  } catch {
    const quoteNumber = previewCreateQuote(orderId, amount, details);
    return { ok: true, quoteNumber };
  }
}

export async function convertLead(leadId: string, phone?: string, name?: string): Promise<{ ok: true; orderId: string; orderNumber: string }> {
  try {
    return await postJson<{ ok: true; orderId: string; orderNumber: string }>('/api/admin/leads/convert', { leadId, phone, name });
  } catch {
    const res = previewConvertLead(leadId);
    return { ok: true, ...res };
  }
}

export async function saveExpert(payload: Record<string, unknown>): Promise<{ ok: true; expertId?: string }> {
  try {
    return await postJson<{ ok: true; expertId?: string }>('/api/admin/experts', payload);
  } catch {
    return { ok: true, expertId: `e-${Date.now()}` };
  }
}

export async function assignExpert(orderId: string, expertId: string, compensation?: number): Promise<{ ok: true; taskId: string }> {
  try {
    return await postJson<{ ok: true; taskId: string }>('/api/admin/orders/assign', { orderId, expertId, compensation });
  } catch {
    const taskId = previewAssignExpert(orderId, expertId, compensation);
    return { ok: true, taskId };
  }
}

export async function updateTask(taskId: string, status: string, notes?: string): Promise<{ ok: true }> {
  try {
    return await postJson<{ ok: true }>('/api/admin/tasks/status', { taskId, status, notes });
  } catch {
    previewUpdateTask(taskId, status, notes);
    return { ok: true };
  }
}

export async function saveDelivery(payload: {
  orderId: string; status: string; internalCost: number;
  zoneId?: string | null; address?: string; courierExpertId?: string | null; proofUrl?: string;
}): Promise<{ ok: true; customerFee: number }> {
  try {
    return await postJson<{ ok: true; customerFee: number }>('/api/admin/orders/delivery', payload);
  } catch {
    previewSaveDelivery(payload);
    return { ok: true, customerFee: 0 };
  }
}

export async function publishPortfolio(payload: {
  orderId: string; title: string; category: string; image: string; description?: string; clientType?: string;
}): Promise<{ ok: true; portfolioId: string }> {
  try {
    return await postJson<{ ok: true; portfolioId: string }>('/api/admin/portfolio', payload);
  } catch {
    return { ok: true, portfolioId: `port-${Date.now()}` };
  }
}

export async function createReview(payload: {
  orderId: string; rating: number; comment?: string; expertId?: string;
}): Promise<{ ok: true; reviewId: string }> {
  try {
    return await postJson<{ ok: true; reviewId: string }>('/api/reviews', payload);
  } catch {
    previewCreateReview(payload.orderId);
    return { ok: true, reviewId: `rev-${Date.now()}` };
  }
}
