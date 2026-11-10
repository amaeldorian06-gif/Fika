import { useEffect, useState } from 'react';
import { Home, ShoppingBag, Store, Wrench } from 'lucide-react';
import { cart } from '../../lib/cart';
import { COPY_NAV } from '../../lib/copy/navigation';
import { Link, useRoute } from '../../router';
import { currentUniverse } from './GlobalHeader';

/**
 * Navigation mobile dédiée (bottom bar) — ne compresse pas la navigation
 * desktop. Cinq destinations réelles uniquement ; le panier porte son
 * compteur. Respecte les safe areas et laisse le contenu respirer
 * (padding appliqué au conteneur de page dans App).
 */
export function MobileBottomNav() {
  const { path } = useRoute();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => cart.subscribe(() => setCartCount(cart.count())), []);
  useEffect(() => setCartCount(cart.count()), [path]);

  if (path.startsWith('/admin')) return null;

  const universe = currentUniverse(path);
  // Boutique reste active sur tout l'univers Market, sauf la page personnelle (panier).
  const boutiqueActive = universe === 'market' && path !== '/boutique/panier';
  const panierActive = path === '/boutique/panier';

  const items = [
    { to: '/', label: COPY_NAV.bottomNav.home, Icon: Home, active: path === '/', badge: 0 },
    { to: '/boutique', label: COPY_NAV.bottomNav.boutique, Icon: Store, active: boutiqueActive, badge: 0 },
    { to: '/services', label: COPY_NAV.bottomNav.services, Icon: Wrench, active: universe === 'services', badge: 0 },
    { to: '/boutique/panier', label: COPY_NAV.bottomNav.panier, Icon: ShoppingBag, active: panierActive, badge: cartCount },
  ];

  return (
    <nav
      aria-label="Navigation mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-surface/97 backdrop-blur-xl border-t border-brand-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, Icon, active, badge }) => {
          return (
            <li key={to + label}>
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                aria-label={badge > 0 ? `${label} — ${badge} article(s)` : label}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                  active ? 'text-brand-accent' : 'text-brand-text-muted'
                }`}
              >
                <span className="relative">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {badge > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-accent text-white text-[9px] font-bold flex items-center justify-center"
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
