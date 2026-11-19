import { AdminMarketLedger } from './AdminMarketLedger';
import {
  AdminMarketBatches, AdminMarketCatalog, AdminMarketOrderDetail, AdminMarketOrders, AdminMarketOverview,
} from './AdminMarket';
import { AdminShell } from './AdminShell';
import { AdminCustomers } from './AdminCustomers';
import { AdminCustomerProfile } from './AdminCustomerProfile';
import { AdminAllOrders } from './AdminAllOrders';
import { AdminExperts } from './AdminExperts';
import { AdminCatalogue } from './AdminCatalogue';
import { AdminFinances } from './AdminFinances';
import {
  AdminAnalytics, AdminLeads, AdminOrderDetailView,
  AdminOrders, AdminOverview,
} from './AdminViews';

/**
 * Routeur du back-office — cinq espaces :
 *   /admin (vue d'ensemble), /admin/clients (CRM), /admin/orders (opérations),
 *   /admin/catalogue (produits & partenaires), /admin/finances (consolidé).
 * Les chemins historiques (/admin/leads, /admin/analytics, /admin/market/*)
 * restent valides et sont rattachés à leur espace dans la navigation.
 * La garde de session vit dans AdminShell (login si non authentifié).
 */
export function AdminRouter({ path }: { path: string }) {
  if (path.startsWith('/admin/clients/')) {
    const id = decodeURIComponent(path.slice('/admin/clients/'.length));
    return (
      <AdminShell path={path} title="Profil client" breadcrumb="Clients">
        <AdminCustomerProfile customerId={id} />
      </AdminShell>
    );
  }
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
  if (path === '/admin/orders/all') {
    return (
      <AdminShell path={path} title="Toutes les commandes" breadcrumb="Commandes">
        <AdminAllOrders />
      </AdminShell>
    );
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
    case '/admin/clients':
      return (
        <AdminShell path={path} title="Clients" breadcrumb="Clients">
          <AdminCustomers />
        </AdminShell>
      );
    case '/admin/catalogue':
      return (
        <AdminShell path={path} title="Catalogue & partenaires" breadcrumb="Catalogue">
          <AdminCatalogue />
        </AdminShell>
      );
    case '/admin/prestataires':
      return (
        <AdminShell path={path} title="Prestataires de services" breadcrumb="Catalogue">
          <AdminExperts />
        </AdminShell>
      );
    case '/admin/finances':
      return (
        <AdminShell path={path} title="Finances & rapports" breadcrumb="Finances">
          <AdminFinances />
        </AdminShell>
      );
    case '/admin/orders':
      return (
        <AdminShell path={path} title="Commandes" breadcrumb="Commandes">
          <AdminOrders />
        </AdminShell>
      );
    case '/admin/leads':
      return (
        <AdminShell path={path} title="Demandes à qualifier" breadcrumb="Commandes">
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
