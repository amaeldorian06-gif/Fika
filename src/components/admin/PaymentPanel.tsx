import { useState } from 'react';
import { type AdminOrderDetail, recordPayment, reviewPayment } from '../../lib/admin/api';
import { PAYMENT_METHODS, payableStatuses, paymentBalance } from '../../lib/admin/payments';
import { PAYMENT_STATUS_LABELS } from '../../lib/admin/status';
import { formatPriceFCFA } from '../../lib/pricing';
import { Button } from '../ui';
import { Checkbox, Field, Input, Select } from '../forms';

type Payment = AdminOrderDetail['payments'][number];

function Receipt({ payment: p, disabled, onReview }: { payment: Payment; disabled: boolean; onReview: (payload: Parameters<typeof reviewPayment>[0]) => Promise<void> }) {
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState('');
  return <li className="border border-brand-border rounded-xl p-4 space-y-3">
    <p className="font-bold">{formatPriceFCFA(p.amount)} · {PAYMENT_STATUS_LABELS[p.status] ?? p.status}</p>
    <p className="text-xs text-brand-text-muted break-words">{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method ?? 'Méthode non renseignée'} · Réf. {p.reference ?? 'Ancien reçu sans référence'}</p>
    {p.confirmedAt && <p className="text-xs text-brand-text-muted">Confirmé le {new Date(p.confirmedAt).toLocaleString('fr-FR')}</p>}
    {p.status === 'PENDING' && <fieldset disabled={disabled} className="space-y-3">
      <Checkbox id={`verified-${p.id}`} checked={verified} onChange={e => setVerified(e.target.checked)} label="J’ai vérifié la réception effective des fonds sur le compte ou dans la caisse Fika." />
      <Button type="button" variant="primary" className="w-full" disabled={disabled || !verified}
        onClick={() => void onReview({ paymentId: p.id, action: 'CONFIRM', receivedVerified: verified })}>Confirmer la réception</Button>
      <Field label="Motif du rejet (si nécessaire)" htmlFor={`reason-${p.id}`}>
        <Input id={`reason-${p.id}`} value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="Ex. reçu incorrect, fonds non reçus" />
      </Field>
      <Button type="button" variant="secondary" className="w-full" disabled={disabled || reason.trim().length < 3}
        onClick={() => void onReview({ paymentId: p.id, action: 'REJECT', reason })}>Rejeter ce reçu</Button>
    </fieldset>}
  </li>;
}

export function PaymentPanel({ order, onSaved }: { order: AdminOrderDetail; onSaved: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<keyof typeof PAYMENT_METHODS>('MTN_MOMO');
  const [reference, setReference] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const balance = paymentBalance(order.totalPrice, order.payments);
  const canRecord = payableStatuses.includes(order.status) && balance.available > 0;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Paiement non enregistré. Réessayez.'); }
    finally { setBusy(false); }
  };

  return <section className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-4" aria-labelledby="payments-title">
    <h2 id="payments-title" className="font-heading font-bold text-brand-text">Paiements et reçus</h2>
    <p className="text-xs text-brand-text-muted">Saisie manuelle uniquement. Aucun débit ni contrôle automatique MTN/Orange n’est effectué par Fika.</p>
    <dl className="text-sm space-y-2">
      <div className="flex justify-between gap-2"><dt>Confirmé</dt><dd className="font-bold">{formatPriceFCFA(balance.confirmed)}</dd></div>
      <div className="flex justify-between gap-2"><dt>À vérifier</dt><dd>{formatPriceFCFA(balance.pending)}</dd></div>
      <div className="flex justify-between gap-2"><dt>Reste à confirmer</dt><dd className="font-bold">{balance.remaining === null ? 'Devis requis' : formatPriceFCFA(balance.remaining)}</dd></div>
    </dl>
    {balance.fullyPaid && <p className="text-sm text-emerald-700">Montant intégral confirmé. Vous pouvez passer la commande en « Payée » depuis les actions de statut.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {canRecord ? <form onSubmit={e => { e.preventDefault(); if (!busy) void run(() => recordPayment({ orderId: order.id, amount: Number(amount), method, reference, idempotencyKey: key })); }}>
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-bold text-sm mb-3">Enregistrer un reçu à vérifier</legend>
        <Field label="Montant reçu (FCFA)" htmlFor="payment-amount" required>
          <Input id="payment-amount" type="number" inputMode="numeric" min={1} max={balance.available} step={1} required value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
        <Field label="Méthode" htmlFor="payment-method" required>
          <Select id="payment-method" value={method} onChange={e => setMethod(e.target.value as keyof typeof PAYMENT_METHODS)}>
            {Object.entries(PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label={method === 'CASH' ? 'Numéro du reçu de caisse' : 'Référence de transaction opérateur'} htmlFor="payment-reference" required hint="Référence unique, lettres/chiffres et . _ / - uniquement. Ne saisissez jamais de code PIN ou OTP.">
          <Input id="payment-reference" required minLength={3} maxLength={100} value={reference} onChange={e => setReference(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" className="w-full" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le reçu'}</Button>
      </fieldset>
    </form> : !balance.fullyPaid && <p className="text-xs text-brand-text-muted">Émettez un devis sur une commande ouverte ou traitez les reçus en attente avant une nouvelle saisie.</p>}
    {order.payments.length ? <ul className="space-y-3">{order.payments.map(p => <Receipt key={p.id} payment={p} disabled={busy} onReview={payload => run(() => reviewPayment(payload))} />)}</ul>
      : <p className="text-sm text-brand-text-muted">Aucun reçu enregistré.</p>}
  </section>;
}
