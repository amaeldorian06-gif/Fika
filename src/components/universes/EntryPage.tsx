import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, MessageCircle, PackageSearch, Store, Wrench } from 'lucide-react';
import { COPY_NAV } from '../../lib/copy/navigation';
import { getWALink } from '../../lib/whatsapp';
import { trackWaClick } from '../../lib/tracking';
import { Link, navigate, useRoute } from '../../router';
import { NeedIllustration } from '../NeedIllustration';

/**
 * Page d'entrée Fika — une marque, deux univers d'importance égale.
 * Rôle : orienter selon l'intention, pas tout afficher. Les ancres héritées
 * de l'ancienne accueil (#services, #comment-ca-marche, #faq) redirigent
 * vers l'univers Services qui porte désormais ce contenu.
 */
export function EntryPage() {
  const { anchor } = useRoute();
  const reduced = useReducedMotion();

  useEffect(() => {
    // Compatibilité : ces sections vivent maintenant sur /services.
    if (anchor && ['services', 'comment-ca-marche', 'faq'].includes(anchor)) {
      navigate(`/services#${anchor}`);
    }
  }, [anchor]);

  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <div className="max-w-6xl mx-auto px-5">
      {/* Présentation de marque */}
      <motion.section className="pt-10 sm:pt-16 pb-12 sm:pb-16 text-center" {...reveal(0)}>
        <p className="text-xs uppercase tracking-widest text-brand-accent font-bold mb-5">{COPY_NAV.entry.eyebrow}</p>
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
          {COPY_NAV.entry.title}
          <br />
          <span className="font-serif italic text-brand-accent">{COPY_NAV.entry.titleAccent}</span>
        </h1>
        <p className="text-brand-text-muted text-lg mt-6 max-w-2xl mx-auto leading-relaxed">{COPY_NAV.entry.subtitle}</p>
      </motion.section>

      {/* Deux entrées d'univers, importance visuelle égale */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 pb-6">
        <motion.section
          aria-labelledby="entry-services"
          className="group flex flex-col rounded-3xl border border-brand-border bg-white p-6 sm:p-8 hover:border-brand-accent focus-within:border-brand-accent transition-colors"
          {...reveal(0.1)}
        >
          <div className="flex items-center justify-between gap-4 mb-6">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">
              <Wrench className="w-4 h-4 text-brand-accent" aria-hidden="true" />
              Fika Services
            </span>
            <span aria-hidden="true" className="text-brand-text-muted/50 font-heading font-bold text-sm">01</span>
          </div>
          <div className="max-w-[285px] w-full mx-auto mb-7 self-center">
            <NeedIllustration withAnswer={false} />
          </div>
          <h2 id="entry-services" className="font-heading text-2xl sm:text-3xl font-bold">{COPY_NAV.entry.services.title}</h2>
          <p className="text-brand-text-muted mt-3 leading-relaxed flex-1">{COPY_NAV.entry.services.text}</p>
          <Link
            to="/services"
            className="mt-7 inline-flex items-center justify-center gap-2 h-14 py-3.5 px-6 rounded-full bg-brand-text text-white font-bold hover:bg-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            {COPY_NAV.entry.services.cta}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
          </Link>
        </motion.section>

        <motion.section
          aria-labelledby="entry-market"
          className="group flex flex-col rounded-3xl border border-brand-border bg-white p-6 sm:p-8 hover:border-brand-accent focus-within:border-brand-accent transition-colors"
          {...reveal(0.2)}
        >
          <div className="flex items-center justify-between gap-4 mb-6">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">
              <Store className="w-4 h-4 text-brand-accent" aria-hidden="true" />
              Fika Market
            </span>
            <span aria-hidden="true" className="text-brand-text-muted/50 font-heading font-bold text-sm">02</span>
          </div>
          <div className="flex items-center justify-center gap-3 mb-6 self-center" aria-hidden="true">
            <span className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-brand-bg border border-brand-border flex items-center justify-center">
              <Store className="w-9 h-9 text-brand-accent" />
            </span>
            <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center -ml-6 rotate-6">
              <PackageSearch className="w-6 h-6 text-brand-accent" />
            </span>
          </div>
          <h2 id="entry-market" className="font-heading text-2xl sm:text-3xl font-bold">{COPY_NAV.entry.market.title}</h2>
          <p className="text-brand-text-muted mt-3 leading-relaxed flex-1">{COPY_NAV.entry.market.text}</p>
          <Link
            to="/boutique"
            className="mt-7 inline-flex items-center justify-center gap-2 h-14 py-3.5 px-6 rounded-full bg-brand-text text-white font-bold hover:bg-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            {COPY_NAV.entry.market.cta}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
          </Link>
        </motion.section>
      </div>

      {/* Raccourcis fréquents */}
      <motion.div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-6 text-sm" {...reveal(0.3)}>
        <Link to="/demande" className="font-semibold text-brand-text underline-offset-4 hover:text-brand-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded">
          {COPY_NAV.entry.shortcuts.describe} →
        </Link>
        <Link to="/boutique/suivi" className="font-semibold text-brand-text underline-offset-4 hover:text-brand-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded">
          {COPY_NAV.entry.shortcuts.track} →
        </Link>
        <a
          href={getWALink('Bonjour Fika 👋, j’ai une question.')}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWaClick({ context: 'home-hero' })}
          className="inline-flex items-center gap-1.5 font-semibold text-brand-wa hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          Parler à Fika
        </a>
      </motion.div>

      {/* Garanties communes */}
      <motion.section className="border-t border-brand-border py-10 mb-4" {...reveal(0.4)}>
        <ul className="grid sm:grid-cols-3 gap-4 text-sm text-brand-text-muted">
          {COPY_NAV.entry.trust.map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <span aria-hidden="true" className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0" />
              {t}
            </li>
          ))}
        </ul>
      </motion.section>
    </div>
  );
}
