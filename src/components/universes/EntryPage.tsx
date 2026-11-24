import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, MapPin, MessageCircle, ShieldCheck, Store, Wrench } from 'lucide-react';
import { getWALink } from '../../lib/whatsapp';
import { trackWaClick, trackFunnelStep } from '../../lib/tracking';
import { Link, navigate, useRoute } from '../../router';
import { SITE_CITY, SITE_DOMAIN, WHATSAPP_PHONE_E164 } from '../../lib/site';

/**
 * Page d'entrée Fika — une promesse, deux parcours, un contact direct.
 * Les catalogues et les explications détaillées restent dans leurs univers.
 */
const PHONE_LABEL = '+237 ' + WHATSAPP_PHONE_E164.slice(4, 7) + ' ' + WHATSAPP_PHONE_E164.slice(7, 10) + ' ' + WHATSAPP_PHONE_E164.slice(10, 13);

function EntryCard({ kind, title, description, href, requestHref, requestAction }: {
  kind: 'market' | 'services';
  title: string;
  description: string;
  href: string;
  requestHref: string;
  requestAction: string;
}) {
  const Icon = kind === 'market' ? Store : Wrench;

  return (
    <section className="flex min-h-[190px] flex-col justify-center rounded-[1.6rem] border border-brand-border bg-white p-6 transition-all duration-300 hover:border-brand-accent/50 hover:shadow-premium-hover sm:p-7">
      <Link to={href} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent text-white shadow-sm">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="font-heading text-2xl font-extrabold tracking-tight text-brand-text">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-brand-text-muted sm:text-base">{description}</p>
        <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-brand-accent">
          Explorer <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </Link>
      <div className="mt-3 border-t border-brand-border pt-3">
        <Link to={requestHref} onClick={() => trackFunnelStep('PATH_SELECTED', { universe: kind })} className="text-xs font-extrabold text-brand-text underline decoration-brand-accent/50 underline-offset-4 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded">
          {requestAction}
        </Link>
      </div>
    </section>
  );
}

export function EntryPage() {
  const { anchor } = useRoute();
  const reduced = useReducedMotion();

  useEffect(() => {
    // Compatibilité : ces sections vivent désormais sur /services.
    if (anchor && ['services', 'comment-ca-marche', 'faq'].includes(anchor)) {
      navigate(`/services#${anchor}`);
    }
  }, [anchor]);

  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.3, delay: reduced ? 0 : delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <div className="min-h-[calc(100vh-76px)] bg-brand-bg">
      <main className="mx-auto max-w-6xl px-5 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-9 lg:px-10">
        <motion.section className="mx-auto max-w-4xl text-center" {...reveal(0)}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-accent sm:text-xs sm:tracking-[0.22em]">
            Ngaoundéré · Une marque, deux façons de vous aider
          </p>
          <h1 className="mt-5 font-heading text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.045em] text-brand-text sm:mt-6 sm:text-5xl lg:text-[3.65rem]">
            Un besoin, un produit
            <br className="hidden sm:block" /> ou une solution ?
          </h1>
          <p className="mt-1 font-serif text-[2.1rem] italic leading-tight text-brand-accent sm:mt-2 sm:text-5xl lg:text-[3.6rem]">
            Fika vous accompagne.
          </p>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-brand-text-muted sm:mt-5 sm:text-lg">
            À {SITE_CITY} : décrivez un besoin ou un produit. Fika recherche, vérifie et coordonne la solution.
          </p>
        </motion.section>

        <motion.section className="mt-7 grid items-stretch gap-4 sm:mt-9 lg:grid-cols-[1.02fr_0.98fr] lg:gap-6" {...reveal(0.06)}>
          <div className="flex min-h-[330px] items-center justify-center overflow-hidden rounded-[1.7rem] border border-brand-border bg-[#F1E7DC] p-2 sm:min-h-[420px] sm:p-3">
            <img
              src="/fika-home-photo.webp"
              alt="Une cliente découvre Fika sur son téléphone"
              width="360"
              height="396"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="aspect-[10/11] h-full w-full max-w-[420px] rounded-[1.45rem] object-cover shadow-premium"
            />
          </div>
          <div className="grid gap-4 sm:grid-rows-2">
            <EntryCard
              kind="market"
              title="Boutique"
              description="Un produit ? Fika le recherche et vérifie sa disponibilité pour vous."
              href="/boutique"
              requestHref="/demande-produit"
              requestAction="Demander un produit"
            />
            <EntryCard
              kind="services"
              title="Services"
              description="Un besoin ? Fika trouve et coordonne la bonne personne."
              href="/services"
              requestHref="/demande"
              requestAction="Décrire mon besoin"
            />
          </div>
        </motion.section>

        <motion.section className="mt-5 flex flex-col gap-4 rounded-[1.6rem] bg-brand-accent px-5 py-5 text-white sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6" {...reveal(0.1)}>
          <div className="flex items-center gap-4">
            <MapPin className="h-9 w-9 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-white/85 sm:text-sm">Disponible uniquement à</p>
              <p className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{SITE_CITY}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.17em] text-white/80 sm:text-xs">Adamaoua · Cameroun</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-brand-accent sm:self-center">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Prix validé avant tout
          </div>
        </motion.section>
      </main>

      <motion.footer className="bg-brand-text text-white" {...reveal(0.14)}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div>
            <a href={`tel:${WHATSAPP_PHONE_E164}`} className="text-lg font-extrabold tracking-tight hover:text-brand-contrast-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">
              {PHONE_LABEL}
            </a>
            <p className="mt-1 text-xs text-white/65">{SITE_DOMAIN}</p>
          </div>
          <a
            href={getWALink('Bonjour Fika 👋, je souhaite être accompagné.')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWaClick({ context: 'home-hero' })}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-extrabold text-[#10351E] shadow-sm transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <MessageCircle className="h-5 w-5 fill-current" aria-hidden="true" />
            WhatsApp
          </a>
        </div>
      </motion.footer>
    </div>
  );
}