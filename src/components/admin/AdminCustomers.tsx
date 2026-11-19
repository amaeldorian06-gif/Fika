import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageCircle, Search, Users } from 'lucide-react';
import {
  fetchCustomers, type CustomerRowDto, type CustomerSegment, type CustomersPayload,
} from '../../lib/admin/api';
import { EmptyState } from './AdminShell';
import { Link } from '../../router';

/**
 * Espace Clients — annuaire unifié Fika Services + Fika Market (CRM v1).
 * Recherche serveur par nom / téléphone / e-mail, segments calculés en base,
 * pagination serveur. Chaque ligne reflète des enregistrements réels ;
 * le profil client détaillé (chronologie, notes, fusion) arrive en phase 3.
 */

const SEGMENTS: { key: CustomerSegment; label: string; hint: string }[] = [
  { key: 'all', label: 'Tous', hint: 'Tous les clients enregistrés' },
  { key: 'services', label: 'Services', hint: 'Au moins une commande Fika Services' },
  { key: 'market', label: 'Market', hint: 'Au moins une commande Fika Market' },
  { key: 'both', label: 'Les deux', hint: 'Clients actifs dans les deux univers' },
  { key: 'new', label: 'Nouveaux', hint: 'Enregistrés depuis 30 jours' },
  { key: 'active', label: 'Actifs', hint: 'Commande dans les 90 derniers jours' },
];

function formatPhone(phone: string): string {
  // E.164 +2376XXXXXXXX → format lisible +237 6XX XX XX XX
  const m = phone.match(/^\+?(\d{3})(\d{3})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : phone;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function waLink(phone: string, name: string | null): string {
  const text = name
    ? `Bonjour ${name}, c’est Fika 👋`
    : 'Bonjour, c’est Fika 👋';
  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
}

function UniverseBadges({ row }: { row: CustomerRowDto }) {
  return (
    <span className="inline-flex gap-1" aria-label="Univers utilisés">
      {row.ordersCount > 0 && (
        <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-bg text-brand-text-muted px-2 py-0.5 rounded-full border border-brand-border">
          Services
        </span>
      )}
      {row.marketOrdersCount > 0 && (
        <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-bg text-brand-text-muted px-2 py-0.5 rounded-full border border-brand-border">
          Market
        </span>
      )}
      {row.ordersCount === 0 && row.marketOrdersCount === 0 && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">
          {row.leadsCount > 0 ? 'Demandes uniquement' : 'Aucune activité'}
        </span>
      )}
    </span>
  );
}

function CustomerRow({ row }: { row: CustomerRowDto }) {
  return (
    <li className="bg-brand-surface border border-brand-border rounded-xl p-4 sm:p-0 sm:grid sm:grid-cols-[1.6fr_1.1fr_1fr_auto] sm:items-center gap-2 sm:gap-4 hover:border-brand-accent transition-colors">
      <div className="min-w-0">
        <Link to={`/admin/clients/${row.id}`} className="font-bold text-brand-text truncate hover:text-brand-accent">
          {row.name ?? 'Nom non renseigné'}
        </Link>
        <p className="text-xs text-brand-text-muted">Client depuis le {formatDate(row.createdAt)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-brand-text font-semibold tabular-nums">{formatPhone(row.phone)}</p>
        <p className="text-xs text-brand-text-muted truncate">{row.email ?? 'Pas d’e-mail'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-text-muted">
        <UniverseBadges row={row} />
        <span className="tabular-nums">{row.ordersCount} cmd S · {row.marketOrdersCount} cmd M · {row.leadsCount} demande{row.leadsCount > 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        <span className="text-xs text-brand-text-muted hidden sm:block" title="Dernière activité">
          {formatDate(row.lastMarketOrderAt ?? row.lastOrderAt)}
        </span>
        <a
          href={waLink(row.phone, row.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-wa px-3 py-2 rounded-full border border-brand-wa/30 hover:bg-brand-wa/10 transition-colors"
          aria-label={`Contacter ${row.name ?? row.phone} sur WhatsApp`}
        >
          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> WhatsApp
        </a>
      </div>
    </li>
  );
}

export function AdminCustomers() {
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<CustomerSegment>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CustomersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<number | null>(null);

  // Recherche différée : une frappe ne déclenche pas une requête à chaque touche.
  useEffect(() => {
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      setQuery(rawQuery);
      setPage(1);
    }, 300);
    return () => { if (debounce.current) window.clearTimeout(debounce.current); };
  }, [rawQuery]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCustomers({ q: query || undefined, segment, page })
      .then((payload) => {
        if (!alive) return;
        setData(payload);
        setError(null);
      })
      .catch(() => {
        if (alive) setError('L’annuaire n’a pas pu être chargé. Vérifiez la connexion puis réessayez.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [query, segment, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const segmentLabel = useMemo(() => SEGMENTS.find((s) => s.key === segment)?.label ?? '', [segment]);

  return (
    <div className="space-y-6">
      <section aria-labelledby="crm-title">
        <h2 id="crm-title" className="font-heading font-bold text-xl text-brand-text mb-1">Annuaire clients unifié</h2>
        <p className="text-sm text-brand-text-muted">
          Un client n’apparaît qu’une seule fois, quel que soit l’univers utilisé (Services, Market ou les deux).
          Recherche par nom, téléphone ou e-mail.
        </p>
      </section>

      {/* Recherche + segments */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Nom, téléphone (ex. 622 36 87 90) ou e-mail…"
            aria-label="Rechercher un client"
            className="w-full bg-brand-surface border border-brand-border rounded-xl pl-11 pr-4 py-3 text-sm text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Segments de clients">
          {SEGMENTS.map((s) => {
            const count = data?.segments[s.key];
            const active = s.key === segment;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => { setSegment(s.key); setPage(1); }}
                title={s.hint}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  active ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-surface text-brand-text-muted border-brand-border hover:border-brand-accent hover:text-brand-text'
                }`}
              >
                {s.label}{typeof count === 'number' ? ` · ${count}` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Résultats */}
      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-brand-text-muted py-8"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Chargement de l’annuaire…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">{error}</p>
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? `Aucun client ne correspond à « ${query} »` : 'Aucun client dans ce segment'}
          description={query
            ? 'Vérifiez l’orthographe, ou essayez la recherche par téléphone (quelques chiffres suffisent).'
            : 'Les clients sont créés automatiquement à la première demande ou commande. Le segment sélectionné est vide pour le moment.'}
        />
      ) : (
        <>
          <p className="text-sm text-brand-text-muted" role="status">
            {data.total} client{data.total > 1 ? 's' : ''} — {segmentLabel.toLowerCase()}
            {query ? ` · recherche « ${query} »` : ''}
          </p>
          <ul className="grid gap-3">
            {data.rows.map((row) => <CustomerRow key={row.id} row={row} />)}
          </ul>
          {totalPages > 1 && (
            <nav className="flex items-center justify-between gap-4" aria-label="Pagination de l’annuaire">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-brand-border bg-brand-surface text-brand-text disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-accent transition-colors"
              >
                ← Précédent
              </button>
              <p className="text-sm text-brand-text-muted">Page {data.page} / {totalPages}</p>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-brand-border bg-brand-surface text-brand-text disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-accent transition-colors"
              >
                Suivant →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
