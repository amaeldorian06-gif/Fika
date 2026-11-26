import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, MapPin, MessageCircle, ShieldCheck, ShoppingBag, Wrench } from 'lucide-react';
import { trackFunnelStep, trackWaClick } from '../../lib/tracking';
import { getWALink } from '../../lib/whatsapp';
import { Link, navigate, useRoute } from '../../router';
import { SITE_CITY } from '../../lib/site';

function EntryCard({ kind, title, description, href }: {
  kind: 'market' | 'services';
  title: string;
  description: string;
  href: string;
}) {
  const isMarket = kind === 'market';
  const Icon = isMarket ? ShoppingBag : Wrench;
  const action = isMarket ? 'Explorer la boutique' : 'Découvrir les services';
  return (
    <section
      aria-labelledby={`entry-${kind}`}
      className={`h-full min-h-[300px] overflow-hidden rounded-[1.75rem] border bg-white shadow-premium transition-all duration-300 hover:-translate-y-1 hover:shadow-premium-hover ${isMarket ? 'border-brand-accent/25' : 'border-brand-border'}`}
    >
      <Link
        to={href}
        aria-label={action}
        onClick={() => trackFunnelStep('PATH_SELECTED', { universe: kind })}
        className="group flex h-full flex-col p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent sm:p-8"
      >
        <div className="flex items-center justify-between">
          <span className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${isMarket ? 'bg-brand-accent text-white' : 'bg-brand-text text-white'}`}>
            <Icon className="h-7 w-7" aria-hidden="true" />
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-text-muted">
            {isMarket ? 'Univers 01' : 'Univers 02'}
          </span>
        </div>
        <div className="mt-8 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent">
            {isMarket ? 'Fika Market' : 'Fika Services'}
          </p>
          <h2 id={`entry-${kind}`} className="mt-2 font-heading text-2xl font-extrabold leading-tight tracking-tight text-brand-text sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-brand-text-muted sm:text-base">
            {description}
          </p>
        </div>
        <span className="mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-brand-accent transition-all group-hover:gap-3">
          {action}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}

export function EntryPage() {
  const { anchor } = useRoute();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!anchor) return;
    if (anchor === 'services') navigate('/services#services');
    else if (anchor === 'faq' || anchor === 'questions') navigate('/a-propos#questions');
    else if (anchor === 'comment-ca-marche' || anchor === 'fonctionnement') navigate('/a-propos#fonctionnement');
  }, [anchor]);

  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.3, delay: reduced ? 0 : delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <div className="bg-brand-bg">
      <main className="mx-auto max-w-6xl px-5 pb-10 pt-10 sm:px-8 sm:pb-14 sm:pt-14 lg:px-10">
        <motion.section className="mx-auto max-w-4xl text-center" {...reveal(0)}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-accent sm:text-xs sm:tracking-[0.22em]">
            Fika · {SITE_CITY}
          </p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-[-0.04em] text-brand-text sm:text-5xl">
            Fika vous accompagne.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-brand-text-muted sm:mt-4 sm:text-lg">
            Deux univers, une équipe : choisissez votre point de départ. Fika recherche, vérifie et coordonne la solution adaptée à votre besoin.
          </p>
        </motion.section>

        <motion.div className="mt-8 grid items-stretch gap-4 sm:mt-10 lg:grid-cols-2 lg:gap-6" {...reveal(0.05)}>
          <EntryCard
            kind="market"
            title="Un produit à trouver ?"
            description="Découvrez les produits sélectionnés par Fika. Nous confirmons le prix final et le délai avant votre paiement, puis organisons la livraison à Ngaoundéré."
            href="/boutique"
          />
          <EntryCard
            kind="services"
            title="Un besoin à résoudre ?"
            description="Décrivez votre besoin. Fika vérifie la faisabilité, la disponibilité du professionnel et les conditions avant de coordonner l’intervention."
            href="/services"
          />
        </motion.div>

        <motion.section className="mt-5 flex flex-col gap-3 rounded-2xl border border-brand-border bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7" {...reveal(0.1)}>
          <div className="flex items-center gap-3">
            <MapPin className="h-6 w-6 shrink-0 text-brand-accent" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-brand-text-muted">Disponible actuellement à</p>
              <p className="font-heading text-xl font-extrabold text-brand-text">{SITE_CITY} <span className="text-xs font-semibold text-brand-text-muted">· Adamaoua, Cameroun</span></p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-brand-text-muted">
            <ShieldCheck className="h-4 w-4 text-brand-accent" aria-hidden="true" />
            Prix et conditions confirmés avant engagement
          </div>
        </motion.section>

        <div className="mt-6 flex justify-center">
          <a
            href={getWALink('Bonjour Fika 👋, je souhaite être accompagné.')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWaClick({ context: 'home-hero' })}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-extrabold text-[#10351E] shadow-sm transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            <MessageCircle className="h-5 w-5 fill-current" aria-hidden="true" />
            Contacter Fika sur WhatsApp
          </a>
        </div>
      </main>
    </div>
  );
}
