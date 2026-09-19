import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';

const db = vi.hoisted(() => ({
  adminUser: { findUnique: vi.fn() },
  order: { findMany: vi.fn(), findUnique: vi.fn() },
  lead: { findMany: vi.fn() },
}));
vi.mock('../src/lib/prisma', () => ({ prisma: db }));
import app from '../api/index';
import { SESSION_COOKIE, signSession, verifySession } from './routes/auth';

let server: Server;
let base: string;
const admin = { id: 'admin-test', email: 'ops@example.test', role: 'SUPERADMIN', active: true, passwordHash: bcrypt.hashSync('test-password-only', 4) };
const cookie = () => `${SESSION_COOKIE}=${signSession({ sub: admin.id, role: admin.role, exp: Date.now() + 60000 })}`;
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

beforeAll(async () => {
  vi.stubEnv('AUTH_SECRET', 'test-only-secret-with-at-least-32-characters');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  base = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => { vi.resetAllMocks(); db.adminUser.findUnique.mockResolvedValue(admin); });
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });

describe('API et session serveur', () => {
  it('refuse toutes les lectures admin sans cookie, avant accès DB', async () => {
    for (const route of ['overview', 'orders', 'orders/test', 'leads', 'customers', 'experts', 'analytics', 'analytics/orders']) {
      expect((await fetch(`${base}/api/admin/${route}`)).status).toBe(401);
    }
    expect(db.adminUser.findUnique).not.toHaveBeenCalled();
    expect(db.order.findMany).not.toHaveBeenCalled();
  });
  it('refuse les mutations et avis anonymes', async () => {
    for (const route of ['admin/payments', 'admin/payments/review', 'admin/orders/status', 'admin/orders/costs', 'admin/orders/quotes', 'admin/leads/convert', 'admin/leads/status', 'admin/experts', 'admin/orders/assign', 'admin/tasks/status', 'admin/orders/delivery', 'admin/portfolio', 'reviews']) {
      expect((await post(`/api/${route}`, {})).status).toBe(401);
    }
  });
  it('émet le cookie signé et restaure la session via /me', async () => {
    const response = await post('/api/auth/login', { email: ' OPS@example.test ', password: 'test-password-only' });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=43200');
    const token = response.headers.get('set-cookie')!.split(';')[0];
    const session = await fetch(`${base}/api/auth/me`, { headers: { Cookie: token } });
    expect(await session.json()).toEqual({ ok: true, admin: { id: admin.id, email: admin.email, role: admin.role } });
    expect(db.adminUser.findUnique).toHaveBeenCalledWith({ where: { email: admin.email } });
  });
  it('refuse les comptes désactivés même avec un cookie valide', async () => {
    db.adminUser.findUnique.mockResolvedValue({ ...admin, active: false });
    expect((await fetch(`${base}/api/admin/orders`, { headers: { Cookie: cookie() } })).status).toBe(401);
  });
  it('conserve les validations métier une fois authentifié', async () => {
    expect((await post('/api/admin/orders/status', {}, { Cookie: cookie() })).status).toBe(400);
    expect((await post('/api/leads', {})).status).toBe(400);
  });
  it('ne renvoie ni HTML ni données fictives en cas de panne DB', async () => {
    db.order.findMany.mockRejectedValue(new Error('private-db-details'));
    const response = await fetch(`${base}/api/admin/orders`, { headers: { Cookie: cookie() } });
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(JSON.stringify(await response.json())).not.toContain('private-db-details');
  });
  it('raccorde la lecture des demandes avec le contrat UI et le même code référence', async () => {
    db.lead.findMany.mockResolvedValue([{ id: 'lead-abcdef', description: 'Besoin de flyer', service: { name: 'Flyer' }, city: { name: 'Ngaoundéré' }, customer: { name: 'Client', phone: '+237600000000' }, zoneName: 'Centre', deadline: null, budgetMin: null, budgetMax: null, status: 'NEW', createdAt: new Date('2026-09-09T12:00:00Z') }]);
    const response = await fetch(`${base}/api/admin/leads`, { headers: { Cookie: cookie() } });
    expect(response.status).toBe(200);
    expect((await response.json())[0]).toMatchObject({ code: 'LEAD-ABCDEF', serviceName: 'Flyer', cityName: 'Ngaoundéré', customerName: 'Client' });
  });
  it('efface le cookie à la déconnexion', async () => {
    const response = await post('/api/auth/logout', {});
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('retourne une vraie 404 JSON pour une route API inconnue', async () => {
    const response = await fetch(`${base}/api/unknown`);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
  });
  it('refuse les formulaires cross-site et le JSON malformé', async () => {
    expect((await fetch(`${base}/api/auth/login`, { method: 'POST', body: 'email=x' })).status).toBe(415);
    expect((await post('/api/auth/logout', {}, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await fetch(`${base}/api/leads`, { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } })).status).toBe(400);
  });
  it('vérifie la structure, la signature et l’expiration du jeton', () => {
    const payload = { sub: admin.id, role: admin.role, exp: Date.now() + 60000 };
    const valid = signSession(payload);
    expect(verifySession(valid)).toEqual(payload);
    expect(verifySession(valid + '.extra')).toBeNull();
    expect(verifySession(valid + 'x')).toBeNull();
    expect(verifySession(signSession({ ...payload, exp: Date.now() - 1 }))).toBeNull();
    expect(verifySession(signSession({ ...payload, exp: NaN }))).toBeNull();
  });
});
