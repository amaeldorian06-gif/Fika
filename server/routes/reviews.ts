import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';
import {
  checkReviewEligibility, computeExpertScore, selectPublishableTestimonials,
  type PublicTestimonial, type ReviewRecord,
} from '../../src/lib/proof';

/**
 * Avis clients (P07) — cœur de la promesse de confiance.
 *
 * Règle absolue : une Review n'existe que rattachée à une commande COMPLETED
 * (orderId unique en base + vérification applicative). Aucune création
 * publique libre : l'API exige un identifiant de commande valide et terminée.
 */

const createReviewSchema = z.object({
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  /** Expert à créditer (sinon déduit de la mission de la commande). */
  expertId: z.string().min(1).optional(),
});

export type ReviewResult =
  | { status: 200; body: { ok: true; reviewId: string } }
  | { status: 400 | 404 | 409; body: { ok: false; code: string; message: string } };

export async function handleCreateReview(body: unknown): Promise<ReviewResult> {
  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Avis invalide.' } };
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: {
      items: { select: { serviceId: true } },
      review: { select: { id: true } },
      tasks: { include: { assignments: { select: { expertId: true } } } },
    },
  });

  const serviceId = order?.items.find((i) => i.serviceId)?.serviceId ?? null;

  const eligibility = checkReviewEligibility({
    orderExists: Boolean(order),
    orderStatus: order?.status ?? null,
    hasExistingReview: Boolean(order?.review),
    serviceId,
    rating: parsed.data.rating,
  });

  if (!eligibility.ok) {
    const status = eligibility.code === 'ORDER_NOT_FOUND' ? 404
      : eligibility.code === 'REVIEW_EXISTS' ? 409
      : 400;
    return { status, body: { ok: false, code: eligibility.code ?? 'REFUSED', message: eligibility.message ?? 'Avis refusé.' } };
  }

  const expertId = parsed.data.expertId
    ?? order!.tasks.flatMap((t) => t.assignments).at(0)?.expertId
    ?? null;

  const review = await prisma.review.create({
    data: {
      customerId: order!.customerId,
      orderId: order!.id,
      serviceId: serviceId!,
      expertId,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
      verified: true, // adossé à une transaction réelle
    },
  });

  return { status: 200, body: { ok: true, reviewId: review.id } };
}

/* ---------------------------- Lectures publiques --------------------------- */

/** Témoignages publics : pseudo + ville uniquement, jamais de coordonnées. */
export async function getPublicTestimonials(limit = 6): Promise<PublicTestimonial[]> {
  const reviews = await prisma.review.findMany({
    where: { verified: true, rating: { gte: 4 }, comment: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: limit * 3,
    include: {
      customer: { select: { name: true } },
      service: { select: { name: true } },
      order: { include: { city: { select: { name: true } } } },
    },
  });

  const records: ReviewRecord[] = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    verified: r.verified,
    customerName: r.customer?.name ?? null,
    cityName: r.order?.city?.name ?? null,
    serviceName: r.service?.name ?? null,
  }));

  return selectPublishableTestimonials(records, limit);
}

/** Réalisations publiées (toujours adossées à une commande terminée). */
export async function getPublicPortfolio(limit = 8) {
  const items = await prisma.portfolioItem.findMany({
    where: { active: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: { id: true, title: true, category: true, image: true, description: true, clientType: true },
  });
  return items;
}

/** Score d'un expert — calculé à la lecture, jamais stocké. */
export async function getExpertScore(expertId: string) {
  const reviews = await prisma.review.findMany({
    where: { expertId, verified: true },
    select: { rating: true },
  });
  return computeExpertScore(reviews.map((r) => r.rating));
}
