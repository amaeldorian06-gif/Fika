import { AdminMarketLedger } from './AdminMarketLedger';
import {
  AdminMarketBatches, AdminMarketCatalog, AdminMarketOrderDetail, AdminMarketOrders, AdminMarketOverview,
} from './AdminMarket';
import { AdminShell } from './AdminShell';
import {
  AdminAnalytics, AdminLeads, AdminOrderDetailView,
  AdminOrders, AdminOverview,
} from './AdminViews';

/**
 * Routeur du back-office : /admin, /admin/orders, /admin/orders/[id],
 * /admin/leads, /admin/analytics + espace Fika Market.
 * La garde de session vit dans AdminShell (login si non authentifié).
 * Les anciennes routes /admin/clients, /admin/experts et /admin/reports
 * (sections retirées) retombent sur le tableau de bord — jamais d'erreur.
 */
export function AdminRouter({ path }: { path: string }) {
  if (path.startsWith('/admin/market/orders/')) {
    const id = decodeURIComponent(path.slice('/admin/market/orders/'.length));
    return (
      <AdminShell path={path} title="Commande Fika Market" breadcrumb="Market">
        <AdminMarketOrderDetail orderId={id} />
      </AdminShell>
    );
  }
  switch (path) {
    case '/admin/market':
      return <AdminShell path={path} title="Fika Market — pilotage"><AdminMarketOverview /></AdminShell>;
    case '/admin/market/catalog':
      return <AdminShell path={path} title="Fika Market — catalogue"><AdminMarketCatalog /></AdminShell>;
    case '/admin/market/releves':
      return <AdminShell path={path} title="Fika Market — relevés & marges"><AdminMarketLedger /></AdminShell>;
    case '/admin/market/orders':
      return <AdminShell path={path} title="Fika Market — commandes"><AdminMarketOrders /></AdminShell>;
    case '/admin/market/batches':
      return <AdminShell path={path} title="Fika Market — approvisionnements"><AdminMarketBatches /></AdminShell>;
  }
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
