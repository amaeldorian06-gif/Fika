import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, PackageSearch, Search, Wrench, X } from 'lucide-react';
import { getServices } from '../../lib/catalog';
import { COPY_NAV } from '../../lib/copy/navigation';
import type { MarketProductPublic } from '../../lib/market';
import { Link } from '../../router';

/**
 * Recherche globale — résultats réels uniquement : services du catalogue
 * statique + produits actifs de la boutique (API). Chaque résultat est
 * typé et classé par univers ; aucun résultat inventé.
 */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<MarketProductPublic[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose]);

  // Produits chargés une fois à l'ouverture (catalogue actif, champ public).
  useEffect(() => {
    let alive = true;
    fetch('/api/market/catalog')
      .then(async (res) => (res.ok ? (await res.json()).products as MarketProductPublic[] : []))
      .then((p) => { if (alive) setProducts(p); })
      .catch(() => { if (alive) setProducts([]); });
    return () => { alive = false; };
  }, []);

  const q = query.trim().toLocaleLowerCase('fr');
  const results = useMemo(() => {
    if (q.length < 2) return null;
    const services = getServices()
      .filter((s) => `${s.name} ${s.shortDescription}`.toLocaleLowerCase('fr').includes(q))
      .slice(0, 5);
    const prods = (products ?? [])
      .filter((p) => `${p.name} ${p.category.name} ${p.reference}`.toLocaleLowerCase('fr').includes(q))
      .slice(0, 5);
    return { services, products: prods };
  }, [q, products]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh] bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={COPY_NAV.search.placeholder}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-brand-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="flex items-center gap-3 px-5 border-b border-brand-border">
          <Search className="w-5 h-5 text-brand-text-muted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={COPY_NAV.search.placeholder}
            aria-label={COPY_NAV.search.placeholder}
            className="flex-1 py-4 text-base bg-transparent outline-none placeholder:text-brand-text-muted/70"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={COPY_NAV.search.close}
            className="p-2 -mr-2 rounded-xl text-brand-text-muted hover:text-brand-text hover:bg-brand-bg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2" role="region" aria-live="polite">
          {results === null ? (
            <p className="px-4 py-6 text-sm text-brand-text-muted">{COPY_NAV.search.minChars}</p>
          ) : results.services.length === 0 && results.products.length === 0 ? (
            <p className="px-4 py-6 text-sm text-brand-text-muted">{COPY_NAV.search.noResults}</p>
          ) : (
            <>
              {results.services.length > 0 && (
                <section aria-labelledby="search-services">
                  <h2 id="search-services" className="flex items-center gap-2 px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">
                    <Wrench className="w-3.5 h-3.5" aria-hidden="true" />{COPY_NAV.search.servicesSection}
                  </h2>
                  <ul>
                    {results.services.map((s) => (
                      <li key={s.id}>
                        <Link
                          to={`/service/${s.slug}`}
                          onClick={onClose}
                          className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl hover:bg-brand-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold truncate">{s.name}</span>
                            <span className="block text-xs text-brand-text-muted truncate">{s.shortDescription}</span>
                          </span>
                          <ArrowRight className="w-4 h-4 text-brand-text-muted shrink-0" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {results.products.length > 0 && (
                <section aria-labelledby="search-products">
                  <h2 id="search-products" className="flex items-center gap-2 px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">
                    <PackageSearch className="w-3.5 h-3.5" aria-hidden="true" />{COPY_NAV.search.productsSection}
                    <span className="font-medium normal-case tracking-normal">· {COPY_NAV.search.productsHint}</span>
                  </h2>
                  <ul>
                    {results.products.map((p) => (
                      <li key={p.id}>
                        <Link
                          to={`/boutique/produit/${p.slug}`}
                          onClick={onClose}
                          className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl hover:bg-brand-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold truncate">{p.name}</span>
                            <span className="block text-xs text-brand-text-muted truncate">{p.category.name} · {p.priceSale.toLocaleString('fr-FR')} F</span>
                          </span>
                          <ArrowRight className="w-4 h-4 text-brand-text-muted shrink-0" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
