import { useState } from 'react';
import { postJson, type AdminLead } from '../../lib/admin/api';
import { LOST_REASONS } from '../../lib/qualification';
import { getServices } from '../../lib/catalog';
import { Field, Select, Textarea } from '../forms';
import { Button } from '../ui';
export function LeadQualification({ lead, reload }: { lead: AdminLead; reload: () => void }) {
  const [status, setStatus] = useState(lead.status);
  const [serviceSlug, setService] = useState(lead.serviceSlug ?? '');
  const [notes, setNotes] = useState(lead.operationsNotes ?? '');
  const [reason, setReason] = useState(lead.lostReason ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (lead.status === 'CONVERTED') return null;
  return <details className="border-y border-brand-border mb-4 py-3"><summary className="cursor-pointer font-semibold text-sm py-2">Qualifier / noter ce qui bloque</summary>
    <form className="space-y-4 pt-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await postJson('/api/admin/leads/status', { leadId: lead.id, status, serviceSlug, operationsNotes: notes, lostReason: reason || null }); reload(); }
      catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setBusy(false); }
    }}>
      <Field label="Statut" htmlFor={`st-${lead.id}`}><Select id={`st-${lead.id}`} value={status} onChange={e => setStatus(e.target.value)}><option value="NEW">Nouvelle</option><option value="QUALIFYING">En qualification</option><option value="LOST">Perdue</option></Select></Field>
      <Field label="Service pressenti" htmlFor={`sv-${lead.id}`}><Select id={`sv-${lead.id}`} value={serviceSlug} onChange={e => setService(e.target.value)}><option value="">Besoin libre / à préciser</option>{getServices().map(s => <option value={s.slug} key={s.id}>{s.name}</option>)}</Select></Field>
      {status === 'LOST' && <Field label="Motif de perte" htmlFor={`rs-${lead.id}`} required><Select id={`rs-${lead.id}`} value={reason} onChange={e => setReason(e.target.value)} required><option value="">Choisir</option>{Object.entries(LOST_REASONS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>}
      <Field label="Notes internes / blocage / prochaine action" htmlFor={`nt-${lead.id}`}><Textarea id={`nt-${lead.id}`} value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)} /></Field>
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
      <Button disabled={busy} type="submit">Enregistrer la qualification</Button>
    </form>
    {!!lead.history?.length && <details className="mt-3 text-xs"><summary className="cursor-pointer py-3">Historique des qualifications</summary>{lead.history.map((h,i) => <div className="py-2" key={i}><span>{new Date(h.createdAt).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })}</span><pre className="whitespace-pre-wrap break-words mt-1">{JSON.stringify(h.changes, null, 2)}</pre></div>)}</details>}
  </details>;
}
