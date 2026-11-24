import { useEffect, useState } from 'react';
import { MessageCircle, Search, ShoppingBag, Wrench } from 'lucide-react';
import { getWALink } from '../../lib/whatsapp';
import { trackWaClick } from '../../lib/tracking';
import { cart } from '../../lib/cart';
import { COPY_NAV } from '../../lib/copy/navigation';
import { Link, navigate, useRoute } from '../../router';
import { SearchOverlay } from './SearchOverlay';
import { MarketHeader } from '../market/MarketHeader';
import { BrandLogo } from '../BrandLogo';
import { SITE_CITY } from '../../lib/site';

/**
 * En-tête global — les deux univers partagent la marque, mais chacun possède
 * une navigation adaptée à son usage. Fika Market a son propre en-tête Etsy-like.
 */

export type Universe = 'market' | 'services' | 'entry';

export function currentUniverse(path: string): Universe {
  if (path.startsWith('/boutique') || path === '/demande-produit') return 'market';
  if (path === '/') return 'entry';
  return 'services'; // /services, /univers, /service, /demande, pages légales
}

export function GlobalHeader() {
  const { path } = useRoute();
  if (path.startsWith('/admin')) return null;
  if (path === '/') return <EntryHeader />;
  if (currentUniverse(path) === 'market') return <MarketHeader />;
  return <ServicesHeader />;
}

function EntryHeader() {
  return (
    <header className="h-[76px] sm:h-[104px] bg-brand-surface border-b border-brand-border">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link to="/" aria-label="Fika — accueil" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
          <BrandLogo className="text-[3.25rem] sm:text-[4rem]" />
        </Link>
        <span className="text-xs sm:text-lg font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-brand-accent">{SITE_CITY}</span>
      </div>
    </header>
  );
}

function ServicesHeader() {
  const { path } = useRoute();
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => cart.subscribe(() => setCartCount(cart.count())), []);
  useEffect(() => setCartCount(cart.count()), [path]);

  const universe = currentUniverse(path);
  const isActive = (u: 'market' | 'services') =>
    (u === 'market' && universe === 'market') || (u === 'services' && universe === 'services');
  // Le panier vit dans l'univers Market — ou reste visible s'il n'est pas vide.
  const showCart = universe === 'market' || cartCount > 0;

  const navLink = (u: 'market' | 'services', label: string, to: string) => (
    <Link
      key={u}
      to={to}
      aria-current={isActive(u) ? 'page' : undefined}
      className={`relative py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded-lg px-1 -mx-1 ${
        isActive(u) ? 'text-brand-text' : 'text-brand-text-muted hover:text-brand-text'
      }`}
    >
      {label}
      <span
        aria-hidden="true"
        className={`absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-brand-accent transition-opacity ${isActive(u) ? 'opacity-100' : 'opacity-0'}`}
      />
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-brand-surface/95 backdrop-blur-xl border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20 gap-4">
            {/* Gauche : marque */}
            <div className="flex items-center min-w-0">
              <Link to="/" aria-label="Fika — accueil" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
                <BrandLogo className="text-3xl sm:text-4xl" />
              </Link>
              {/* Étiquette d'univers (desktop) : « Où suis-je ? » */}
              <span className="hidden lg:inline-flex items-center gap-1.5 ml-4 pl-4 border-l border-brand-border text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">
                {universe === 'market' ? '· Fika Market' : universe === 'services' ? '· Fika Services' : '· Services & Boutique'}
              </span>
            </div>

            {/* Centre : bascule d'univers (desktop) */}
            <nav className="hidden md:flex items-center gap-7" aria-label="Navigation principale">
              {navLink('market', COPY_NAV.universes.boutique, '/boutique')}
              {navLink('services', COPY_NAV.universes.services, '/services')}
              <button
                type="button"
                onClick={() => navigate('/services#comment-ca-marche')}
                className="py-2 text-sm font-semibold text-brand-text-muted hover:text-brand-text transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded-lg"
              >
                Comment ça marche
              </button>
            </nav>

            {/* Droite : actions contextuelles */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label={COPY_NAV.actions.search}
                className="p-2.5 rounded-xl text-brand-text-muted hover:text-brand-text hover:bg-brand-bg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                <Search className="w-5 h-5" aria-hidden="true" />
              </button>

              {universe === 'services' && (
                <Link
                  to="/demande"
                  className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-full bg-brand-text text-white text-sm font-bold hover:bg-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                  <Wrench className="w-4 h-4" aria-hidden="true" />
                  {COPY_NAV.actions.describeNeed}
                </Link>
              )}

              {showCart && (
                <Link
                  to="/boutique/panier"
                  aria-label={cartCount > 0 ? `${COPY_NAV.actions.cart} — ${cartCount} article(s)` : COPY_NAV.actions.cart}
                  title={COPY_NAV.actions.cart}
                  className="relative p-2.5 rounded-xl text-brand-text-muted hover:text-brand-text hover:bg-brand-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                  <ShoppingBag className="w-5 h-5" aria-hidden="true" />
                  {cartCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-accent text-white text-[10px] font-bold flex items-center justify-center"
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Link>
              )}

              <a
                href={getWALink('Bonjour Fika 👋')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWaClick({ context: 'header' })}
                aria-label={`${COPY_NAV.actions.whatsapp} — ouvrir la conversation`}
                className="p-2.5 rounded-xl text-brand-wa hover:bg-brand-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </header>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  );
}
