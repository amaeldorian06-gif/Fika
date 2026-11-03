import { describe, expect, it } from 'vitest';
import {
  VERIFICATION_LEVELS, canSetLevel, activityLevel, effectiveLevel, computeExpertMetrics,
  publicTrustSignals, networkClaim, levelRank,
} from './trust';

const d = (iso: string) => new Date(iso);
const NOW = d('2026-09-19T12:00:00Z');

describe('niveaux de confiance', () => {
  it('définit 7 niveaux ordonnés, les deux derniers automatiques', () => {
    expect(VERIFICATION_LEVELS.map((l) => l.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(VERIFICATION_LEVELS.filter((l) => l.automatic).map((l) => l.level)).toEqual(['FIKA_JOB_DONE', 'ACTIVE_PRO']);
    expect(levelRank('INCONNU')).toBe(1);
  });

  it('refuse les niveaux automatiques à la main', () => {
    expect(canSetLevel('SKILL_VERIFIED', 'FIKA_JOB_DONE', 'COMPLETED_JOB', 'x').ok).toBe(false);
    expect(canSetLevel('NEW', 'ACTIVE_PRO', 'ADMIN_REVIEW', 'x').ok).toBe(false);
  });

  it('exige un type de vérification cohérent pour monter', () => {
    expect(canSetLevel('NEW', 'PHONE_VERIFIED', 'ID_DOCUMENT', null).ok).toBe(false);
    expect(canSetLevel('NEW', 'PHONE_VERIFIED', 'PHONE_CALL', null).ok).toBe(true);
    expect(canSetLevel('PHONE_VERIFIED', 'PROFILE_VERIFIED', 'PHONE_CALL', null).ok).toBe(false);
    expect(canSetLevel('PHONE_VERIFIED', 'PROFILE_VERIFIED', 'ID_DOCUMENT', null).ok).toBe(true);
    expect(canSetLevel('PROFILE_VERIFIED', 'SKILL_VERIFIED', 'ADMIN_REVIEW', null).ok).toBe(false);
    expect(canSetLevel('PROFILE_VERIFIED', 'SKILL_VERIFIED', 'PRACTICAL_TEST', null).ok).toBe(true);
  });

  it('exige un motif pour rétrograder et refuse le statu quo', () => {
    expect(canSetLevel('SKILL_VERIFIED', 'NEW', 'ADMIN_REVIEW', '').ok).toBe(false);
    expect(canSetLevel('SKILL_VERIFIED', 'NEW', 'ADMIN_REVIEW', 'Faux diplôme constaté').ok).toBe(true);
    expect(canSetLevel('NEW', 'NEW', 'ADMIN_REVIEW', 'x').ok).toBe(false);
  });
});

describe('niveaux automatiques', () => {
  const none = { completedTasks: 0, cancelledTasks: 0, lastCompletedAt: null, lastCancelledAt: null };
  it('sans intervention terminée, le niveau manuel reste', () => {
    expect(activityLevel(none, NOW)).toBeNull();
    expect(effectiveLevel('PHONE_VERIFIED', none, NOW)).toBe('PHONE_VERIFIED');
  });
  it('une intervention terminée donne « Intervention Fika réalisée » sans écraser un niveau plus haut', () => {
    const one = { ...none, completedTasks: 1, lastCompletedAt: d('2026-09-01T00:00:00Z') };
    expect(effectiveLevel('NEW', one, NOW)).toBe('FIKA_JOB_DONE');
    expect(effectiveLevel('SKILL_VERIFIED', one, NOW)).toBe('FIKA_JOB_DONE');
  });
  it('« Professionnel actif » exige 3 terminées, aucune annulation récente et une mission récente ; il est révocable', () => {
    const active = { ...none, completedTasks: 3, lastCompletedAt: d('2026-09-10T00:00:00Z') };
    expect(effectiveLevel('NEW', active, NOW)).toBe('ACTIVE_PRO');
    expect(effectiveLevel('ACTIVE_PRO', { ...active, cancelledTasks: 1, lastCancelledAt: d('2026-09-15T00:00:00Z') }, NOW)).toBe('FIKA_JOB_DONE');
    expect(effectiveLevel('ACTIVE_PRO', { ...active, lastCompletedAt: d('2026-01-01T00:00:00Z') }, NOW)).toBe('FIKA_JOB_DONE');
    expect(effectiveLevel('ACTIVE_PRO', { ...active, cancelledTasks: 1, lastCancelledAt: d('2026-01-01T00:00:00Z') }, NOW)).toBe('ACTIVE_PRO');
  });
});

describe('métriques calculées depuis les tâches réelles', () => {
  it('renvoie null sans donnée (aucune statistique inventée)', () => {
    const m = computeExpertMetrics([], []);
    expect(m).toMatchObject({ completedTasks: 0, cancellationRate: null, reworkRate: null, avgResponseHours: null, avgCompletionHours: null, averageRating: null, reviewCount: 0 });
  });
  it('calcule annulation, reprise, délais et satisfaction', () => {
    const t0 = d('2026-09-01T08:00:00Z');
    const tasks = [
      { status: 'COMPLETED', createdAt: t0, assignedAt: t0, startedAt: d('2026-09-01T10:00:00Z'), completedAt: d('2026-09-02T08:00:00Z'), reworked: true },
      { status: 'COMPLETED', createdAt: t0, assignedAt: t0, startedAt: d('2026-09-01T12:00:00Z'), completedAt: d('2026-09-03T08:00:00Z'), reworked: false },
      { status: 'CANCELLED', createdAt: t0, assignedAt: t0, startedAt: null, completedAt: null, reworked: false },
      { status: 'IN_PROGRESS', createdAt: t0, assignedAt: t0, startedAt: null, completedAt: null, reworked: false },
    ];
    const m = computeExpertMetrics(tasks, [{ rating: 5 }, { rating: 4 }, { rating: 9 }]);
    expect(m.completedTasks).toBe(2);
    expect(m.cancelledTasks).toBe(1);
    expect(m.activeTasks).toBe(1);
    expect(m.cancellationRate).toBe(33.3);
    expect(m.reworkRate).toBe(50);
    expect(m.avgResponseHours).toBe(3);
    expect(m.avgCompletionHours).toBe(36);
    expect(m.averageRating).toBe(4.5);
    expect(m.reviewCount).toBe(2);
    expect(m.lastCompletedAt?.toISOString()).toBe('2026-09-03T08:00:00.000Z');
  });
});

describe('signaux publics', () => {
  it('n’affiche rien de « vérifié » avant le profil contrôlé', () => {
    const labels = publicTrustSignals({ level: 'PHONE_VERIFIED', zone: 'Dang', completedTasks: 0 }).map((s) => s.label);
    expect(labels).toEqual(['Zone d’intervention : Dang']);
    expect(labels.join(' ')).not.toMatch(/vérifi/i);
  });
  it('n’affiche que les signaux réellement disponibles', () => {
    const codes = publicTrustSignals({ level: 'PROFILE_VERIFIED', zone: null, completedTasks: 2, averageRating: 5, reviewCount: 2 }).map((s) => s.code);
    expect(codes).toEqual(['PROFILE_CHECKED', 'FIKA_EXPERIENCE', 'COMPLETED_COUNT']);
  });
  it('affiche compétence, statut actif et note dès que les données existent', () => {
    const labels = publicTrustSignals({ level: 'ACTIVE_PRO', zone: 'Bamyanga', completedTasks: 4, averageRating: 4.7, reviewCount: 3 }).map((s) => s.label);
    expect(labels).toEqual([
      'Profil contrôlé par Fika', 'Compétence vérifiée par Fika', 'Professionnel actif sur Fika',
      '4 interventions terminées', 'Zone d’intervention : Bamyanga', '4.7/5 sur 3 avis',
    ]);
  });
  it('formule le réseau sans « vérifié » tant qu’aucun profil n’est contrôlé', () => {
    expect(networkClaim([])).toBe('Des professionnels sélectionnés et suivis par Fika');
    expect(networkClaim(['NEW', 'PHONE_VERIFIED'])).toBe('Des professionnels sélectionnés et suivis par Fika');
    expect(networkClaim(['PROFILE_VERIFIED'])).toBe('Des professionnels dont Fika a contrôlé le profil');
    expect(networkClaim(['SKILL_VERIFIED', 'NEW'])).toBe('Des professionnels dont Fika a contrôlé le profil et la compétence');
  });
});
