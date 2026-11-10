import { Lock, Store, Wrench } from 'lucide-react';
import { SITE_CITY } from '../lib/site';
import { Link, useRoute } from '../router';

/**
 * Coquille commune : en-tête global et pied de page structurés autour des
 * deux univers (Fika Services / Fika Market). La navigation mobile
 * « bas d'écran » vit dans son propre composant (MobileBottomNav).
 * Les pages admin gèrent leur propre coquille : rien n'y est rendu ici.
 */

export { GlobalHeader } from './navigation/GlobalHeader';
export { MobileBottomNav } from './navigation/MobileBottomNav';

export function Footer() {
  const { path } = useRoute();
  if (path.startsWith('/admin')) return null;

  return (
    <footer className="bg-brand-surface border-t border-brand-border py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-6 md:gap-8 items-start">
          <div>
            <Link to="/" className="font-signature text-3xl font-normal tracking-wide text-brand-text inline-flex items-center gap-1.5 mb-2">
              Fika<span className="text-brand-accent text-2xl leading-none">.</span>
            </Link>
            <p className="text-brand-text-muted text-xs max-w-sm leading-relaxed">
              Services du quotidien, artisans et produits sélectionnés — coordonnés à Ngaoundéré par une seule équipe.
            </p>
          </div>

          <div>
            <h4 className="flex items-center gap-1.5 font-heading font-bold mb-2.5 text-brand-text uppercase tracking-wider text-[11px]">
              <Wrench className="w-3 h-3 text-brand-accent" aria-hidden="true" /> Services
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link to="/services" className="text-brand-text-muted hover:text-brand-accent transition-colors py-1 inline-block">Tous les services</Link></li>
              <li><Link to="/services#comment-ca-marche" className="text-brand-text-muted hover:text-brand-accent transition-colors py-1 inline-block">Comment ça marche</Link></li>
              <li><Link to="/services#faq" className="text-brand-text-muted hover:text-brand-accent transition-colors py-1 inline-block">Questions fréquentes</Link></li>
              <li><Link to="/demande" className="text-brand-text-muted hover:text-brand-accent transition-colors py-1 inline-block">Décrire un besoin</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="flex items-center gap-1.5 font-heading font-bold mb-2.5 text-brand-text uppercase tracking-wider text-[11px]">
              <Store className="w-3 h-3 text-brand-accent" aria-hidden="true" /> Boutique
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link to="/boutique" className="text-brand-text-muted hover:text-brand-accent transition-colors py-1 inline-block">Fika Market</Link></li>
              <li><Link to="/boutique/panier" className="text-brand-text-muted hover:text-brand-accent transition-colors py-1 inline-block">Mon panier</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold mb-2.5 text-brand-text uppercase tracking-wider text-[11px]">Légal &amp; Équipe</h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link to="/mentions-legales" className="text-brand-text-muted hover:text-brand-accent transition-colors">Mentions légales</Link></li>
              <li><Link to="/cgv" className="text-brand-text-muted hover:text-brand-accent transition-colors">CGV</Link></li>
              <li><Link to="/confidentialite" className="text-brand-text-muted hover:text-brand-accent transition-colors">Confidentialité</Link></li>
              <li>
                <Link
                  to="/admin"
                  rel="nofollow"
                  title="Espace réservé à l'équipe Fika"
                  className="inline-flex items-center gap-1 text-brand-accent font-semibold hover:underline pt-0.5"
                >
                  <Lock className="w-3 h-3" />
                  Espace équipe
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-brand-text-muted">
          <p>&copy; {new Date().getFullYear()} Fika. Tous droits réservés.</p>
          <p className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-wa inline-block" />
            Déplacement organisé par Fika · {SITE_CITY}
          </p>
        </div>
      </div>
    </footer>
  );
}
