import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchFinancesSummary, fetchOverview, type AdminOverviewData, type FinancesSummaryPayload } from '../../lib/admin/api';
import { formatPriceFCFA } from '../../lib/pricing';
import { AdminMarketLedger } from './AdminMarketLedger';

/**
 * Espace Finances & rapports — vue consolidée :
 * 1. Indicateurs financiers Fika Services du mois (revenus confirmés, marge),
 *    calculés par /api/admin/overview à partir des données réelles.
 * 2. Relevés & marges Fika Market (composant existant réutilisé : paiements
 *    vérifiés, coûts d'approvisionnement, marges réelles).
 * Les concepts « confirmé » et « encaissé » restent distincts : un reçu
 * non vérifié n'est jamais compté comme encaissé.
 */

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">{label}</p>
      <p className="font-heading font-bold text-2xl text-brand-text tabular-nums">{value}</p>
      {hint && <p className="text-xs text-brand-text-muted mt-1">{hint}</p>}
    </div>
  );
}

function ServicesFinanceSummary({ data }: { data: AdminOverviewData }) {
  const delta = data.revenue - data.previousRevenue;
  const deltaPercent = data.previousRevenue > 0 ? Math.round((delta / data.previousRevenue) * 100) : null;
  return (
    <section aria-labelledby="finances-services-title" className="space-y-4">
      <div>
        <h3 id="finances-services-title" className="font-heading font-bold text-lg text-brand-text">Fika Services — {data.monthLabel}</h3>
        <p className="text-sm text-brand-text-muted">Chiffres confirmés du mois en cours, calculés depuis les commandes réelles.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Revenus confirmés" value={formatPriceFCFA(data.revenue)}
          hint={deltaPercent !== null ? `${delta >= 0 ? '+' : ''}${deltaPercent} % vs mois précédent` : undefined} />
        <KpiCard label="Marge" value={formatPriceFCFA(data.marginAmount)} hint={`${data.marginPercent} % du revenu confirmé`} />
        <KpiCard label="Panier moyen" value={formatPriceFCFA(data.averageBasket)} />
        <KpiCard label="Commandes du mois" value={String(data.ordersCount)} />
      </div>
    </section>
  );
}

export function AdminFinances() {
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [summary, setSummary] = useState<FinancesSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchOverview(), fetchFinancesSummary()])
      .then(([ov, fin]) => {
        if (!alive) return;
        setOverview(ov);
        setSummary(fin);
        setError(null);
      })
      .catch(() => { if (alive) setError('Les indicateurs n’ont pas pu être chargés.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-10">
      <section aria-labelledby="finances-title" className="space-y-1">
        <h2 id="finances-title" className="font-heading font-bold text-xl text-brand-text">Finances & rapports</h2>
        <p className="text-sm text-brand-text-muted">
          Consolidation Fika Services et Fika Market. Un paiement déclaré par un client mais non vérifié n’est jamais compté comme encaissé.
        </p>
      </section>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-brand-text-muted py-4"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Chargement des indicateurs…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">{error}</p>
      ) : (
        <>
          {summary && (
            <section aria-labelledby="finances-consolide-title" className="space-y-4">
              <div>
                <h3 id="finances-consolide-title" className="font-heading font-bold text-lg text-brand-text">Consolidé des deux univers — encaissé vérifié</h3>
                <p className="text-sm text-brand-text-muted">Cumul historique des paiements confirmés. Les reçus déclarés en attente de vérification ne sont jamais comptés ici.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Encaissé vérifié — total" value={formatPriceFCFA(summary.services.confirmed + summary.market.confirmed)} hint="Fika Services + Fika Market" />
                <KpiCard label="Services — encaissé" value={formatPriceFCFA(summary.services.confirmed)} />
                <KpiCard label="Market — encaissé" value={formatPriceFCFA(summary.market.confirmed)} />
                <KpiCard label="À vérifier" value={formatPriceFCFA(summary.services.pending + summary.market.pending)} hint={`${formatPriceFCFA(summary.refunds)} remboursés (Market)`} />
              </div>
            </section>
          )}
          {overview && <ServicesFinanceSummary data={overview} />}
        </>
      )}

      <AdminMarketLedger />
    </div>
  );
}
