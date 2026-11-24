import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity, Calculator, Inbox, LogOut, Package, Tags, Users, ChevronRight, Loader2, MailCheck,
} from 'lucide-react';
import { Link, navigate } from '../../router';
import { BrandLogo } from '../BrandLogo';
import { fetchSession, fetchOrders, logout, fetchNotificationStatus, sendNotificationTest, type AdminIdentity, type NotificationStatus } from '../../lib/admin/api';
import { TODO_STATUSES } from '../../lib/admin/status';
import { AdminLoginPage } from './AdminLoginPage';

/**
 * Coquille du back-office : garde de session + navigation.
 * Toute route /admin/* est inaccessible sans session valide (le serveur
 * refuse par ailleurs chaque mutation sans cookie — défense en profondeur).
 */

/**
 * Cinq espaces d'administration (architecture cible) :
 *   1. Vue d'ensemble — tableau de bord + analytiques
 *   2. Clients — CRM unifié Services + Market
 *   3. Commandes & opérations — Services, demandes, Market, approvisionnements
 *   4. Catalogue & partenaires — produits + fournisseurs
 *   5. Finances & rapports — consolidation des deux univers
 * Les chemins historiques (/admin/leads, /admin/market/*…) restent valides.
 */
export const ADMIN_NAV = [
  { path: '/admin', label: "Vue d'ensemble", icon: Activity },
  { path: '/admin/clients', label: 'Clients', icon: Users },
  { path: '/admin/orders', label: 'Commandes', icon: Package, badge: true },
  { path: '/admin/catalogue', label: 'Catalogue & partenaires', icon: Tags },
  { path: '/admin/finances', label: 'Finances', icon: Calculator },
] as const;

/** Sous-navigation de chaque espace (rendue sous l'entrée active). */
export const ADMIN_SUBNAV: Record<string, { path: string; label: string }[]> = {
  '/admin': [
    { path: '/admin', label: 'Tableau de bord' },
    { path: '/admin/analytics', label: 'Analytiques' },
  ],
  '/admin/clients': [
    { path: '/admin/clients', label: 'Annuaire unifié' },
  ],
  '/admin/orders': [
    { path: '/admin/orders/all', label: 'Toutes les commandes' },
    { path: '/admin/orders', label: 'Commandes Services' },
    { path: '/admin/leads', label: 'Demandes à qualifier' },
    { path: '/admin/market/orders', label: 'Commandes Market' },
    { path: '/admin/market/batches', label: 'Approvisionnements' },
  ],
  '/admin/catalogue': [
    { path: '/admin/catalogue', label: 'Produits & fournisseurs' },
    { path: '/admin/prestataires', label: 'Prestataires' },
  ],
  '/admin/finances': [
    { path: '/admin/finances', label: 'Vue consolidée' },
  ],
};

/** Mapping explicite chemin → espace de navigation (gère les chemins historiques). */
function spaceForPath(path: string): string {
  if (path.startsWith('/admin/clients')) return '/admin/clients';
  if (path.startsWith('/admin/orders')) return '/admin/orders';
  if (path.startsWith('/admin/leads')) return '/admin/orders';
  if (path.startsWith('/admin/market/orders') || path.startsWith('/admin/market/batches')) return '/admin/orders';
  if (path.startsWith('/admin/catalogue') || path.startsWith('/admin/market/catalog') || path.startsWith('/admin/prestataires')) return '/admin/catalogue';
  if (path.startsWith('/admin/finances') || path.startsWith('/admin/market/releves')) return '/admin/finances';
  if (path.startsWith('/admin/analytics')) return '/admin';
  if (path.startsWith('/admin/market')) return '/admin/orders'; // pilotage Market : espace opérations
  return '/admin';
}

