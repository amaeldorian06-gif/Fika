import { useState } from 'react';
import { type AdminLead, convertLead } from '../../lib/admin/api';
import { normalizePhoneE164 } from '../../lib/lead';
import { navigate } from '../../router';
import { Button } from '../ui';
import { Field, Input } from '../forms';

export function LeadConversion({ lead }: { lead: AdminLead }) {
  const [name, setName] = useState(lead.customerName ?? '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (lead.status === 'CONVERTED') return <p className="text-sm text-brand-text-muted">Déjà convertie en commande.</p>;
  if (lead.status === 'LOST') return <p className="text-sm text-brand-text-muted">Demande perdue : requalification nécessaire avant conversion.</p>;
  return <form className="mt-auto space-y-3" onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    setError(null);
    const normalized = lead.customerPhone ?? normalizePhoneE164(phone);
    if (!normalized) { setError('Renseignez un numéro camerounais valide pour identifier le client.'); return; }
    setBusy(true);
    try {
      const result = await convertLead(lead.id, lead.customerPhone ? undefined : normalized, name.trim() || undefined);
      navigate(`/admin/orders/${encodeURIComponent(result.orderId)}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Conversion impossible.'); }
    finally { setBusy(false); }
  }}>
    {!lead.customerPhone && <fieldset disabled={busy} className="space-y-3">
      <p className="text-xs text-brand-text-muted">Cette demande n’a pas de contact rattaché. Ajoutez le téléphone convenu avec le client.</p>
      <Field label="Téléphone du client" htmlFor={`lead-phone-${lead.id}`} required><Input id={`lead-phone-${lead.id}`} type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+237 6 XX XX XX XX" /></Field>
      <Field label="Nom du client (facultatif)" htmlFor={`lead-name-${lead.id}`}><Input id={`lead-name-${lead.id}`} value={name} maxLength={80} onChange={e => setName(e.target.value)} /></Field>
    </fieldset>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Button type="submit" variant="primary" className="w-full" disabled={busy}>{busy ? 'Conversion…' : 'Convertir et ouvrir la commande'}</Button>
  </form>;
}
