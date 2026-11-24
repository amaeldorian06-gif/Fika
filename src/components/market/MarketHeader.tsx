import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Grid3X3, MessageCircle, Search, ShoppingBag, X } from 'lucide-react';
import { cart } from '../../lib/cart';
import { trackWaClick } from '../../lib/tracking';
import { getWALink } from '../../lib/whatsapp';
import { Link, navigate, useRoute } from '../../router';
import { formatPrice, ProductImage, pushSearchHistory, searchProducts, useCatalog } from './shared';
import { BrandLogo } from '../BrandLogo';

/**
 * En-tête propre à Fika Market : recherche directe, catégories réelles,
 * navigation horizontale et accès panier. L'en-tête Services reste isolé.
 */
export function MarketHeader() {
  const { path } = useRoute();
  const { data, error } = useCatalog();
  const [cartCount, setCartCount] = useState(0);
  const [query, setQuery] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => cart.subscribe(() => setCartCount(cart.count())), []);
  useEffect(() => setCartCount(cart.count()), [path]);

  useEffect(() => {
    setQuery('');
    setSuggestionsOpen(false);
    setCategoryMenuOpen(false);
  }, [path]);

  useEffect(() => {
    if (!suggestionsOpen && !categoryMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setSuggestionsOpen(false);
        setCategoryMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSuggestionsOpen(false);
        setCategoryMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [suggestionsOpen, categoryMenuOpen]);

  const categories = useMemo(() => {
    if (!data) return [];
    return data.categories
      .map((category) => ({
        ...category,
        productCount: data.products.filter((product) => product.category.slug === category.slug).length,
      }))
      .filter((category) => category.productCount > 0);
  }, [data]);

  const suggestions = useMemo(() => {
    if (!data || query.trim().length < 2) return [];
    return searchProducts(data.products, query).slice(0, 5);
  }, [data, query]);

  const currentCategory = path.startsWith('/boutique/categorie/')
    ? decodeURIComponent(path.slice('/boutique/categorie/'.length))
    : '';

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) return;
    pushSearchHistory(term);
    setSuggestionsOpen(false);
    navigate(`/boutique/tous?q=${encodeURIComponent(term)}`);
  };

  const closeMenus = () => {
    setSuggestionsOpen(false);
    setCategoryMenuOpen(false);
  };

  const boutiqueActive = path === '/boutique';
  const allProductsActive = path === '/boutique/tous';
  const productRequestActive = path === '/demande-produit';

  return (
    <header ref={headerRef} className="sticky top-0 z-50 bg-brand-surface/95 backdrop-blur-xl border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3">
          <Link
            to="/boutique"
            aria-label="Fika Market — accueil de la boutique"
            className="order-1 shrink-0 inline-flex items-baseline gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            <BrandLogo className="text-3xl sm:text-4xl" />
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-text-muted">Market</span>
          </Link>

          <button
            type="button"
            aria-expanded={categoryMenuOpen}
            aria-controls="market-category-menu"
            onClick={() => { setCategoryMenuOpen((open) => !open); setSuggestionsOpen(false); }}
            className="order-2 hidden md:inline-flex shrink-0 items-center gap-2 h-11 px-3 rounded-full border border-brand-border text-sm font-semibold text-brand-text hover:border-brand-accent hover:bg-brand-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            <Grid3X3 className="w-4 h-4" aria-hidden="true" />
            Catégories
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${categoryMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>

          <div className="order-3 basis-full sm:basis-auto sm:flex-1 min-w-0 relative">
            <form role="search" onSubmit={submitSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); setCategoryMenuOpen(false); }}
                onFocus={() => { if (query.trim().length >= 2) setSuggestionsOpen(true); }}
                placeholder="Rechercher un produit, une marque…"
                aria-label="Rechercher un produit dans Fika Market"
                aria-expanded={suggestionsOpen && query.trim().length >= 2}
                aria-controls="market-search-suggestions"
                autoComplete="off"
                className="w-full h-11 rounded-full border border-brand-border bg-brand-bg pl-11 pr-12 text-sm font-medium placeholder:text-brand-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:border-brand-accent"
              />
              <button
                type="submit"
                disabled={query.trim().length < 2}
                aria-label="Lancer la recherche"
                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-accent text-white hover:brightness-95 disabled:opacity-45 disabled:cursor-not-allowed transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>

            {suggestionsOpen && query.trim().length >= 2 && (
              <div id="market-search-suggestions" role="region" aria-live="polite" aria-label="Suggestions de produits" className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-[60] max-h-[min(65vh,420px)] overflow-y-auto rounded-2xl border border-brand-border bg-white shadow-2xl">
                {suggestions.length > 0 ? (
                  <>
                    {suggestions.map((product) => (
                      <Link
                        key={product.id}
                        to={`/boutique/produit/${product.slug}`}
                        onClick={closeMenus}
                        className="flex items-center gap-3 p-3 border-b border-brand-border last:border-b-0 hover:bg-brand-bg focus-visible:outline-none focus-visible:bg-brand-bg"
                      >
                        <span className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-brand-bg flex items-center justify-center">
                          <ProductImage src={product.images[0]} alt="" className="w-full h-full object-cover" iconClassName="w-5 h-5 text-brand-text-muted/40" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-sm font-bold text-brand-text">{product.name}</span>
                          <span className="block truncate text-xs text-brand-text-muted">{product.category.name}{product.brand ? ` · ${product.brand}` : ''}</span>
                        </span>
                        <span className="shrink-0 text-sm font-extrabold text-brand-accent">{formatPrice(product.priceSale)}</span>
                      </Link>
                    ))}
                    <Link to={`/boutique/tous?q=${encodeURIComponent(query.trim())}`} onClick={closeMenus} className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-brand-accent hover:bg-brand-bg">
                      Voir tous les résultats <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </>
                ) : (
                  <div className="p-4">
                    <p className="text-sm font-semibold text-brand-text">Aucun produit correspondant à « {query.trim()} ».</p>
                    <Link to="/demande-produit" onClick={closeMenus} className="inline-flex items-center gap-1 mt-2 text-sm font-bold text-brand-accent hover:underline">
                      Demander ce produit <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="order-2 sm:order-4 ml-auto sm:ml-0 flex items-center gap-1 sm:gap-2 shrink-0">
            <Link to="/services" className="hidden md:inline-flex h-10 items-center px-3 rounded-full text-sm font-semibold text-brand-text-muted hover:text-brand-text hover:bg-brand-bg">
              Fika Services
            </Link>
            <Link
              to="/boutique/panier"
              aria-label={cartCount > 0 ? `Mon panier — ${cartCount} article(s)` : 'Mon panier'}
              title="Mon panier"
              className="relative inline-flex items-center justify-center w-10 h-10 rounded-full text-brand-text hover:bg-brand-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            >
              <ShoppingBag className="w-5 h-5" aria-hidden="true" />
              {cartCount > 0 && <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-accent text-white text-[10px] font-bold flex items-center justify-center">{cartCount > 99 ? '99+' : cartCount}</span>}
            </Link>
            <a
              href={getWALink('Bonjour Fika 👋')}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWaClick({ context: 'header' })}
              aria-label="Contacter Fika sur WhatsApp"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full text-brand-wa hover:bg-brand-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            >
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <nav aria-label="Catégories Fika Market" className="border-t border-brand-border/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              to="/boutique"
              aria-current={boutiqueActive ? 'page' : undefined}
              className={`shrink-0 rounded-full px-3 py-2 text-xs sm:text-sm font-bold transition-colors ${boutiqueActive ? 'bg-brand-bg text-brand-accent' : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg'}`}
            >
              Boutique
            </Link>
            {categories.slice(0, 7).map((category) => (
              <Link
                key={category.slug}
                to={`/boutique/categorie/${category.slug}`}
                aria-current={currentCategory === category.slug ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3 py-2 text-xs sm:text-sm font-semibold transition-colors ${currentCategory === category.slug ? 'bg-brand-bg text-brand-accent' : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg'}`}
              >
                {category.name}
              </Link>
            ))}
            <Link to="/boutique/tous" aria-current={allProductsActive ? 'page' : undefined} className={`shrink-0 rounded-full px-3 py-2 text-xs sm:text-sm font-semibold transition-colors ${allProductsActive ? 'bg-brand-bg text-brand-accent' : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg'}`}>
              Tous les produits
            </Link>
            <Link to="/demande-produit" aria-current={productRequestActive ? 'page' : undefined} className={`shrink-0 rounded-full px-3 py-2 text-xs sm:text-sm font-bold transition-colors ${productRequestActive ? 'bg-brand-bg text-brand-accent' : 'text-brand-accent hover:bg-brand-bg'}`}>
              Demander un produit
            </Link>
          </div>
        </div>
      </nav>

      {categoryMenuOpen && (
        <div id="market-category-menu" className="absolute left-0 right-0 top-full z-[55] border-b border-brand-border bg-white shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-heading text-lg font-bold">Explorer les catégories</h2>
                <p className="mt-1 text-xs text-brand-text-muted">Des catégories issues du catalogue Fika Market.</p>
              </div>
              <button type="button" onClick={() => setCategoryMenuOpen(false)} aria-label="Fermer les catégories" className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-brand-bg text-brand-text-muted">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            {categories.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {categories.map((category) => (
                  <Link key={category.slug} to={`/boutique/categorie/${category.slug}`} onClick={closeMenus} className="group rounded-xl border border-brand-border p-3 hover:border-brand-accent hover:bg-brand-bg/70 transition-colors">
                    <span className="block text-sm font-bold text-brand-text group-hover:text-brand-accent">{category.name}</span>
                    <span className="block mt-1 text-xs text-brand-text-muted">{category.productCount} produit{category.productCount > 1 ? 's' : ''}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-brand-bg p-4 text-sm text-brand-text-muted">{error || 'Les catégories seront affichées dès la publication des premiers produits.'}</p>
            )}
            <Link to="/boutique/tous" onClick={closeMenus} className="inline-flex items-center gap-2 mt-5 text-sm font-bold text-brand-accent hover:underline">
              Voir tous les produits <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
