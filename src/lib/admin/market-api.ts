import { getJson, postJson } from './api';
import type { MarketAvailability, MarketOrderStatus } from '../market';

/** Client back-office Fika Market : données serveur uniquement, aucun repli fictif. */

export type MarketBatchStatus = 'PLANNED' | 'ORDERED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';
export type MarketDeliveryStatus = 'PENDING' | 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
export type MarketPaymentMethod = 'MTN_MOMO' | 'ORANGE_MONEY' | 'CASH';

export interface MarketCategoryDto {
  id: string; name: string; slug: string; position: number; active: boolean;
}

export interface MarketSupplierDto {
  id: string; name: string; contact: string | null; note: string | null; active: boolean;
}

export interface MarketProductDto {
  id: string; reference: string; name: string; slug: string; description: string | null;
  categoryId: string; categoryName: string;
  supplierId: string | null; supplierName: string | null;
  availability: MarketAvailability; active: boolean; popular: boolean;
  priceSale: number; supplierPrice: number; estimatedLandedCost: number; estimatedMargin: number;
  delayLabel: string | null; images: string[]; specs: { label: string; value: string }[];
}

export interface MarketOrderSummaryDto {
  id: string; orderNumber: string; trackCode: string; status: MarketOrderStatus; statusLabel: string;
  name: string; phone: string; zoneName: string | null;
  createdAt: string; deliveredAt: string | null;
  itemCount: number; products: string;
  total: number | null; paid: number; margin: number | null;
}

export interface MarketOrderItemDto {
  id: string; productId: string | null; productName: string; variantLabel: string | null; quantity: number;
  unitPrice: number | null; unitCostReal: number | null; procurementBatchId: string | null;
}

export interface MarketOrderDetailDto extends MarketOrderSummaryDto {
  address: string | null; notes: string | null; source: string; deliveryFee: number | null;
  items: MarketOrderItemDto[];
  events: { id: string; from: string | null; to: string; note: string | null; actorId: string | null; createdAt: string }[];
  payments: { id: string; amount: number; method: string | null; reference: string | null; status: string; confirmedAt: string | null; createdAt: string }[];
  delivery: { id: string; status: MarketDeliveryStatus; fee: number; cost: number; courier: string | null; scheduledAt: string | null; deliveredAt: string | null; note: string | null } | null;
}

export interface MarketBatchDto {
  id: string; reference: string; status: MarketBatchStatus;
  supplierId: string | null; supplierName: string | null;
  totalCost: number; note: string | null; expectedAt: string | null; receivedAt: string | null;
  createdAt: string; itemCount: number;
}

export interface MarketOverviewDto {
  totalRequests: number;
  byStatus: {
    requested: number; confirmed: number; procuring: number; toDeliver: number;
    delivered: number; cancelled: number; delayed: number; refunded: number;
  };
  activeProducts: number; availableProducts: number;
  confirmedCount: number; revenue: number; avgOrderValue: number | null;
  cashConfirmed: number;
  deliveredCount: number; deliveredMargin: number | null; avgDeliveredMargin: number | null;
  conversionRate: number | null;
  topProducts: { name: string; count: number }[];
}

export interface MarketCatalogAdminDto {
  categories: MarketCategoryDto[];
  suppliers: MarketSupplierDto[];
  products: MarketProductDto[];
}

/* -------------------------------- Lectures -------------------------------- */

export async function fetchMarketOverview(): Promise<MarketOverviewDto> {
  return await getJson<MarketOverviewDto>('/api/admin/market/overview');
}

export async function fetchMarketCatalogAdmin(): Promise<MarketCatalogAdminDto> {
  const [categories, suppliers, products] = await Promise.all([
    getJson<MarketCategoryDto[]>('/api/admin/market/categories'),
    getJson<MarketSupplierDto[]>('/api/admin/market/suppliers'),
    getJson<MarketProductDto[]>('/api/admin/market/products'),
  ]);
  return { categories, suppliers, products };
}

