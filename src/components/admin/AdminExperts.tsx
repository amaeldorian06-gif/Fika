import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, ShieldCheck, UserCog } from 'lucide-react';
import { fetchExperts, type AssignableExpertDto } from '../../lib/admin/api';
import { VERIFICATION_LEVEL_LABELS } from '../../lib/trust';
import { formatPriceFCFA } from '../../lib/pricing';
import { EmptyState } from './AdminShell';

/**
 * Espace Prestataires (§4D) — répertoire des professionnels du réseau Fika
 * avec leurs indicateurs RÉELS (interventions terminées, tâches actives,
 * niveau de confiance effectif). Lecture seule volontaire : l'affectation
 * d'une intervention se fait depuis le détail d'une commande (règles métier
 * existantes) ; aucun indicateur n'est saisi à la main.
 */

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  PAUSED: 'En pause',
  SUSPENDED: 'Suspendu',
  BACKUP: 'Réserviste',
};

const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  BACKUP: 'bg-brand-bg text-brand-text-muted border-brand-border',
  PAUSED: 'bg-amber-50 text-amber-800 border-amber-200',
  SUSPENDED: 'bg-red-50 text-red-800 border-red-200',
};

function ExpertCard({ e }: { e: AssignableExpertDto }) {
  return (
    <li className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading font-bold text-lg text-brand-text">{e.name}</p>
          <p className="text-sm text-brand-text-muted">
            {e.trade ?? 'Métier non renseigné'}{e.zone ? ` · ${e.zone}` : ''}
          </p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${STATUS_CLASSES[e.status] ?? STATUS_CLASSES.BACKUP}`}>
          {STATUS_LABELS[e.status] ?? e.status}
        </span>
      </div>

      {e.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {e.skills.map((s) => (
            <span key={s} className="text-[10px] font-bold uppercase tracking-wider bg-brand-bg text-brand-text-muted px-2 py-0.5 rounded-full border border-brand-border">{s}</span>
          ))}
        </div>
      )}

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-brand-bg rounded-xl p-3">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Terminées</dt>
          <dd className="font-heading font-bold text-lg text-brand-text tabular-nums">{e.completedOrders}</dd>
        </div>
        <div className="bg-brand-bg rounded-xl p-3">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">En cours</dt>
          <dd className="font-heading font-bold text-lg text-brand-text tabular-nums">{e.activeTaskCount}</dd>
        </div>
        <div className="bg-brand-bg rounded-xl p-3">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Fiabilité</dt>
          <dd className="font-heading font-bold text-lg text-brand-text tabular-nums">{e.reliabilityScore != null ? `${e.reliabilityScore} %` : '—'}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 text-brand-text-muted">
          <ShieldCheck className="w-4 h-4 text-brand-accent" aria-hidden="true" />
          {VERIFICATION_LEVEL_LABELS[e.verificationLevel as keyof typeof VERIFICATION_LEVEL_LABELS] ?? e.verificationLevel}
          {e.usualCost != null && ` · tarif habituel ${formatPriceFCFA(e.usualCost)}`}
        </span>
        <a
          href={`https://wa.me/${e.phone.replace(/[^0-9]/g, '')}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-wa px-3 py-2 rounded-full border border-brand-wa/30 hover:bg-brand-wa/10 transition-colors"
          aria-label={`Contacter ${e.name} sur WhatsApp`}
        >
          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> WhatsApp
        </a>
      </div>

      {e.internalNotes && <p className="text-xs text-brand-text-muted border-t border-brand-border pt-3 break-words">{e.internalNotes}</p>}
    </li>
  );
}

export function AdminExperts() {
  const [experts, setExperts] = useState<AssignableExpertDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchExperts()
      .then((rows) => { if (alive) { setExperts(rows); setError(null); } })
      .catch(() => { if (alive) setError('Le répertoire des prestataires n’a pas pu être chargé.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-6">
      <section aria-labelledby="experts-title" className="space-y-1">
        <h2 id="experts-title" className="font-heading font-bold text-xl text-brand-text">Prestataires de services</h2>
        <p className="text-sm text-brand-text-muted">
          Professionnels du réseau Fika. Les interventions terminées, tâches actives et niveaux de confiance sont calculés
          depuis les enregistrements réels — jamais saisis à la main. L’affectation d’une intervention se fait depuis le
          détail d’une commande Services.
        </p>
      </section>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-brand-text-muted py-8"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Chargement du répertoire…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">{error}</p>
      ) : !experts || experts.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Aucun prestataire enregistré"
          description="Les prestataires sont créés dans la base du réseau Fika. Affectez-les à des commandes Services depuis le panneau Exécution d’un détail de commande."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {experts.map((e) => <ExpertCard key={e.id} e={e} />)}
        </ul>
      )}
    </div>
  );
}
