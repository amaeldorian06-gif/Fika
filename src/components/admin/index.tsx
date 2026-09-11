import { AdminShell } from './AdminShell';
import {
  AdminAnalytics, AdminClients, AdminExperts, AdminLeads, AdminOrderDetailView,
  AdminOrders, AdminOverview,
} from './AdminViews';

/**
 * Routeur du back-office : /admin, /admin/orders, /admin/orders/[id],
 * /admin/leads, /admin/clients, /admin/experts, /admin/analytics.
 * La garde de session vit dans AdminShell (login si non authentifié).
 */
export function AdminRouter({ path }: { path: string }) {
  if (path.startsWith('/admin/orders/')) {
    const id = decodeURIComponent(path.slice('/admin/orders/'.length));
    return (
      <AdminShell path={path} title="Détail de la commande" breadcrumb="Commandes">
        <AdminOrderDetailView orderId={id} />
      </AdminShell>
    );
  }

  switch (path) {
    case '/admin/orders':
      return (
        <AdminShell path={path} title="Commandes" breadcrumb="Commandes">
          <AdminOrders />
        </AdminShell>
      );
    case '/admin/leads':
      return (
        <AdminShell path={path} title="Demandes à qualifier" breadcrumb="Demandes">
          <AdminLeads />
        </AdminShell>
      );
    case '/admin/clients':
      return (
        <AdminShell path={path} title="Clients" breadcrumb="Clients">
          <AdminClients />
        </AdminShell>
      );
    case '/admin/experts':
      return (
        <AdminShell path={path} title="Experts partenaires" breadcrumb="Experts">
          <AdminExperts />
        </AdminShell>
      );
    case '/admin/analytics':
      return (
        <AdminShell path={path} title="Analytiques" breadcrumb="Analytiques">
          <AdminAnalytics />
        </AdminShell>
      );
    default:
      return (
        <AdminShell path="/admin" title="Tableau de bord">
          <AdminOverview />
        </AdminShell>
      );
  }
}

// Export par défaut : permet le lazy-loading de tout le back-office (P09).
export default AdminRouter;
