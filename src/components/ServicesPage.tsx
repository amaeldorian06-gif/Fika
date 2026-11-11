import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, ChevronDown, Clock, MessageCircle, Search, Star, X } from 'lucide-react';
import { getWALink } from '../lib/whatsapp';
import { trackServiceSearch, trackWaClick } from '../lib/tracking';
import { getCategories, getServices, searchServices } from '../lib/catalog';
import { FAQS, SERVICES_RESPONSE_PROMISE } from '../lib/data';
import { fetchPublicTestimonials, } from '../lib/proof-api';
import type { PublicTestimonial } from '../lib/proof';
import { Button, UniverseIcon } from './ui';
import { Link } from '../router';
import { NeedIllustration } from './NeedIllustration';
import { ServiceCard } from './ServiceCard';

/**
 * Accueil de l'univers Fika Services (route /services) — recherche dès le
 * héros, découverte par univers, processus, témoignages réels (aucun
 * témoignage = section masquée, jamais de faux avis), FAQ.
 */

/** Suggestions en un tap : friction minimale sur mobile. */
const SEARCH_SUGGESTIONS = ['plomberie', 'fuite', 'déménagement', 'réparation téléphone', 'CV'];

function UniverseCard({ slug, title, examples, icon, color, count }: { slug: string; title: string; examples?: string; icon?: string | null; color: string; count: number }) {
  return (
    <Link
      to={`/univers/${slug}`}
      className="group block h-full p-6 rounded-3xl bg-brand-surface border border-brand-border hover:shadow-premium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${color}`}>
        <UniverseIcon icon={icon ?? 'Wrench'} className="w-5 h-5 text-brand-accent" />
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
          <p className="text-brand-text-muted text-base sm:text-lg mt-4 sm:mt-6 max-w-xl">Une fuite, une panne, des travaux ou un transport ? Décrivez votre besoin. Nous recherchons et coordonnons la bonne personne.</p>

          {/* Recherche — la réponse directe à la promesse du héros */}
          <div id="recherche" className="mt-5 sm:mt-7 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-text-muted" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex. plomberie, réparation téléphone, déménagement…"
                aria-label="Rechercher un service"
                className="w-full pl-12 pr-12 py-3.5 bg-white border border-brand-border rounded-full text-base font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all placeholder:text-brand-text-muted"
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

      {/* Résultats de recherche — plein largeur, sous le héros */}
      {query.trim() !== '' && (
        <section aria-label="Résultats de recherche" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <p className="text-sm font-semibold text-brand-text-muted mb-5" role="status">
            {results.length === 1 ? '1 service trouvé' : `${results.length} services trouvés`}
            {results.length === 0 && ' — essayez un autre mot (ex. fuite, écran, transport).'}
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

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-5 pt-16 pb-4">
        <h2 className="font-heading text-2xl font-bold mb-6">Vos questions</h2>
        {FAQS.map(f => <details key={f.q} className="group border-b border-brand-border"><summary className="list-none cursor-pointer flex items-center justify-between gap-4 py-5 font-semibold focus-visible:outline-brand-accent [&::-webkit-details-marker]:hidden">{f.q}<ChevronDown className="w-5 h-5 shrink-0 group-open:rotate-180" /></summary><p className="text-brand-text-muted leading-relaxed pb-5">{f.a}</p></details>)}
        <div className="text-center mt-10"><Button asChild size="lg" className="rounded-full"><Link to="/demande">Décrire mon besoin <ArrowRight className="ml-2 w-4 h-4" /></Link></Button></div>
      </section>
    </div>
  );
}
