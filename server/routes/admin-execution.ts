import { z } from 'zod';
import { prisma } from '../../src/lib/prisma';
import { canAssignExpert, canTransitionTask, quoteDelivery } from '../../src/lib/proof';
import type { MutationResult } from './admin-orders';
import { getOrderMargin, type MarginView } from './admin-orders';

/**
 * Chaîne d'exécution du back-office (P07) : affectation d'expert, avancement
 * des tâches, livraison et preuve. Toutes les étapes sont pilotées par
 * l'équipe Fika — le client n'est jamais mis en relation directe avec
 * l'expert (invariant d'orchestration).
 */

const unauthorized = (): MutationResult => ({
  status: 401, body: { ok: false, code: 'UNAUTHORIZED', message: 'Session expirée. Reconnectez-vous.' },
});

/* ---------------------------- Affectation expert --------------------------- */

const assignSchema = z.object({
  orderId: z.string().min(1),
  expertId: z.string().min(1),
  /** Rémunération convenue ; par défaut le coût habituel de l'expert. */
  compensation: z.number().int().min(0).max(100_000_000).optional(),
  deadline: z.string().datetime().optional(),
  brief: z.string().trim().max(2000).optional(),
});

export async function handleAssignExpert(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult<{ taskId: string; margin: MarginView | null }>> {
  if (!adminId) return unauthorized();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Affectation invalide.' } };
  }

  const [order, expert] = await Promise.all([
    prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      include: { items: { include: { service: { select: { name: true } } } } },
    }),
    prisma.expert.findUnique({
      where: { id: parsed.data.expertId },
      include: { assignments: { where: { status: { in: ['ASSIGNED', 'ACCEPTED'] } }, select: { id: true } } },
    }),
  ]);

  if (!order) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Commande introuvable.' } };
  if (!expert) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Expert introuvable.' } };

  const check = canAssignExpert({
    id: expert.id, name: expert.name, skills: expert.skills, zone: expert.zone,
    usualCost: expert.usualCost, availability: expert.availability,
    status: expert.status, activeTaskCount: expert.assignments.length,
  });
  if (!check.ok) {
    return { status: 409, body: { ok: false, code: 'EXPERT_UNAVAILABLE', message: check.reason ?? 'Expert non assignable.' } };
  }

  const deliverables = order.items
    .map((i) => `${i.service?.name ?? i.customName ?? 'Prestation'}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`)
    .join('\n');
  const compensation = parsed.data.compensation ?? expert.usualCost ?? 0;
  const mainServiceId = order.items.find((i) => i.serviceId)?.serviceId ?? null;

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        orderId: order.id,
        serviceId: mainServiceId,
        clientBrief: parsed.data.brief ?? order.items.map((i) => i.customName).filter(Boolean).join('\n') || null,
        deliverables: deliverables || null,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : order.expectedDeliveryAt,
        internalCompensation: compensation,
        status: 'ASSIGNED',
        assignments: { create: [{ expertId: expert.id, status: 'ASSIGNED' }] },
      },
    });

    // Le coût expert pré-remplit la marge (modifiable ensuite côté commande).
    if (compensation > 0) {
      await tx.cost.create({
        data: { orderId: order.id, type: 'EXPERT', amount: compensation, note: `Mission confiée à ${expert.name}` },
      });
    }

    // Un expert engagé n'est plus proposé tant que la mission court.
    await tx.expert.update({ where: { id: expert.id }, data: { availability: false } });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        from: order.status,
        to: order.status,
        note: `Expert assigné : ${expert.name}.`,
        actorId: adminId,
      },
    });

    return created;
  });

  return { status: 200, body: { ok: true, taskId: task.id, margin: await getOrderMargin(order.id) } };
}

/* --------------------------- Avancement des tâches ------------------------- */

const taskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED']),
  notes: z.string().trim().max(2000).optional(),
});

export async function handleUpdateTask(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult> {
  if (!adminId) return unauthorized();
  const parsed = taskStatusSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Mise à jour invalide.' } };
  }

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    include: { assignments: { select: { id: true, expertId: true } }, order: { select: { id: true, status: true } } },
  });
  if (!task) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Tâche introuvable.' } };

  const check = canTransitionTask(task.status, parsed.data.status);
  if (!check.ok) {
    return { status: 409, body: { ok: false, code: 'TASK_TRANSITION_REFUSED', message: check.reason ?? 'Transition refusée.' } };
  }

  const done = parsed.data.status === 'COMPLETED' || parsed.data.status === 'CANCELLED';

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: { status: parsed.data.status, notes: parsed.data.notes ?? task.notes },
    });

    if (done) {
      await tx.taskAssignment.updateMany({
        where: { taskId: task.id },
        data: { status: parsed.data.status === 'COMPLETED' ? 'COMPLETED' : 'DECLINED' },
      });
      // L'expert redevient disponible et voit son compteur progresser.
      for (const a of task.assignments) {
        await tx.expert.update({
          where: { id: a.expertId },
          data: {
            availability: true,
            ...(parsed.data.status === 'COMPLETED' ? { completedOrders: { increment: 1 } } : {}),
          },
        });
      }
    }

    await tx.orderEvent.create({
      data: {
        orderId: task.order.id,
        from: task.order.status,
        to: task.order.status,
        note: `Tâche : ${task.status} → ${parsed.data.status}.${parsed.data.notes ? ` ${parsed.data.notes}` : ''}`,
        actorId: adminId,
      },
    });
  });

  return { status: 200, body: { ok: true } };
}

