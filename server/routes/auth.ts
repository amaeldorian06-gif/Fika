import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';
import { FOUNDER_EMAIL, FOUNDER_ID, isFounderEmail, isFounderPassword } from '../lib/founder';

/**
 * Authentification back-office (P06) — implémentation de référence.
 * Session : cookie httpOnly + Secure + SameSite=Lax, signé HMAC-SHA256
 * (secret AUTH_SECRET). Aucun mot de passe ni hash n'est jamais journalisé.
 *
 * Contrat Next.js (App Router) :
 *   // app/api/auth/login/route.ts
 *   const r = await handleLogin(await req.json(), ip);
 *   const res = Response.json(r.body, { status: r.status });
 *   if (r.cookie) res.headers.append('Set-Cookie', r.cookie);
 */

export const SESSION_COOKIE = 'fika_admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

/**
 * Secret de signature des sessions.
 * 1) AUTH_SECRET si défini (recommandé) ;
 * 2) sinon, dérivé de DATABASE_URL (qui contient le mot de passe de la base,
 *    déjà secret) — une seule variable suffit ainsi pour faire tourner Fika.
 * Jamais de valeur codée en dur : le dépôt est public.
 */
function secret(): string {
  let s = process.env.AUTH_SECRET;
  if (!s) {
    const db = process.env.DATABASE_URL;
    if (!db) throw new Error('AUTH_SECRET ou DATABASE_URL requis.');
    return createHmac('sha256', 'fika-session-v1').update(db).digest('hex');
  }
  if (s.length < 32) {
    s = s.padEnd(32, '_fika2026securise_');
  }
  return s;
}

interface SessionPayload {
  sub: string;   // AdminUser.id
  role: string;
  exp: number;   // timestamp ms
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token || token.split('.').length !== 2) {
    return null;
  }
  const [body, sig] = token.split('.');
  try {
    const expected = createHmac('sha256', secret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.role !== 'string' ||
      !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function buildCookie(value: string, maxAgeSec: number): string {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

/* ------------------------------ Rate limiting ----------------------------- */

const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRate(ip: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  if (attempts.size > 10000) {
    for (const [key, value] of attempts) if (value.resetAt < now) attempts.delete(key);
    if (attempts.size > 10000 && !attempts.has(ip)) return false;
  }
  const bucket = attempts.get(ip);
  if (!bucket || bucket.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/* --------------------------------- Login ---------------------------------- */

const loginSchema = z.object({
  email: z.string().trim().min(1).max(160),
  password: z.string().min(8, 'Mot de passe trop court.').max(200),
});

export interface AdminIdentity {
  id: string;
  email: string;
  role: string;
}

export type LoginResult =
  | { status: 200; body: { ok: true; admin: AdminIdentity }; cookie: string }
  | { status: 400 | 401 | 429; body: { ok: false; message: string }; cookie?: undefined };

export async function handleLogin(body: unknown, ip: string): Promise<LoginResult> {
  if (!checkLoginRate(ip || 'unknown')) {
    return { status: 429, body: { ok: false, message: 'Trop de tentatives. Réessayez dans une minute.' } };
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 401, body: { ok: false, message: 'Identifiant ou mot de passe incorrect.' } };
  }

  // Message identique dans tous les cas d'échec (pas d'énumération de comptes).
  const genericError = { status: 401, body: { ok: false, message: 'Identifiant ou mot de passe incorrect.' } } as const;

  if (!isFounderEmail(parsed.data.email) || !(await isFounderPassword(parsed.data.password))) return genericError;
  const founder = { id: FOUNDER_ID, email: FOUNDER_EMAIL, role: 'SUPERADMIN' };
  const token = signSession({ sub: founder.id, role: founder.role, exp: Date.now() + SESSION_TTL_MS });
  return { status: 200, body: { ok: true, admin: founder }, cookie: buildCookie(token, SESSION_TTL_MS / 1000) };
}

/** Audit actor only: called for writes, NEVER for login, /me or session guard. */
export async function ensureFounderRecord(): Promise<AdminIdentity> {
  return prisma.adminUser.upsert({
    where: { id: FOUNDER_ID },
    create: { id: FOUNDER_ID, email: FOUNDER_EMAIL, passwordHash: '!code-auth-only', role: 'SUPERADMIN', active: true },
    update: { active: true, role: 'SUPERADMIN' },
    select: { id: true, email: true, role: true },
  });
}

export function handleLogout(): { status: 200; body: { ok: true }; cookie: string } {
  return { status: 200, body: { ok: true }, cookie: buildCookie('', 0) };
}

/** Session courante (guard de layout / routes protégées). */
export async function getCurrentAdmin(cookieValue: string | undefined): Promise<AdminIdentity | null> {
  const payload = verifySession(cookieValue);
  if (!payload) {
    return null;
  }
  if (payload.sub !== FOUNDER_ID || payload.role !== 'SUPERADMIN') return null;
  return { id: FOUNDER_ID, email: FOUNDER_EMAIL, role: 'SUPERADMIN' };
}

/** Utilitaire de génération de secret pour la doc d'installation. */
export const generateAuthSecret = (): string => randomBytes(32).toString('base64url');
