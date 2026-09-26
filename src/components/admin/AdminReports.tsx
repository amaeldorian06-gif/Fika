import { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/admin/api';
import { localDay } from '../../lib/report-period';
import { Button } from '../ui';
import { Field, Input } from '../forms';

type Report = { id: string; fromDate: string; toDate: string; createdAt: string; downloadedAt: string | null; archivedAt: string | null; restoredAt: string | null; archivedOrders: number; archivedLeads: number };
export function AdminReports() {
  const [from, setFrom] = useState(localDay);
  const [to, setTo] = useState(localDay);
  const [rows, setRows] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  async function reload() {
    setLoading(true);
    try { setRows(await getJson<Report[]>('/api/admin/reports')); setError(''); }
    catch { setError('Exports indisponibles. La connexion admin fonctionne, mais le stockage doit être accessible. Réessayez.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  async function perform(fn: () => Promise<unknown>) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Opération non confirmée.'); }
    finally { setBusy(false); }
  }
  async function download(r: Report) {
    const res = await fetch(`/api/admin/reports/${encodeURIComponent(r.id)}/download`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Téléchargement non confirmé. Réessayez.');
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `fika-${r.fromDate}-${r.toDate}-${r.id.slice(-6)}.zip`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    setMessage('Téléchargement lancé. Ouvrez le ZIP et vérifiez les fichiers avant de demander l’archivage.');
  }
  return <div className="space-y-6">
    <p className="text-brand-text-muted">Votre mémoire opérationnelle, sans remise à zéro destructive. Export manuel quotidien ou par période, en heure du Cameroun. Les données s’accumulent tant que vous ne les archivez pas.</p>
    <form className="bg-white rounded-2xl p-5 border border-brand-border flex flex-wrap gap-4 items-end" onSubmit={e => { e.preventDefault(); void perform(async () => { const r = await postJson<Report>('/api/admin/reports', { from, to }); await download(r); }); }}>
      <Field label="Du" htmlFor="report-from"><Input id="report-from" type="date" required value={from} onChange={e => setFrom(e.target.value)} /></Field>
      <Field label="Au (inclus)" htmlFor="report-to"><Input id="report-to" type="date" required value={to} min={from} onChange={e => setTo(e.target.value)} /></Field>
      <Button type="submit" disabled={busy || loading}>Exporter le dossier ZIP</Button>
    </form>
    <p className="text-sm text-brand-text-muted">Dossier : demandes, clients, commandes, paiements, coûts, événements, statistiques et répartition des besoins. Il contient des données personnelles : conservez-le dans un emplacement protégé. Ce n’est pas une sauvegarde complète de la base.</p>
    {error && <div role="alert" className="text-red-700"><p>{error}</p><button className="underline py-3" disabled={busy} onClick={() => void reload()}>Réessayer</button></div>}
    {message && <p role="status" className="text-brand-wa">{message}</p>}
    {loading ? <p>Chargement…</p> : !rows.length && !error ? <p>Aucun export. Choisissez une journée ou une période.</p> : rows.map(r => <article key={r.id} className="bg-white border border-brand-border p-5 rounded-2xl">
      <h2 className="font-bold">Du {r.fromDate} au {r.toDate}</h2>
      <p className="text-xs text-brand-text-muted mt-1">Créé le {new Date(r.createdAt).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })}</p>
      {r.archivedAt && <p className="text-sm mt-2">{r.archivedOrders} commande(s) et {r.archivedLeads} demande(s) archivées.{r.restoredAt ? ' Restaurées dans la vue courante.' : ' Historique conservé.'}</p>}
      <div className="flex flex-wrap gap-3 mt-4">
        <Button variant="outline" disabled={busy} onClick={() => void perform(() => download(r))}>Télécharger</Button>
        {!r.archivedAt && <Button variant="outline" disabled={busy || !r.downloadedAt} onClick={() => { setConfirm(r.id); setChecked(false); }}>Archiver les dossiers traités</Button>}
        {r.archivedAt && !r.restoredAt && <Button variant="outline" disabled={busy} onClick={() => void perform(async () => { await postJson(`/api/admin/reports/${r.id}/restore`, {}); setMessage('Dossiers restaurés dans la vue courante.'); })}>Restaurer</Button>}
      </div>
      {confirm === r.id && <div className="mt-5 border-t border-brand-border pt-4 space-y-3">
        <p className="text-sm">Seules les commandes terminées/annulées et les demandes traitées sans commande ouverte seront masquées de la vue courante. Les dossiers modifiés depuis l’export sont conservés. Les statistiques et l’historique ne sont pas effacés.</p>
        <label className="flex gap-3 text-sm py-3"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /> J’ai sauvegardé et vérifié le dossier ZIP.</label>
        <Button disabled={!checked || busy} onClick={() => void perform(async () => { const result = await postJson<Report>(`/api/admin/reports/${r.id}/archive`, { confirmed: true }); setConfirm(null); setMessage(`${result.archivedOrders} commande(s), ${result.archivedLeads} demande(s) archivées. Aucun enregistrement supprimé.`); })}>Confirmer l’archivage</Button>
        <button className="underline ml-4 py-3" onClick={() => setConfirm(null)}>Annuler</button>
      </div>}
    </article>)}
  </div>;
}