/* -------------------------------- Livraison -------------------------------- */

const deliverySchema = z.object({
  orderId: z.string().min(1),
  zoneId: z.string().min(1).nullish(),
  address: z.string().trim().max(300).optional(),
  courierExpertId: z.string().min(1).nullish(),
  status: z.enum(['PENDING', 'PICKUP', 'IN_TRANSIT', 'DELIVERED', 'FAILED']),
  /** Coût interne du transport (0 si course assurée en interne). */
  internalCost: z.number().int().min(0).max(100_000_000).default(0),
  proofUrl: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function handleUpsertDelivery(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult<{ deliveryId: string; customerFee: number; margin: MarginView | null }>> {
  if (!adminId) return unauthorized();
  const parsed = deliverySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Livraison invalide.' } };
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: { deliveries: { take: 1, orderBy: { createdAt: 'desc' } }, costs: { where: { type: 'DELIVERY' } } },
  });
  if (!order) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Commande introuvable.' } };

  // Invariant : le client ne paie jamais la livraison ; seul le coût interne existe.
  const quote = quoteDelivery(parsed.data.internalCost);

  const existing = order.deliveries[0];
  const data = {
    orderId: order.id,
    address: parsed.data.address ?? order.clientAddress,
    zoneId: parsed.data.zoneId ?? null,
    status: parsed.data.status,
    courierExpertId: parsed.data.courierExpertId ?? null,
    fee: quote.internalCost,
    proofUrl: parsed.data.proofUrl ?? null,
    note: parsed.data.note ?? null,
  };

  const delivery = existing
    ? await prisma.delivery.update({ where: { id: existing.id }, data })
    : await prisma.delivery.create({ data });

  // Coût interne tracé une seule fois (transporteur tiers).
  const alreadyTraced = order.costs.reduce((s, c) => s + c.amount, 0);
  if (quote.internalCost > alreadyTraced) {
    await prisma.cost.create({
      data: {
        orderId: order.id,
        type: 'DELIVERY',
        amount: quote.internalCost - alreadyTraced,
        note: 'Transport (gratuit pour le client — Ngaoundéré)',
      },
    });
  }

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      from: order.status,
      to: order.status,
      note: `Livraison : ${parsed.data.status}. Frais client 0 F (${quote.label}).`,
      actorId: adminId,
    },
  });

  return {
    status: 200,
    body: { ok: true, deliveryId: delivery.id, customerFee: quote.customerFee, margin: await getOrderMargin(order.id) },
  };
}

/* -------------------------- Publication portfolio -------------------------- */

const portfolioSchema = z.object({
  orderId: z.string().min(1),
  title: z.string().trim().min(3).max(120),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().max(1000).optional(),
  /** Chemin d'asset local (/fika/...) — TODO_PROD pour les visuels réels. */
  image: z.string().trim().min(1).max(300),
  clientType: z.string().trim().max(80).optional(),
});

export async function handlePublishPortfolio(
  body: unknown,
  adminId: string | null,
): Promise<MutationResult<{ portfolioId: string }>> {
  if (!adminId) return unauthorized();
  const parsed = portfolioSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'VALIDATION', message: 'Réalisation invalide.' } };
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: { items: { select: { serviceId: true } } },
  });
  if (!order) return { status: 404, body: { ok: false, code: 'NOT_FOUND', message: 'Commande introuvable.' } };
  if (order.status !== 'COMPLETED') {
    return {
      status: 409,
      body: { ok: false, code: 'ORDER_NOT_COMPLETED', message: 'Seule une commande terminée peut alimenter le portfolio.' },
    };
  }

  const item = await prisma.portfolioItem.create({
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      serviceId: order.items.find((i) => i.serviceId)?.serviceId ?? null,
      orderId: order.id,
      description: parsed.data.description ?? null,
      image: parsed.data.image,
      clientType: parsed.data.clientType ?? null,
      date: new Date(),
      active: true,
    },
  });

  return { status: 200, body: { ok: true, portfolioId: item.id } };
}
