import { useState } from 'react';
import { ArrowRight, ChevronDown, MessageCircle, Search } from 'lucide-react';
import { getWALink } from '../lib/whatsapp';
import { trackWaClick } from '../lib/tracking';
import { getCategories, getServices } from '../lib/catalog';
import { FAQS } from '../lib/data';
import { Button, UniverseIcon } from './ui';
import { Link } from '../router';
import { NeedIllustration } from './NeedIllustration';
import { ServiceCard } from './ServiceCard';

/**
 * Accueil de l'univers Fika Services (route /services) — découvertes par
 * univers, catalogue filtrable, processus, FAQ. Fusion de l'ancienne page
 * d'accueil et de l'ancien catalogue : rien n'est perdu, tout est réorganisé
 * autour de l'univers Services.
 */

function UniverseCard({ slug, title, examples, icon, color }: { slug: string; title: string; examples?: string; icon?: string | null; color: string }) {
  return (
    <Link
      to={`/univers/${slug}`}
      className="group block h-full p-6 rounded-3xl bg-brand-surface border border-brand-border hover:shadow-premium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${color}`}>
        <UniverseIcon icon={icon ?? 'Wrench'} className="w-5 h-5 text-brand-accent" />
      </div>
      <h3 className="font-heading font-bold text-lg mb-2 text-brand-text">{title}</h3>
      <p className="text-sm text-brand-text-muted leading-relaxed line-clamp-2">{examples}</p>
      <span className="flex items-center text-sm font-semibold text-brand-accent gap-2 mt-4 group-hover:gap-3 transition-all">
        Explorer <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}

export function ServicesPage() {
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [query, setQuery] = useState('');

  const universes = getCategories();
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
    <div className="pb-16">
      {/* Hero — identité Fika Services */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-14 grid lg:grid-cols-[1.2fr_1fr] items-center gap-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-accent font-bold mb-5">Fika Services · Ngaoundéré</p>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight leading-tight">Un besoin. Une demande.<br /><span className="font-serif italic text-brand-accent">Fika s’occupe du reste.</span></h1>
          <p className="text-brand-text-muted text-lg mt-6 max-w-xl">Une fuite, une panne, des travaux ou un transport ? Décrivez votre besoin. Nous recherchons et coordonnons la bonne personne.</p>
          <Button asChild size="lg" className="mt-8 rounded-full px-7"><Link to="/demande">Décrire mon besoin <ArrowRight className="ml-2 w-5 h-5" /></Link></Button>
          <a className="flex items-center gap-2 mt-4 py-3 text-sm font-semibold text-brand-wa" href={getWALink("Bonjour Fika 👋\nJ'ai un besoin et j'aimerais savoir si vous pouvez m'aider.")} target="_blank" rel="noopener noreferrer" onClick={() => trackWaClick({ context: 'home-hero' })}><MessageCircle size={18} /> Parler à Fika sur WhatsApp</a>
        </div>
        <NeedIllustration />
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="border-y border-brand-border bg-white px-5 py-12 mt-10 lg:mt-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading text-2xl font-bold mb-8">Vous expliquez. Nous coordonnons.</h2>
          <ol className="grid sm:grid-cols-3 gap-8">
            {['Décrivez votre besoin.', 'Nous précisons la solution et le prix avec vous.', 'Nous organisons l’intervention et son suivi.'].map((text, i) => <li key={text}><span className="text-brand-accent font-mono text-sm">0{i + 1}</span><p className="mt-2 font-medium">{text}</p></li>)}
          </ol>
        </div>
      </section>

      {/* Univers */}
      <section id="services" aria-labelledby="univers" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 mb-16">
        <h2 id="univers" className="text-2xl font-heading font-bold mb-6 text-brand-text">Parcourir par univers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {universes.map((u) => (
            <UniverseCard key={u.id} slug={u.slug} title={u.title} examples={u.examples} icon={u.icon} color={u.color} />
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

      {/* Catalogue complet — seule liste de services de la page : les services
          populaires y portent déjà le badge « Populaire » et le prix (ServiceCard),
          pas de section « Les plus demandés » dupliquée. */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-heading font-bold mb-6 text-brand-text">Catalogue complet</h2>
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 mb-10">
          <div className="flex flex-wrap gap-2 flex-1">
            <button
              onClick={() => setActiveCategory('')}
              className={`px-4 py-2 rounded-full text-sm font-bold border transition-all cursor-pointer ${!activeCategory ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-surface text-brand-text-muted border-brand-border hover:border-brand-border-dark'}`}
            >
              Tout
            </button>
            {universes.map((u) => (
              <button
                key={u.id}
                onClick={() => setActiveCategory(activeCategory === u.id ? '' : u.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold border transition-all cursor-pointer ${activeCategory === u.id ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-surface text-brand-text-muted border-brand-border hover:border-brand-border-dark'}`}
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
              aria-label="Rechercher un service"
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
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-5 pt-16 pb-4">
        <h2 className="font-heading text-2xl font-bold mb-6">Vos questions</h2>
        {FAQS.map(f => <details key={f.q} className="group border-b border-brand-border"><summary className="list-none cursor-pointer flex items-center justify-between gap-4 py-5 font-semibold focus-visible:outline-brand-accent [&::-webkit-details-marker]:hidden">{f.q}<ChevronDown className="w-5 h-5 shrink-0 group-open:rotate-180" /></summary><p className="text-brand-text-muted leading-relaxed pb-5">{f.a}</p></details>)}
        <div className="text-center mt-10"><Button asChild size="lg" className="rounded-full"><Link to="/demande">Décrire mon besoin <ArrowRight className="ml-2 w-4 h-4" /></Link></Button></div>
      </section>
    </div>
  );
}
