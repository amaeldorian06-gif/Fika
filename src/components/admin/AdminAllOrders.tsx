import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Store, Wrench } from 'lucide-react';
import { Link } from '../../router';
import { fetchOrders, type AdminOrderSummary } from '../../lib/admin/api';
import { fetchMarketOrders, type MarketOrderSummaryDto } from '../../lib/admin/market-api';
import { formatPriceFCFA } from '../../lib/pricing';
import { Input } from '../forms';
import { EmptyState } from './AdminShell';

/** Chargement asynchrone avec état d'erreur honnête (même contrat que AdminViews). */
function useAsyncData(loader: () => Promise<{ services: AdminOrderSummary[]; market: MarketOrderSummaryDto[] }>) {
  const [data, setData] = useState<{ services: AdminOrderSummary[]; market: MarketOrderSummaryDto[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    loader().then((res) => {
      if (!alive) return;
      setData(res);
      setLoading(false);
    }).catch(() => {
      if (!alive) return;
      setData(null);
      setLoadError('Impossible de charger les données. Vérifiez la connexion et la disponibilité du serveur.');
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);
  return { data, loading, loadError };
}

/**
 * Vue « Toutes les commandes » (phase 4) : file unique fusionnant Fika
 * Services et Fika Market, filtrable par univers et par recherche. Chaque
 * ligne mène au détail de son univers — les transitions de statut restent
 * dans les vues spécialisées (règles métier serveur préservées).
 */

type Universe = 'all' | 'services' | 'market';

interface MergedRow {
  key: string;
  ref: string;
  customer: string;
  universe: 'services' | 'market';
  date: string;
  amount: string;
  status: string;
  link: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function AdminAllOrders() {
  const [universe, setUniverse] = useState<Universe>('all');
  const [q, setQ] = useState('');
  const { data, loading, loadError } = useAsyncData(async () => {
    const [services, market] = await Promise.all([
      fetchOrders({ scope: 'current' }),
      fetchMarketOrders(),
    ]);
    return { services, market };
  });

  const rows: MergedRow[] = useMemo(() => {
    if (!data) return [];
    const merged: MergedRow[] = [
      ...data.services.map((o): MergedRow => ({
        key: `s-${o.id}`,
        ref: o.orderNumber,
        customer: o.customerName ?? o.customerPhone,
        universe: 'services',
        date: o.createdAt,
        amount: o.totalPrice != null ? formatPriceFCFA(o.totalPrice) : 'Devis en cours',
        status: o.status,
        link: `/admin/orders/${o.id}`,
      })),
      ...data.market.map((o): MergedRow => ({
        key: `m-${o.id}`,
        ref: o.orderNumber,
        customer: o.name,
        universe: 'market',
        date: o.createdAt,
        amount: o.total != null ? formatPriceFCFA(o.total) : 'Prix à confirmer',
        status: o.statusLabel ?? o.status,
        link: `/admin/market/orders/${o.id}`,
      })),
    ];
    const needle = q.trim().toLowerCase();
    return merged
      .filter((r) => (universe === 'all' ? true : r.universe === universe))
      .filter((r) => (needle ? r.ref.toLowerCase().includes(needle) || r.customer.toLowerCase().includes(needle) : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, universe, q]);

  const chips: { key: Universe; label: string; count?: number }[] = [
    { key: 'all', label: 'Toutes', count: rows.length },
    { key: 'services', label: 'Fika Services' },
    { key: 'market', label: 'Fika Market' },
  ];

  return (
    <div className="space-y-5">
      <section aria-labelledby="all-orders-title" className="space-y-1">
        <h2 id="all-orders-title" className="font-heading font-bold text-xl text-brand-text">Toutes les commandes</h2>
        <p className="text-sm text-brand-text-muted">
          File unique des deux univers, de la plus récente à la plus ancienne. Les actions et transitions de statut se font dans la vue détaillée de chaque univers.
        </p>
      </section>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" aria-hidden="true" />
          <Input
            className="pl-11"
            placeholder="Rechercher un numéro (CMD/MKT) ou un client…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher dans toutes les commandes"
          />
        </div>
        <div className="flex gap-2" role="group" aria-label="Filtrer par univers">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setUniverse(c.key)}
              aria-pressed={universe === c.key}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${
                universe === c.key ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-surface text-brand-text-muted border-brand-border hover:border-brand-accent hover:text-brand-text'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-brand-text-muted py-8"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Chargement des commandes…</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">Les commandes n’ont pas pu être chargées.</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune commande" description={q ? `Aucune commande ne correspond à « ${q} ».` : 'Aucune commande en cours dans les deux univers.'} />
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.key}>
              <Link
                to={r.link}
                className="bg-brand-surface border border-brand-border rounded-xl p-4 grid gap-2 sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center sm:gap-4 hover:border-brand-accent transition-colors"
              >
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border w-fit ${
                  r.universe === 'services' ? 'bg-brand-bg text-brand-text-muted border-brand-border' : 'bg-brand-bg text-brand-accent border-brand-border'
                }`}>
                  {r.universe === 'services' ? <Wrench className="w-3 h-3" aria-hidden="true" /> : <Store className="w-3 h-3" aria-hidden="true" />}
                  {r.universe === 'services' ? 'Services' : 'Market'}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-brand-text truncate">{r.ref} · {r.customer}</p>
                  <p className="text-xs text-brand-text-muted">{formatDate(r.date)} · {r.status}</p>
                </div>
                <span className="text-sm font-heading font-bold text-brand-text tabular-nums sm:text-right">{r.amount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
