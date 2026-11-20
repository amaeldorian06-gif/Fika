import { useEffect, useState } from 'react';
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

export function useCatalog(category?: string) {
  const [data, setData] = useState<CatalogData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    fetch(`/api/market/catalog${category ? `?category=${encodeURIComponent(category)}` : ''}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('catalog');
        return (await res.json()) as CatalogData;
      })
      .then((d) => { if (alive) { setData(d); setError(''); } })
      .catch(() => { if (alive) setError('Catalogue momentanément indisponible. Réessayez dans un instant.'); });
    return () => { alive = false; };
  }, [category]);
  return { data, error };
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
export function ProductImage({ src, alt, className, iconClassName }: {
  src?: string | null; alt: string; className?: string; iconClassName?: string;
}) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  if (!src || failed[src]) {
    return <PackageSearch className={iconClassName ?? 'w-10 h-10 text-brand-text-muted/40'} aria-hidden="true" />;
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed((f) => ({ ...f, [src]: true }))} className={className} />;
}

/**
 * Défilement automatique des photos d'aperçu : doux et maîtrisé.
 * Une photo reste 5 secondes, puis un fondu enchaîné (700 ms) amène la
 * suivante. Pause au survol ou au focus clavier, désactivé si animation
 * réduite demandée ou une seule photo.
 */
const CAROUSEL_INTERVAL_MS = 5000;

function useCarouselIndex(count: number, paused = false): number {
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [count]);
  useEffect(() => {
    if (count <= 1 || paused) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % count), CAROUSEL_INTERVAL_MS);
    return () => { window.clearInterval(id); };
  }, [count, paused]);
  return count > 0 ? i % count : 0;
}

/** Carte produit : photo (carousel), description courte, prix, disponibilité. */
export function ProductCard({ product }: { product: MarketProductPublic }) {
  const [hold, setHold] = useState(false);
  const imageIndex = useCarouselIndex(product.images.length, hold);
  return (
    <Link
      to={`/boutique/produit/${product.slug}`}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
      className="group flex flex-col rounded-2xl border border-brand-border bg-white overflow-hidden hover:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent"
    >
      <div className="relative aspect-square bg-brand-bg overflow-hidden">
        {product.images.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <PackageSearch className="w-10 h-10 text-brand-text-muted/40" aria-hidden="true" />
          </div>
        ) : (
          product.images.map((src, i) => (
            <div
              key={src + i}
              aria-hidden={i !== imageIndex}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${i === imageIndex ? 'opacity-100' : 'opacity-0'}`}
            >
              <ProductImage src={src} alt={product.name} className="w-full h-full object-cover" />
            </div>
          ))
        )}
        {product.images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5" aria-hidden="true">
            {product.images.map((_, d) => (
              <span key={d} className={`h-1.5 rounded-full transition-all duration-500 ${d === imageIndex ? 'w-2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]' : 'w-1.5 bg-white/60'}`} />
            ))}
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">
          {product.category.name}{product.brand ? ` · ${product.brand}` : ''}
        </span>
        <h3 className="font-heading font-bold leading-snug">{product.name}</h3>
        {product.shortDescription && (
          <p className="text-xs text-brand-text-muted leading-snug line-clamp-2">{product.shortDescription}</p>
        )}
        <p className="text-lg font-extrabold text-brand-accent">{formatPrice(product.priceSale)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${AVAILABILITY_STYLES[product.availability]}`}>
            {AVAILABILITY_LABELS[product.availability]}
          </span>
        </div>
      </div>
    </Link>
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
