import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, Check, MessageCircle, Search, Sparkles, Tag, X,
} from 'lucide-react';
import { getCategories, getServices } from '../lib/catalog';
import { displayPrice, getCityPricing } from '../lib/pricing';
import { getWALink } from '../lib/whatsapp';
import { compileSearchMessage } from '../lib/whatsapp/engine';
import { trackWaClick } from '../lib/tracking';
import { SEARCH_SUGGESTIONS } from '../lib/data';
import { navigate } from '../router';
import type { Category, Service } from '../lib/types';

const POPULAR_SHORTCUTS = [
  { label: 'Flyer professionnel', slug: 'flyer-pro', category: 'Design', price: 'Dès 5 000 F' },
  { label: 'Création de site vitrine', slug: 'site-vitrine', category: 'Digital', price: 'Dès 25 000 F' },
  { label: 'CV professionnel', slug: 'cv-professionnel', category: 'Documents', price: 'Dès 3 000 F' },
  { label: 'Réparation téléphone', slug: 'reparation-telephone', category: 'Technologie', price: 'Diag dès 3 000 F' },
  { label: 'WhatsApp Business', slug: 'whatsapp-business', category: 'Entreprise', price: 'Pour 5 000 F' },
  { label: 'Impression & reliure', slug: 'impression-reliure', category: 'Documents', price: 'Dès 1 000 F' },
];

