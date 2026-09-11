import type { OrderStatus } from './status';
/** Client back-office : uniquement des données serveur, aucun repli de démonstration. */

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
  payments: { id: string; amount: number; method: string | null; status: string; reference?: string | null; confirmedAt?: string | null }[];
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

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('fika:unauthorized'));
    throw new Error('Session expirée. Reconnectez-vous.');
  }
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
  if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('fika:unauthorized'));
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new ApiUnavailableError();
  const data = (await res.json()) as T & { ok?: boolean; message?: string };
  if (!res.ok || data.ok === false) throw new Error(data.message ?? 'Opération refusée.');
  return data;
}

/* -------------------------------- Session --------------------------------- */

export async function login(email: string, password: string): Promise<{ ok: true; admin: AdminIdentity }> {
  const res = await postJson<{ ok: true; admin: AdminIdentity }>('/api/auth/login', { email, password });
  return res;
}

export async function logout(): Promise<{ ok: true }> {
  return await postJson<{ ok: true }>('/api/auth/logout', {});
}

export async function fetchSession(): Promise<AdminIdentity | null> {
  try {
    const data = await getJson<{ ok: boolean; admin: AdminIdentity | null }>('/api/auth/me');
    return data.admin ?? null;
  } catch (error) {
    if (error instanceof Error && error.message === 'Session expirée. Reconnectez-vous.') return null;
    throw error;
  }
}

/* -------------------------------- Lectures -------------------------------- */

export async function fetchOverview(): Promise<AdminOverviewData | null> {
  return await getJson<AdminOverviewData>('/api/admin/overview');
}

export async function fetchOrders(params: { status?: string; q?: string } = {}): Promise<AdminOrderSummary[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs}` : '';
  return await getJson<AdminOrderSummary[]>(`/api/admin/orders${suffix}`);
}

export async function fetchOrder(id: string): Promise<AdminOrderDetail | null> {
  return await getJson<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(id)}`);
}

export async function fetchLeads(): Promise<AdminLead[]> {
  return await getJson<AdminLead[]>('/api/admin/leads');
}

export async function fetchExperts(): Promise<AdminExpert[]> {
  return await getJson<AdminExpert[]>('/api/admin/experts');
}

export async function fetchCustomers(): Promise<AdminCustomer[]> {
  return await getJson<AdminCustomer[]>('/api/admin/customers');
}

export async function fetchAssignableExperts(): Promise<AssignableExpertDto[]> {
  return await getJson<AssignableExpertDto[]>('/api/admin/experts?assignable=1');
}

/* ------------------------------- Mutations -------------------------------- */

export async function updateOrderStatus(orderId: string, to: OrderStatus, note?: string): Promise<{ ok: true; status: OrderStatus }> {
  return await postJson<{ ok: true; status: OrderStatus }>('/api/admin/orders/status', { orderId, to, note });
}

export async function addOrderCost(orderId: string, type: string, amount: number, note?: string) {
  return await postJson<{ ok: true; margin: { revenue: number; costsTotal: number; marginAmount: number; marginPercent: number } }>(
    '/api/admin/orders/costs', { orderId, type, amount, note },
  );
}

export async function createQuote(orderId: string, amount: number, details?: string): Promise<{ ok: true; quoteNumber: string }> {
  return await postJson<{ ok: true; quoteNumber: string }>('/api/admin/orders/quotes', { orderId, amount, details });
}

export async function convertLead(leadId: string, phone?: string, name?: string): Promise<{ ok: true; orderId: string; orderNumber: string }> {
  return await postJson<{ ok: true; orderId: string; orderNumber: string }>('/api/admin/leads/convert', { leadId, phone, name });
}

export async function saveExpert(payload: Record<string, unknown>): Promise<{ ok: true; expertId?: string }> {
  return await postJson<{ ok: true; expertId?: string }>('/api/admin/experts', payload);
}

export async function assignExpert(orderId: string, expertId: string, compensation?: number): Promise<{ ok: true; taskId: string }> {
  return await postJson<{ ok: true; taskId: string }>('/api/admin/orders/assign', { orderId, expertId, compensation });
}

export async function updateTask(taskId: string, status: string, notes?: string): Promise<{ ok: true }> {
  return await postJson<{ ok: true }>('/api/admin/tasks/status', { taskId, status, notes });
}

export async function saveDelivery(payload: {
  orderId: string; status: string; internalCost: number;
  zoneId?: string | null; address?: string; courierExpertId?: string | null; proofUrl?: string;
}): Promise<{ ok: true; customerFee: number }> {
  return await postJson<{ ok: true; customerFee: number }>('/api/admin/orders/delivery', payload);
}

export async function publishPortfolio(payload: {
  orderId: string; title: string; category: string; image: string; description?: string; clientType?: string;
}): Promise<{ ok: true; portfolioId: string }> {
  return await postJson<{ ok: true; portfolioId: string }>('/api/admin/portfolio', payload);
}

export async function createReview(payload: {
  orderId: string; rating: number; comment?: string; expertId?: string;
}): Promise<{ ok: true; reviewId: string }> {
  return await postJson<{ ok: true; reviewId: string }>('/api/reviews', payload);
}

export function recordPayment(payload: import('./payments').RecordPaymentInput): Promise<{ ok: true; paymentId: string }> {
  return postJson('/api/admin/payments', payload);
}

export function reviewPayment(payload: { paymentId: string; action: 'CONFIRM' | 'REJECT'; receivedVerified?: boolean; reason?: string }): Promise<{ ok: true; paymentId: string }> {
  return postJson('/api/admin/payments/review', payload);
}
