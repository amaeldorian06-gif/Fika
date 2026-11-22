import { prisma } from '../../src/lib/prisma';

/**
 * Alertes opérationnelles du tableau de bord (§8 du cahier des charges) :
 * chaque alerte est un compteur réel calculé en base et mène directement à
 * la liste opérationnelle correspondante. Aucune alerte décorative — si le
 * compteur est à zéro, elle n'apparaît pas.
 */

export interface AdminAlertDto {
  key: string;
  label: string;
  count: number;
  link: string;
  /** Sérieux : réclame une action Fika maintenant (vs attente côté client). */
  severity: 'action' | 'suivi';
}

export async function getAdminAlerts(): Promise<AdminAlertDto[]> {
  const [
    leadsNew,
    servicesTodo,
    servicesExecution,
    servicesDisputed,
    marketToProcess,
    marketQuotesSent,
    marketDelayed,
    marketInDelivery,
    paymentsPending,
    marketPaymentsPending,
    providerResponsesPending,
    tasksOverdue,
  ] = await Promise.all([
    prisma.lead.count({ where: { status: 'NEW' } }),
    prisma.order.count({ where: { status: { in: ['NEW', 'QUALIFYING', 'QUOTED', 'AWAITING_CONFIRMATION'] } } }),
    prisma.order.count({ where: { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'QUALITY_CHECK'] } } }),
    prisma.order.count({ where: { status: 'DISPUTED' } }),
    prisma.marketOrder.count({ where: { status: { in: ['REQUESTED', 'SUPPLIER_CHECK'] } } }),
    prisma.marketOrder.count({ where: { status: 'AWAITING_CLIENT' } }),
    prisma.marketOrder.count({ where: { status: 'DELAYED' } }),
    prisma.marketOrder.count({ where: { status: { in: ['PROCURING', 'SHIPPED_INBOUND', 'RECEIVED', 'READY', 'DELIVERING'] } } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.marketPayment.count({ where: { status: 'PENDING' } }),
    prisma.taskAssignment.count({ where: { status: 'ASSIGNED', task: { status: 'ASSIGNED' } } }),
    prisma.task.count({ where: { deadline: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
  ]);

  const alerts: AdminAlertDto[] = [
    { key: 'leads-new', label: 'Nouvelles demandes de service à qualifier', count: leadsNew, link: '/admin/leads', severity: 'action' },
    { key: 'services-todo', label: 'Commandes Services à traiter (devis, confirmation)', count: servicesTodo, link: '/admin/orders', severity: 'action' },
    { key: 'market-process', label: 'Commandes Market à confirmer (réception, vérification fournisseur)', count: marketToProcess, link: '/admin/market/orders', severity: 'action' },
    { key: 'payments-verify', label: 'Paiements déclarés à vérifier (Services + Market)', count: paymentsPending + marketPaymentsPending, link: '/admin/finances', severity: 'action' },
    { key: 'provider-response', label: 'Prestataires affectés sans réponse enregistrée', count: providerResponsesPending, link: '/admin/orders', severity: 'action' },
    { key: 'tasks-overdue', label: 'Missions Services dont l’échéance est dépassée', count: tasksOverdue, link: '/admin/orders', severity: 'action' },
    { key: 'services-disputed', label: 'Commandes Services en litige', count: servicesDisputed, link: '/admin/orders', severity: 'action' },
    { key: 'market-delayed', label: 'Commandes Market en retard', count: marketDelayed, link: '/admin/market/orders', severity: 'action' },
    { key: 'services-execution', label: 'Interventions Services en cours d’exécution', count: servicesExecution, link: '/admin/orders', severity: 'suivi' },
    { key: 'market-quotes', label: 'Devis Market en attente de réponse client', count: marketQuotesSent, link: '/admin/market/orders', severity: 'suivi' },
    { key: 'market-delivery', label: 'Commandes Market en approvisionnement ou livraison', count: marketInDelivery, link: '/admin/market/orders', severity: 'suivi' },
  ];
  return alerts.filter((a) => a.count > 0);
}
