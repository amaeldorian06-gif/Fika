import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../ui';
import { Link } from '../../router';
import { AVAILABILITY_LABELS, type MarketProductPublic } from '../../lib/market';
import { trackMarketEvent } from '../../lib/market-analytics';
import { getWALink } from '../../lib/whatsapp';
import {
  activeFilterEntries, pushSearchHistory, searchProducts, usePersistentState, useCatalog, ProductCard,
} from './shared';

/**
 * Tous les produits — recherche, filtres (catégorie, marque, tag,
 * disponibilité), tri (pertinence, nouveautés, prix). L'état est conservé au
 * retour depuis une fiche (sessionStorage). Jamais de tri « popularité »
 * artificielle (CDC §4.3).
 */

export type MarketSort = 'pertinence' | 'nouveautes' | 'prix-asc' | 'prix-desc';

const SORT_LABELS: Record<MarketSort, string> = {
  pertinence: 'Pertinence',
  nouveautes: 'Nouveautés',
  'prix-asc': 'Prix croissant',
  'prix-desc': 'Prix décroissant',
};

interface Filters { category: string; brand: string; tag: string; availability: string }

const EMPTY_FILTERS: Filters = { category: '', brand: '', tag: '', availability: '' };
const FILTER_LABELS: Record<keyof Filters, string> = { category: 'Catégorie', brand: 'Marque', tag: 'Tag', availability: 'Disponibilité' };

function sortProducts(products: MarketProductPublic[], sort: MarketSort): MarketProductPublic[] {
  const list = [...products];
  if (sort === 'nouveautes') list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else if (sort === 'prix-asc') list.sort((a, b) => a.priceSale - b.priceSale);
  else if (sort === 'prix-desc') list.sort((a, b) => b.priceSale - a.priceSale);
  return list; // 'pertinence' : ordre du catalogue (aucune popularité artificielle ajoutée)
}

