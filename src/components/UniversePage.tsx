import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, MessageSquare, Search, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { getCategoryBySlug, getFeaturedServices, getPackages, getServiceById, getServices } from '../lib/catalog';
import { computePackageSavings, formatPriceFCFA } from '../lib/pricing';
import { getWALink } from '../lib/whatsapp';
import { trackWaClick } from '../lib/tracking';
import { Button, UniverseIcon } from './ui';
import { ServiceCard } from './ServiceCard';
import { Link } from '../router';

const BUDGETS = ['Faible', 'Moyen', 'Élevé'] as const;
const DELAIS = ['Rapide', 'Standard', 'Long'] as const;
const TYPES = ['Création', 'Optimisation', 'Consulting', 'Production', 'Support', 'Intervention'] as const;

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2 text-brand-text">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none pl-4 pr-10 py-3 bg-brand-bg border border-brand-border rounded-xl text-sm font-medium text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-accent cursor-pointer transition-all"
        >
          <option value="">Tous</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />
      </div>
    </div>
  );
}

export function UniversePage({ slug }: { slug: string }) {
  const universe = getCategoryBySlug(slug);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [budget, setBudget] = useState('');
  const [delai, setDelai] = useState('');
  const [typeBesoin, setTypeBesoin] = useState('');

  const allServices = useMemo(() => (universe ? getServices({ categoryId: universe.id }) : []), [universe]);

  const vedette = useMemo(
    () => (universe ? getFeaturedServices(universe.id).slice(0, 3) : []),
    [universe],
  );

  const filteredServices = allServices.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = `${s.name} ${s.shortDescription} ${s.fullDescription ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (budget && s.budget !== budget) return false;
    if (delai && s.delai !== delai) return false;
    if (typeBesoin && s.typeBesoin !== typeBesoin) return false;
    return true;
  });

  const packages = universe ? getPackages({ categoryId: universe.id }) : [];

  if (!universe) {
    return (
      <div className="min-h-screen pt-24 pb-16 max-w-3xl mx-auto px-4 text-center">
        <h1 className="font-heading text-3xl font-bold mb-4">Univers introuvable</h1>
        <Button onClick={() => history.back()} variant="outline">Retour</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-24">
      {/* Hero Section */}
      <div className="pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`p-8 md:p-16 rounded-3xl border flex flex-col md:flex-row items-center gap-8 md:gap-12 relative overflow-hidden ${universe.color}`}
        >
          <div className="flex-1 z-10">
            <Link to="/" className="inline-flex items-center text-sm font-semibold opacity-70 hover:opacity-100 mb-6 transition-opacity">
              <ArrowLeft className="w-4 h-4 mr-2" /> Tous les univers
            </Link>
            <div className="inline-block bg-white/50 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider mb-6 ml-0 md:ml-4">
              Univers
            </div>
            <h1 className="text-4xl md:text-6xl font-heading font-extrabold tracking-tight mb-4">
              {universe.title}
            </h1>
            <p className="text-lg md:text-xl font-medium opacity-90 max-w-2xl">
              {universe.promise}
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="z-10 opacity-70"
          >
            <UniverseIcon icon={universe.icon} className="w-24 h-24 md:w-32 md:h-32" />
          </motion.div>
        </motion.div>
      </div>

      {/* Featured / Popular Services */}
      {vedette.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-8">
          <h2 className="text-2xl font-heading font-bold mb-8 text-brand-text">En vedette</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {vedette.map((service, idx) => (
              <ServiceCard key={service.id} service={service} idx={idx} />
            ))}
          </div>
        </section>
      )}

      {/* Search and Filter Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-12">
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans cet univers..."
                className="w-full pl-12 pr-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all placeholder:text-brand-text-muted font-medium"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-bold transition-all ${showFilters ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-bg text-brand-text border-brand-border hover:border-brand-border-dark'}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtres
              {(budget || delai || typeBesoin) && (
                <span className="w-2 h-2 rounded-full bg-brand-accent" />
              )}
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-4 border-t border-brand-border overflow-hidden"
              >
                <FilterSelect label="Budget" value={budget} onChange={setBudget} options={BUDGETS} />
                <FilterSelect label="Délai" value={delai} onChange={setDelai} options={DELAIS} />
                <FilterSelect label="Type de besoin" value={typeBesoin} onChange={setTypeBesoin} options={TYPES} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* All Services Grid */}
        <h2 className="text-2xl font-heading font-bold mb-8 text-brand-text">Tous les services</h2>
        {filteredServices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service, idx) => (
              <ServiceCard key={service.id} service={service} idx={idx} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-brand-surface rounded-2xl border border-brand-border">
            <p className="text-brand-text-muted text-lg mb-4">Aucun service ne correspond à vos critères.</p>
            <Button
              variant="outline"
              onClick={() => { setSearchQuery(''); setBudget(''); setDelai(''); setTypeBesoin(''); }}
            >
              Réinitialiser les filtres
            </Button>
          </div>
        )}
      </section>

      {/* Packages Section */}
      {packages.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-12">
          <h2 className="text-2xl font-heading font-bold mb-8 text-brand-text">Packs associés</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3 }}
                className="p-8 rounded-3xl bg-brand-surface border border-brand-border flex flex-col hover:shadow-premium transition-shadow"
              >
                <h3 className="font-heading font-bold text-2xl mb-2 text-brand-text">{pkg.title}</h3>
                <p className="text-brand-text-muted mb-6 text-sm">{pkg.description}</p>
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-3xl font-extrabold text-brand-accent">{formatPriceFCFA(pkg.price)}</span>
                  {computePackageSavings(pkg) > 0 && (
                    <span className="text-xs font-bold text-brand-wa bg-brand-wa/10 px-2.5 py-1 rounded-full">
                      −{formatPriceFCFA(computePackageSavings(pkg))}
                    </span>
                  )}
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {pkg.services.map((line, i) => {
                    const s = getServiceById(line.serviceId);
                    return (
                      <li key={i} className="flex items-center gap-3 text-sm text-brand-text-muted">
                        <CheckCircle2 className="w-4 h-4 text-brand-wa shrink-0" />
                        {line.customName ?? (s ? s.name : 'Service inclus')}
                        {line.quantity > 1 ? ` ×${line.quantity}` : ''}
                      </li>
                    );
                  })}
                </ul>
                <a
                  href={getWALink(`Bonjour Fika 👋, je souhaite souscrire au pack : ${pkg.title}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWaClick({ context: 'univers-pack', campaign: pkg.slug })}
                  className="w-full inline-flex items-center justify-center bg-brand-bg text-brand-text border border-brand-border py-3 px-4 rounded-xl font-bold hover:bg-brand-surface transition-colors"
                >
                  Choisir ce pack
                </a>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Global CTA */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16">
        <div className="bg-brand-text rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent/50 via-transparent to-transparent"></div>
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-heading font-extrabold mb-6">Besoin de conseil ?</h2>
            <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto text-brand-contrast-soft">
              Nos experts sont disponibles sur WhatsApp pour vous orienter vers la solution la plus adaptée à votre besoin.
            </p>
            <a
              href={getWALink('Bonjour Fika 👋, je souhaite être conseillé(e) sur vos services.')}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWaClick({ context: 'univers-cta' })}
              className="inline-flex items-center justify-center bg-white text-brand-text py-4 px-8 rounded-xl font-bold text-lg hover:bg-brand-surface transition-all transform hover:scale-105 gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              Discuter sur WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
