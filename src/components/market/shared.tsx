import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { PackageSearch } from 'lucide-react';
import { Link } from '../../router';
import { AVAILABILITY_LABELS, type MarketProductPublic } from '../../lib/market';

/**
 * Fika Market — briques partagées des pages publiques (anciennement dans le
 * monolithe Market.tsx, découpées à la phase 3 sans changement de comportement
 * des éléments repris). Aucune donnée fictive : catalogue vide = message honnête.
 */

export function formatPrice(n: number): string {
  return `${n.toLocaleString('fr-FR')} F`;
}

export const AVAILABILITY_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PREORDER: 'bg-amber-50 text-amber-700 border-amber-200',
  UNAVAILABLE: 'bg-brand-bg text-brand-text-muted border-brand-border',
};

export type CatalogCategory = {
  slug: string; name: string; description: string | null; imageUrl: string | null;
  children: { slug: string; name: string }[];
};

export type CatalogData = { categories: CatalogCategory[]; products: MarketProductPublic[] };

// Cache mémoire court + déduplication des requêtes simultanées (header et page).
// Le catalogue public reste rafraîchi rapidement après une modification admin.
const CATALOG_CACHE_TTL_MS = 10_000;
const catalogCache = new Map<string, { data: CatalogData; expiresAt: number }>();
const catalogRequests = new Map<string, Promise<CatalogData>>();

function catalogKey(category?: string): string {
  return category ? `category:${category}` : 'all';
}

function loadCatalog(category?: string): Promise<CatalogData> {
  const key = catalogKey(category);
  const cached = catalogCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);

  const pending = catalogRequests.get(key);
  if (pending) return pending;

  const request = fetch(`/api/market/catalog${category ? `?category=${encodeURIComponent(category)}` : ''}`)
    .then(async (res) => {
      if (!res.ok) throw new Error('catalog');
      return (await res.json()) as CatalogData;
    })
    .then((data) => {
      catalogCache.set(key, { data, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS });
      return data;
    })
    .finally(() => { catalogRequests.delete(key); });

  catalogRequests.set(key, request);
  return request;
}

export function useCatalog(category?: string) {
  const key = catalogKey(category);
  const [data, setData] = useState<CatalogData | null>(() => catalogCache.get(key)?.data ?? null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const cached = catalogCache.get(key);
    if (cached) setData(cached.data);
    if (cached && cached.expiresAt > Date.now()) {
      setError('');
      return () => { alive = false; };
    }

    loadCatalog(category)
      .then((result) => { if (alive) { setData(result); setError(''); } })
      .catch(() => { if (alive) setError('Catalogue momentanément indisponible. Réessayez dans un instant.'); });
    return () => { alive = false; };
  }, [category, key]);
  return { data, error, loading: !data && !error };
}

/** Normalisation de recherche : accents et casse ignorés (« cable » trouve « Câble »). */
export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Image produit avec repli gracieux : URL absente OU morte → icône de repli.
 * Jamais l'icône « image cassée » du navigateur (dégradation honnête et propre).
 * Les URL déjà échouées sont mémorisées : le carousel ne re-montrera pas une
 * image morte à chaque tour (l'icône reste stable).
 */
export function ProductImage({ src, alt, className, iconClassName, loading = 'lazy', onError }: {
  src?: string | null; alt: string; className?: string; iconClassName?: string; loading?: 'lazy' | 'eager'; onError?: (src: string) => void;
}) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  if (!src || failed[src]) {
    return <PackageSearch className={iconClassName ?? 'w-10 h-10 text-brand-text-muted/40'} aria-hidden="true" />;
  }
  return <img src={src} alt={alt} loading={loading} decoding="async" onError={() => { setFailed((f) => ({ ...f, [src]: true })); onError?.(src); }} className={className} />;
}

