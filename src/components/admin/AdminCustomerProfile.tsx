import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, MessageCircle, Save, StickyNote, Tag, Users } from 'lucide-react';
import { Link, navigate } from '../../router';
import {
  addCustomerNoteApi, fetchCustomerProfile, mergeCustomersApi, updateCustomerApi,
  type CustomerProfilePayload,
} from '../../lib/admin/api';
import { formatPriceFCFA } from '../../lib/pricing';
import { Button } from '../ui';
import { Field, Input } from '../forms';
import { EmptyState } from './AdminShell';

/**
 * Profil client unifié (CRM phase 3) : identité, aperçu commercial réel des
 * deux univers, chronologie unifiée, notes internes, tags manuels, détection
 * de doublons (même nom) avec fusion contrôlée. Toutes les valeurs proviennent
 * de la base — aucun indicateur estimé.
 */

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPhone(phone: string): string {
  const m = phone.match(/^\+?(\d{3})(\d{3})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : phone;
}

const UNIVERSE_LABEL: Record<CustomerProfilePayload['timeline'][number]['universe'], string> = {
  services: 'Fika Services',
  market: 'Fika Market',
  interne: 'Interne',
};

const UNIVERSE_CLASS: Record<CustomerProfilePayload['timeline'][number]['universe'], string> = {
  services: 'bg-brand-bg text-brand-text-muted border-brand-border',
  market: 'bg-brand-bg text-brand-accent border-brand-border',
  interne: 'bg-brand-bg text-brand-text-muted border-brand-border',
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text-muted mb-1">{label}</p>
      <p className="font-heading font-bold text-xl text-brand-text tabular-nums">{value}</p>
    </div>
  );
}

