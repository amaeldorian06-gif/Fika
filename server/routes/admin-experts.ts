import { createExpertSchema, updateExpertSchema } from '../../src/lib/admin/experts';
import { hasPrismaCode, serialTransaction } from '../lib/transaction';
import type { MutationResult } from './admin-orders';

export async function handleCreateExpert(body: unknown, adminId: string | null): Promise<MutationResult<{ expertId: string }>> {
  if (!adminId) return { status: 401, body: { ok: false, code: 'UNAUTHORIZED', message: 'Session expirée. Reconnectez-vous.' } };
  const parsed = createExpertSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { ok: false, code: 'VALIDATION', message: parsed.error.issues[0].message } };
  try {
    return await serialTransaction<MutationResult<{ expertId: string }>>(async tx => {
      const expert = await tx.expert.create({ data: parsed.data });
      return { status: 200, body: { ok: true, expertId: expert.id } };
    });
  } catch (error) {
    if (!hasPrismaCode(error, 'P2002')) throw error;
    return { status: 409, body: { ok: false, code: 'DUPLICATE_PHONE', message: 'Un expert utilise déjà ce numéro.' } };
  }
}

export async function handleUpdateExpert(body: unknown, adminId: string | null): Promise<MutationResult> {
  if (!adminId) return { status: 401, body: { ok: false, code: 'UNAUTHORIZED', message: 'Session expirée. Reconnectez-vous.' } };
  const parsed = updateExpertSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { ok: false, code: 'VALIDATION', message: parsed.error.issues[0].message } };
  const { expertId, ...data } = parsed.data;
  try {
    return await serialTransaction<MutationResult>(async tx => {
      const expert = await tx.expert.findUnique({ where: { id: expertId }, include: { assignments: { include: { task: true } } } });
      if (!expert) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Expert introuvable.' } };
      if (data.availability === true && expert.assignments.some(a => ['ASSIGNED', 'ACCEPTED'].includes(a.status) && !['COMPLETED', 'CANCELLED'].includes(a.task.status))) {
        return { status: 409, body: { ok: false, code: 'BUSY', message: 'Cet expert a une mission active : terminez-la avant de le rendre disponible.' } };
      }
      await tx.expert.update({ where: { id: expertId }, data });
      return { status: 200, body: { ok: true } };
    });
  } catch (error) {
    if (!hasPrismaCode(error, 'P2002')) throw error;
    return { status: 409, body: { ok: false, code: 'DUPLICATE_PHONE', message: 'Un expert utilise déjà ce numéro.' } };
  }
}
