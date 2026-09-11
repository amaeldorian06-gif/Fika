import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import { prisma } from '../../src/lib/prisma';

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

function secret(): string {
  let s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error('AUTH_SECRET manquant.');
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
  console.log('[auth debug] verifySession called with token:', token ? token.substring(0, 15) + '...' : 'undefined');
  if (!token || token.split('.').length !== 2) {
    console.log('[auth debug] Token missing or invalid format.');
    return null;
  }
  const [body, sig] = token.split('.');
  try {
    const expected = createHmac('sha256', secret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      console.log('[auth debug] Signature mismatch.');
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.role !== 'string' ||
      !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
      console.log('[auth debug] Payload invalid or expired. Exp:', payload.exp, 'Now:', Date.now());
      return null;
    }
    console.log('[auth debug] Session verified successfully for user:', payload.sub);
    return payload;
  } catch (err) {
    console.log('[auth debug] Exception during verifySession:', err);
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
  email: z.string().trim().email('Adresse e-mail invalide.').max(160),
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
  console.log('[auth debug] handleLogin called from IP:', ip);
  if (!checkLoginRate(ip || 'unknown')) {
    console.log('[auth debug] Rate limit exceeded for IP:', ip);
    return { status: 429, body: { ok: false, message: 'Trop de tentatives. Réessayez dans une minute.' } };
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    console.log('[auth debug] Invalid login payload:', parsed.error.issues);
    return { status: 400, body: { ok: false, message: 'Identifiants invalides.' } };
  }

  console.log('[auth debug] Looking up admin email:', parsed.data.email.toLowerCase());
  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } });

  // Message identique dans tous les cas d'échec (pas d'énumération de comptes).
  const genericError = { status: 401, body: { ok: false, message: 'E-mail ou mot de passe incorrect.' } } as const;
  if (!admin || !admin.active) {
    console.log('[auth debug] Admin not found or inactive.');
    await bcrypt.compare(parsed.data.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    return genericError;
  }

  console.log('[auth debug] Admin found. Comparing password hash...');
  const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!valid) {
    console.log('[auth debug] Password mismatch.');
    return genericError;
  }

  console.log('[auth debug] Login successful! Creating session token.');
  const token = signSession({ sub: admin.id, role: admin.role, exp: Date.now() + SESSION_TTL_MS });
  console.info(`[auth] Connexion admin ${admin.email.replace(/(.).*(@.*)/, '$1•••$2')}`);

  return {
    status: 200,
    body: { ok: true, admin: { id: admin.id, email: admin.email, role: admin.role } },
    cookie: buildCookie(token, SESSION_TTL_MS / 1000),
  };
}

export function handleLogout(): { status: 200; body: { ok: true }; cookie: string } {
  return { status: 200, body: { ok: true }, cookie: buildCookie('', 0) };
}

/** Session courante (guard de layout / routes protégées). */
export async function getCurrentAdmin(cookieValue: string | undefined): Promise<AdminIdentity | null> {
  console.log('[auth debug] getCurrentAdmin checking cookie...');
  const payload = verifySession(cookieValue);
  if (!payload) {
    console.log('[auth debug] getCurrentAdmin: no valid session payload.');
    return null;
  }
  console.log('[auth debug] getCurrentAdmin: session valid, looking up user in DB:', payload.sub);
  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, active: true },
  });
  if (!admin || !admin.active) {
    console.log('[auth debug] getCurrentAdmin: user not found or inactive in DB.');
    return null;
  }
  console.log('[auth debug] getCurrentAdmin: user found and active.');
  return { id: admin.id, email: admin.email, role: admin.role };
}

/** Utilitaire de génération de secret pour la doc d'installation. */
export const generateAuthSecret = (): string => randomBytes(32).toString('base64url');
