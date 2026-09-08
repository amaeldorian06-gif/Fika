import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';
import type { MutationResult } from './admin-orders';

/**
 * CRUD experts du back-office (P06).
 * Rappel invariant : les experts sont des partenaires sélectionnés par Fika,
 * jamais des vendeurs inscrits (pas de marketplace, pas d'auto-inscription).
 */

const expertSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court.').max(80),
  phone: z.string().regex(/^\+2376\d{8}$/, 'Téléphone E.164 attendu (+2376XXXXXXXX).'),
  skills: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  cityId: z.string().min(1).nullish(),
  zone: z.string().trim().max(120).nullish(),
  usualCost: z.number().int().min(0).max(100_000_000).nullish(),
  availability: z.boolean().default(true),
  status: z.enum(['ACTIVE', 'PAUSED', 'SUSPENDED', 'BACKUP']).default('ACTIVE'),
});

export async function handleCreateExpert(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult<{ expertId: string }>> {
  if (!adminId) {
    return { status: 401, body: { ok: false, code: 'UNAUTHORIZED', message: 'Session expirée. Reconnectez-vous.' } };
  }
  const parsed = expertSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Fiche expert invalide.' } };
  }

  const existing = await prisma.expert.findUnique({ where: { phone: parsed.data.phone }, select: { id: true } });
  if (existing) {
    return { status: 409, body: { ok: false, code: 'DUPLICATE_PHONE', message: 'Un expert utilise déjà ce numéro.' } };
  }

  const expert = await prisma.expert.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      skills: parsed.data.skills,
      cityId: parsed.data.cityId ?? null,
      zone: parsed.data.zone ?? null,
      usualCost: parsed.data.usualCost ?? null,
      availability: parsed.data.availability,
      status: parsed.data.status,
    },
  });

  return { status: 200, body: { ok: true, expertId: expert.id } };
}

const updateSchema = expertSchema.partial().extend({ expertId: z.string().min(1) });

export async function handleUpdateExpert(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult> {
  if (!adminId) {
    return { status: 401, body: { ok: false, code: 'UNAUTHORIZED', message: 'Session expirée. Reconnectez-vous.' } };
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Modification invalide.' } };
  }

  const { expertId, ...data } = parsed.data;
  const exists = await prisma.expert.findUnique({ where: { id: expertId }, select: { id: true } });
  if (!exists) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Expert introuvable.' } };

  await prisma.expert.update({
    where: { id: expertId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.skills !== undefined ? { skills: data.skills } : {}),
      ...(data.cityId !== undefined ? { cityId: data.cityId ?? null } : {}),
      ...(data.zone !== undefined ? { zone: data.zone ?? null } : {}),
      ...(data.usualCost !== undefined ? { usualCost: data.usualCost ?? null } : {}),
      ...(data.availability !== undefined ? { availability: data.availability } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  return { status: 200, body: { ok: true } };
}
