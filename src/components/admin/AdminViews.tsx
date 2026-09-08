import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, ArrowLeft, BarChart, Briefcase, CheckCircle2, DollarSign,
  Download, FileText, Inbox, Loader2, MessageCircle, Package, Search, TrendingUp, Users,
} from 'lucide-react';
import { EmptyState } from './AdminShell';
import { Link } from '../../router';
import { Button } from '../ui';
import { Input, Select, Textarea } from '../forms';
import { formatPriceFCFA } from '../../lib/pricing';
import { computeTrend, formatMonthLabel } from '../../lib/admin/kpi';
import {
  COST_TYPE_LABELS, DELIVERY_STATUS_LABELS, EXPERT_STATUS_LABELS, LEAD_STATUS_LABELS,
  ORDER_STATUS_META, PAYMENT_STATUS_LABELS, QUOTE_STATUS_LABELS, orderStatusLabel,
  transitionOptions, type OrderStatus,
} from '../../lib/admin/status';
import {
  addOrderCost, assignExpert, convertLead, createQuote, createReview, fetchAssignableExperts,
  fetchCustomers, fetchExperts, fetchLeads, fetchOrder, fetchOrders, fetchOverview,
  publishPortfolio, saveDelivery, updateOrderStatus, updateTask,
  type AdminCustomer, type AdminExpert, type AdminLead, type AdminOrderDetail,
  type AdminOrderSummary, type AssignableExpertDto,
} from '../../lib/admin/api';
import { getWALink } from '../../lib/whatsapp';
import { downloadCsv } from '../../lib/csv';
import {
  ANALYTICS_PERIODS, fetchAnalytics, fetchAnalyticsOrders,
  type AnalyticsPeriodKey,
} from '../../lib/analytics-api';
import {
  TASK_STATUS_LABELS, TASK_TRANSITIONS, canAssignExpert, rankExperts,
} from '../../lib/proof';
import { DELIVERY_STATUS_LABELS as DELIVERY_LABELS } from '../../lib/admin/status';

