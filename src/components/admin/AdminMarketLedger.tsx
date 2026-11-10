import { useEffect, useState } from 'react';
import { Calculator, CheckCircle2, Loader2, Plus, Trash2, X } from 'lucide-react';
import { EmptyState } from './AdminShell';
import { Button } from '../ui';
import { Field, Input, Select, Textarea } from '../forms';
import { formatPriceFCFA } from '../../lib/pricing';
import {
  fetchMarketLedger, recordLedgerPayment, reviewMarketPayment, saveLedgerExpense,
  type MarketLedgerDto, type MarketPaymentMethod,
} from '../../lib/admin/market-api';
import { EXPENSE_CATEGORY_OPTIONS } from '../../lib/market-ledger';
import { postJson } from '../../lib/admin/api';

/**
 * Relevés & marges — le fondateur écrit ici ses relevés réels (encaissements
 * reçus, coûts payés) et le logiciel calcule directement : totaux, solde,
 * ventilation par catégorie et marge par commande.
 *
 * Honnêteté comptable : la marge par commande n'est PAS un profit net — les
 * coûts partagés (lots d'approvisionnement, charges générales) n'y sont pas
 * alloués. Le solde global, lui, soustrait toutes les dépenses.
 */

type Mode = 'encaissement' | 'cout-commande' | 'depense-generale';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'encaissement', label: 'Encaissement', hint: 'Argent reçu pour une commande' },
  { id: 'cout-commande', label: 'Coût payé', hint: 'Dépense liée à une commande' },
  { id: 'depense-generale', label: 'Dépense générale', hint: 'Loyer, data, transport…' },
];

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });

function useLedger() {
  const [data, setData] = useState<MarketLedgerDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);
  useEffect(() => {
    let alive = true;
    setLoading(true); setLoadError(null);
    fetchMarketLedger()
      .then((res) => { if (alive) { setData(res); setLoading(false); } })
      .catch(() => { if (alive) { setData(null); setLoadError('Impossible de charger les relevés. Vérifiez la connexion.'); setLoading(false); } });
    return () => { alive = false; };
  }, [tick]);
  return { data, loading, loadError, reload };
}

