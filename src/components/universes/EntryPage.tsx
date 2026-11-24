import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Headphones, MapPin, MessageCircle, ShieldCheck, ShoppingBag, Store, Truck, Wrench, Zap } from 'lucide-react';
import { getWALink } from '../../lib/whatsapp';
import { trackWaClick, trackFunnelStep } from '../../lib/tracking';
import { Link, navigate, useRoute } from '../../router';
import { NeedIllustration } from '../NeedIllustration';
import { BrandLogo } from '../BrandLogo';
import { SITE_CITY, SITE_DOMAIN, WHATSAPP_PHONE_E164 } from '../../lib/site';

/**
 * Page d'entrée Fika — présentation courte, deux parcours et une seule action
 * de contact. Les catalogues et contenus détaillés restent dans leurs univers.
 */
const PHONE_LABEL = '+237 671 164 936';

function EntryCard({ kind, title, description, href, action, requestHref, requestAction, note }: {
  kind: 'market' | 'services';
  title: string;
  description: string;
  href: string;
  action: string;
  requestHref: string;
  requestAction: string;
  note: string;
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
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-accent">
          {action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-3">
        <p className="text-xs font-medium text-brand-text-muted">{note}</p>
        <Link to={requestHref} onClick={() => trackFunnelStep('PATH_SELECTED', { universe: kind })} className="shrink-0 text-xs font-extrabold text-brand-text underline decoration-brand-accent/50 underline-offset-4 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded">
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
    initial: { opacity: 0, y: reduced ? 0 : 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.35, delay: reduced ? 0 : delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <div className="min-h-[calc(100vh-76px)] bg-brand-bg">
      <main className="mx-auto max-w-6xl px-5 pb-7 pt-8 sm:px-8 sm:pb-9 sm:pt-10 lg:px-10">
        {/* Une promesse centrale, sans détour. */}
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

        {/* Les deux parcours sont immédiatement visibles. */}
        <motion.section className="mt-7 grid items-stretch gap-4 sm:mt-9 lg:grid-cols-[1.02fr_0.98fr] lg:gap-6" {...reveal(0.06)}>
          <div className="flex min-h-[330px] items-center justify-center overflow-hidden rounded-[1.7rem] border border-brand-border bg-[#F1E7DC] p-3 sm:min-h-[420px] sm:p-5">
            <div className="w-full max-w-[380px]">
              <NeedIllustration withAnswer={false} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-rows-2">
            <EntryCard
              kind="market"
              title="Boutique"
              description="Un produit ? Fika le recherche et vérifie sa disponibilité pour vous."
              href="/boutique"
              action="Explorer Fika Market"
              requestHref="/demande-produit"
              requestAction="Demander un produit"
              note="Prix final confirmé avant tout paiement."
            />
            <EntryCard
              kind="services"
              title="Services"
              description="Un besoin ? Fika trouve et coordonne la bonne personne."
              href="/services"
              action="Explorer les services"
              requestHref="/demande"
              requestAction="Décrire mon besoin"
              note="Prix validé avec vous avant toute intervention."
            />
          </div>
        </motion.section>

        {/* Territoire réel : une seule ville, aucune promesse d'expansion prématurée. */}
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

        {/* Quatre bénéfices lisibles, sans transformer l'accueil en catalogue. */}
        <motion.section className="mt-7 sm:mt-8" {...reveal(0.14)}>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-brand-accent/45" />
            <h2 className="font-heading text-center text-base font-extrabold text-brand-text sm:text-xl">Avec Fika, profitez de :</h2>
            <span className="h-px flex-1 bg-brand-accent/45" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {[
              { icon: Zap, text: 'Des services variés et réactifs' },
              { icon: ShoppingBag, text: 'Une boutique en ligne moderne' },
              { icon: ShieldCheck, text: 'Des achats accompagnés en confiance' },
              { icon: Headphones, text: 'Une assistance disponible' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex min-h-[112px] flex-col items-center justify-center rounded-2xl border border-brand-border bg-white px-3 py-4 text-center shadow-premium sm:min-h-[124px] sm:px-4">
                <Icon className="mb-2 h-7 w-7 text-brand-accent sm:h-8 sm:w-8" aria-hidden="true" />
                <p className="max-w-[18ch] text-xs font-semibold leading-snug text-brand-text sm:text-sm">{text}</p>
              </div>
            ))}
          </div>
        </motion.section>
      </main>

      {/* Un seul point de contact, visible et utilisable. */}
      <motion.footer className="bg-brand-text text-white" {...reveal(0.18)}>
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
            onClick={() => trackWaClick({ context: 'entry-footer' })}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-extrabold text-[#10351E] shadow-sm transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <MessageCircle className="h-5 w-5 fill-current" aria-hidden="true" />
            WhatsApp · Nous contacter
          </a>
          <span className="hidden items-center gap-2 text-xs font-semibold text-white/75 lg:inline-flex">
            <Truck className="h-4 w-4" aria-hidden="true" />
            Plus proche de vous, plus utile pour vous.
          </span>
        </div>
      </motion.footer>
    </div>
  );
}
