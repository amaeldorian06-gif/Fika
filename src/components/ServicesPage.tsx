import { useState } from 'react';
import { ArrowLeft, ArrowRight, MessageCircle, Search } from 'lucide-react';
import { getCategories, getPopularServices, getServices } from '../lib/catalog';
import { displayPrice, getCityPricing } from '../lib/pricing';
import { getWALink } from '../lib/whatsapp';
import { trackWaClick } from '../lib/tracking';
import { Button, UniverseIcon } from './ui';
import { ServiceCard } from './ServiceCard';
import { Link, navigate } from '../router';

function UniverseCard({ slug, title, examples, icon, color }: { slug: string; title: string; examples?: string; icon?: string | null; color: string }) {
  return (
    <Link
      to={`/univers/${slug}`}
      className="group block h-full p-6 rounded-3xl bg-brand-surface border border-brand-border hover:shadow-premium-hover hover:border-brand-border-dark transition-all"
    >
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-5 ${color}`}>
        <UniverseIcon icon={icon} className="w-5 h-5" />
      </div>
      <h3 className="font-heading font-bold text-lg mb-2 text-brand-text">{title}</h3>
      <p className="text-sm text-brand-text-muted mb-6 leading-relaxed line-clamp-2">{examples}</p>
      <span className="flex items-center text-sm font-semibold text-brand-accent gap-2 group-hover:gap-3 transition-all">
        Voir l'univers <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}

export function ServicesPage() {
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [query, setQuery] = useState('');

  const universes = getCategories();
  const topServices = getPopularServices(4);
  const services = getServices();

  const filtered = services.filter((s) => {
    if (activeCategory && s.categoryId !== activeCategory) return false;
    if (query) {
      const q = query.toLowerCase();
      return `${s.name} ${s.shortDescription}`.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen pt-8 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center text-sm text-brand-text-muted hover:text-brand-accent mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à l&apos;accueil
        </Link>
        <h1 className="font-heading text-4xl font-bold mb-6 text-brand-text">Tous nos services</h1>
        <p className="text-xl text-brand-text-muted mb-12">
          Trouvez la solution adaptée à votre besoin parmi nos différentes catégories.
        </p>

        {/* Grille des 7 univers */}
        <section aria-labelledby="univers" className="mb-16">
          <h2 id="univers" className="text-2xl font-heading font-bold mb-6 text-brand-text">Parcourir par univers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {universes.map((u) => (
              <UniverseCard
                key={u.id}
                slug={u.slug}
                title={u.title}
                examples={u.examples}
                icon={u.icon}
                color={u.color}
              />
            ))}
            <Link
              to="/demande"
              className="group block h-full p-6 rounded-3xl bg-brand-text text-white border border-brand-text hover:shadow-premium-hover transition-all"
            >
              <div className="w-11 h-11 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center mb-5">
                <MessageCircle className="w-5 h-5 text-brand-accent" />
              </div>
              <h3 className="font-heading font-bold text-lg mb-2">Autre besoin</h3>
              <p className="text-sm text-brand-contrast-muted mb-6 leading-relaxed line-clamp-2">Vous ne trouvez pas votre besoin ? Parlez-nous.</p>
              <span className="flex items-center text-sm font-semibold text-brand-accent gap-2 group-hover:gap-3 transition-all">
                Décrire mon besoin <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </section>

        {/* Top services avec prix */}
        <section aria-labelledby="top-services" className="mb-16">
          <h2 id="top-services" className="text-2xl font-heading font-bold mb-6 text-brand-text">Les plus demandés</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {topServices.map((s) => (
              <article
                key={s.id}
                className="p-6 rounded-3xl bg-brand-surface border border-brand-border flex flex-col hover:shadow-premium transition-shadow"
              >
                <h3 className="font-heading font-bold text-xl mb-2 text-brand-text">{s.name}</h3>
                <p className="font-heading font-bold text-brand-accent mb-2">{displayPrice(s, getCityPricing(s.id))}</p>
                <p className="text-sm text-brand-text-muted leading-relaxed flex-1 mb-6">{s.shortDescription}</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/service/${s.slug}`}>Voir le service</Link>
                </Button>
              </article>
            ))}
          </div>
        </section>

        {/* Filtres par univers + recherche */}
        <h2 className="text-2xl font-heading font-bold mb-6 text-brand-text">Catalogue complet</h2>
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 mb-10">
          <div className="flex flex-wrap gap-2 flex-1">
            <button
              onClick={() => setActiveCategory('')}
              className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${!activeCategory ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-surface text-brand-text-muted border-brand-border hover:border-brand-border-dark'}`}
            >
              Tout
            </button>
            {universes.map((u) => (
              <button
                key={u.id}
                onClick={() => setActiveCategory(activeCategory === u.id ? '' : u.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeCategory === u.id ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-surface text-brand-text-muted border-brand-border hover:border-brand-border-dark'}`}
              >
                {u.title}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-11 pr-4 py-2.5 bg-brand-surface border border-brand-border rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all placeholder:text-brand-text-muted"
            />
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((service, idx) => (
              <ServiceCard key={service.id} service={service} idx={idx} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-brand-bg rounded-xl border border-brand-border">
            <p className="text-brand-text-muted mb-6">Aucun service ne correspond à votre recherche.</p>
            <Button variant="outline" onClick={() => { setQuery(''); setActiveCategory(''); }}>
              Réinitialiser
            </Button>
          </div>
        )}

        {/* Besoin hors catalogue */}
        <div className="mt-16 p-8 md:p-12 rounded-3xl bg-brand-surface border border-brand-border text-center">
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4 text-brand-text">Vous ne trouvez pas votre besoin ?</h2>
          <p className="text-brand-text-muted mb-8 max-w-xl mx-auto">
            Décrivez-nous simplement ce que vous cherchez, nous verrons comment le prendre en charge.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" className="rounded-full px-8" onClick={() => navigate('/demande')}>
              Décrire mon besoin
            </Button>
            <Button asChild variant="whatsapp" className="rounded-full px-8">
              <a
                href={getWALink('Bonjour Fika 👋, je ne trouve pas mon service dans le catalogue.')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWaClick({ context: 'services-page' })}
              >
                <MessageCircle className="w-4 h-4 mr-2" /> Nous écrire
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
