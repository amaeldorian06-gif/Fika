import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, Clock, MessageCircle, Search, Star, X } from 'lucide-react';
import { getWALink } from '../lib/whatsapp';
import { trackServiceSearch, trackWaClick } from '../lib/tracking';
import { getCategories, getServices, searchServices, universeImage } from '../lib/catalog';
import { SERVICES_RESPONSE_PROMISE } from '../lib/data';
import { fetchPublicTestimonials, } from '../lib/proof-api';
import type { PublicTestimonial } from '../lib/proof';
import { Button, UniverseIcon } from './ui';
import { Link, navigate, useRoute } from '../router';
import { NeedIllustration } from './NeedIllustration';
import { ServiceCard } from './ServiceCard';

/**
 * Accueil de l'univers Fika Services (route /services) — recherche dès le
 * héros, découverte par univers, processus, témoignages réels (aucun
 * témoignage = section masquée, jamais de faux avis).
 */

/** Suggestions en un tap : friction minimale sur mobile. */
const SEARCH_SUGGESTIONS = ['plomberie', 'réparation téléphone', 'ordinateur', 'livraison express', 'CV'];

function UniverseCard({ slug, title, examples, icon, color, count }: { slug: string; title: string; examples?: string; icon?: string | null; color: string; count: number }) {
  // Photo d'illustration réelle si elle existe (bucket service-univers,
  // convention <slug>.jpg). Le bloc garde TOUJOURS la même hauteur — photo,
  // ou icône centrée sur fond teinté — pour une grille stable sans saut de
  // mise en page, même pendant que les photos arrivent une à une.
  const [noPhoto, setNoPhoto] = useState(false);
  return (
    <Link
      to={`/univers/${slug}`}
      className="group block h-full p-6 rounded-3xl glass-surface hover:shadow-premium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
    >
      <div className={`relative -mx-6 -mt-6 mb-5 h-44 sm:h-48 rounded-t-3xl overflow-hidden ${noPhoto ? color : 'bg-brand-bg'}`}>
        {noPhoto ? (
          <UniverseIcon icon={icon ?? 'Wrench'} className="w-10 h-10 text-brand-accent absolute inset-0 m-auto" />
        ) : (
          <>
            <img
              src={universeImage(slug)}
              alt={`Illustration — ${title}`}
              loading="lazy"
              onError={() => setNoPhoto(true)}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
            />
            <span className={`absolute bottom-3 left-4 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${color}`}>
              <UniverseIcon icon={icon ?? 'Wrench'} className="w-5 h-5 text-brand-accent" />
            </span>
          </>
        )}
      </div>
      <h3 className="font-heading font-bold text-lg mb-1 text-brand-text">{title}</h3>
      <p className="text-xs font-bold uppercase tracking-wider text-brand-accent mb-2">{count} service{count > 1 ? 's' : ''}</p>
      <p className="text-sm text-brand-text-muted leading-relaxed line-clamp-2">{examples}</p>
      <span className="flex items-center text-sm font-semibold text-brand-accent gap-2 mt-4 group-hover:gap-3 transition-all">
        Explorer <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}

function TestimonialCard({ t }: { t: PublicTestimonial }) {
  return (
    <figure className="p-6 rounded-3xl bg-brand-surface border border-brand-border flex flex-col">
      <div className="flex items-center gap-1 mb-4" aria-label={`Note ${t.rating} sur 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={`w-4 h-4 ${i < t.rating ? 'text-brand-accent fill-brand-accent' : 'text-brand-border fill-brand-border'}`} aria-hidden="true" />
        ))}
      </div>
      <blockquote className="text-sm text-brand-text leading-relaxed flex-1">« {t.content} »</blockquote>
      <figcaption className="mt-4 text-sm">
        <span className="font-bold">{t.name}{t.city ? `, ${t.city}` : ''}</span>
        {t.serviceName && <span className="text-brand-text-muted"> — {t.serviceName}</span>}
        {t.verified && <span className="flex items-center gap-1 text-xs text-brand-text-muted mt-1"><BadgeCheck className="w-3.5 h-3.5 text-brand-accent" aria-hidden="true" /> Avis vérifié (commande terminée)</span>}
      </figcaption>
    </figure>
  );
}

export function ServicesPage() {
  const [query, setQuery] = useState('');
  const [testimonials, setTestimonials] = useState<PublicTestimonial[] | null>(null);
  const { anchor } = useRoute();

  useEffect(() => {
    if (anchor === 'faq' || anchor === 'questions') navigate('/a-propos#questions');
    else if (anchor === 'comment-ca-marche' || anchor === 'fonctionnement') navigate('/a-propos#fonctionnement');
  }, [anchor]);

  const universes = getCategories();
  const results = searchServices(query);

  // Témoignages réels : si l'API ne répond pas ou qu'il n'y en a pas, la
  // section reste masquée — jamais de faux avis.
  useEffect(() => {
    let alive = true;
    fetchPublicTestimonials().then((t) => { if (alive) setTestimonials(t); }).catch(() => { /* masquée */ });
    return () => { alive = false; };
  }, []);

  // Suivi de l'efficacité de la recherche : on trace une fois la frappe
  // stabilisée (1,2 s sans changement), requête ET nombre de résultats.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => trackServiceSearch({ query: q, results: searchServices(q).length }), 1200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="pb-16">
      {/* Hero — identité Fika Services + recherche immédiate */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-14 grid lg:grid-cols-[1.2fr_1fr] items-center gap-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-accent font-bold mb-4">Fika Services · Ngaoundéré</p>
          <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight leading-tight">Un besoin. Une demande.<br /><span className="font-serif italic text-brand-accent">Fika s’occupe du reste.</span></h1>
          <p className="text-brand-text-muted text-base sm:text-lg mt-4 sm:mt-6 max-w-xl">Une fuite, une panne d’appareil ou une course à effectuer ? Décrivez votre besoin. Nous vérifions la faisabilité, le professionnel et les conditions avant de confirmer.</p>

          {/* Recherche — la réponse directe à la promesse du héros */}
          <div id="recherche" className="mt-5 sm:mt-7 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-text-muted" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex. plomberie, réparation téléphone, livraison express…"
                aria-label="Rechercher un service"
                className="w-full pl-12 pr-12 py-3.5 glass-surface rounded-full text-base font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all placeholder:text-brand-text-muted"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Effacer la recherche"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-brand-text-muted hover:text-brand-text hover:bg-brand-bg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2.5 sm:mt-3" aria-label="Suggestions de recherche">
              {SEARCH_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${query === s ? 'bg-brand-text text-white border-brand-text' : 'bg-brand-surface text-brand-text-muted border-brand-border hover:border-brand-accent hover:text-brand-text'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Button asChild size="lg" className="mt-5 sm:mt-7 rounded-full px-6 sm:px-7"><Link to="/demande">Décrire mon besoin <ArrowRight className="ml-2 w-5 h-5" /></Link></Button>
          <a className="flex items-center gap-2 mt-3 sm:mt-4 py-2 sm:py-3 text-sm font-semibold text-brand-wa" href={getWALink("Bonjour Fika 👋\nJ'ai un besoin et j'aimerais savoir si vous pouvez m'aider.")} target="_blank" rel="noopener noreferrer" onClick={() => trackWaClick({ context: 'home-hero' })}><MessageCircle size={18} /> Parler à Fika sur WhatsApp</a>
          <p className="flex items-center gap-2 mt-1 text-xs text-brand-text-muted"><Clock className="w-3.5 h-3.5 text-brand-accent shrink-0" aria-hidden="true" /> {SERVICES_RESPONSE_PROMISE}</p>
        </div>
        <NeedIllustration />
      </section>

      {/* Navigation par univers : ruban horizontal inspiré des marketplaces. */}
      <nav aria-label="Parcourir les catégories de services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-1 mb-4">
        <div className="glass-surface flex items-center gap-2 overflow-x-auto rounded-2xl p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link to="/services" className="inline-flex shrink-0 items-center rounded-full bg-brand-text px-4 py-2 text-xs font-bold text-white" aria-current="page">
            Tous les services
          </Link>
          {universes.map((u) => (
            <Link key={u.id} to={`/univers/${u.slug}`} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/70 bg-white/55 px-4 py-2 text-xs font-semibold text-brand-text-muted transition-colors hover:bg-white hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
              <UniverseIcon icon={u.icon ?? 'Wrench'} className="h-4 w-4 text-brand-accent" />
              {u.title}
              <span className="text-[10px] font-bold text-brand-accent">{getServices({ categoryId: u.id }).length}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Résultats de recherche — plein largeur, sous le héros */}
      {query.trim() !== '' && (
        <section aria-label="Résultats de recherche" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <p className="text-sm font-semibold text-brand-text-muted mb-5" role="status">
            {results.length === 1 ? '1 service trouvé' : `${results.length} services trouvés`}
            {results.length === 0 && ' — essayez un autre mot (ex. plomberie, écran, livraison).'}
          </p>
          {results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((service, idx) => (
                <ServiceCard key={service.id} service={service} idx={idx} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-brand-bg rounded-2xl border border-dashed border-brand-border">
              <p className="text-brand-text-muted mb-6">Aucun service ne correspond à « {query.trim()} ».</p>
              <Button variant="outline" onClick={() => setQuery('')}>
                Effacer la recherche
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Univers */}
      <section id="services" aria-labelledby="univers" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 mb-16">
        <h2 id="univers" className="text-2xl font-heading font-bold mb-6 text-brand-text">Parcourir par univers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {universes.map((u) => (
            <UniverseCard key={u.id} slug={u.slug} title={u.title} examples={u.examples} icon={u.icon} color={u.color} count={getServices({ categoryId: u.id }).length} />
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

      {/* Témoignages — réels uniquement, masqués tant qu'il n'y en a pas */}
      {testimonials && testimonials.length > 0 && (
        <section id="temoignages" aria-labelledby="titre-temoignages" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
          <h2 id="titre-temoignages" className="text-2xl font-heading font-bold mb-6 text-brand-text">Ils ont utilisé Fika</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.slice(0, 6).map((t) => <TestimonialCard key={t.id} t={t} />)}
          </div>
        </section>
      )}

    </div>
  );
}
