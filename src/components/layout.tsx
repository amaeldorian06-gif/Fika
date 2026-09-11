import { useState } from 'react';
import { ArrowRight, Lock, MessageCircle } from 'lucide-react';
import { getWALink } from '../lib/whatsapp';
import { SITE_CITY } from '../lib/site';
import { Button } from './ui';
import { Link, navigate, useRoute } from '../router';

export function Header() {
  const { path } = useRoute();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  if (path.startsWith('/admin')) return null;

  return (
    <header className="sticky top-0 z-50 bg-brand-surface/95 backdrop-blur-xl border-b border-brand-border transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <Link to="/" className="font-signature text-4xl font-normal tracking-wide text-brand-text flex items-center gap-2">
              Fika<span className="text-brand-accent text-3xl leading-none">.</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => navigate('/#services')} className="text-sm font-semibold text-brand-text-muted hover:text-brand-text transition-colors cursor-pointer">
              Services
            </button>
            <button onClick={() => navigate('/#realisations')} className="text-sm font-semibold text-brand-text-muted hover:text-brand-text transition-colors cursor-pointer">
              Réalisations
            </button>
            <button onClick={() => navigate('/#a-propos')} className="text-sm font-semibold text-brand-text-muted hover:text-brand-text transition-colors cursor-pointer">
              Comment ça marche
            </button>

            <Button variant="whatsapp" size="sm" className="rounded-full px-5 ml-2 font-bold" asChild>
              <a href={getWALink('Bonjour Fika.')} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </Button>
          </nav>

          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="px-3.5 py-2 rounded-full border border-brand-border bg-brand-bg text-brand-text font-heading font-bold text-sm inline-flex items-center gap-2 hover:border-brand-accent transition-colors cursor-pointer"
              aria-expanded={mobileMenuOpen}
              aria-controls="menu-mobile"
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu de navigation'}
            >
              <span>{mobileMenuOpen ? 'Fermer' : 'Menu'}</span>
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full transition-colors ${
                  mobileMenuOpen ? 'bg-brand-accent' : 'bg-brand-wa'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile déroulant — positionnement absolu sous le header (z-50) garanti visible */}
      {mobileMenuOpen && (
        <div
          id="menu-mobile"
          className="md:hidden absolute top-full left-0 right-0 z-50 bg-brand-surface border-b border-brand-border shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Menu mobile"
        >
          <nav className="px-6 py-6 space-y-4 max-h-[80vh] overflow-y-auto" aria-label="Navigation mobile">
            <ul className="divide-y divide-brand-border">
              {[
                { label: 'Catalogue des services', target: '/#services', desc: '7 univers et prestations' },
                { label: 'Réalisations & portfolio', target: '/#realisations', desc: 'Exemples de travaux livrés' },
                { label: 'Comment ça marche', target: '/#a-propos', desc: 'Le circuit en 4 étapes' },
                { label: 'Questions fréquentes', target: '/#faq', desc: 'Prix, délais et livraison' },
                { label: 'Décrire un besoin sur mesure', target: '/demande', desc: 'Formulaire de demande directe' },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left py-3.5 text-brand-text hover:text-brand-accent transition-colors cursor-pointer"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate(item.target);
                    }}
                  >
                    <div>
                      <span className="font-heading text-lg font-bold block">{item.label}</span>
                      <span className="text-xs text-brand-text-muted">{item.desc}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-brand-accent shrink-0 ml-3" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="pt-4 border-t border-brand-border space-y-3">
              <Button variant="whatsapp" size="lg" className="w-full rounded-full" asChild>
                <a
                  href={getWALink('Bonjour Fika 👋, je souhaite poser une question.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Discuter sur WhatsApp
                </a>
              </Button>
              <p className="text-center text-xs font-semibold text-brand-text-muted">
                {SITE_CITY} · Livraison gratuite dans toute la ville
              </p>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { path } = useRoute();
  if (path.startsWith('/admin')) return null;

  return (
    <footer className="bg-brand-surface border-t border-brand-border py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr] gap-6 md:gap-8 items-start">
          <div>
            <Link to="/" className="font-signature text-3xl font-normal tracking-wide text-brand-text inline-flex items-center gap-1.5 mb-2">
              Fika<span className="text-brand-accent text-2xl leading-none">.</span>
            </Link>
            <p className="text-brand-text-muted text-xs max-w-sm leading-relaxed">
              Orchestrateur de services numériques, techniques et pratiques à Ngaoundéré.
            </p>
          </div>

          <div>
            <h4 className="font-heading font-bold mb-2.5 text-brand-text uppercase tracking-wider text-[11px]">Navigation</h4>
            <ul className="space-y-1.5 text-xs">
              <li><button onClick={() => navigate('/#services')} className="text-brand-text-muted hover:text-brand-accent transition-colors cursor-pointer">Services & Packs</button></li>
              <li><button onClick={() => navigate('/#realisations')} className="text-brand-text-muted hover:text-brand-accent transition-colors cursor-pointer">Réalisations</button></li>
              <li><button onClick={() => navigate('/#a-propos')} className="text-brand-text-muted hover:text-brand-accent transition-colors cursor-pointer">Comment ça marche</button></li>
              <li><button onClick={() => navigate('/#faq')} className="text-brand-text-muted hover:text-brand-accent transition-colors cursor-pointer">FAQ</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold mb-2.5 text-brand-text uppercase tracking-wider text-[11px]">Légal & Équipe</h4>
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
            Livraison gratuite dans toute la ville de {SITE_CITY}
          </p>
        </div>
      </div>
    </footer>
  );
}
