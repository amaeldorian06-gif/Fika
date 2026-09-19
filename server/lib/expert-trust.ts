import type { Prisma, PrismaClient } from '@prisma/client';
import {
  computeExpertMetrics, effectiveLevel, type ActivitySnapshot, type ExpertMetrics, type TaskRecord,
  type VerificationLevel, type VerificationType,
} from '../../src/lib/trust';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Métriques d'un professionnel calculées depuis les données existantes :
 *  - Task / TaskAssignment : missions confiées, terminées, annulées, délais ;
 *  - OrderEvent « Tâche : X → Y » : début (IN_PROGRESS), reprise (REVIEW → IN_PROGRESS) ;
 *  - Review : satisfaction.
 * Rien n'est stocké ni saisi à la main.
 */
export async function loadExpertMetrics(db: Db, expertId: string): Promise<ExpertMetrics> {
  const assignments = await db.taskAssignment.findMany({
    where: { expertId, status: { not: 'DECLINED' } },
    include: { task: { select: { id: true, orderId: true, status: true, createdAt: true, updatedAt: true } } },
  });
  const orderIds = [...new Set(assignments.map((a) => a.task.orderId))];
  const events = orderIds.length
    ? await db.orderEvent.findMany({
      where: { orderId: { in: orderIds }, note: { startsWith: 'Tâche : ' } },
      select: { orderId: true, note: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    : [];
  const reviews = await db.review.findMany({ where: { expertId }, select: { rating: true } });

  const tasks: TaskRecord[] = assignments.map((a) => {
    const evs = events.filter((e) => e.orderId === a.task.orderId);
    const started = evs.find((e) => /→ IN_PROGRESS/.test(e.note ?? '') && !/REVIEW → IN_PROGRESS/.test(e.note ?? ''));
    const completedEv = evs.find((e) => /→ COMPLETED/.test(e.note ?? ''));
    const reworked = evs.some((e) => /REVIEW → IN_PROGRESS/.test(e.note ?? ''));
    return {
      status: a.task.status,
      createdAt: a.task.createdAt,
      assignedAt: a.assignedAt,
      startedAt: started?.createdAt ?? null,
      completedAt: a.task.status === 'COMPLETED' ? (completedEv?.createdAt ?? a.task.updatedAt) : (a.task.status === 'CANCELLED' ? a.task.updatedAt : null),
      reworked,
    };
  });
  return computeExpertMetrics(tasks, reviews);
}

export function snapshotFromMetrics(m: ExpertMetrics): ActivitySnapshot {
  return { completedTasks: m.completedTasks, cancelledTasks: m.cancelledTasks, lastCompletedAt: m.lastCompletedAt, lastCancelledAt: m.lastCancelledAt };
}

/** Écrit un changement de niveau + sa trace. Ne fait rien si le niveau ne change pas. */
export async function applyLevelChange(
  db: Db,
  expert: { id: string; verificationLevel: string },
  to: VerificationLevel,
  type: VerificationType,
  note: string | null,
  actorId: string | null,
): Promise<boolean> {
  if (expert.verificationLevel === to) return false;
  await db.expertVerification.create({
    data: { expertId: expert.id, from: expert.verificationLevel as VerificationLevel, to, type, note, actorId },
  });
  await db.expert.update({
    where: { id: expert.id },
    data: { verificationLevel: to, lastVerifiedAt: new Date(), lastVerificationType: type },
  });
  return true;
}

/**
 * Après une tâche terminée ou annulée : recalcule le niveau que l'activité
 * justifie (Intervention Fika réalisée / Professionnel actif / perte du statut
 * actif) et trace le changement avec le type COMPLETED_JOB ou ADMIN_REVIEW.
 */
export async function syncAutomaticLevel(db: Db, expertId: string, actorId: string | null): Promise<void> {
  const expert = await db.expert.findUnique({ where: { id: expertId }, select: { id: true, verificationLevel: true } });
  if (!expert) return;
  const metrics = await loadExpertMetrics(db, expertId);
  const next = effectiveLevel(expert.verificationLevel as VerificationLevel, snapshotFromMetrics(metrics));
  if (next === expert.verificationLevel) return;
  const lostActive = expert.verificationLevel === 'ACTIVE_PRO';
  const note = next === 'ACTIVE_PRO'
    ? `${metrics.completedTasks} interventions terminées, aucune annulation récente.`
    : lostActive
      ? 'Statut « Professionnel actif » retiré : annulation récente ou inactivité.'
      : `${metrics.completedTasks} intervention(s) Fika terminée(s).`;
  await applyLevelChange(db, expert, next, lostActive ? 'ADMIN_REVIEW' : 'COMPLETED_JOB', note, actorId);
}