export function AdminShell({
  path, title, breadcrumb, children,
}: { path: string; title: string; breadcrumb?: string; children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [todoCount, setTodoCount] = useState<number | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus | null>(null);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSession().then((session) => {
      if (!alive) return;
      setAdmin(session);
      setChecking(false);
    }).catch(() => {
      if (!alive) return;
      setSessionError('Serveur indisponible : la session ne peut pas être vérifiée. Réessayez dans quelques instants.');
      setChecking(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const expired = () => { setAdmin(null); setTodoCount(null); };
    window.addEventListener('fika:unauthorized', expired);
    return () => window.removeEventListener('fika:unauthorized', expired);
  }, []);

  useEffect(() => {
    if (!admin) return;
    let alive = true;
    fetchOrders().then((orders) => {
      if (!alive) return;
      setTodoCount(orders.filter((o) => TODO_STATUSES.includes(o.status)).length);
    }).catch(() => { if (alive) setTodoCount(null); });
    return () => { alive = false; };
  }, [admin]);

  useEffect(() => {
    if (!admin) return;
    let alive = true;
    fetchNotificationStatus().then((status) => {
      if (alive) setNotificationStatus(status);
    }).catch(() => {
      if (alive) setNotificationStatus(null);
    });
    return () => { alive = false; };
  }, [admin]);

  const handleNotificationTest = async () => {
    setNotificationBusy(true);
    setNotificationFeedback(null);
    try {
      const result = await sendNotificationTest();
      setNotificationFeedback({ kind: 'success', text: result.message });
    } catch (error) {
      setNotificationFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : "Le test d'envoi a échoué. Consultez les logs Vercel.",
      });
    } finally {
      setNotificationBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <Loader2 className="w-6 h-6 animate-spin text-brand-accent" aria-label="Chargement" />
      </div>
    );
  }

  if (!admin) return <AdminLoginPage onSuccess={(identity) => { setSessionError(null); setAdmin(identity); }} initialError={sessionError} />;

  // Espace actif : mapping explicite chemin → espace (les chemins historiques
  // /admin/leads, /admin/analytics, /admin/market/* restent routés vers leur espace).
  const activeSpace = spaceForPath(path);
  const activeNav = ADMIN_NAV.find((item) => item.path === activeSpace);
  const subItems = ADMIN_SUBNAV[activeSpace] ?? [];

  const handleLogout = async () => {
    try { await logout(); } catch {
      setSessionError('Déconnexion non confirmée par le serveur. Réessayez avant de quitter cet appareil.');
      return;
    }
    setAdmin(null);
    navigate('/admin');
  };

  return (
    <div className="min-h-screen flex bg-brand-bg font-sans">
      <aside className="w-64 bg-brand-surface border-r border-brand-border flex-col h-screen sticky top-0 hidden md:flex">
        <div className="p-6 border-b border-brand-border">
          <Link to="/" aria-label="Fika — accueil"><BrandLogo className="text-3xl" /></Link>
          <p className="text-xs text-brand-text-muted font-medium uppercase tracking-wider mt-1">Admin Ops</p>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto" aria-label="Navigation back-office">
          {ADMIN_NAV.map((item) => {
            const active = item === activeNav;
            return (
              <div key={item.path}>
                <Link
                  to={item.path}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                    active ? 'bg-brand-bg text-brand-text' : 'text-brand-text-muted hover:bg-brand-bg hover:text-brand-text'
                  }`}
                >
                  <item.icon className="w-5 h-5" /> {item.label}
                  {'badge' in item && item.badge && todoCount ? (
                    <span className="ml-auto bg-brand-accent text-white text-[10px] px-2 py-0.5 rounded-full">{todoCount}</span>
                  ) : null}
                </Link>
                {active && subItems.length > 0 && (
                  <div className="mt-1 mb-2 ml-4 pl-4 border-l border-brand-border space-y-0.5">
                    {subItems.map((sub) => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        aria-current={path === sub.path ? 'page' : undefined}
                        className={`block px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          path === sub.path
                            ? 'text-brand-accent bg-brand-bg'
                            : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg'
                        }`}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-brand-border">
          <p className="px-4 pb-3 text-xs text-brand-text-muted truncate" title={admin.email}>{admin.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 overflow-auto">
        {/* Session vérifiée par le serveur */}
        <div className="bg-brand-wa/10 border-b border-brand-wa/20 px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs font-semibold text-brand-wa flex-wrap gap-2">
          <span>Connecté : {admin.email} · {admin.role === 'SUPERADMIN' ? 'Administration' : 'Opérations'}</span>
          <span className="text-brand-text-muted font-normal">Ngaoundéré · Espace équipe</span>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div>
              <nav className="flex items-center gap-1.5 text-xs font-semibold text-brand-text-muted mb-1.5" aria-label="Fil d'Ariane">
                <Link to="/admin" className="hover:text-brand-accent transition-colors">Admin</Link>
                {breadcrumb && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-brand-text">{breadcrumb}</span>
                  </>
                )}
              </nav>
              <h1 className="text-2xl font-heading font-bold text-brand-text">{title}</h1>
            </div>
          </div>

          <section className="mb-6 rounded-2xl border border-brand-border bg-brand-surface px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" aria-label="État des notifications e-mail">
            <div className="flex items-start gap-3 min-w-0">
              <MailCheck className="w-5 h-5 mt-0.5 text-brand-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-brand-text">Alertes e-mail</p>
                <p className="text-xs text-brand-text-muted">
                  {notificationStatus
                    ? (notificationStatus.configured
                      ? 'Variables présentes · authentification SMTP non vérifiée'
                      : 'Variables Gmail incomplètes')
                    : 'État de la configuration indisponible'}
                </p>
                {notificationStatus && (
                  <p className="mt-1 text-xs text-brand-text-muted break-words">
                    Expéditeur : {notificationStatus.sender ?? 'non défini'} · Destinataire : {notificationStatus.recipient}
                  </p>
                )}
                {notificationFeedback && (
                  <p role="status" className={`mt-1 text-xs font-medium ${notificationFeedback.kind === 'success' ? 'text-brand-wa' : 'text-red-700'}`}>
                    {notificationFeedback.text}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleNotificationTest()}
              disabled={notificationBusy || !notificationStatus?.configured}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-border px-4 py-2 text-xs font-bold text-brand-text hover:border-brand-accent hover:text-brand-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {notificationBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailCheck className="w-4 h-4" />}
              {notificationBusy ? 'Envoi du test…' : "Tester l'envoi"}
            </button>
          </section>

          {/* Navigation mobile : espaces + sous-navigation de l'espace actif */}
          <div className="md:hidden flex gap-2 mb-2 overflow-x-auto pb-2">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
                  item === activeNav ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-surface text-brand-text-muted border-brand-border'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          {subItems.length > 1 && (
            <div className="md:hidden flex gap-2 mb-6 overflow-x-auto pb-2" aria-label="Sections de l’espace actif">
              {subItems.map((sub) => (
                <Link
                  key={sub.path}
                  to={sub.path}
                  aria-current={path === sub.path ? 'page' : undefined}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                    path === sub.path ? 'bg-brand-bg text-brand-accent border-brand-accent' : 'bg-brand-surface text-brand-text-muted border-brand-border'
                  }`}
                >
                  {sub.label}
                </Link>
              ))}
            </div>
          )}

          {sessionError && <p role="alert" className="mb-4 text-red-700">{sessionError}</p>}
          <button type="button" onClick={handleLogout} className="md:hidden mb-4 text-sm font-bold underline">Se déconnecter</button>
          {children}
        </div>
      </div>
    </div>
  );
}

/** État vide honnête : aucune donnée fictive n'est jamais affichée. */
export function EmptyState({ title, description, icon: Icon = Inbox }: {
  title: string; description: string; icon?: typeof Inbox;
}) {
  return (
    <div className="text-center py-16 px-6 bg-brand-surface rounded-2xl border border-dashed border-brand-border-dark">
      <div className="w-12 h-12 mx-auto rounded-xl bg-brand-bg border border-brand-border flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-brand-text-muted" />
      </div>
      <h2 className="font-heading font-bold text-brand-text mb-2">{title}</h2>
      <p className="text-sm text-brand-text-muted max-w-md mx-auto leading-relaxed">{description}</p>
    </div>
  );
}