export async function fetchMarketOrders(params: { status?: string; q?: string } = {}): Promise<MarketOrderSummaryDto[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs}` : '';
  return await getJson<MarketOrderSummaryDto[]>(`/api/admin/market/orders${suffix}`);
}

export async function fetchMarketOrder(id: string): Promise<MarketOrderDetailDto> {
  return await getJson<MarketOrderDetailDto>(`/api/admin/market/orders/${encodeURIComponent(id)}`);
}

export async function fetchMarketBatches(): Promise<MarketBatchDto[]> {
  return await getJson<MarketBatchDto[]>('/api/admin/market/batches');
}

/* ------------------------------- Mutations -------------------------------- */

export async function saveMarketCategory(payload: { id?: string; name: string; position?: number; active?: boolean }): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/categories', payload);
}

export async function saveMarketSupplier(payload: { id?: string; name: string; contact?: string; note?: string; active?: boolean }): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/suppliers', payload);
}

export interface MarketProductPayload {
  productId?: string;
  name: string; reference: string; categoryId: string; supplierId?: string | null;
  description?: string;
  specs?: { label: string; value: string }[];
  images?: string[];
  priceSale: number; supplierPrice?: number; estimatedLandedCost?: number;
  delayLabel?: string;
  availability: MarketAvailability;
  active?: boolean; popular?: boolean;
}

export async function saveMarketProduct(payload: MarketProductPayload): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/products', payload);
}

/**
 * Téléverse une image produit vers le bucket public (5 Mo, JPEG/PNG/WebP
 * vérifiés par magic bytes côté serveur) et renvoie l'URL publique à ranger
 * dans images[]. Multipart : n'utilise pas postJson (JSON uniquement).
 */
export async function uploadProductImage(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const res = await fetch('/api/admin/files/product-image', { method: 'POST', credentials: 'same-origin', body: fd });
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('fika:unauthorized'));
    throw new Error('Session expirée. Reconnectez-vous.');
  }
  const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; message?: string } | null;
  if (!res.ok || !data?.ok || !data.url) throw new Error(data?.message ?? 'Envoi de l’image impossible.');
  return { url: data.url };
}

export async function updateMarketOrderStatus(orderId: string, to: MarketOrderStatus, note?: string): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/orders/status', { orderId, to, note });
}

export async function confirmMarketPrice(orderId: string, deliveryFee: number, items: { itemId: string; unitPrice: number }[], note?: string): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/orders/price', { orderId, deliveryFee, items, note });
}

export async function recordMarketPayment(orderId: string, amount: number, method: MarketPaymentMethod, reference?: string): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/payments', { orderId, amount, method, reference });
}

export async function reviewMarketPayment(paymentId: string, action: 'CONFIRM' | 'REJECT'): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/payments/review', { paymentId, action });
}

export async function saveMarketBatch(payload: { reference: string; supplierId?: string | null; totalCost?: number; note?: string }): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/batches', payload);
}

export async function updateMarketBatchStatus(batchId: string, to: MarketBatchStatus): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/batches/status', { batchId, to });
}

export async function assignMarketItem(itemId: string, batchId: string | null, unitCostReal: number | null): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/items/assign', { itemId, batchId, unitCostReal });
}

export async function saveMarketDelivery(orderId: string, payload: {
  status: MarketDeliveryStatus; fee: number; cost: number; courier?: string; note?: string;
}): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/delivery', { orderId, ...payload });
}

/* --------------------------------- Relevés --------------------------------- */

export interface MarketLedgerDto {
  totals: { encaisse: number; depense: number; solde: number };
  byCategory: { category: string; label: string; total: number }[];
  orders: {
    id: string; orderNumber: string; customerName: string | null; status: string; statusLabel: string;
    encaisse: number; paye: number; marge: number;
  }[];
  payments: { id: string; orderNumber: string; amount: number; method: string; methodLabel: string; status: 'PENDING' | 'CONFIRMED' | 'REJECTED'; reference: string | null; createdAt: string }[];
  expenses: { id: string; orderNumber: string | null; label: string; category: string; categoryLabel: string; amount: number; note: string | null; incurredAt: string }[];
}

export async function fetchMarketLedger(): Promise<MarketLedgerDto> {
  return await getJson('/api/admin/market/ledger');
}

/** Encaissement écrit par le fondateur : confirmé directement (relevé). */
export async function recordLedgerPayment(orderId: string, amount: number, method: MarketPaymentMethod, reference?: string): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/payments', { orderId, amount, method, reference, confirm: true });
}

export async function saveLedgerExpense(payload: {
  orderId?: string; label: string; category: string; amount: number; note?: string;
}): Promise<{ ok: true }> {
  return await postJson('/api/admin/market/expenses', payload);
}
