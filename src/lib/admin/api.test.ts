import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQuote, fetchOrders, fetchSession, publishPortfolio } from './api';
import { fetchAnalytics } from '../analytics-api';

afterEach(() => vi.unstubAllGlobals());

describe('aucun repli silencieux sur la démonstration', () => {
  it('une session expirée ne provient jamais du stockage navigateur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    expect(await fetchSession()).toBeNull();
  });
  it('les pannes de lecture et analytics sont visibles, pas des chiffres fictifs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')));
    await expect(fetchOrders()).rejects.toThrow();
    await expect(fetchAnalytics('month')).rejects.toThrow();
    await expect(fetchSession()).rejects.toThrow();
  });
  it('un refus métier ne devient pas un devis local réussi', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, message: 'Devis refusé' }), { status: 409, headers: { 'Content-Type': 'application/json' } })));
    await expect(createQuote('order', 12000)).rejects.toThrow('Devis refusé');
  });
  it('une API absente ne crée pas de fausse publication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>SPA</html>', { headers: { 'Content-Type': 'text/html' } })));
    await expect(publishPortfolio({ orderId: 'order', title: 'Flyer', category: 'Design', image: '/image.webp' })).rejects.toThrow('API indisponible');
  });
});