export function AdminCustomerProfile({ customerId }: { customerId: string }) {
  const [profile, setProfile] = useState<CustomerProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Édition identité + tags
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTags, setEditTags] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Note
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Fusion
  const [mergeTarget, setMergeTarget] = useState('');
  const [merging, setMerging] = useState(false);

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCustomerProfile(customerId)
      .then((data) => {
        if (!alive) return;
        setProfile(data);
        if (data) {
          setEditName(data.name ?? '');
          setEditEmail(data.email ?? '');
          setEditTags(data.tags.join(', '));
        }
        setError(null);
      })
      .catch(() => { if (alive) setError('Le profil n’a pas pu être chargé.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [customerId, reloadKey]);

  if (loading && !profile) {
    return <p className="flex items-center gap-2 text-sm text-brand-text-muted py-8"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Chargement du profil…</p>;
  }
  if (error || !profile) {
    return <EmptyState icon={Users} title="Profil indisponible" description={error ?? 'Ce client n’existe pas ou a été supprimé.'} />;
  }

  const saveInfo = async () => {
    setSavingInfo(true);
    setInfoMsg(null);
    try {
      await updateCustomerApi(profile.id, {
        name: editName.trim() || null,
        email: editEmail.trim() || null,
        tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setInfoMsg('Informations enregistrées.');
      reload();
    } catch {
      setInfoMsg('Échec de l’enregistrement — vérifiez les champs (e-mail valide, tags séparés par des virgules).');
    } finally {
      setSavingInfo(false);
    }
  };

  const saveNote = async () => {
    if (noteBody.trim().length < 3) return;
    setSavingNote(true);
    try {
      await addCustomerNoteApi(profile.id, noteBody.trim());
      setNoteBody('');
      reload();
    } catch {
      setError('La note n’a pas pu être enregistrée.');
    } finally {
      setSavingNote(false);
    }
  };

  const doMerge = async () => {
    if (!mergeTarget) return;
    setMerging(true);
    try {
      await mergeCustomersApi(profile.id, mergeTarget);
      navigate('/admin/clients');
    } catch {
      setError('La fusion a échoué — aucune donnée n’a été modifiée.');
      setMerging(false);
    }
  };

  const waText = profile.name ? `Bonjour ${profile.name}, c’est Fika 👋` : 'Bonjour, c’est Fika 👋';

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/clients" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text-muted hover:text-brand-accent transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Annuaire clients
          </Link>
          <h2 className="font-heading font-bold text-2xl text-brand-text">{profile.name ?? 'Nom non renseigné'}</h2>
          <p className="text-sm text-brand-text-muted mt-1">
            {formatPhone(profile.phone)} · client depuis le {formatDate(profile.createdAt)}
            {profile.lastActivityAt ? ` · dernière activité le ${formatDate(profile.lastActivityAt)}` : ''}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profile.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-brand-bg text-brand-accent px-2 py-0.5 rounded-full border border-brand-border">
                <Tag className="w-2.5 h-2.5" aria-hidden="true" /> {t}
              </span>
            ))}
          </div>
        </div>
        <a
          href={`https://wa.me/${profile.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waText)}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-bold text-brand-wa px-4 py-2.5 rounded-full border border-brand-wa/30 hover:bg-brand-wa/10 transition-colors"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp
        </a>
      </div>

      {/* Doublons potentiels : même nom, examen manuel demandé */}
      {profile.duplicates.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5" aria-labelledby="duplicates-title">
          <h3 id="duplicates-title" className="font-heading font-bold text-amber-900 mb-2">Doublon possible — examen requis</h3>
          <p className="text-sm text-amber-900/80 mb-3">
            {profile.duplicates.length === 1 ? 'Un autre client porte' : `${profile.duplicates.length} autres clients portent`} le même nom. La fusion regroupe tout l’historique
            (commandes des deux univers, demandes, notes) sur le client conservé — elle est irréversible et ne se fait jamais automatiquement.
          </p>
          <ul className="space-y-2">
            {profile.duplicates.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 bg-white/70 border border-amber-200 rounded-xl px-4 py-3">
                <div>
                  <Link to={`/admin/clients/${d.id}`} className="font-bold text-brand-text hover:text-brand-accent">{d.name ?? 'Sans nom'}</Link>
                  <p className="text-xs text-brand-text-muted">{formatPhone(d.phone)} · créé le {formatDate(d.createdAt)}</p>
                </div>
                <Button
                  type="button" variant="secondary"
                  disabled={merging}
                  onClick={() => { setMergeTarget(d.id); if (window.confirm(`Fusionner « ${profile.name ?? profile.phone} » (source) dans « ${d.name ?? d.phone} » (cible conservée) ? Tout l’historique sera réattribué. Cette action est irréversible.`)) void doMerge(); }}
                >
                  {merging ? 'Fusion…' : 'Fusionner dans ce client'}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Aperçu commercial */}
      <section aria-labelledby="profile-stats-title" className="space-y-3">
        <h3 id="profile-stats-title" className="font-heading font-bold text-lg text-brand-text">Relation commerciale</h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Commandes Services" value={String(profile.counts.orders)} />
          <StatCard label="Commandes Market" value={String(profile.counts.marketOrders)} />
          <StatCard label="Demandes" value={String(profile.counts.leads)} />
          <StatCard label="Encaissé vérifié" value={formatPriceFCFA(profile.finance.servicesConfirmed + profile.finance.marketConfirmed)} />
        </div>
        <p className="text-xs text-brand-text-muted">
          Encaissé vérifié = paiements Fika Services confirmés + paiements Market vérifiés.
          Reçus en attente de vérification : {formatPriceFCFA(profile.finance.servicesPending + profile.finance.marketPending)} (jamais comptés comme encaissés).
          {profile.counts.ordersCompleted > 0 && ` · ${profile.counts.ordersCompleted} commande(s) service terminée(s)`}
          {profile.counts.ordersCancelled > 0 && ` · ${profile.counts.ordersCancelled} annulée(s)`}
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] items-start">
        {/* Chronologie unifiée */}
        <section aria-labelledby="timeline-title" className="space-y-3">
          <h3 id="timeline-title" className="font-heading font-bold text-lg text-brand-text">Chronologie unifiée</h3>
          {profile.timeline.length === 0 ? (
            <EmptyState icon={Users} title="Aucune activité enregistrée" description="Ce client n’a encore ni demande, ni commande, ni note." />
          ) : (
            <ol className="relative border-l-2 border-brand-border ml-3 space-y-4">
              {profile.timeline.map((e, i) => (
                <li key={`${e.at}-${i}`} className="ml-4">
                  <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-brand-accent border-2 border-brand-surface" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${UNIVERSE_CLASS[e.universe]}`}>
                      {UNIVERSE_LABEL[e.universe]}
                    </span>
                    {e.link ? (
                      <Link to={e.link} className="text-sm font-bold text-brand-text hover:text-brand-accent">{e.label}</Link>
                    ) : (
                      <span className="text-sm font-bold text-brand-text">{e.label}</span>
                    )}
                    <span className="text-xs text-brand-text-muted">{formatDate(e.at)}</span>
                  </div>
                  {e.detail && <p className="text-sm text-brand-text-muted mt-0.5 break-words">{e.detail}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-8">
          {/* Notes internes */}
          <section aria-labelledby="notes-title" className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-4">
            <h3 id="notes-title" className="font-heading font-bold text-lg text-brand-text flex items-center gap-2">
              <StickyNote className="w-4 h-4" aria-hidden="true" /> Notes internes
            </h3>
            <form onSubmit={(e) => { e.preventDefault(); if (!savingNote) void saveNote(); }}>
              <fieldset disabled={savingNote} className="space-y-3">
                <Field label="Nouvelle note" htmlFor="customer-note" required hint="Visible uniquement dans l’administration.">
                  <Input
                    id="customer-note" required minLength={3} maxLength={2000} value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Ex. Rappeler pour le devis toiture…"
                  />
                </Field>
                <Button type="submit" variant="primary" className="w-full">{savingNote ? 'Enregistrement…' : 'Ajouter la note'}</Button>
              </fieldset>
            </form>
            {profile.notes.length > 0 && (
              <ul className="space-y-3">
                {profile.notes.map((n) => (
                  <li key={n.id} className="border border-brand-border rounded-xl p-4">
                    <p className="text-sm text-brand-text leading-relaxed whitespace-pre-line break-words">{n.body}</p>
                    <p className="text-xs text-brand-text-muted mt-2">{formatDate(n.createdAt)}{n.author ? ` · ${n.author}` : ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Identité et tags */}
          <section aria-labelledby="identity-title" className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-4">
            <h3 id="identity-title" className="font-heading font-bold text-lg text-brand-text flex items-center gap-2">
              <Save className="w-4 h-4" aria-hidden="true" /> Identité et tags
            </h3>
            {infoMsg && <p role="status" className={`text-sm ${infoMsg.includes('Échec') ? 'text-red-700' : 'text-emerald-700'}`}>{infoMsg}</p>}
            <form onSubmit={(e) => { e.preventDefault(); if (!savingInfo) void saveInfo(); }}>
              <fieldset disabled={savingInfo} className="space-y-3">
                <Field label="Nom" htmlFor="customer-name">
                  <Input id="customer-name" maxLength={120} value={editName} onChange={(e) => setEditName(e.target.value)} />
                </Field>
                <Field label="E-mail" htmlFor="customer-email">
                  <Input id="customer-email" type="email" maxLength={160} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </Field>
                <Field label="Tags (séparés par des virgules)" htmlFor="customer-tags" hint="Ex. fidèle, grossiste, à relancer">
                  <Input id="customer-tags" value={editTags} onChange={(e) => setEditTags(e.target.value)} />
                </Field>
                <p className="text-xs text-brand-text-muted">Le téléphone ({formatPhone(profile.phone)}) est l’identifiant du client : il n’est pas modifiable ici.</p>
                <Button type="submit" variant="primary" className="w-full">{savingInfo ? 'Enregistrement…' : 'Enregistrer'}</Button>
              </fieldset>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
