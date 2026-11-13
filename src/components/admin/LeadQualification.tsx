import { useState } from 'react';
import { postJson, type AdminLead } from '../../lib/admin/api';
import { LOST_REASONS } from '../../lib/qualification';
import { getServices } from '../../lib/catalog';
import { Field, Select, Textarea } from '../forms';
import { Button } from '../ui';

/**
 * Changement de statut direct sur la carte de demande — sans déplier le
 * formulaire de qualification. « Perdue » demande son motif (garde serveur) ;
 * les notes et le service pressenti existants sont conservés tels quels.
 */
export function LeadStatusControl({ lead, reload }: { lead: AdminLead; reload: () => void }) {
  const [next, setNext] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (lead.status === 'CONVERTED') return null;

  const apply = async (to: 'NEW' | 'QUALIFYING' | 'LOST', lostReason?: string) => {
    setBusy(true); setError('');
    try {
      await postJson('/api/admin/leads/status', {
        leadId: lead.id,
        status: to,
        // serviceSlug absent : le serveur conserve le service pressentu.
        // operationsNotes transmises pour ne pas écraser les notes existantes.
        operationsNotes: lead.operationsNotes ?? '',
        lostReason: to === 'LOST' ? (lostReason ?? null) : null,
      });
      setNext(''); setReason(''); reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <label className="sr-only" htmlFor={`qs-${lead.id}`}>Changer le statut de la demande {lead.code}</label>
      <select
        id={`qs-${lead.id}`}
        value={next}
        disabled={busy}
        onChange={(e) => {
          const v = e.target.value as 'NEW' | 'QUALIFYING' | 'LOST';
          setNext(v);
          if (v && v !== 'LOST') void apply(v);
        }}
        className="text-xs font-semibold border border-brand-border rounded-lg px-2.5 py-2 bg-white cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
      >
        <option value="">Changer le statut…</option>
        <option value="NEW">Nouvelle</option>
        <option value="QUALIFYING">En qualification</option>
        <option value="LOST">Perdue…</option>
      </select>
      {next === 'LOST' && (
        <>
          <label className="sr-only" htmlFor={`qr-${lead.id}`}>Motif de perte de la demande {lead.code}</label>
          <select
            id={`qr-${lead.id}`}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            className="text-xs font-semibold border border-brand-border rounded-lg px-2.5 py-2 bg-white cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            <option value="">Motif…</option>
            {Object.entries(LOST_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button type="button" size="sm" disabled={busy || !reason} onClick={() => void apply('LOST', reason)}>Confirmer</Button>
        </>
      )}
      {error && <p role="alert" className="w-full text-xs text-red-700 font-medium">{error}</p>}
    </div>
  );
}

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
