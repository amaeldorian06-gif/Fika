/**
 * Confiance progressive des professionnels Fika — DÉFINITION UNIQUE.
 *
 * Tout écran (carte, fiche, commande, admin, analytiques) passe par ce module :
 *  - `VERIFICATION_LEVELS` : les 7 niveaux, dans l'ordre, avec ce que chacun exige ;
 *  - `publicTrustSignals()` : ce qui peut être dit au client, et rien d'autre ;
 *  - `computeExpertMetrics()` : performance mesurée depuis les données existantes
 *    (Task / TaskAssignment / Review / OrderEvent), jamais saisie à la main.
 *
 * Règle absolue : le mot « vérifié » n'apparaît publiquement que si le niveau
 * correspondant est atteint ET repose sur une vérification réelle tracée
 * (ExpertVerification). Un niveau n'est jamais déduit d'une simple déclaration.
 */

export type VerificationLevel =
  | 'NEW'
  | 'PHONE_VERIFIED'
  | 'PROFILE_VERIFIED'
  | 'SKILL_DECLARED'
  | 'SKILL_VERIFIED'
  | 'FIKA_JOB_DONE'
  | 'ACTIVE_PRO';

export type VerificationType =
  | 'PHONE_CALL'
  | 'ID_DOCUMENT'
  | 'IN_PERSON'
  | 'PRACTICAL_TEST'
  | 'SITE_VISIT'
  | 'REFERENCE_CHECK'
  | 'COMPLETED_JOB'
  | 'ADMIN_REVIEW';

export interface VerificationLevelMeta {
  level: VerificationLevel;
  rank: number;
  /** Libellé interne (administration). */
  label: string;
  /** Ce que Fika doit avoir réellement fait pour attribuer ce niveau. */
  requires: string;
  /** Types de vérification acceptables pour passer à ce niveau (contrôle admin). */
  acceptedTypes: VerificationType[];
  /** Attribué automatiquement par le système (jamais à la main). */
  automatic: boolean;
}

export const VERIFICATION_LEVELS: VerificationLevelMeta[] = [
  { level: 'NEW', rank: 1, label: 'Nouveau', automatic: false,
    requires: 'Fiche créée. Aucun contrôle effectué.',
    acceptedTypes: ['ADMIN_REVIEW'] },
  { level: 'PHONE_VERIFIED', rank: 2, label: 'Téléphone vérifié', automatic: false,
    requires: 'Appel ou échange WhatsApp réel avec le numéro enregistré ; la personne répond bien à ce nom.',
    acceptedTypes: ['PHONE_CALL', 'IN_PERSON'] },
  { level: 'PROFILE_VERIFIED', rank: 3, label: 'Profil vérifié', automatic: false,
    requires: 'Pièce d\u2019identité vue (ou rencontre physique) ; nom, métier et zone d\u2019intervention confirmés.',
    acceptedTypes: ['ID_DOCUMENT', 'IN_PERSON'] },
  { level: 'SKILL_DECLARED', rank: 4, label: 'Compétence déclarée', automatic: false,
    requires: 'Métier et compétences décrits par le professionnel, avec au moins une référence ou un exemple de réalisation noté. Rien n\u2019est encore contrôlé sur le savoir-faire.',
    acceptedTypes: ['PHONE_CALL', 'IN_PERSON', 'ADMIN_REVIEW'] },
  { level: 'SKILL_VERIFIED', rank: 5, label: 'Compétence vérifiée', automatic: false,
    requires: 'Test pratique, chantier/atelier visité ou référence rappelée par Fika, avec un résultat concluant noté.',
    acceptedTypes: ['PRACTICAL_TEST', 'SITE_VISIT', 'REFERENCE_CHECK'] },
  { level: 'FIKA_JOB_DONE', rank: 6, label: 'Intervention Fika réalisée', automatic: true,
    requires: 'Au moins une tâche Fika terminée (statut COMPLETED). Attribué automatiquement.',
    acceptedTypes: ['COMPLETED_JOB'] },
  { level: 'ACTIVE_PRO', rank: 7, label: 'Professionnel actif', automatic: true,
    requires: `Au moins ${3} interventions Fika terminées, aucune annulation sur les 90 derniers jours et une mission terminée depuis moins de 90 jours. Attribué et retiré automatiquement.`,
    acceptedTypes: ['COMPLETED_JOB'] },
];

export const ACTIVE_PRO_MIN_COMPLETED = 3;
export const ACTIVE_PRO_WINDOW_DAYS = 90;

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  PHONE_CALL: 'Appel / WhatsApp',
  ID_DOCUMENT: 'Pièce d\u2019identité vue',
  IN_PERSON: 'Rencontre physique',
  PRACTICAL_TEST: 'Test pratique',
  SITE_VISIT: 'Chantier / atelier visité',
  REFERENCE_CHECK: 'Référence rappelée',
  COMPLETED_JOB: 'Intervention Fika terminée',
  ADMIN_REVIEW: 'Revue interne du dossier',
};