export function MarketAllPage() {
  const { data, error } = useCatalog();
  const products = data?.products ?? [];

  // Recherche initiale : paramètre d'URL (?q= depuis l'accueil) prioritaire,
  // sinon état restauré (retour depuis une fiche produit).
  const [q, setQ] = usePersistentState('fika:market:all:q', '');
  const [filters, setFilters] = usePersistentState<Filters>('fika:market:all:filters', EMPTY_FILTERS);
  const [sort, setSort] = usePersistentState<MarketSort>('fika:market:all:sort', 'pertinence');
  const [panelOpen, setPanelOpen] = useState(false);
  const [urlApplied, setUrlApplied] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get('q');
    if (fromUrl && !urlApplied) { setQ(fromUrl); pushSearchHistory(fromUrl); setUrlApplied(true); }
  }, [urlApplied, setQ]);

  // Options de filtres dérivées des données réelles (jamais de valeurs fantômes).
  const options = useMemo(() => {
    const scoped = products.filter((p) => !filters.category || p.category.slug === filters.category);
    const brands = [...new Set(scoped.map((p) => p.brand).filter((b): b is string => !!b))].sort();
    const tags = [...new Set(scoped.flatMap((p) => p.tags))].sort();
    return { brands, tags };
  }, [products, filters.category]);

  const filtered = useMemo(() => {
    let list = searchProducts(products, q);
    if (filters.category) list = list.filter((p) => p.category.slug === filters.category);
    if (filters.brand) list = list.filter((p) => p.brand === filters.brand);
    if (filters.tag) list = list.filter((p) => p.tags.includes(filters.tag));
    if (filters.availability) list = list.filter((p) => p.availability === filters.availability);
    return sortProducts(list, sort);
  }, [products, q, filters, sort]);

  // Analytics de recherche : debounce — une recherche « terminée » compte,
  // pas chaque frappe (SEARCH_PERFORMED / SEARCH_EMPTY, CDC §9).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const count = searchProducts(products, term).length;
    const id = window.setTimeout(() => {
      trackMarketEvent(count > 0 ? 'SEARCH_PERFORMED' : 'SEARCH_EMPTY', { query: term, resultCount: count });
    }, 900);
    return () => { window.clearTimeout(id); };
  }, [q, products]);

  const setFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    const active = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== ''));
    if (Object.keys(active).length > 0) trackMarketEvent('FILTER_USED', { filters: active });
  };

  const resetFilters = () => { setFilters(EMPTY_FILTERS); setQ(''); };
  const activeCount = Object.values(filters).filter((v) => v !== '').length + (q.trim().length >= 2 ? 1 : 0);
  const entries = activeFilterEntries(filters as unknown as Record<string, string>, FILTER_LABELS as unknown as Record<string, string>);

  const filterControls = (
    <>
      <label className="flex flex-col gap-1 text-xs font-semibold text-brand-text-muted">
        Catégorie
        <select aria-label="Filtrer par catégorie" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}
          className="rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-text font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
          <option value="">Toutes</option>
          {(data?.categories ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-brand-text-muted">
        Marque
        <select aria-label="Filtrer par marque" value={filters.brand} onChange={(e) => setFilter('brand', e.target.value)} disabled={options.brands.length === 0}
          className="rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-text font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent disabled:opacity-50">
          <option value="">Toutes</option>
          {options.brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-brand-text-muted">
        Tag
        <select aria-label="Filtrer par tag" value={filters.tag} onChange={(e) => setFilter('tag', e.target.value)} disabled={options.tags.length === 0}
          className="rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-text font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent disabled:opacity-50">
          <option value="">Tous</option>
          {options.tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-brand-text-muted">
        Disponibilité
        <select aria-label="Filtrer par disponibilité" value={filters.availability} onChange={(e) => setFilter('availability', e.target.value)}
          className="rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-text font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
          <option value="">Toutes</option>
          {Object.entries(AVAILABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
    </>
  );

  return (
    <div className="max-w-6xl mx-auto px-5 py-10 sm:py-14">
      <nav aria-label="Fil d'Ariane" className="text-xs text-brand-text-muted">
        <Link to="/" className="hover:text-brand-accent">Accueil</Link> <span aria-hidden="true">/</span>{' '}
        <Link to="/boutique" className="hover:text-brand-accent">Boutique</Link> <span aria-hidden="true">/</span>{' '}
        <span className="font-semibold text-brand-text">Tous les produits</span>
      </nav>
      <h1 className="font-heading text-3xl font-bold mt-3">Tous les produits</h1>

      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 border border-red-200 text-red-700 p-4">{error}</p>}

      {data && (
        <>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : nom, référence, marque…" aria-label="Rechercher un produit"
                className="w-full h-11 rounded-full border border-brand-border bg-white pl-11 pr-10 text-sm font-medium placeholder:text-brand-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent" />
              {q && (
                <button type="button" onClick={() => setQ('')} aria-label="Effacer la recherche" title="Effacer"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-brand-text-muted hover:bg-brand-bg hover:text-brand-text cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <label className="sm:hidden">
              <span className="sr-only">Trier</span>
              <select aria-label="Trier les produits" value={sort} onChange={(e) => setSort(e.target.value as MarketSort)}
                className="w-full h-11 rounded-full border border-brand-border bg-white px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
                {(Object.keys(SORT_LABELS) as MarketSort[]).map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setPanelOpen(true)} className="sm:hidden inline-flex items-center justify-center gap-2 h-11 rounded-full border border-brand-border bg-white px-4 text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent" aria-expanded={panelOpen}>
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              Filtrer{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
          </div>

          {/* Filtres en ligne (desktop) + tri */}
          <div className="hidden sm:flex items-end gap-4 mt-4">
            {filterControls}
            <label className="flex flex-col gap-1 text-xs font-semibold text-brand-text-muted ml-auto">
              Trier par
              <select aria-label="Trier les produits" value={sort} onChange={(e) => setSort(e.target.value as MarketSort)}
                className="rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-text font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
                {(Object.keys(SORT_LABELS) as MarketSort[]).map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
              </select>
            </label>
          </div>

          {/* Étiquettes des filtres actifs (recherche incluse) */}
          {(entries.length > 0 || q.trim().length >= 2) && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {q.trim().length >= 2 && (
                <button type="button" onClick={() => setQ('')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-text text-white text-xs font-bold cursor-pointer hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  aria-label="Retirer la recherche">
                  Recherche : {q.trim()}
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
              {entries.map((e) => (
                <button key={e.key + e.value} type="button"
                  onClick={() => setFilter(e.key as keyof Filters, '')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-text text-white text-xs font-bold cursor-pointer hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  aria-label={`Retirer le filtre ${e.label} : ${e.value}`}>
                  {e.label} : {e.value}
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              ))}
              <button type="button" onClick={resetFilters} className="text-xs font-bold text-brand-text-muted hover:text-red-600 underline underline-offset-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded">
                Réinitialiser
              </button>
            </div>
          )}

          <p className="text-sm text-brand-text-muted mt-4" role="status">
            {filtered.length} produit{filtered.length > 1 ? 's' : ''}{q.trim() ? ` pour « ${q.trim()} »` : ''}
          </p>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="mt-6 text-center py-14 px-6 bg-white rounded-2xl border border-dashed border-brand-border">
              <PackageSearch className="w-10 h-10 mx-auto text-brand-text-muted/50 mb-4" />
              <h2 className="font-heading font-bold text-lg">Aucun produit ne correspond à votre recherche</h2>
              <p className="text-sm text-brand-text-muted mt-2 max-w-md mx-auto">
                Essayez un autre mot, parcourez les catégories, ou dites-nous ce que vous cherchez : nous pouvons probablement le commander pour vous.
              </p>
              {data.categories.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-5">
                  {data.categories.map((c) => (
                    <Link key={c.slug} to={`/boutique/categorie/${c.slug}`} className="px-4 py-2 rounded-full border border-brand-border bg-white text-sm font-bold hover:border-brand-accent hover:text-brand-accent">
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Button asChild variant="primary" className="rounded-full"><Link to="/demande-produit">Demander un produit</Link></Button>
                <Button asChild variant="outline" className="rounded-full"><a href={getWALink('Bonjour Fika Market 👋\nJe cherche un produit. Pouvez-vous me dire si vous pouvez le commander ?')} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4 mr-2" />Sur WhatsApp</a></Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Panneau de filtres mobile (CDC §4.4) */}
      {panelOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Filtres">
          <button type="button" className="absolute inset-0 bg-black/40 cursor-default" aria-label="Fermer les filtres" onClick={() => setPanelOpen(false)} />
          <div className="relative w-full bg-white rounded-t-3xl p-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg">Filtrer</h2>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Fermer" className="p-2 rounded-full hover:bg-brand-bg cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">{filterControls}</div>
            <label className="flex flex-col gap-1 text-xs font-semibold text-brand-text-muted">
              Trier par
              <select aria-label="Trier les produits" value={sort} onChange={(e) => setSort(e.target.value as MarketSort)}
                className="rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-text font-semibold">
                {(Object.keys(SORT_LABELS) as MarketSort[]).map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
              </select>
            </label>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={resetFilters}>Réinitialiser</Button>
              <Button type="button" className="flex-1 rounded-full" onClick={() => setPanelOpen(false)}>
                Voir les résultats{filtered.length > 0 ? ` (${filtered.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