function useActionBanner() {
  const [state, setState] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const run = async (action: () => Promise<unknown>, success: string) => {
    setState(null);
    try {
      await action();
      setState({ kind: 'success', text: success });
      return true;
    } catch (e) {
      setState({ kind: 'error', text: e instanceof Error ? e.message : 'Opération refusée.' });
      return false;
    }
  };
  const banner = state && (
    <p role="status" className={`rounded-xl p-3 text-sm font-medium ${state.kind === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
      {state.text}
    </p>
  );
  return { run, banner };
}

export function AdminMarketLedger() {
  const { data, loading, loadError, reload } = useLedger();
  const { run, banner } = useActionBanner();
  const [mode, setMode] = useState<Mode>('encaissement');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState('');
  const [values, setValues] = useState({
    orderId: '', amount: '', method: 'CASH' as MarketPaymentMethod, reference: '',
    label: '', category: 'PURCHASE', note: '',
  });
  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => setValues((s) => ({ ...s, [k]: v }));

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-accent" aria-label="Chargement" /></div>;
  if (loadError || !data) {
    return (
      <div className="space-y-4">
        <EmptyState title="Relevés indisponibles" description={loadError ?? 'Données indisponibles.'} icon={Calculator} />
        <Button size="sm" onClick={reload}>Réessayer</Button>
      </div>
    );
  }

  const ordersAvecRef = data.orders; // toutes les commandes : le fondateur choisit celle qu'il règle
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const amount = Number(values.amount);
    if (!Number.isInteger(amount) || amount < 100) { setFormError('Montant invalide (entier, minimum 100 F).'); return; }
    setPending(true);
    try {
      if (mode === 'encaissement') {
        if (!values.orderId) throw new Error('Choisissez la commande encaissée.');
        await recordLedgerPayment(values.orderId, amount, values.method, values.reference.trim() || undefined);
      } else {
        if (values.label.trim().length < 2) throw new Error('Libellé requis (2 caractères minimum).');
        await saveLedgerExpense({
          orderId: mode === 'cout-commande' ? values.orderId || undefined : undefined,
          label: values.label.trim(), category: values.category, amount,
          note: values.note.trim() || undefined,
        });
      }
      setValues((s) => ({ ...s, amount: '', reference: '', label: '', note: '' }));
      reload();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Enregistrement refusé.');
    } finally {
      setPending(false);
    }
  };

  const act = async (action: () => Promise<unknown>, success: string) => { const ok = await run(action, success); if (ok) reload(); return ok; };

  return (
    <div className="space-y-8">
      {banner}

      {/* Totaux calculés */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-brand-border bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">Encaissé</p>
          <p className="text-2xl font-extrabold mt-1">{formatPriceFCFA(data.totals.encaisse)}</p>
          <p className="text-xs text-brand-text-muted mt-1">Paiements confirmés</p>
        </div>
        <div className="rounded-2xl border border-brand-border bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">Dépensé</p>
          <p className="text-2xl font-extrabold mt-1">{formatPriceFCFA(data.totals.depense)}</p>
          <p className="text-xs text-brand-text-muted mt-1">{data.byCategory.length} catégorie(s)</p>
        </div>
        <div className="rounded-2xl border p-5 bg-brand-text text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">Solde</p>
          <p className="text-2xl font-extrabold mt-1">{formatPriceFCFA(data.totals.solde)}</p>
          <p className="text-xs text-white/70 mt-1">Encaissé − dépensé</p>
        </div>
      </div>

      {/* Écrire un relevé */}
      <section className="rounded-2xl border border-brand-border bg-white p-5 sm:p-6">
        <h2 className="font-heading font-bold text-lg mb-1">Écrire un relevé</h2>
        <p className="text-sm text-brand-text-muted mb-4">Chaque écriture est enregistrée telle quelle ; les totaux se recalculent immédiatement.</p>
        <div role="tablist" aria-label="Type de relevé" className="flex flex-wrap gap-2 mb-5">
          {MODES.map((m) => (
            <button
              key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => { setMode(m.id); setFormError(''); }}
              className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${mode === m.id ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-bg text-brand-text-muted border-brand-border hover:border-brand-border-dark'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-text-muted -mt-3 mb-4">{MODES.find((m) => m.id === mode)?.hint}</p>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
          {mode === 'encaissement' && (
            <>
              <Field label="Commande encaissée" htmlFor="l-order" required>
                <Select id="l-order" required value={values.orderId} onChange={(e) => set('orderId', e.target.value)}>
                  <option value="">— Choisir une commande —</option>
                  {ordersAvecRef.map((o) => (
                    <option key={o.id} value={o.id}>{o.orderNumber} · {o.customerName ?? 'client'} · {o.statusLabel}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Montant reçu (F)" htmlFor="l-amount" required error={undefined}>
                <Input id="l-amount" type="number" min={100} step={1} inputMode="numeric" required value={values.amount} onChange={(e) => set('amount', e.target.value)} placeholder="ex. 15000" />
              </Field>
              <Field label="Moyen" htmlFor="l-method">
                <Select id="l-method" value={values.method} onChange={(e) => set('method', e.target.value as MarketPaymentMethod)}>
                  <option value="CASH">Espèces</option>
                  <option value="MTN_MOMO">MTN MoMo</option>
                  <option value="ORANGE_MONEY">Orange Money</option>
                </Select>
              </Field>
              <Field label="Référence (facultatif)" htmlFor="l-ref">
                <Input id="l-ref" maxLength={80} value={values.reference} onChange={(e) => set('reference', e.target.value)} placeholder="n° transaction, reçu…" />
              </Field>
            </>
          )}
          {mode !== 'encaissement' && (
            <>
              {mode === 'cout-commande' && (
                <Field label="Commande concernée" htmlFor="l-order2">
                  <Select id="l-order2" value={values.orderId} onChange={(e) => set('orderId', e.target.value)}>
                    <option value="">— Choisir une commande —</option>
                    {ordersAvecRef.map((o) => (
                      <option key={o.id} value={o.id}>{o.orderNumber} · {o.customerName ?? 'client'} · {o.statusLabel}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Libellé" htmlFor="l-label" required>
                <Input id="l-label" maxLength={120} required value={values.label} onChange={(e) => set('label', e.target.value)} placeholder="ex. Achat écouteurs chez le fournisseur" />
              </Field>
              <Field label="Catégorie" htmlFor="l-cat">
                <Select id="l-cat" value={values.category} onChange={(e) => set('category', e.target.value)}>
                  {EXPENSE_CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Montant payé (F)" htmlFor="l-amount2" required>
                <Input id="l-amount2" type="number" min={100} step={1} inputMode="numeric" required value={values.amount} onChange={(e) => set('amount', e.target.value)} placeholder="ex. 8000" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Note (facultatif)" htmlFor="l-note">
                  <Textarea id="l-note" maxLength={500} rows={2} value={values.note} onChange={(e) => set('note', e.target.value)} />
                </Field>
              </div>
            </>
          )}
          {formError && <p role="alert" className="sm:col-span-2 rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm font-medium">{formError}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Enregistrer le relevé
            </Button>
          </div>
        </form>
      </section>

      {/* Marge par commande */}
      <section>
        <h2 className="font-heading font-bold text-lg mb-1">Marge par commande</h2>
        <p className="text-sm text-brand-text-muted mb-3">Encaissements confirmés − coûts payés pour la commande. Ce n'est pas un profit net : les coûts partagés (lots, charges générales) n'y sont pas alloués.</p>
        {data.orders.length === 0 ? (
          <EmptyState title="Aucune commande" description="Les marges apparaîtront dès la première commande." icon={Calculator} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-brand-text-muted border-b border-brand-border">
                  <th className="px-4 py-3 font-bold">Commande</th>
                  <th className="px-4 py-3 font-bold">Client</th>
                  <th className="px-4 py-3 font-bold">Statut</th>
                  <th className="px-4 py-3 font-bold text-right">Encaissé</th>
                  <th className="px-4 py-3 font-bold text-right">Payé</th>
                  <th className="px-4 py-3 font-bold text-right">Marge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {data.orders.map((o) => (
                  <tr key={o.id} className={o.encaisse === 0 && o.paye === 0 ? 'text-brand-text-muted' : ''}>
                    <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">{o.orderNumber}</td>
                    <td className="px-4 py-3">{o.customerName ?? '—'}</td>
                    <td className="px-4 py-3">{o.statusLabel}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatPriceFCFA(o.encaisse)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatPriceFCFA(o.paye)}</td>
                    <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${o.marge < 0 ? 'text-red-600' : o.marge > 0 ? 'text-emerald-700' : ''}`}>
                      {o.marge === 0 && o.encaisse === 0 && o.paye === 0 ? '—' : formatPriceFCFA(o.marge)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Par catégorie */}
      <section>
        <h2 className="font-heading font-bold text-lg mb-3">Dépenses par catégorie</h2>
        {data.byCategory.length === 0 ? (
          <EmptyState title="Aucune dépense" description="Les catégories se rempliront avec vos relevés." icon={Calculator} />
        ) : (
          <ul className="divide-y divide-brand-border bg-white rounded-2xl border border-brand-border">
            {data.byCategory.map((c) => (
              <li key={c.category} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-semibold">{c.label}</span>
                <span className="text-brand-text-muted whitespace-nowrap ml-4">
                  {formatPriceFCFA(c.total)}
                  {data.totals.depense > 0 && <span className="ml-2 text-xs">({Math.round((c.total / data.totals.depense) * 100)} %)</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Écritures récentes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-heading font-bold text-lg mb-3">Encaissements</h2>
          {data.payments.length === 0 ? (
            <EmptyState title="Aucun encaissement" description="Enregistrez l'argent reçu sur vos commandes." icon={CheckCircle2} />
          ) : (
            <ul className="divide-y divide-brand-border bg-white rounded-2xl border border-brand-border">
              {data.payments.map((p) => (
                <li key={p.id} className="px-5 py-3 text-sm flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold"><span className="font-mono">{p.orderNumber}</span> · {formatPriceFCFA(p.amount)} <span className="text-brand-text-muted font-normal">· {p.methodLabel}</span></p>
                    <p className="text-xs text-brand-text-muted">{dateFr(p.createdAt)}{p.reference ? ` · réf. ${p.reference}` : ''}</p>
                  </div>
                  {p.status === 'CONFIRMED' && <span className="shrink-0 inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Confirmé</span>}
                  {p.status === 'PENDING' && (
                    <span className="shrink-0 flex items-center gap-1">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">À confirmer</span>
                      <Button size="sm" variant="outline" onClick={() => act(() => reviewMarketPayment(p.id, 'CONFIRM'), 'Encaissement confirmé.')}>Confirmer</Button>
                      <Button size="sm" variant="outline" aria-label="Rejeter l'encaissement" onClick={() => act(() => reviewMarketPayment(p.id, 'REJECT'), 'Encaissement rejeté.')}><X className="w-3.5 h-3.5" aria-hidden="true" /></Button>
                    </span>
                  )}
                  {p.status === 'REJECTED' && <span className="shrink-0 inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">Rejeté</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="font-heading font-bold text-lg mb-3">Dépenses</h2>
          {data.expenses.length === 0 ? (
            <EmptyState title="Aucune dépense" description="Enregistrez vos coûts payés (commandes ou généraux)." icon={Calculator} />
          ) : (
            <ul className="divide-y divide-brand-border bg-white rounded-2xl border border-brand-border">
              {data.expenses.map((x) => (
                <li key={x.id} className="px-5 py-3 text-sm flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{x.label} · {formatPriceFCFA(x.amount)} <span className="text-brand-text-muted font-normal">· {x.categoryLabel}</span></p>
                    <p className="text-xs text-brand-text-muted">{dateFr(x.incurredAt)} · {x.orderNumber ? `commande ${x.orderNumber}` : 'générale'}{x.note ? ` · ${x.note}` : ''}</p>
                  </div>
                  <Button size="sm" variant="outline" aria-label="Supprimer la dépense" onClick={() => act(() => postJson('/api/admin/market/expenses/delete', { expenseId: x.id }), 'Dépense supprimée.')}>
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
