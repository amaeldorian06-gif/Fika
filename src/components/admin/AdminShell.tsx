import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity, BarChart, Briefcase, Inbox, LogOut, Package, Users, ChevronRight, Loader2,
} from 'lucide-react';
import { Link, navigate } from '../../router';
import { fetchSession, fetchOrders, logout, type AdminIdentity } from '../../lib/admin/api';
import { TODO_STATUSES } from '../../lib/admin/status';
import { AdminLoginPage } from './AdminLoginPage';

/**
 * Coquille du back-office : garde de session + navigation.
 * Toute route /admin/* est inaccessible sans session valide (le serveur
 * refuse par ailleurs chaque mutation sans cookie — défense en profondeur).
 */

export const ADMIN_NAV = [
  { path: '/admin', label: "Vue d'ensemble", icon: Activity },
  { path: '/admin/orders', label: 'Commandes', icon: Package, badge: true },
  { path: '/admin/leads', label: 'Demandes', icon: Inbox },
  { path: '/admin/clients', label: 'Clients', icon: Users },
  { path: '/admin/experts', label: 'Experts', icon: Briefcase },
  { path: '/admin/analytics', label: 'Analytiques', icon: BarChart },
] as const;

export function AdminShell({
  path, title, breadcrumb, children,
}: { path: string; title: string; breadcrumb?: string; children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [todoCount, setTodoCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSession().then((session) => {
      if (!alive) return;
      setAdmin(session);
      setChecking(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!admin) return;
    let alive = true;
    fetchOrders().then((orders) => {
      if (!alive) return;
      setTodoCount(orders.filter((o) => TODO_STATUSES.includes(o.status)).length);
    });
    return () => { alive = false; };
  }, [admin]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <Loader2 className="w-6 h-6 animate-spin text-brand-accent" aria-label="Chargement" />
      </div>
    );
  }

  if (!admin) return <AdminLoginPage onSuccess={setAdmin} />;

  const handleLogout = async () => {
    try { await logout(); } catch { /* session déjà expirée */ }
    setAdmin(null);
    navigate('/admin');
  };

  return (
    <div className="min-h-screen flex bg-brand-bg font-sans">
      <aside className="w-64 bg-brand-surface border-r border-brand-border flex-col h-screen sticky top-0 hidden md:flex">
        <div className="p-6 border-b border-brand-border">
          <Link to="/" className="font-signature text-3xl text-brand-text">
            Fika<span className="text-brand-accent">.</span>
          </Link>
          <p className="text-xs text-brand-text-muted font-medium uppercase tracking-wider mt-1">Admin Ops</p>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1" aria-label="Navigation back-office">
          {ADMIN_NAV.map((item) => {
            const active = item.path === '/admin' ? path === '/admin' : path.startsWith(item.path);
            return (
              <Link
                key={item.path}
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
        {/* Bandeau statut fondateur */}
        <div className="bg-brand-wa/10 border-b border-brand-wa/20 px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs font-semibold text-brand-wa flex-wrap gap-2">
          <span>🟢 Connecté en tant que Fondateur ({admin.email}) · Rôle : {admin.role}</span>
          <span className="text-brand-text-muted font-normal">Ngaoundéré · Données réactives</span>
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

          {/* Navigation mobile */}
          <div className="md:hidden flex gap-2 mb-6 overflow-x-auto pb-2">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
                  path === item.path ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-surface text-brand-text-muted border-brand-border'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

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
