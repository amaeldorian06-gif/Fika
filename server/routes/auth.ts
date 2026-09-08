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
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    // TODO_PROD : définir AUTH_SECRET (≥ 32 caractères aléatoires).
    throw new Error('AUTH_SECRET manquant ou trop court (32 caractères minimum).');
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
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  try {
    const expected = createHmac('sha256', secret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
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
  if (!checkLoginRate(ip || 'unknown')) {
    return { status: 429, body: { ok: false, message: 'Trop de tentatives. Réessayez dans une minute.' } };
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, message: 'Identifiants invalides.' } };
  }

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } });

  // Message identique dans tous les cas d'échec (pas d'énumération de comptes).
  const genericError = { status: 401, body: { ok: false, message: 'E-mail ou mot de passe incorrect.' } } as const;
  if (!admin || !admin.active) {
    await bcrypt.compare(parsed.data.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    return genericError;
  }

  const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!valid) return genericError;

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
  const payload = verifySession(cookieValue);
  if (!payload) return null;
  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, active: true },
  });
  if (!admin || !admin.active) return null;
  return { id: admin.id, email: admin.email, role: admin.role };
}

/** Utilitaire de génération de secret pour la doc d'installation. */
export const generateAuthSecret = (): string => randomBytes(32).toString('base64url');