/* -------------------------------- Communs --------------------------------- */

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${meta?.classes ?? 'bg-brand-bg text-brand-text-muted border-brand-border'}`}>
      {meta?.label ?? status}
    </span>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-brand-accent" aria-label="Chargement" />
    </div>
  );
}

function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loader().then((res) => {
      if (!alive) return;
      setData(res);
      setLoading(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, reload: () => setTick((t) => t + 1) };
}

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const dateTimeFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/* ------------------------------ Vue d'ensemble ----------------------------- */

function KpiCard({ label, value, Icon, hint, accent }: {
  label: string; value: string; Icon: typeof DollarSign; hint?: string; accent?: boolean;
}) {
  return (
    <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-brand-text-muted font-semibold uppercase tracking-wider">{label}</p>
        <Icon className="w-5 h-5 text-brand-border-dark" />
      </div>
      <p className={`text-3xl font-extrabold ${accent ? 'text-brand-accent' : 'text-brand-text'}`}>{value}</p>
      {hint && <p className="text-sm font-medium text-brand-text-muted mt-2">{hint}</p>}
    </div>
  );
}

export function AdminOverview() {
  const { data, loading } = useAsync(fetchOverview, []);

  if (loading) return <Loading />;
  if (!data) {
    return (
      <EmptyState
        icon={Activity}
        title="Aucune donnée à afficher"
        description="Les indicateurs sont calculés à partir des commandes réelles. Connectez la base de données et enregistrez une première commande : le chiffre d'affaires, la marge et le pipeline se rempliront automatiquement."
      />
    );
  }

  const trend = computeTrend(data.revenue, data.previousRevenue);

  return (
    <>
      <div className="flex justify-end mb-6">
        <span className="text-sm text-brand-text-muted font-medium bg-brand-surface px-4 py-2 rounded-lg border border-brand-border shadow-sm">
          {data.monthLabel || formatMonthLabel(new Date())}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KpiCard
          label="CA du mois" value={formatPriceFCFA(data.revenue)} Icon={DollarSign}
          hint={trend.percent === null ? 'Première période mesurée' : `${trend.percent > 0 ? '+' : ''}${trend.percent.toFixed(1)} % vs mois dernier`}
        />
        <KpiCard
          label="Marge brute" value={formatPriceFCFA(data.marginAmount)} Icon={Activity} accent
          hint={`${data.marginPercent.toFixed(1)} % du CA`}
        />
        <KpiCard
          label="À traiter" value={String(data.todoCount)} Icon={AlertCircle}
          hint="Demandes à qualifier ou confirmer"
        />
        <KpiCard
          label="Panier moyen" value={formatPriceFCFA(data.averageBasket)} Icon={FileText}
          hint={`${data.ordersCount} commande(s) facturée(s)`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-brand-surface rounded-2xl border border-brand-border shadow-sm overflow-hidden">
          <div className="p-6 border-b border-brand-border flex items-center justify-between">
            <h2 className="font-heading font-bold text-brand-text text-lg">Commandes récentes</h2>
            <Link to="/admin/orders" className="text-sm font-bold text-brand-accent hover:text-brand-text transition-colors">
              Voir tout
            </Link>
          </div>
          {data.recentOrders.length > 0 ? (
            <OrdersTable orders={data.recentOrders} />
          ) : (
            <p className="p-6 text-sm text-brand-text-muted">Aucune commande sur la période.</p>
          )}
        </div>

        <div className="space-y-8">
          <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-brand-border">
              <h2 className="font-heading font-bold text-brand-text text-lg">Pipeline</h2>
            </div>
            <div className="p-2">
              {Object.entries(data.pipeline).length === 0 && (
                <p className="px-4 py-3 text-sm text-brand-text-muted">Pipeline vide.</p>
              )}
              {Object.entries(data.pipeline)
                .sort(([a], [b]) => (ORDER_STATUS_META[a as OrderStatus]?.step ?? 99) - (ORDER_STATUS_META[b as OrderStatus]?.step ?? 99))
                .map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-brand-bg transition-colors">
                    <StatusBadge status={status as OrderStatus} />
                    <span className="ml-auto text-sm font-extrabold text-brand-text">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-brand-border">
              <h2 className="font-heading font-bold text-brand-text text-lg">Top services</h2>
            </div>
            <div className="p-2">
              {data.topServices.length === 0 && (
                <p className="px-4 py-3 text-sm text-brand-text-muted">Aucune vente enregistrée.</p>
              )}
              {data.topServices.map((s) => (
                <div key={s.name} className="px-4 py-3 rounded-xl hover:bg-brand-bg transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-brand-text truncate">{s.name}</span>
                    <span className="text-xs font-bold text-brand-text-muted shrink-0">×{s.volume}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1 text-xs">
                    <span className="text-brand-text-muted">{formatPriceFCFA(s.revenue)}</span>
                    <span className="font-bold text-brand-wa">{formatPriceFCFA(s.marginAmount)} de marge</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* -------------------------------- Commandes -------------------------------- */

function OrdersTable({ orders }: { orders: AdminOrderSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-brand-text-muted uppercase tracking-wider border-b border-brand-border">
            <th className="px-6 py-4">Commande</th>
            <th className="px-6 py-4">Client</th>
            <th className="px-6 py-4">Statut</th>
            <th className="px-6 py-4 text-right">Montant</th>
            <th className="px-6 py-4 text-right">Marge</th>
            <th className="px-6 py-4">Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const revenue = o.totalPrice ?? 0;
            const margin = revenue - o.costsTotal;
            return (
              <tr key={o.id} className="border-b border-brand-border last:border-0 hover:bg-brand-bg transition-colors">
                <td className="px-6 py-4 font-bold whitespace-nowrap">
                  <Link to={`/admin/orders/${o.id}`} className="text-brand-text hover:text-brand-accent transition-colors">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-6 py-4 text-brand-text whitespace-nowrap">{o.customerName ?? o.customerPhone}</td>
                <td className="px-6 py-4"><StatusBadge status={o.status} /></td>
                <td className="px-6 py-4 text-right font-semibold text-brand-text whitespace-nowrap">
                  {o.totalPrice != null ? formatPriceFCFA(o.totalPrice) : '—'}
                </td>
                <td className="px-6 py-4 text-right font-semibold text-brand-wa whitespace-nowrap">
                  {revenue > 0 ? `${formatPriceFCFA(margin)} (${Math.round((margin / revenue) * 100)} %)` : '—'}
                </td>
                <td className="px-6 py-4 text-brand-text-muted whitespace-nowrap">{dateFr(o.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdminOrders() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data, loading } = useAsync(() => fetchOrders({ status, q }), [status, q]);
  const orders = data ?? [];

  return (
    <>
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
          <Input
            className="pl-11"
            placeholder="Rechercher un client, un numéro…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher une commande"
          />
        </div>
        <Select className="md:w-64" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {(Object.keys(ORDER_STATUS_META) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{orderStatusLabel(s)}</option>
          ))}
        </Select>
      </div>

      {loading ? <Loading /> : orders.length > 0 ? (
        <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-sm overflow-hidden">
          <OrdersTable orders={orders} />
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="Aucune commande"
          description="Les commandes créées depuis les demandes clients apparaîtront ici, avec leur statut, leur marge et leur historique."
        />
      )}
    </>
  );
}

/* ----------------------------- Détail commande ----------------------------- */

export function AdminOrderDetailView({ orderId }: { orderId: string }) {
  const { data, loading, reload } = useAsync(() => fetchOrder(orderId), [orderId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costType, setCostType] = useState('EXPERT');
  const [costAmount, setCostAmount] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteDetails, setQuoteDetails] = useState('');

  const order: AdminOrderDetail | null = data;

  const margin = useMemo(() => {
    if (!order) return null;
    const revenue = order.totalPrice ?? 0;
    const costs = order.costs.reduce((s, c) => s + c.amount, 0);
    const amount = revenue - costs;
    return {
      revenue, costs, amount,
      percent: revenue > 0 ? (amount / revenue) * 100 : 0,
    };
  }, [order]);

  if (loading) return <Loading />;
  if (!order) {
    return (
      <EmptyState
        icon={Package}
        title="Commande introuvable"
        description="Cette commande n'existe pas ou la base de données n'est pas connectée."
      />
    );
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Opération refusée.'); }
    finally { setBusy(false); }
  };

  const options = transitionOptions(order.status, {
    hasAssignedExpert: order.hasAssignedExpert,
    hasConfirmedPayment: order.hasConfirmedPayment,
    hasItems: order.items.length > 0,
  });

  return (
    <div className="space-y-8">
      <Link to="/admin/orders" className="inline-flex items-center text-sm font-medium text-brand-text-muted hover:text-brand-accent">
        <ArrowLeft className="w-4 h-4 mr-2" /> Toutes les commandes
      </Link>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200" role="alert">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Synthèse */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <div>
                <p className="font-heading text-2xl font-bold text-brand-text">{order.orderNumber}</p>
                <p className="text-sm text-brand-text-muted">Créée le {dateFr(order.createdAt)}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-1">Client</dt>
                <dd className="font-medium text-brand-text">
                  {order.customerName ?? 'Client'}{' · '}
                  <a
                    href={getWALink(`Bonjour 👋, au sujet de votre commande ${order.orderNumber} chez Fika.`)}
                    target="_blank" rel="noopener noreferrer"
                    className="text-brand-wa font-bold hover:underline"
                  >
                    {order.customerPhone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-1">Livraison</dt>
                <dd className="font-medium text-brand-text">
                  {[order.cityName, order.zoneName].filter(Boolean).join(' / ') || '—'}
                  <span className="block text-xs text-brand-wa font-bold">Gratuite pour le client</span>
                </dd>
              </div>
              {order.clientAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-1">Adresse</dt>
                  <dd className="font-medium text-brand-text">{order.clientAddress}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Lignes */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
            <h2 className="font-heading font-bold text-brand-text p-6 border-b border-brand-border">Prestations</h2>
            <ul className="divide-y divide-brand-border">
              {order.items.map((item) => (
                <li key={item.id} className="px-6 py-4 flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-brand-text">
                    {item.serviceName ?? item.customName ?? 'Prestation'}
                    {item.quantity > 1 && <span className="text-brand-text-muted"> ×{item.quantity}</span>}
                  </span>
                  <span className="font-semibold text-brand-text whitespace-nowrap">
                    {item.price != null ? formatPriceFCFA(item.price * item.quantity) : 'À chiffrer'}
                  </span>
                </li>
              ))}
              {order.items.length === 0 && <li className="px-6 py-4 text-sm text-brand-text-muted">Aucune ligne.</li>}
            </ul>
          </div>

          {/* Timeline */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
            <h2 className="font-heading font-bold text-brand-text p-6 border-b border-brand-border">Historique</h2>
            <ol className="p-6 space-y-4">
              {order.events.map((ev) => (
                <li key={ev.id} className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-brand-accent mt-2 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-brand-text">
                      {ev.from ? `${orderStatusLabel(ev.from)} → ` : ''}{orderStatusLabel(ev.to)}
                    </p>
                    {ev.note && <p className="text-brand-text-muted">{ev.note}</p>}
                    <p className="text-xs text-brand-text-muted mt-0.5">
                      {dateTimeFr(ev.createdAt)}{ev.actorEmail ? ` · ${ev.actorEmail}` : ''}
                    </p>
                  </div>
                </li>
              ))}
              {order.events.length === 0 && <li className="text-sm text-brand-text-muted">Aucun événement.</li>}
            </ol>
          </div>
        </div>

        {/* Colonne actions */}
        <div className="space-y-6">
          {/* Marge en direct */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
            <h2 className="font-heading font-bold text-brand-text mb-4">Marge</h2>
            {margin && (
              <>
                <p className="text-3xl font-extrabold text-brand-accent">{formatPriceFCFA(margin.amount)}</p>
                <p className="text-sm font-medium text-brand-text-muted mb-1">
                  {margin.percent.toFixed(1)} % du prix client
                </p>
                {order.targetMarginPercent != null && (
                  <p className={`text-xs font-bold ${margin.percent >= order.targetMarginPercent ? 'text-brand-wa' : 'text-brand-accent'}`}>
                    Cible {order.targetMarginPercent} % · écart {(margin.percent - order.targetMarginPercent).toFixed(1)} pts
                  </p>
                )}
                <dl className="mt-4 pt-4 border-t border-brand-border space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-brand-text-muted">Prix client</dt><dd className="font-semibold">{formatPriceFCFA(margin.revenue)}</dd></div>
                  <div className="flex justify-between"><dt className="text-brand-text-muted">Coûts internes</dt><dd className="font-semibold">{formatPriceFCFA(margin.costs)}</dd></div>
                </dl>
              </>
            )}
          </div>

          {/* Statut */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
            <h2 className="font-heading font-bold text-brand-text mb-4">Changer le statut</h2>
            <div className="space-y-2">
              {options.map((opt) => (
                <button
                  key={opt.status}
                  type="button"
                  disabled={busy || !opt.check.ok}
                  title={opt.check.reason}
                  onClick={() => run(() => updateOrderStatus(order.id, opt.status))}
                  className="w-full text-left px-4 py-3 rounded-xl border border-brand-border text-sm font-bold text-brand-text hover:border-brand-border-dark hover:bg-brand-bg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {opt.label}
                  {!opt.check.ok && <span className="block text-xs font-medium text-brand-text-muted mt-0.5">{opt.check.reason}</span>}
                </button>
              ))}
              {options.length === 0 && <p className="text-sm text-brand-text-muted">Aucune transition disponible.</p>}
            </div>
          </div>

          {/* Coûts */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
            <h2 className="font-heading font-bold text-brand-text mb-4">Ajouter un coût</h2>
            <div className="space-y-3">
              <Select value={costType} onChange={(e) => setCostType(e.target.value)} aria-label="Type de coût">
                {Object.entries(COST_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Input
                type="number" min={0} inputMode="numeric" placeholder="Montant en FCFA"
                value={costAmount} onChange={(e) => setCostAmount(e.target.value)} aria-label="Montant du coût"
              />
              <Button
                variant="secondary" className="w-full" disabled={busy || !costAmount}
                onClick={() => run(async () => {
                  await addOrderCost(order.id, costType, Number(costAmount));
                  setCostAmount('');
                })}
              >
                Enregistrer le coût
              </Button>
            </div>
            {order.costs.length > 0 && (
              <ul className="mt-4 pt-4 border-t border-brand-border space-y-2 text-sm">
                {order.costs.map((c) => (
                  <li key={c.id} className="flex justify-between">
                    <span className="text-brand-text-muted">{COST_TYPE_LABELS[c.type] ?? c.type}</span>
                    <span className="font-semibold">{formatPriceFCFA(c.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Devis */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
            <h2 className="font-heading font-bold text-brand-text mb-4">Créer un devis</h2>
            <div className="space-y-3">
              <Input
                type="number" min={0} inputMode="numeric" placeholder="Montant proposé (FCFA)"
                value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} aria-label="Montant du devis"
              />
              <Textarea rows={3} placeholder="Détail (optionnel)" value={quoteDetails} onChange={(e) => setQuoteDetails(e.target.value)} aria-label="Détail du devis" />
              <Button
                variant="primary" className="w-full" disabled={busy || !quoteAmount}
                onClick={() => run(async () => {
                  await createQuote(order.id, Number(quoteAmount), quoteDetails || undefined);
                  setQuoteAmount(''); setQuoteDetails('');
                })}
              >
                Émettre le devis
              </Button>
            </div>
            {order.quotes.length > 0 && (
              <ul className="mt-4 pt-4 border-t border-brand-border space-y-2 text-sm">
                {order.quotes.map((q) => (
                  <li key={q.id} className="flex justify-between gap-2">
                    <span className="text-brand-text-muted truncate">{q.quoteNumber}</span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatPriceFCFA(q.amount)} · {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ExecutionPanel order={order} busy={busy} run={run} />
          <DeliveryPanel order={order} busy={busy} run={run} />
          <ProofPanel order={order} busy={busy} run={run} />

          {/* Paiements & livraison */}
          {(order.payments.length > 0 || order.deliveries.length > 0) && (
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-4 text-sm">
              {order.payments.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span className="text-brand-text-muted">Paiement {p.method ?? ''}</span>
                  <span className="font-semibold">{formatPriceFCFA(p.amount)} · {PAYMENT_STATUS_LABELS[p.status] ?? p.status}</span>
                </div>
              ))}
              {order.deliveries.map((d) => (
                <div key={d.id} className="flex justify-between">
                  <span className="text-brand-text-muted">Livraison {d.zoneName ?? ''}</span>
                  <span className="font-semibold">
                    {DELIVERY_STATUS_LABELS[d.status] ?? d.status} · coût interne {formatPriceFCFA(d.fee)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------- Exécution : affectation, tâches, livraison, preuve -------- */

function ExecutionPanel({ order, busy, run }: {
  order: AdminOrderDetail; busy: boolean; run: (fn: () => Promise<unknown>) => void;
}) {
  const { data } = useAsync(fetchAssignableExperts, [order.id]);
  const [expertId, setExpertId] = useState('');
  const [compensation, setCompensation] = useState('');

  const experts: AssignableExpertDto[] = data ?? [];
  const ranked = useMemo(
    () => rankExperts(
      experts.map((e) => ({
        id: e.id, name: e.name, skills: e.skills, zone: e.zone, usualCost: e.usualCost,
        availability: e.availability, status: e.status as 'ACTIVE', activeTaskCount: e.activeTaskCount,
      })),
      { skill: order.items[0]?.serviceName ?? null, zone: order.zoneName },
    ),
    [experts, order],
  );

  const selected = ranked.find((e) => e.id === expertId);
  const blocked = selected ? canAssignExpert(selected) : { ok: true as const };

  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
      <h2 className="font-heading font-bold text-brand-text mb-1">Exécution</h2>
      <p className="text-xs text-brand-text-muted mb-4">
        L&apos;expert travaille pour Fika : le client n&apos;est jamais mis en relation directe.
      </p>

      {order.tasks.length > 0 && (
        <ul className="space-y-3 mb-5">
          {order.tasks.map((task) => {
            const next = TASK_TRANSITIONS[task.status] ?? [];
            return (
              <li key={task.id} className="p-4 rounded-xl bg-brand-bg border border-brand-border">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm font-bold text-brand-text truncate">
                    {task.expertName ?? 'Expert'}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-surface border border-brand-border text-brand-text-muted whitespace-nowrap">
                    {TASK_STATUS_LABELS[task.status] ?? task.status}
                  </span>
                </div>
                {task.internalCompensation != null && (
                  <p className="text-xs text-brand-text-muted mb-2">
                    Rémunération : {formatPriceFCFA(task.internalCompensation)}
                  </p>
                )}
                {next.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {next.map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => updateTask(task.id, status))}
                        className="px-3 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-xs font-bold text-brand-text hover:border-brand-border-dark disabled:opacity-40 transition-colors"
                      >
                        {TASK_STATUS_LABELS[status] ?? status}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-3">
        <Select value={expertId} onChange={(e) => setExpertId(e.target.value)} aria-label="Choisir un expert">
          <option value="">Assigner un expert…</option>
          {ranked.map((e) => (
            <option key={e.id} value={e.id} disabled={!canAssignExpert(e).ok}>
              {e.name}
              {e.skills.length ? ` — ${e.skills[0]}` : ''}
              {e.zone ? ` (${e.zone})` : ''}
              {!canAssignExpert(e).ok ? ' — indisponible' : ''}
            </option>
          ))}
        </Select>
        {selected && (
          <Input
            type="number" min={0} inputMode="numeric"
            placeholder={selected.usualCost != null ? `Coût habituel : ${selected.usualCost}` : 'Rémunération (FCFA)'}
            value={compensation} onChange={(e) => setCompensation(e.target.value)}
            aria-label="Rémunération de l'expert"
          />
        )}
        {selected && !blocked.ok && (
          <p className="text-xs font-medium text-brand-accent">{blocked.reason}</p>
        )}
        <Button
          variant="secondary" className="w-full"
          disabled={busy || !expertId || !blocked.ok}
          onClick={() => run(async () => {
            await assignExpert(order.id, expertId, compensation ? Number(compensation) : undefined);
            setExpertId(''); setCompensation('');
          })}
        >
          Assigner et créer la tâche
        </Button>
        {experts.length === 0 && (
          <p className="text-xs text-brand-text-muted">
            Aucun expert enregistré : ajoutez vos partenaires dans « Experts ».
          </p>
        )}
      </div>
    </div>
  );
}

function DeliveryPanel({ order, busy, run }: {
  order: AdminOrderDetail; busy: boolean; run: (fn: () => Promise<unknown>) => void;
}) {
  const current = order.deliveries[0];
  const [status, setStatus] = useState(current?.status ?? 'PENDING');
  const [internalCost, setInternalCost] = useState(String(current?.fee ?? 0));
  const [proofUrl, setProofUrl] = useState(current?.proofUrl ?? '');

  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
      <h2 className="font-heading font-bold text-brand-text mb-1">Livraison</h2>
      <p className="text-xs font-bold text-brand-wa mb-4">
        Frais client : 0 F — gratuite dans toute la ville de Ngaoundéré.
      </p>

      <div className="space-y-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Statut de livraison">
          {Object.entries(DELIVERY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Input
          type="number" min={0} inputMode="numeric"
          placeholder="Coût interne du transport (FCFA)"
          value={internalCost} onChange={(e) => setInternalCost(e.target.value)}
          aria-label="Coût interne du transport"
        />
        <Input
          placeholder="Preuve de livraison (URL photo)"
          value={proofUrl} onChange={(e) => setProofUrl(e.target.value)}
          aria-label="Preuve de livraison"
        />
        <Button
          variant="secondary" className="w-full" disabled={busy}
          onClick={() => run(() => saveDelivery({
            orderId: order.id,
            status,
            internalCost: Number(internalCost) || 0,
            proofUrl: proofUrl || undefined,
          }))}
        >
          Enregistrer la livraison
        </Button>
        <p className="text-xs text-brand-text-muted">
          Le coût interne est tracé en ligne « Livraison » et impacte la marge — jamais le client.
        </p>
      </div>
    </div>
  );
}

function ProofPanel({ order, busy, run }: {
  order: AdminOrderDetail; busy: boolean; run: (fn: () => Promise<unknown>) => void;
}) {
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [title, setTitle] = useState('');
  const completed = order.status === 'COMPLETED';

  const reviewMessage = `Bonjour 👋,\n\nMerci d'avoir fait confiance à Fika pour votre commande ${order.orderNumber}.\n\nVotre avis nous aide beaucoup : comment s'est passée la prestation ?\n\n—\nRéf : avis ${order.orderNumber}`;

  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
      <h2 className="font-heading font-bold text-brand-text mb-1">Preuve</h2>
      <p className="text-xs text-brand-text-muted mb-4">
        Un avis public n&apos;existe que sur une commande terminée.
      </p>

      {!completed && (
        <p className="text-sm text-brand-text-muted">
          Disponible une fois la commande au statut « Terminée ».
        </p>
      )}

      {completed && (
        <div className="space-y-5">
          <Button asChild variant="whatsapp" className="w-full">
            <a href={getWALink(reviewMessage)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" /> Demander un avis
            </a>
          </Button>

          {order.hasReview ? (
            <p className="text-sm font-medium text-brand-wa flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Avis déjà enregistré pour cette commande.
            </p>
          ) : (
            <div className="space-y-3 pt-4 border-t border-brand-border">
              <Select value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Note de l'avis">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} / 5</option>
                ))}
              </Select>
              <Textarea
                rows={3} placeholder="Commentaire du client (transmis par WhatsApp)"
                value={comment} onChange={(e) => setComment(e.target.value)}
                aria-label="Commentaire de l'avis"
              />
              <Button
                variant="primary" className="w-full" disabled={busy}
                onClick={() => run(async () => {
                  await createReview({ orderId: order.id, rating: Number(rating), comment: comment || undefined });
                  setComment('');
                })}
              >
                Enregistrer l&apos;avis vérifié
              </Button>
            </div>
          )}

          <div className="space-y-3 pt-4 border-t border-brand-border">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">Publier la réalisation</p>
            <Input
              placeholder="Titre de la réalisation" value={title}
              onChange={(e) => setTitle(e.target.value)} aria-label="Titre de la réalisation"
            />
            <Button
              variant="outline" className="w-full" disabled={busy || !title}
              onClick={() => run(async () => {
                await publishPortfolio({
                  orderId: order.id,
                  title,
                  category: order.items[0]?.serviceName ?? 'Prestation',
                  // TODO_PROD : téléversement du visuel réel ; placeholder de marque en attendant.
                  image: '/fika/portfolio-1.svg',
                  clientType: order.customerName ? 'Client Fika' : undefined,
                });
                setTitle('');
              })}
            >
              Ajouter au portfolio
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Leads ---------------------------------- */

export function AdminLeads() {
  const { data, loading, reload } = useAsync(fetchLeads, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const leads: AdminLead[] = data ?? [];

  if (loading) return <Loading />;
  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Aucune demande en attente"
        description="Les demandes déposées depuis le formulaire /demande arrivent ici pour qualification, puis conversion en commande."
      />
    );
  }

  return (
    <>
      {error && (
        <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-red-50 border border-red-200" role="alert">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {leads.map((lead) => (
          <article key={lead.id} className="bg-brand-surface border border-brand-border rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="font-heading font-bold text-brand-text">{lead.code}</span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-brand-bg text-brand-text-muted border-brand-border">
                {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
              </span>
            </div>
            <p className="text-sm text-brand-text mb-4 line-clamp-3">{lead.description ?? '—'}</p>
            <dl className="text-xs text-brand-text-muted space-y-1 mb-5">
              {lead.serviceName && <div>Service : <span className="font-semibold text-brand-text">{lead.serviceName}</span></div>}
              <div>Lieu : <span className="font-semibold text-brand-text">{[lead.cityName, lead.zoneName].filter(Boolean).join(' / ') || '—'}</span></div>
              {lead.deadline && <div>Délai : <span className="font-semibold text-brand-text">{lead.deadline}</span></div>}
              {(lead.budgetMin != null || lead.budgetMax != null) && (
                <div>
                  Budget indicatif :{' '}
                  <span className="font-semibold text-brand-text">
                    {lead.budgetMin != null ? formatPriceFCFA(lead.budgetMin) : '—'}
                    {lead.budgetMax != null ? ` – ${formatPriceFCFA(lead.budgetMax)}` : ''}
                  </span>
                </div>
              )}
              <div>Reçue le <span className="font-semibold text-brand-text">{dateFr(lead.createdAt)}</span></div>
            </dl>
            <div className="flex flex-col sm:flex-row gap-3 mt-auto">
              <Button
                variant="primary" className="flex-1" disabled={busy === lead.id || lead.status === 'CONVERTED'}
                onClick={async () => {
                  setBusy(lead.id); setError(null);
                  try { await convertLead(lead.id); reload(); }
                  catch (e) { setError(e instanceof Error ? e.message : 'Conversion impossible.'); }
                  finally { setBusy(null); }
                }}
              >
                {busy === lead.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Convertir en commande
              </Button>
              {lead.customerPhone && (
                <Button asChild variant="whatsapp" className="flex-1">
                  <a
                    href={getWALink(`Bonjour 👋, au sujet de votre demande ${lead.code} déposée sur le site Fika.`)}
                    target="_blank" rel="noopener noreferrer"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

/* -------------------------------- Experts --------------------------------- */

export function AdminExperts() {
  const { data, loading } = useAsync(fetchExperts, []);
  const experts: AdminExpert[] = data ?? [];

  if (loading) return <Loading />;
  if (experts.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Aucun expert enregistré"
        description="Ajoutez vos partenaires (nom, téléphone E.164, compétences, zone, coût habituel) pour pouvoir assigner les commandes."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {experts.map((expert) => (
        <article key={expert.id} className="bg-brand-surface p-6 rounded-2xl border border-brand-border shadow-sm">
          <div className="flex items-start justify-between mb-4 gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-full bg-brand-text text-white flex items-center justify-center font-bold shrink-0">
                {expert.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-brand-text truncate">{expert.name}</p>
                <p className="text-sm text-brand-text-muted truncate">{expert.skills.join(' · ') || 'Compétences à renseigner'}</p>
              </div>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${expert.availability ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-brand-bg text-brand-text-muted border-brand-border'}`}>
              {EXPERT_STATUS_LABELS[expert.status] ?? expert.status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-brand-border text-center">
            <div>
              <p className="text-xl font-extrabold text-brand-text">{expert.completedOrders}</p>
              <p className="text-xs text-brand-text-muted font-medium">Missions</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-brand-accent">{expert.reliabilityScore.toFixed(1)}</p>
              <p className="text-xs text-brand-text-muted font-medium">Fiabilité</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-brand-text">{expert.usualCost != null ? formatPriceFCFA(expert.usualCost) : '—'}</p>
              <p className="text-xs text-brand-text-muted font-medium">Coût habituel</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/* -------------------------------- Clients --------------------------------- */

export function AdminClients() {
  const { data, loading } = useAsync(fetchCustomers, []);
  const customers: AdminCustomer[] = data ?? [];

  if (loading) return <Loading />;
  if (customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aucun client"
        description="Les clients sont créés automatiquement à la première commande ou demande avec téléphone."
      />
    );
  }

  return (
    <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-brand-text-muted uppercase tracking-wider border-b border-brand-border">
            <th className="px-6 py-4">Client</th>
            <th className="px-6 py-4">Téléphone</th>
            <th className="px-6 py-4 text-right">Commandes</th>
            <th className="px-6 py-4 text-right">Total dépensé</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-b border-brand-border last:border-0 hover:bg-brand-bg transition-colors">
              <td className="px-6 py-4 font-semibold text-brand-text">{c.name ?? '—'}</td>
              <td className="px-6 py-4">
                <a
                  href={getWALink('Bonjour 👋, ici Fika.')}
                  target="_blank" rel="noopener noreferrer"
                  className="text-brand-wa font-bold hover:underline"
                >
                  {c.phone}
                </a>
              </td>
              <td className="px-6 py-4 text-right font-semibold">{c.ordersCount}</td>
              <td className="px-6 py-4 text-right font-semibold">{formatPriceFCFA(c.totalSpent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------- Analytics -------------------------------- */

function Bars({ points, format }: { points: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="flex items-end gap-1.5 sm:gap-2 h-40" role="img" aria-label="Histogramme hebdomadaire">
      {points.map((p, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 group" title={`${p.label} : ${format(p.value)}`}>
          <div className="w-full flex-1 flex items-end">
            <div
              className={`w-full rounded-t-md transition-colors ${p.value > 0 ? 'bg-brand-text/85 group-hover:bg-brand-accent' : 'bg-brand-border'}`}
              style={{ height: `${Math.max(p.value > 0 ? 6 : 2, (p.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-[9px] sm:text-[10px] font-bold text-brand-text-muted truncate w-full text-center">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

function FunnelChart({ steps }: { steps: { label: string; count: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.label} className="flex items-center gap-3">
          <span className="w-32 sm:w-40 text-xs font-bold text-brand-text-muted text-right shrink-0 truncate">{step.label}</span>
          <div className="flex-1 h-6 rounded-md bg-brand-bg border border-brand-border overflow-hidden">
            <div
              className={`h-full rounded-md ${step.count > 0 ? 'bg-brand-accent/80' : ''}`}
              style={{ width: `${Math.max(step.count > 0 ? 3 : 0, (step.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 text-xs font-extrabold text-brand-text text-right shrink-0">{step.count}</span>
        </div>
      ))}
    </div>
  );
}

function GapBadge({ gap }: { gap: number | null }) {
  if (gap == null) return <span className="text-xs text-brand-text-muted">pas de cible</span>;
  const ok = gap >= 0;
  return (
    <span className={`text-xs font-bold whitespace-nowrap ${ok ? 'text-brand-wa' : 'text-brand-accent'}`}>
      {ok ? '▲' : '▼'} {Math.abs(gap).toFixed(1)} pts
    </span>
  );
}

export function AdminAnalytics() {
  const [period, setPeriod] = useState<AnalyticsPeriodKey>('30d');
  const { data, loading } = useAsync(() => fetchAnalytics(period), [period]);
  const { data: orderRows } = useAsync(fetchAnalyticsOrders, []);
  const rows = orderRows ?? [];

  if (loading) return <Loading />;
  if (!data) {
    return (
      <EmptyState
        icon={BarChart}
        title="Pas encore de données de pilotage"
        description="Les indicateurs se construisent avec l'activité réelle : clics WhatsApp, demandes, commandes et coûts. Connectez la base et l'historique se remplira automatiquement."
      />
    );
  }

  const c = data.current;
  const trend = computeTrend(c.finance.revenueInvoiced, data.previous.revenueInvoiced);

  const exportCsv = () => {
    downloadCsv(`commandes-fika-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Commande', 'Client', 'Téléphone', 'Statut', 'Montant (F)', 'Coûts (F)', 'Marge (F)', 'Créée le'],
      rows.map((r) => [
        r.orderNumber, r.customerName ?? r.customerPhone, r.customerPhone,
        orderStatusLabel(r.status as Parameters<typeof orderStatusLabel>[0]),
        r.totalPrice ?? '', r.costsTotal,
        (r.totalPrice ?? 0) - r.costsTotal,
        new Date(r.createdAt).toLocaleDateString('fr-FR'),
      ]),
    );
  };

  return (
    <div className="space-y-8">
      {/* Sélecteur de période */}
      <div className="flex flex-wrap items-center gap-2">
        {ANALYTICS_PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
              period === p.key ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-surface text-brand-text-muted border-brand-border hover:border-brand-border-dark'
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="text-xs text-brand-text-muted ml-auto hidden sm:block">{data.period.label}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="CA confirmé" value={formatPriceFCFA(c.finance.revenueConfirmed)} Icon={DollarSign} hint={`${formatPriceFCFA(c.finance.revenueInvoiced)} facturés`} />
        <KpiCard label="Marge réelle" value={formatPriceFCFA(c.finance.marginAmount)} Icon={Activity} accent hint={`${c.finance.marginPercent.toFixed(1)} % du CA`} />
        <KpiCard label="Conversion demandes" value={c.conversionFromLead != null ? `${c.conversionFromLead} %` : '—'} Icon={TrendingUp} hint={`${c.leads.converted}/${c.leads.total} converties`} />
        <KpiCard label="Délai de complétion" value={c.completionDays != null ? `${c.completionDays} j` : '—'} Icon={FileText} hint="Création → terminée (moyenne)" />
      </div>

      {/* CA 12 semaines + funnel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading font-bold text-brand-text">CA facturé — 12 semaines</h2>
            {trend.percent != null && (
              <span className={`text-xs font-bold ${trend.direction === 'down' ? 'text-brand-accent' : 'text-brand-wa'}`}>
                {trend.direction === 'down' ? '▼' : '▲'} {Math.abs(trend.percent).toFixed(1)} % vs période précédente
              </span>
            )}
          </div>
          <Bars points={c.weekly.map((w) => ({ label: w.label, value: w.revenue }))} format={formatPriceFCFA} />
        </div>

        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6">
          <h2 className="font-heading font-bold text-brand-text mb-6">Pipeline des commandes</h2>
          <FunnelChart steps={c.funnel.filter((f) => f.count > 0 || ['NEW', 'QUALIFYING', 'QUOTED', 'PAID', 'COMPLETED'].includes(f.status))} />
        </div>
      </div>

      {/* Top services avec marges vs cible */}
      <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
        <h2 className="font-heading font-bold text-brand-text p-6 border-b border-brand-border">Marges par service vs cible</h2>
        {c.topServices.length === 0 ? (
          <p className="p-6 text-sm text-brand-text-muted">Aucune vente sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-brand-text-muted uppercase tracking-wider border-b border-brand-border">
                  <th className="px-6 py-4">Service</th>
                  <th className="px-6 py-4 text-right">Volume</th>
                  <th className="px-6 py-4 text-right">CA</th>
                  <th className="px-6 py-4 text-right">Marge</th>
                  <th className="px-6 py-4 text-right">Marge %</th>
                  <th className="px-6 py-4 text-right">vs cible</th>
                </tr>
              </thead>
              <tbody>
                {c.topServices.map((s) => (
                  <tr key={s.serviceId ?? s.name} className="border-b border-brand-border last:border-0">
                    <td className="px-6 py-4 font-semibold text-brand-text">{s.name}</td>
                    <td className="px-6 py-4 text-right">×{s.volume}</td>
                    <td className="px-6 py-4 text-right">{formatPriceFCFA(s.revenue)}</td>
                    <td className="px-6 py-4 text-right font-semibold">{formatPriceFCFA(s.marginAmount)}</td>
                    <td className="px-6 py-4 text-right">{s.marginPercent.toFixed(1)} %</td>
                    <td className="px-6 py-4 text-right"><GapBadge gap={s.marginGapPoints} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Sources */}
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6">
          <h2 className="font-heading font-bold text-brand-text mb-1">Sources de trafic</h2>
          <p className="text-xs text-brand-text-muted mb-4">Clics WhatsApp par contexte et demandes par origine.</p>
          {c.sources.length === 0 ? (
            <p className="text-sm text-brand-text-muted">Aucun événement sur la période.</p>
          ) : (
            <ul className="space-y-2">
              {c.sources.map((s) => (
                <li key={`${s.kind}-${s.source}`} className="flex items-center gap-3 text-sm">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    s.kind === 'whatsapp' ? 'bg-brand-wa/10 text-brand-wa border-brand-wa/20' : 'bg-brand-bg text-brand-text-muted border-brand-border'
                  }`}>
                    {s.kind === 'whatsapp' ? 'WhatsApp' : 'Demande'}
                  </span>
                  <span className="font-semibold text-brand-text truncate">{s.source}</span>
                  <span className="ml-auto font-extrabold text-brand-text">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Coûts */}
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-6">
          <h2 className="font-heading font-bold text-brand-text mb-1">Répartition des coûts</h2>
          <p className="text-xs text-brand-text-muted mb-4">Coûts internes tracés ({formatPriceFCFA(c.finance.costsTotal)} sur la période).</p>
          {c.costs.length === 0 ? (
            <p className="text-sm text-brand-text-muted">Aucun coût saisi.</p>
          ) : (
            <div className="space-y-3">
              {c.costs.map((cost) => (
                <div key={cost.type}>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <span>{COST_TYPE_LABELS[cost.type] ?? cost.type}</span>
                    <span className="text-brand-text-muted">{cost.percent.toFixed(1)} %</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-brand-bg border border-brand-border overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cost.type === 'DELIVERY' ? 'bg-brand-accent' : 'bg-brand-text/80'}`}
                      style={{ width: `${cost.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top experts */}
      <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
        <h2 className="font-heading font-bold text-brand-text p-6 border-b border-brand-border">Experts — volume et fiabilité</h2>
        {c.experts.length === 0 ? (
          <p className="p-6 text-sm text-brand-text-muted">Aucun expert enregistré.</p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {c.experts.map((e) => (
              <li key={e.expertId} className="px-6 py-4 flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-brand-text truncate">{e.name}</span>
                <span className="flex items-center gap-4 shrink-0">
                  <span className="text-brand-text-muted">{e.completedOrders} mission(s)</span>
                  <span className={`font-bold ${e.reworkRate <= 0.05 ? 'text-brand-wa' : 'text-brand-accent'}`}>
                    reprises {(e.reworkRate * 100).toFixed(0)} %
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Export CSV */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-surface rounded-2xl border border-brand-border p-6">
        <div>
          <h2 className="font-heading font-bold text-brand-text">Export des commandes</h2>
          <p className="text-sm text-brand-text-muted">CSV (fr-FR) de la table de commandes — données internes uniquement.</p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-2" /> Exporter {rows.length > 0 ? `(${rows.length})` : ''}
        </Button>
      </div>
    </div>
  );
}