export function levelMeta(level: string): VerificationLevelMeta {
  return VERIFICATION_LEVELS.find((l) => l.level === level) ?? VERIFICATION_LEVELS[0];
}

export function levelRank(level: string): number {
  return levelMeta(level).rank;
}

export const VERIFICATION_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  VERIFICATION_LEVELS.map((l) => [l.level, l.label]),
);

/* ------------------------- Changement de niveau (admin) -------------------- */

export interface LevelChangeCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Un admin peut monter d'un ou plusieurs crans jusqu'à « Compétence vérifiée »
 * (à condition que le type de vérification corresponde au niveau visé) et
 * redescendre à tout moment (revue interne). Les niveaux 6 et 7 sont réservés
 * au système : ils reposent sur des interventions réellement terminées.
 */
export function canSetLevel(
  from: VerificationLevel,
  to: VerificationLevel,
  type: VerificationType,
  note: string | null | undefined,
): LevelChangeCheck {
  if (from === to) return { ok: false, reason: 'Le professionnel est déjà à ce niveau.' };
  const target = levelMeta(to);
  if (target.automatic) {
    return { ok: false, reason: `« ${target.label} » est attribué automatiquement par une intervention Fika terminée, pas à la main.` };
  }
  const downgrade = levelRank(to) < levelRank(from);
  if (downgrade) {
    if (!note || note.trim().length < 5) return { ok: false, reason: 'Une rétrogradation exige un motif (5 caractères minimum).' };
    return { ok: true };
  }
  if (!target.acceptedTypes.includes(type)) {
    const accepted = target.acceptedTypes.map((t) => VERIFICATION_TYPE_LABELS[t]).join(', ');
    return { ok: false, reason: `Pour « ${target.label} », la vérification doit être : ${accepted}.` };
  }
  return { ok: true };
}

/* ---------------------- Niveaux automatiques (système) --------------------- */

export interface ActivitySnapshot {
  completedTasks: number;
  cancelledTasks: number;
  lastCompletedAt: Date | null;
  lastCancelledAt: Date | null;
}

/**
 * Niveau que l'activité réelle justifie, indépendamment des vérifications
 * manuelles. Le niveau effectif est le max(niveau manuel, niveau d'activité),
 * sauf pour ACTIVE_PRO qui peut être perdu (annulation récente / inactivité).
 */
export function activityLevel(a: ActivitySnapshot, now = new Date()): VerificationLevel | null {
  if (a.completedTasks <= 0) return null;
  const windowMs = ACTIVE_PRO_WINDOW_DAYS * 86_400_000;
  const recentCancel = a.lastCancelledAt != null && now.getTime() - a.lastCancelledAt.getTime() <= windowMs;
  const recentJob = a.lastCompletedAt != null && now.getTime() - a.lastCompletedAt.getTime() <= windowMs;
  if (a.completedTasks >= ACTIVE_PRO_MIN_COMPLETED && !recentCancel && recentJob) return 'ACTIVE_PRO';
  return 'FIKA_JOB_DONE';
}

/** Niveau effectif à afficher partout : manuel ou activité, le plus élevé, ACTIVE_PRO révocable. */
export function effectiveLevel(stored: VerificationLevel, a: ActivitySnapshot, now = new Date()): VerificationLevel {
  const byActivity = activityLevel(a, now);
  if (stored === 'ACTIVE_PRO' && byActivity !== 'ACTIVE_PRO') {
    // Perte du statut actif : on retombe sur ce que l'activité justifie encore.
    return byActivity ?? 'FIKA_JOB_DONE';
  }
  if (!byActivity) return stored;
  return levelRank(byActivity) > levelRank(stored) ? byActivity : stored;
}

/* ------------------------ Métriques de performance ------------------------- */

export interface TaskRecord {
  status: string; // TaskStatus
  createdAt: Date; // création de la tâche = mission confiée
  assignedAt: Date | null; // TaskAssignment.assignedAt
  startedAt: Date | null; // premier passage IN_PROGRESS (OrderEvent « Tâche : … → IN_PROGRESS »)
  completedAt: Date | null; // passage COMPLETED
  reworked: boolean; // REVIEW → IN_PROGRESS observé (reprise)
}

export interface ReviewRecord {
  rating: number;
}

export interface ExpertMetrics {
  completedTasks: number;
  cancelledTasks: number;
  activeTasks: number;
  /** Taux d'annulation sur les missions confiées (terminées + annulées). null si aucune. */
  cancellationRate: number | null;
  /** Taux de reprise sur les missions terminées. null si aucune. */
  reworkRate: number | null;
  /** Délai moyen affectation → début (heures). null si non mesurable. */
  avgResponseHours: number | null;
  /** Délai moyen affectation → terminée (heures). null si non mesurable. */
  avgCompletionHours: number | null;
  /** Note moyenne des avis clients (1–5). null si aucun avis. */
  averageRating: number | null;
  reviewCount: number;
  lastCompletedAt: Date | null;
  lastCancelledAt: Date | null;
}

const hoursBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 3_600_000);
const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

/** Tout est calculé à la lecture : aucune statistique n'est inventée ni saisie. */
export function computeExpertMetrics(tasks: TaskRecord[], reviews: ReviewRecord[]): ExpertMetrics {
  const completed = tasks.filter((t) => t.status === 'COMPLETED');
  const cancelled = tasks.filter((t) => t.status === 'CANCELLED');
  const active = tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status));
  const decided = completed.length + cancelled.length;
  const response = tasks
    .filter((t) => t.assignedAt && t.startedAt)
    .map((t) => hoursBetween(t.assignedAt!, t.startedAt!));
  const completion = completed
    .filter((t) => t.assignedAt && t.completedAt)
    .map((t) => hoursBetween(t.assignedAt!, t.completedAt!));
  const ratings = reviews.map((r) => r.rating).filter((r) => r >= 1 && r <= 5);
  const last = (xs: (Date | null)[]) => xs.filter((d): d is Date => d != null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return {
    completedTasks: completed.length,
    cancelledTasks: cancelled.length,
    activeTasks: active.length,
    cancellationRate: decided ? Math.round((cancelled.length / decided) * 1000) / 10 : null,
    reworkRate: completed.length ? Math.round((completed.filter((t) => t.reworked).length / completed.length) * 1000) / 10 : null,
    avgResponseHours: mean(response),
    avgCompletionHours: mean(completion),
    averageRating: ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : null,
    reviewCount: ratings.length,
    lastCompletedAt: last(completed.map((t) => t.completedAt)),
    lastCancelledAt: last(cancelled.map((t) => t.completedAt ?? t.assignedAt ?? t.createdAt)),
  };
}

/* ------------------------- Signaux publics (client) ------------------------ */

export interface PublicTrustInput {
  level: VerificationLevel;
  zone?: string | null;
  completedTasks: number;
  averageRating?: number | null;
  reviewCount?: number;
}

export interface TrustSignal {
  code: 'PROFILE_CHECKED' | 'SKILL_CHECKED' | 'FIKA_EXPERIENCE' | 'ACTIVE' | 'ZONE' | 'COMPLETED_COUNT' | 'RATING';
  label: string;
}

/**
 * Ce que le client peut voir. Chaque signal n'apparaît que si la donnée existe
 * réellement. Pas de « vérifié » avant « Profil vérifié » ; pas de « compétence
 * vérifiée » avant un contrôle réel ; jamais de statistique à zéro maquillée.
 */
export function publicTrustSignals(i: PublicTrustInput): TrustSignal[] {
  const out: TrustSignal[] = [];
  const rank = levelRank(i.level);
  if (rank >= levelRank('PROFILE_VERIFIED')) out.push({ code: 'PROFILE_CHECKED', label: 'Profil contrôlé par Fika' });
  if (rank >= levelRank('SKILL_VERIFIED')) out.push({ code: 'SKILL_CHECKED', label: 'Compétence vérifiée par Fika' });
  if (i.level === 'ACTIVE_PRO') out.push({ code: 'ACTIVE', label: 'Professionnel actif sur Fika' });
  else if (rank >= levelRank('FIKA_JOB_DONE') || i.completedTasks > 0) out.push({ code: 'FIKA_EXPERIENCE', label: 'Déjà intervenu pour des clients Fika' });
  if (i.completedTasks > 0) out.push({ code: 'COMPLETED_COUNT', label: `${i.completedTasks} intervention${i.completedTasks > 1 ? 's' : ''} terminée${i.completedTasks > 1 ? 's' : ''}` });
  if (i.zone && i.zone.trim()) out.push({ code: 'ZONE', label: `Zone d\u2019intervention : ${i.zone.trim()}` });
  if (i.averageRating != null && (i.reviewCount ?? 0) >= 3) out.push({ code: 'RATING', label: `${i.averageRating.toFixed(1)}/5 sur ${i.reviewCount} avis` });
  return out;
}

/**
 * Formulation publique du réseau Fika, calculée sur les professionnels actifs.
 * Aucun « vérifié » tant qu'aucun professionnel n'a atteint « Profil vérifié ».
 */
export function networkClaim(levels: VerificationLevel[]): string {
  const verified = levels.filter((l) => levelRank(l) >= levelRank('PROFILE_VERIFIED')).length;
  const skilled = levels.filter((l) => levelRank(l) >= levelRank('SKILL_VERIFIED')).length;
  if (skilled > 0) return 'Des professionnels dont Fika a contrôlé le profil et la compétence';
  if (verified > 0) return 'Des professionnels dont Fika a contrôlé le profil';
  return 'Des professionnels sélectionnés et suivis par Fika';
}
