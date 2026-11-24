import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, MessageCircle, ShieldCheck, Store, Wrench } from 'lucide-react';
import { getWALink } from '../../lib/whatsapp';
import { trackWaClick, trackFunnelStep } from '../../lib/tracking';
import { Link, navigate, useRoute } from '../../router';
import { SITE_CITY, SITE_DOMAIN, WHATSAPP_PHONE_E164 } from '../../lib/site';

const PHONE_LABEL = '+237 ' + WHATSAPP_PHONE_E164.slice(4, 7) + ' ' + WHATSAPP_PHONE_E164.slice(7, 10) + ' ' + WHATSAPP_PHONE_E164.slice(10, 13);

function EntryCard({ kind, title, description, href }: {
  kind: 'market' | 'services';
  title: string;
  description: string;
  href: string;
}) {
  const Icon = kind === 'market' ? Store : Wrench;
  return (
    <Link
      to={href}
      onClick={() => trackFunnelStep('PATH_SELECTED', { universe: kind })}
      className="group flex min-h-[154px] flex-col justify-center rounded-[1.5rem] border border-brand-border bg-white p-4 text-left transition-all duration-300 hover:border-brand-accent/50 hover:shadow-premium-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:min-h-[170px] sm:p-6"
    >
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent text-white shadow-sm sm:mb-4 sm:h-12 sm:w-12">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="font-heading text-xl font-extrabold tracking-tight text-brand-text sm:text-2xl">{title}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-brand-text-muted sm:mt-2 sm:text-base">{description}</p>
    </Link>
  );
}

export function EntryPage() {
  const { anchor } = useRoute();
  const reduced = useReducedMotion();

  useEffect(() => {
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
          <h1 className="mt-4 font-heading text-[2.15rem] font-extrabold leading-[1.08] tracking-[-0.045em] text-brand-text sm:mt-5 sm:text-5xl lg:text-[3.65rem]">
            Un besoin, un produit
            <br className="hidden sm:block" /> ou une solution ?
          </h1>
          <p className="mt-1 font-serif text-[2rem] italic leading-tight text-brand-accent sm:mt-2 sm:text-5xl lg:text-[3.6rem]">
            Fika vous accompagne.
          </p>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-brand-text-muted sm:mt-4 sm:text-lg">
            À {SITE_CITY} : décrivez un besoin ou un produit. Fika recherche, vérifie et coordonne la solution.
          </p>
        </motion.section>

        <motion.section className="mt-6 grid items-stretch gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-[1.02fr_0.98fr] lg:gap-6" {...reveal(0.05)}>
          <div className="entry-hero-image relative aspect-[1.12/1] overflow-hidden rounded-[1.6rem] border border-brand-border bg-[#F1E7DC] shadow-premium sm:aspect-[1.25/1] lg:aspect-[0.91/1]">
            <img
              src="/fika-home-photo.webp"
              alt="Une cliente souriante consulte son téléphone et découvre Fika."
              width="360"
              height="396"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-[50%_34%]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:grid-rows-2 lg:gap-4">
            <EntryCard
              kind="market"
              title="Boutique"
              description="Un produit ? Fika le recherche et le vérifie pour vous."
              href="/boutique"
            />
            <EntryCard
              kind="services"
              title="Services"
              description="Un besoin ? Fika trouve et coordonne la bonne personne."
              href="/services"
            />
          </div>
        </motion.section>

        <motion.section className="mt-4 flex flex-col gap-3 rounded-[1.5rem] bg-brand-accent px-5 py-4 text-white sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5" {...reveal(0.1)}>
          <div className="flex items-center gap-3">
            <MapPin className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-white/85 sm:text-sm">Disponible uniquement à</p>
              <p className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{SITE_CITY}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-white/80 sm:text-xs">Adamaoua · Cameroun</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-brand-accent sm:self-center">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Prix validé avant tout
          </div>
        </motion.section>
      </main>

      <motion.footer className="bg-brand-text text-white" {...reveal(0.14)}>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5 lg:px-10">
          <div>
            <a href={`tel:${WHATSAPP_PHONE_E164}`} className="rounded text-lg font-extrabold tracking-tight hover:text-brand-contrast-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              {PHONE_LABEL}
            </a>
            <p className="mt-0.5 text-xs text-white/65">{SITE_DOMAIN}</p>
          </div>
          <a
            href={getWALink('Bonjour Fika 👋, je souhaite être accompagné.')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWaClick({ context: 'home-hero' })}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-extrabold text-[#10351E] shadow-sm transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <MessageCircle className="h-5 w-5 fill-current" aria-hidden="true" />
            WhatsApp
          </a>
        </div>
      </motion.footer>
    </div>
  );
}
