import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../ui';
import { Link } from '../../router';
import { AVAILABILITY_LABELS, type MarketProductPublic } from '../../lib/market';
import { trackMarketEvent } from '../../lib/market-analytics';
import { activeFilterEntries, usePersistentState, useCatalog, ProductCard } from './shared';
import type { MarketSort } from './MarketAll';

/**
 * Page catégorie — fil d'Ariane, description, sous-catégories visibles,
 * filtres contextuels dérivés des produits réels de la catégorie, tri.
 * Tous les produits de la catégorie restent visibles sans sous-catégorie
 * choisie (CDC §5.2). État conservé au retour d'une fiche.
 */

const SORT_LABELS: Record<MarketSort, string> = {
  pertinence: 'Pertinence', nouveautes: 'Nouveautés', 'prix-asc': 'Prix croissant', 'prix-desc': 'Prix décroissant',
};

interface Filters { sub: string; brand: string; availability: string }
const EMPTY_FILTERS: Filters = { sub: '', brand: '', availability: '' };
const FILTER_LABELS: Record<keyof Filters, string> = { sub: 'Sous-catégorie', brand: 'Marque', availability: 'Disponibilité' };

function sortProducts(products: MarketProductPublic[], sort: MarketSort): MarketProductPublic[] {
  const list = [...products];
  if (sort === 'nouveautes') list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else if (sort === 'prix-asc') list.sort((a, b) => a.priceSale - b.priceSale);
  else if (sort === 'prix-desc') list.sort((a, b) => b.priceSale - a.priceSale);
  return list;
}

export function MarketCategoryPage({ slug }: { slug: string }) {
  const { data, error } = useCatalog(slug);
  useEffect(() => { trackMarketEvent('CATEGORY_VIEWED', { category: slug }); }, [slug]);

  const [filters, setFilters] = usePersistentState<Filters>(`fika:market:cat:${slug}:filters`, EMPTY_FILTERS);
  const [sort, setSort] = usePersistentState<MarketSort>(`fika:market:cat:${slug}:sort`, 'pertinence');
  const [panelOpen, setPanelOpen] = useState(false);

  const products = useMemo(() => (data?.products ?? []).filter((p) => p.category.slug === slug), [data, slug]);

  // Catégorie courante : depuis la liste publique si visible, sinon déduite
  // de ses produits (catégorie masquée accessible par lien direct).
  const categoryMeta = data?.categories.find((c) => c.slug === slug) ?? null;
  const categoryName = categoryMeta?.name ?? products[0]?.category.name ?? 'Catégorie';
  const subcategories = categoryMeta?.children
    ?? [...new Map(products.filter((p) => p.subcategory).map((p) => [p.subcategory!.slug, p.subcategory!])).values()];

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter((b): b is string => !!b))].sort(), [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (filters.sub) list = list.filter((p) => p.subcategory?.slug === filters.sub);
    if (filters.brand) list = list.filter((p) => p.brand === filters.brand);
    if (filters.availability) list = list.filter((p) => p.availability === filters.availability);
    return sortProducts(list, sort);
  }, [products, filters, sort]);

  const setFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    const active = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== ''));
    if (Object.keys(active).length > 0) trackMarketEvent('FILTER_USED', { category: slug, filters: active });
  };

  const entries = activeFilterEntries(filters as unknown as Record<string, string>, FILTER_LABELS as unknown as Record<string, string>);
  const filterControls = (
    <>
      <label className="flex flex-col gap-1 text-xs font-semibold text-brand-text-muted">
        Marque
        <select aria-label="Filtrer par marque" value={filters.brand} onChange={(e) => setFilter('brand', e.target.value)} disabled={brands.length === 0}
          className="rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-text font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent disabled:opacity-50">
          <option value="">Toutes</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
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
        <span className="font-semibold text-brand-text">{categoryName}</span>
      </nav>
      <h1 className="font-heading text-3xl font-bold mt-3">{categoryName}</h1>
      {categoryMeta?.description && <p className="text-brand-text-muted mt-3 max-w-2xl leading-relaxed">{categoryMeta.description}</p>}

      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 border border-red-200 text-red-700 p-4">{error}</p>}

      {data && data.products.length === 0 && (
        <div className="mt-8 text-center py-14 px-6 bg-white rounded-2xl border border-dashed border-brand-border">
          <p className="text-brand-text-muted">Aucun produit dans cette catégorie pour le moment.</p>
          <Button asChild variant="outline" className="mt-5 rounded-full"><Link to="/boutique/tous">Voir tous les produits</Link></Button>
        </div>
      )}

      {data && products.length > 0 && (
        <>
          {/* Sous-catégories visibles — « Tous » par défaut : aucun produit masqué */}
          {subcategories.length > 0 && (
            <nav className="flex gap-2 overflow-x-auto py-4 -mx-5 px-5" aria-label="Sous-catégories">
              <button type="button" onClick={() => setFilter('sub', '')}
                className={`px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${filters.sub === '' ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-brand-text-muted border-brand-border hover:border-brand-accent'}`}>
                Tous
              </button>
              {subcategories.map((s) => (
                <button key={s.slug} type="button" onClick={() => setFilter('sub', s.slug)}
                  className={`px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${filters.sub === s.slug ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-brand-text-muted border-brand-border hover:border-brand-accent'}`}>
                  {s.name}
                </button>
              ))}
            </nav>
          )}

          {/* Filtres contextuels (desktop) — options dérivées des produits réels */}
          <div className="hidden sm:flex items-end gap-4 mt-2">
            {filterControls}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-brand-text-muted" role="status">
              {filtered.length} produit{filtered.length > 1 ? 's' : ''}
              {filters.sub ? ` · ${subcategories.find((s) => s.slug === filters.sub)?.name ?? ''}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <label className="hidden sm:block">
                <span className="sr-only">Trier</span>
                <select aria-label="Trier les produits" value={sort} onChange={(e) => setSort(e.target.value as MarketSort)}
                  className="h-10 rounded-full border border-brand-border bg-white px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
                  {(Object.keys(SORT_LABELS) as MarketSort[]).map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => setPanelOpen(true)} className="sm:hidden inline-flex items-center gap-2 h-10 px-4 rounded-full border border-brand-border bg-white text-sm font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent" aria-expanded={panelOpen}>
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                Filtrer{entries.length > 0 ? ` (${entries.length})` : ''}
              </button>
            </div>
          </div>

          {/* Étiquettes actives */}
          {entries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {entries.map((e) => (
                <button key={e.key + e.value} type="button" onClick={() => setFilter(e.key as keyof Filters, '')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-text text-white text-xs font-bold cursor-pointer hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  aria-label={`Retirer le filtre ${e.label} : ${e.value}`}>
                  {e.label} : {e.value}
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              ))}
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-bold text-brand-text-muted hover:text-red-600 underline underline-offset-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded">
                Réinitialiser
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}

      {/* Panneau de filtres mobile */}
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
              <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={() => setFilters(EMPTY_FILTERS)}>Réinitialiser</Button>
              <Button type="button" className="flex-1 rounded-full" onClick={() => setPanelOpen(false)}>
                Voir les résultats{filtered.length > 0 ? ` (${filtered.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10">
        <Link to="/boutique/tous" className="inline-flex items-center gap-1 text-sm font-bold text-brand-accent hover:underline">
          Voir tous les produits <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
