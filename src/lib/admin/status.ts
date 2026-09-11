/**
 * Statuts de commande — libellés français, couleurs et règles de transition.
 * Source unique partagée par l'UI admin et les routes serveur (P06).
 * Aucun libellé anglais brut ne doit apparaître dans l'interface.
 */

export type OrderStatus =
  | 'NEW' | 'QUALIFYING' | 'QUOTED' | 'AWAITING_CONFIRMATION' | 'PAID'
  | 'ASSIGNED' | 'IN_PROGRESS' | 'QUALITY_CHECK' | 'READY' | 'DELIVERED'
  | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

export interface StatusMeta {
  label: string;
  /** Classes Tailwind (tokens neutres + palette d'état). */
  classes: string;
  /** Étape du pipeline opérationnel (tri des files). */
  step: number;
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  NEW:                   { label: 'Nouvelle',              classes: 'bg-amber-100 text-amber-700 border-amber-200',       step: 1 },
  QUALIFYING:            { label: 'En qualification',      classes: 'bg-amber-100 text-amber-700 border-amber-200',       step: 2 },
  QUOTED:                { label: 'Devis envoyé',          classes: 'bg-blue-100 text-blue-700 border-blue-200',          step: 3 },
  AWAITING_CONFIRMATION: { label: 'Attente confirmation',  classes: 'bg-blue-100 text-blue-700 border-blue-200',          step: 4 },
  PAID:                  { label: 'Payée',                 classes: 'bg-emerald-100 text-emerald-700 border-emerald-200', step: 5 },
  ASSIGNED:              { label: 'Assignée',              classes: 'bg-indigo-100 text-indigo-700 border-indigo-200',    step: 6 },
  IN_PROGRESS:           { label: 'En cours',              classes: 'bg-indigo-100 text-indigo-700 border-indigo-200',    step: 7 },
  QUALITY_CHECK:         { label: 'Contrôle qualité',      classes: 'bg-purple-100 text-purple-700 border-purple-200',    step: 8 },
  READY:                 { label: 'Prête',                 classes: 'bg-purple-100 text-purple-700 border-purple-200',    step: 9 },
  DELIVERED:             { label: 'Livrée',                classes: 'bg-teal-100 text-teal-700 border-teal-200',          step: 10 },
  COMPLETED:             { label: 'Terminée',              classes: 'bg-emerald-100 text-emerald-700 border-emerald-200', step: 11 },
  CANCELLED:             { label: 'Annulée',               classes: 'bg-red-100 text-red-700 border-red-200',             step: 12 },
  DISPUTED:              { label: 'Litige',                classes: 'bg-red-100 text-red-700 border-red-200',             step: 13 },
};

export const orderStatusLabel = (status: OrderStatus): string =>
  ORDER_STATUS_META[status]?.label ?? status;

/** Statuts considérés comme chiffre d'affaires réalisé. */
export const REVENUE_STATUSES: OrderStatus[] = ['PAID', 'ASSIGNED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'DELIVERED', 'COMPLETED'];

/** Statuts nécessitant une action de l'équipe (file « à traiter »). */
export const TODO_STATUSES: OrderStatus[] = ['NEW', 'QUALIFYING', 'AWAITING_CONFIRMATION'];

/** Transitions autorisées depuis chaque statut. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['QUALIFYING', 'CANCELLED'],
  QUALIFYING: ['QUOTED', 'AWAITING_CONFIRMATION', 'CANCELLED'],
  QUOTED: ['AWAITING_CONFIRMATION', 'PAID', 'CANCELLED'],
  AWAITING_CONFIRMATION: ['PAID', 'QUOTED', 'CANCELLED'],
  PAID: ['ASSIGNED', 'CANCELLED', 'DISPUTED'],
  ASSIGNED: ['IN_PROGRESS', 'PAID', 'CANCELLED', 'DISPUTED'],
  IN_PROGRESS: ['QUALITY_CHECK', 'DISPUTED', 'CANCELLED'],
  QUALITY_CHECK: ['READY', 'IN_PROGRESS', 'DISPUTED'],
  READY: ['DELIVERED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: ['DISPUTED'],
  CANCELLED: [],
  DISPUTED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
};

export interface TransitionContext {
  /** Un expert est assigné à au moins une tâche de la commande. */
  hasAssignedExpert: boolean;
  /** Le total des paiements confirmés couvre le montant dû. */
  hasConfirmedPayment: boolean;
  /** La commande porte au moins une ligne. */
  hasItems: boolean;
}

export interface TransitionCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Valide une transition : graphe d'états + règles métier.
 * ASSIGNED exige un expert ; PAID exige un paiement confirmé ;
 * COMPLETED exige un paiement intégralement confirmé.
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  ctx: TransitionContext,
): TransitionCheck {
  if (from === to) return { ok: false, reason: 'La commande est déjà dans ce statut.' };

  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Transition impossible : « ${orderStatusLabel(from)} » → « ${orderStatusLabel(to)} ».`,
    };
  }

  if (to === 'QUOTED' && !ctx.hasItems) {
    return { ok: false, reason: 'Ajoutez au moins une ligne avant d\u2019envoyer un devis.' };
  }
  if (to === 'PAID' && !ctx.hasConfirmedPayment) {
    return { ok: false, reason: 'Le paiement confirmé doit couvrir le montant total (un acompte ne suffit pas).' };
  }
  if (to === 'ASSIGNED' && !ctx.hasAssignedExpert) {
    return { ok: false, reason: 'Assignez un expert avant de passer la commande en « Assignée ».' };
  }
  if (to === 'COMPLETED' && !ctx.hasConfirmedPayment) {
    return { ok: false, reason: 'Le solde doit être entièrement confirmé avant de terminer la commande.' };
  }

  return { ok: true };
}

/** Transitions proposables dans l'UI (avec motif de blocage éventuel). */
export function transitionOptions(
  from: OrderStatus,
  ctx: TransitionContext,
): { status: OrderStatus; label: string; check: TransitionCheck }[] {
  return (ALLOWED_TRANSITIONS[from] ?? []).map((status) => ({
    status,
    label: orderStatusLabel(status),
    check: canTransition(from, status, ctx),
  }));
}

/* ------------------------------ Autres enums ------------------------------ */

export const COST_TYPE_LABELS: Record<string, string> = {
  EXPERT: 'Expert', MATERIAL: 'Matériel', DELIVERY: 'Livraison', OTHER: 'Autre',
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouveau', QUALIFYING: 'En qualification', CONVERTED: 'Converti', LOST: 'Perdu',
};

export const EXPERT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif', PAUSED: 'En pause', SUSPENDED: 'Suspendu', BACKUP: 'Renfort',
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', SENT: 'Envoyé', ACCEPTED: 'Accepté', REJECTED: 'Refusé', EXPIRED: 'Expiré',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', CONFIRMED: 'Confirmé', FAILED: 'Échoué', REFUNDED: 'Remboursé',
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: 'À planifier', PICKUP: 'Récupération', IN_TRANSIT: 'En route',
  DELIVERED: 'Livrée', FAILED: 'Échec',
};