export function ServiceSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const services = getServices();
  const categories = getCategories();

  // Rotation des placeholders
  useEffect(() => {
    if (isOpen || query) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % SEARCH_SUGGESTIONS.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [isOpen, query]);

  // Fermeture clic extérieur
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Filtrage temps réel
  const cleanQuery = query.trim().toLowerCase();

  const matchingServices: Service[] = cleanQuery
    ? services.filter((s) => {
        const hay = `${s.name} ${s.shortDescription} ${s.categoryId} ${s.typeBesoin}`.toLowerCase();
        return hay.includes(cleanQuery);
      }).slice(0, 5)
    : [];

  const matchingCategories: Category[] = cleanQuery
    ? categories.filter((c) => {
        const hay = `${c.title} ${c.description ?? ''} ${c.examples ?? ''}`.toLowerCase();
        return hay.includes(cleanQuery);
      }).slice(0, 2)
    : [];

  const handleSelectService = (slug: string) => {
    setIsOpen(false);
    navigate(`/service/${slug}`);
  };

  const handleSelectCategory = (slug: string) => {
    setIsOpen(false);
    navigate(`/univers/${slug}`);
  };

  const handleAskWhatsApp = () => {
    setIsOpen(false);
    trackWaClick({ context: 'search' });
    window.open(getWALink(compileSearchMessage(query.trim())), '_blank');
  };

  const handleCustomDemand = () => {
    setIsOpen(false);
    navigate('/demande');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (matchingServices.length > 0) {
      handleSelectService(matchingServices[0].slug);
    } else {
      handleAskWhatsApp();
    }
  };

  return (
    <div ref={containerRef} className="relative max-w-2xl mx-auto z-30">
      <form onSubmit={handleSubmit} role="search">
        <div
          className={`relative flex items-center bg-brand-surface rounded-2xl border transition-all duration-200 ${
            isOpen
              ? 'border-brand-accent shadow-premium-hover ring-2 ring-brand-accent/20'
              : 'border-brand-border shadow-premium hover:border-brand-border-dark'
          }`}
        >
          <Search className="absolute left-4 w-5 h-5 text-brand-text-muted shrink-0" aria-hidden="true" />

          <div className="relative w-full">
            {!query && !isOpen && (
              <div className="absolute inset-y-0 left-0 flex items-center pl-12 pointer-events-none w-full overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={placeholderIndex}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.25 }}
                    className="text-brand-text-muted truncate font-medium text-sm md:text-base"
                  >
                    {SEARCH_SUGGESTIONS[placeholderIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}

            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false);
              }}
              placeholder="Que souhaitez-vous faire ? (ex: site web, flyer, CV, réparation...)"
              aria-label="Rechercher un service ou un besoin"
              aria-expanded={isOpen}
              className="w-full h-14 md:h-16 pl-12 pr-28 bg-transparent outline-none text-brand-text font-medium text-sm md:text-base placeholder:text-transparent focus:placeholder:text-brand-border-dark"
            />
          </div>

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
              }}
              className="p-2 text-brand-text-muted hover:text-brand-text mr-1 cursor-pointer"
              aria-label="Effacer la recherche"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            className="absolute right-2 h-10 md:h-12 px-4 md:px-5 rounded-xl bg-brand-text text-white text-sm font-bold inline-flex items-center gap-2 hover:bg-black active:scale-[0.98] transition-all cursor-pointer shrink-0"
          >
            <span>Trouver</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Panneau de résultats et suggestions instantanées */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 right-0 mt-2 bg-brand-surface rounded-2xl border border-brand-border shadow-2xl overflow-hidden divide-y divide-brand-border z-50 text-left"
          >
            {/* Cas 1 : Aucune saisie -> Raccourcis populaires & univers */}
            {!cleanQuery && (
              <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-brand-accent" />
                    <p className="text-xs font-heading font-bold uppercase tracking-wider text-brand-text-muted">
                      Prestations les plus demandées à Ngaoundéré
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {POPULAR_SHORTCUTS.map((item) => (
                      <button
                        key={item.slug}
                        type="button"
                        onClick={() => handleSelectService(item.slug)}
                        className="flex items-center justify-between p-3 rounded-xl bg-brand-bg hover:bg-brand-surface hover:border-brand-accent/40 border border-transparent transition-all text-left cursor-pointer group"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors truncate">
                            {item.label}
                          </p>
                          <p className="text-xs text-brand-text-muted">{item.category}</p>
                        </div>
                        <span className="text-xs font-bold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full shrink-0">
                          {item.price}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-brand-border">
                  <p className="text-xs font-heading font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                    Parcourir par univers
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat.slug)}
                        className="px-3 py-1.5 rounded-lg bg-brand-bg hover:bg-brand-surface hover:border-brand-border-dark border border-brand-border text-xs font-bold text-brand-text transition-colors cursor-pointer"
                      >
                        {cat.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cas 2 : Résultats de recherche en direct */}
            {cleanQuery && (
              <div className="max-h-[70vh] overflow-y-auto divide-y divide-brand-border">
                {/* Univers correspondants */}
                {matchingCategories.length > 0 && (
                  <div className="p-3 bg-brand-bg/60">
                    <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-brand-text-muted px-2 mb-2">
                      Univers correspondant
                    </p>
                    <div className="space-y-1">
                      {matchingCategories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCategory(c.slug)}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-brand-surface transition-colors text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5">
                            <Tag className="w-4 h-4 text-brand-accent" />
                            <span className="text-sm font-bold text-brand-text group-hover:text-brand-accent">
                              Univers {c.title}
                            </span>
                            <span className="text-xs text-brand-text-muted hidden sm:inline truncate max-w-xs">
                              — {c.promise}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-brand-accent flex items-center gap-1 shrink-0">
                            Explorer <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Services correspondants */}
                {matchingServices.length > 0 && (
                  <div className="p-3 space-y-1">
                    <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-brand-text-muted px-2 mb-2">
                      Services disponibles ({matchingServices.length})
                    </p>
                    {matchingServices.map((s) => {
                      const price = displayPrice(s, getCityPricing(s.id));
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectService(s.slug)}
                          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-brand-bg transition-all text-left cursor-pointer group"
                        >
                          <div className="min-w-0 pr-3">
                            <p className="text-sm font-bold text-brand-text group-hover:text-brand-accent transition-colors truncate">
                              {s.name}
                            </p>
                            <p className="text-xs text-brand-text-muted line-clamp-1">{s.shortDescription}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-extrabold text-brand-accent block">{price}</span>
                            <span className="text-[10px] font-semibold text-brand-wa inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Livré gratuit
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Si aucun service direct ne correspond */}
                {matchingServices.length === 0 && matchingCategories.length === 0 && (
                  <div className="p-6 text-center space-y-3">
                    <p className="text-sm text-brand-text font-bold">
                      Aucune prestation standard nommée « {query} »
                    </p>
                    <p className="text-xs text-brand-text-muted max-w-sm mx-auto">
                      Fika est une agence orchestratrice : nous prenons en charge les besoins sur mesure même hors catalogue.
                    </p>
                  </div>
                )}

                {/* Bas de panneau : Action directe WhatsApp & Demande sur-mesure */}
                <div className="p-3 bg-brand-bg flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={handleCustomDemand}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-accent text-xs font-bold text-brand-text transition-colors cursor-pointer text-center"
                  >
                    Décrire ce besoin dans le formulaire
                  </button>

                  <button
                    type="button"
                    onClick={handleAskWhatsApp}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-brand-wa hover:bg-brand-wa-hover text-xs font-bold text-white shadow-sm inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Demander directement sur WhatsApp</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