/** Carte produit : une image principale par carte pour limiter les téléchargements inutiles. */
export function ProductCard({ product }: { product: MarketProductPublic }) {
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const availableImages = product.images.filter((src) => Boolean(src) && !failedImages[src]);

  // Défilement discret en boucle ; le pointeur et le focus arrêtent l'image
  // pour laisser le temps d'examiner le produit.
  useEffect(() => {
    if (paused || reduceMotion || availableImages.length < 2) return;
    const timer = window.setInterval(() => setActiveImageIndex((current) => (current + 1) % availableImages.length), 5000);
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, availableImages.length]);

  useEffect(() => {
    if (activeImageIndex >= availableImages.length) setActiveImageIndex(0);
  }, [activeImageIndex, availableImages.length]);

  return (
    <Link
      to={"/boutique/produit/" + product.slug}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="glass-surface group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl shadow-[0_5px_20px_-16px_rgba(20,20,20,0.25)] transition-all duration-300 hover:-translate-y-1 hover:border-brand-border-dark hover:shadow-[0_18px_36px_-22px_rgba(20,20,20,0.36)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
    >
      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-[#F3F1EE]">
        {availableImages.length > 0 ? availableImages.map((src, index) => (
          <div key={src} className={`absolute inset-0 transition-opacity duration-500 ${index === activeImageIndex ? 'opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={index !== activeImageIndex}>
            <ProductImage
              src={src}
              alt={index === activeImageIndex ? product.name : ''}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
              iconClassName="h-10 w-10 text-brand-text-muted/35"
              onError={(failedSrc) => setFailedImages((current) => ({ ...current, [failedSrc]: true }))}
            />
          </div>
        )) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ProductImage src={null} alt={product.name} iconClassName="h-10 w-10 text-brand-text-muted/35" />
          </div>
        )}
        {availableImages.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center" aria-label={`${availableImages.length} photos du produit`}>
            <span className="flex items-center gap-1.5 rounded-full border border-white/60 bg-slate-950/25 px-2 py-1 backdrop-blur-xl">
              {availableImages.map((src, index) => (
                <span key={src} className={`h-1.5 rounded-full transition-all duration-300 ${index === activeImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/55'}`} />
              ))}
            </span>
          </div>
        )}
        <span className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-sm backdrop-blur-xl ${product.availability === 'AVAILABLE' ? 'border-emerald-200/80 bg-white/85 text-emerald-700' : product.availability === 'PREORDER' ? 'border-amber-200/80 bg-white/85 text-amber-800' : 'border-slate-200/80 bg-white/85 text-slate-500'}`}>
          {AVAILABILITY_LABELS[product.availability]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5 sm:p-4">
        <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.13em] text-brand-text-muted">{product.category.name}{product.brand ? ' · ' + product.brand : ''}</span>
        <h3 className="line-clamp-2 min-h-[2.6rem] font-heading text-sm font-bold leading-snug text-brand-text group-hover:text-brand-accent transition-colors sm:text-[15px]">{product.name}</h3>
        {product.shortDescription && <p className="line-clamp-2 text-xs leading-relaxed text-brand-text-muted">{product.shortDescription}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="text-lg font-extrabold tracking-tight text-brand-text">{formatPrice(product.priceSale)}</p>
          <span className="text-[10px] font-bold text-brand-accent opacity-0 transition-opacity group-hover:opacity-100">Voir →</span>
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="aspect-square animate-pulse bg-slate-100" />
      <div className="space-y-3 p-4">
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-slate-100" />
        <div className="h-3.5 w-3/5 animate-pulse rounded bg-slate-100" />
        <div className="h-5 w-2/5 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

/* ------------------------------ Recherche ---------------------------------- */

/** Distance de Levenshtein bornée — pour tolérer une faute de frappe par mot. */
function withinLevenshtein(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

function productHaystack(p: MarketProductPublic): string {
  return normalizeSearch([p.name, p.reference, p.brand ?? '', p.tags.join(' '), p.category.name, p.subcategory?.name ?? ''].join(' '));
}

/**
 * Recherche tolérante : chaque mot tapé doit se retrouver (sous-chaîne,
 * préfixe de mot, ou à une faute près pour les mots d'au moins 4 lettres)
 * dans le nom, la référence, la marque, les tags ou la catégorie.
 */
export function searchProducts(products: MarketProductPublic[], query: string): MarketProductPublic[] {
  const q = normalizeSearch(query).trim();
  if (!q) return products;
  const tokens = q.split(/\s+/).filter(Boolean);
  return products.filter((p) => {
    const haystack = productHaystack(p);
    const words = haystack.split(/[^a-z0-9]+/).filter(Boolean);
    return tokens.every((t) =>
      haystack.includes(t) ||
      words.some((w) => w.startsWith(t) || (t.length >= 4 && w.length >= 4 && withinLevenshtein(t, w, 1))),
    );
  });
}

/** Historique de recherche récent (localStorage, 5 entrées max, jamais envoyé ailleurs). */
const HISTORY_KEY = 'fika:market-search-history';

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string').slice(0, 5) : [];
  } catch { return []; }
}

export function pushSearchHistory(query: string): void {
  const q = query.trim();
  if (q.length < 2) return;
  try {
    const next = [q, ...getSearchHistory().filter((h) => h !== q)].slice(0, 5);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch { /* stockage indisponible : historique simplement absent */ }
}

/* --------------------------- État de navigation ----------------------------- */

/**
 * État conservé d'une page liste (recherche, filtres, tri) : persisté en
 * sessionStorage et restauré au retour depuis une fiche produit — le
 * visiteur retrouve exactement là où il en était (CDC §4.4).
 */
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue];
}

/** Filtres actifs → étiquettes humaines (une par valeur non vide). */
export function activeFilterEntries(filters: Record<string, string>, labels: Record<string, string>): { key: string; label: string; value: string }[] {
  return Object.entries(filters)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => ({ key: k, value: v, label: labels[k] ?? k }));
}
