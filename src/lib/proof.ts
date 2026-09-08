/**
 * Règles de la chaîne opérationnelle et de la preuve (P07) — fonctions pures.
 *
 * Invariants verrouillés ici :
 *  - une Review publique = une commande COMPLETED (orderId unique) ;
 *  - le client ne paie jamais la livraison à Ngaoundéré (coût interne tracé) ;
 *  - aucune donnée client complète n'est exposée publiquement (pseudo + ville) ;
 *  - le score expert n'est jamais stocké : il se calcule à la lecture.
 */

/* ----------------------------- Affectation -------------------------------- */

export interface AssignableExpert {
  id: string;
  name: string;
  skills: string[];
  zone: string | null;
  usualCost: number | null;
  availability: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'BACKUP';
  /** Tâches en cours (PENDING/ASSIGNED/IN_PROGRESS/REVIEW). */
  activeTaskCount: number;
}

export interface AssignmentCheck {
  ok: boolean;
  reason?: string;
}

/** Un expert indisponible ou suspendu ne peut pas recevoir de tâche. */
export function canAssignExpert(expert: AssignableExpert): AssignmentCheck {
  if (expert.status === 'SUSPENDED') return { ok: false, reason: 'Expert suspendu.' };
  if (expert.status === 'PAUSED') return { ok: false, reason: 'Expert en pause.' };
  if (!expert.availability) {
    return { ok: false, reason: 'Expert indisponible : une mission est déjà en cours.' };
  }
  return { ok: true };
}

/** Tri de suggestion : compétence correspondante, puis zone, puis charge. */
export function rankExperts(
  experts: AssignableExpert[],
  criteria: { skill?: string | null; zone?: string | null },
): AssignableExpert[] {
  const score = (e: AssignableExpert): number => {
    let s = 0;
    if (criteria.skill && e.skills.some((k) => k.toLowerCase().includes(criteria.skill!.toLowerCase()))) s -= 100;
    if (criteria.zone && e.zone && e.zone.toLowerCase() === criteria.zone.toLowerCase()) s -= 50;
    if (!canAssignExpert(e).ok) s += 1000;
    return s + e.activeTaskCount;
  };
  return [...experts].sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

/* ------------------------------ Livraison --------------------------------- */

export interface DeliveryQuote {
  /** Toujours 0 : la gratuité ne dépend jamais du quartier. */
  customerFee: number;
  /** Coût réellement supporté par Fika (tracé en Cost DELIVERY). */
  internalCost: number;
  label: string;
}

export function quoteDelivery(internalCost: number, deliveryIncluded = true): DeliveryQuote {
  return {
    customerFee: 0,
    internalCost: Math.max(0, Math.round(internalCost)),
    label: deliveryIncluded
      ? 'Livraison gratuite dans toute la ville de Ngaoundéré'
      : 'Livraison à organiser',
  };
}

/* -------------------------------- Preuve ---------------------------------- */

export interface ReviewEligibility {
  ok: boolean;
  code?: 'ORDER_NOT_FOUND' | 'ORDER_NOT_COMPLETED' | 'REVIEW_EXISTS' | 'RATING_OUT_OF_RANGE' | 'NO_SERVICE';
  message?: string;
}

export interface ReviewContext {
  orderExists: boolean;
  orderStatus: string | null;
  hasExistingReview: boolean;
  serviceId: string | null;
  rating: number;
}

/** Une review n'est acceptée que sur une commande terminée, une seule fois. */
export function checkReviewEligibility(ctx: ReviewContext): ReviewEligibility {
  if (!ctx.orderExists) {
    return { ok: false, code: 'ORDER_NOT_FOUND', message: 'Commande introuvable.' };
  }
  if (ctx.orderStatus !== 'COMPLETED') {
    return {
      ok: false,
      code: 'ORDER_NOT_COMPLETED',
      message: 'Un avis ne peut être publié que sur une commande terminée.',
    };
  }
  if (ctx.hasExistingReview) {
    return { ok: false, code: 'REVIEW_EXISTS', message: 'Cette commande a déjà un avis.' };
  }
  if (!ctx.serviceId) {
    return { ok: false, code: 'NO_SERVICE', message: 'La commande ne référence aucun service.' };
  }
  if (!Number.isInteger(ctx.rating) || ctx.rating < 1 || ctx.rating > 5) {
    return { ok: false, code: 'RATING_OUT_OF_RANGE', message: 'La note doit être comprise entre 1 et 5.' };
  }
  return { ok: true };
}

/**
 * Anonymisation publique : prénom + initiale du nom (« Aminata T. »).
 * Jamais de nom complet, jamais de téléphone.
 */
export function publicDisplayName(fullName: string | null | undefined): string {
  const name = (fullName ?? '').trim();
  if (!name) return 'Client vérifié';
  const [first, ...rest] = name.split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

export interface PublicTestimonial {
  id: string;
  name: string;
  city: string | null;
  content: string;
  rating: number;
  serviceName: string | null;
  verified: boolean;
}

export interface ReviewRecord {
  id: string;
  rating: number;
  comment: string | null;
  verified: boolean;
  customerName: string | null;
  cityName: string | null;
  serviceName: string | null;
}

/** Projection publique d'une review (pseudo + ville uniquement). */
export function toPublicTestimonial(review: ReviewRecord): PublicTestimonial {
  return {
    id: review.id,
    name: publicDisplayName(review.customerName),
    city: review.cityName,
    content: review.comment ?? '',
    rating: review.rating,
    serviceName: review.serviceName,
    verified: review.verified,
  };
}

/** Seules les reviews vérifiées et commentées sont publiables en vitrine. */
export function selectPublishableTestimonials(reviews: ReviewRecord[], limit = 6): PublicTestimonial[] {
  return reviews
    .filter((r) => r.verified && (r.comment ?? '').trim().length >= 20 && r.rating >= 4)
    .slice(0, limit)
    .map(toPublicTestimonial);
}

/* ---------------------------- Score des experts ---------------------------- */

export interface ExpertScore {
  average: number | null;
  count: number;
}

/** Moyenne des notes — calculée à la lecture, jamais stockée. */
export function computeExpertScore(ratings: number[]): ExpertScore {
  if (ratings.length === 0) return { average: null, count: 0 };
  const sum = ratings.reduce((s, r) => s + r, 0);
  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length };
}

/* -------------------------------- Tâches ---------------------------------- */

export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: 'À planifier',
  ASSIGNED: 'Assignée',
  IN_PROGRESS: 'En cours',
  REVIEW: 'Contrôle qualité',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Assignée', ACCEPTED: 'Acceptée', DECLINED: 'Refusée', COMPLETED: 'Terminée',
};

/** Transitions autorisées pour une tâche (pilotées par l'équipe Fika). */
export const TASK_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['REVIEW', 'CANCELLED'],
  REVIEW: ['COMPLETED', 'IN_PROGRESS'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionTask(from: string, to: string): AssignmentCheck {
  if (from === to) return { ok: false, reason: 'La tâche est déjà dans cet état.' };
  const allowed = TASK_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Transition impossible : « ${TASK_STATUS_LABELS[from] ?? from} » → « ${TASK_STATUS_LABELS[to] ?? to} ».`,
    };
  }
  return { ok: true };
}
