import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, MessageCircle,
  PackageCheck, Quote, Truck, MapPin, UserSearch, X, Image as ImageIcon, Star,
} from 'lucide-react';
import { getWALink } from '../lib/whatsapp';
import { trackWaClick } from '../lib/tracking';
import { DELIVERY_PROMISE, SITE_CITY } from '../lib/site';
import { computePackageSavings, formatPriceFCFA } from '../lib/pricing';
import {
  getCategories, getPackages, getPopularServices, getServiceById, getServices,
} from '../lib/catalog';
import { Section, PricingCard } from './ds';
import { fetchPublicPortfolio, fetchPublicTestimonials, type PublicPortfolioItem } from '../lib/proof-api';
import type { PublicTestimonial } from '../lib/proof';
import { PROCESS_STEPS, FAQS, PORTFOLIO, TESTIMONIALS } from '../lib/data';
import { Button, UniverseIcon } from './ui';
import { Link, navigate } from '../router';
import { ServiceSearch } from './ServiceSearch';

/* ------------------------------- Preuve sociale -------------------------- */

function SocialProof() {
  const [reviews, setReviews] = useState<PublicTestimonial[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPublicTestimonials().then((list) => { if (alive) setReviews(list); });
    return () => { alive = false; };
  }, []);

  // Vraie preuve uniquement : masquée tant qu'il n'y a pas au moins 3 avis vérifiés.
  if (!reviews || reviews.length < 3) return null;

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
    >
      <span className="inline-flex items-center gap-2 bg-brand-surface border border-brand-border px-4 py-2 rounded-full shadow-premium">
        <span className="flex" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`w-4 h-4 ${n <= Math.round(avg) ? 'fill-brand-accent text-brand-accent' : 'text-brand-border-dark'}`}
            />
          ))}
        </span>
        <span className="text-sm font-bold text-brand-text">{avg.toFixed(1)}/5</span>
        <span className="text-sm text-brand-text-muted">· {reviews.length} avis vérifiés</span>
      </span>
    </motion.div>
  );
}

/* --------------------------------- Hero ---------------------------------- */

function Hero() {
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const, delay },
  });

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
      <motion.h1
        {...fade(0)}
        className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-brand-text mb-6 leading-[1.08]"
      >
        Vous avez besoin de quelque chose ?<br />
        <span className="text-brand-accent font-serif italic font-medium">Nous nous occupons du reste.</span>
      </motion.h1>

      <motion.p {...fade(0.1)} className="text-lg md:text-xl text-brand-text-muted mb-10 max-w-xl mx-auto leading-relaxed">
        Vous décrivez, nous orchestrons, vous recevez.
      </motion.p>

      <motion.div {...fade(0.2)} className="mb-10">
        <ServiceSearch />
      </motion.div>

      <motion.div {...fade(0.3)} className="flex flex-col items-center gap-6">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Button asChild size="lg" variant="whatsapp" className="w-full sm:w-auto rounded-full px-8">
            <a
              href={getWALink(`Bonjour Fika 👋,\n\nJ'ai besoin d'aide pour :\n\nVille / quartier :\nDélai souhaité :\n\nPouvez-vous m'indiquer si vous pouvez m'aider ?`)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWaClick({ context: 'home-hero' })}
            >
              Parler à Fika <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>
          <Button size="lg" variant="secondary" className="w-full sm:w-auto rounded-full px-8" onClick={() => navigate('/services')}>
            Voir le catalogue
          </Button>
        </div>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-brand-text-muted font-medium">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-brand-accent" /> Prix transparents</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-brand-accent" /> Experts sélectionnés</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-brand-accent" /> Livraison gratuite</span>
        </div>

        <SocialProof />
      </motion.div>
    </section>
  );
}

/* ------------------------------- Univers --------------------------------- */

function UniversePricingCards() {
  const universes = getCategories();
  const services = getServices();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {universes.map((cat, idx) => {
        const catServices = services.filter((s) => s.categoryId === cat.id);
        const prices = catServices.map((s) => s.startingPrice).filter((p): p is number => p != null);
        const min = prices.length ? Math.min(...prices) : null;
        const examples = (cat.examples ?? '').split('·').map((e) => e.trim()).filter(Boolean).slice(0, 3);

        return (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: idx * 0.05 }}
          >
            <Link
              to={`/univers/${cat.slug}`}
              className="group block h-full p-7 rounded-card bg-brand-surface border border-brand-border hover:shadow-premium-hover hover:border-brand-border-dark transition-all active:scale-[0.99]"
            >
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-5 ${cat.color}`}>
                <UniverseIcon icon={cat.icon} className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-3 text-brand-text">{cat.title}</h3>
              <ul className="space-y-1.5 mb-6">
                {examples.map((ex, i) => (
                  <li key={i} className="text-sm text-brand-text-muted flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-brand-accent shrink-0" aria-hidden="true" />
                    {ex}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-4 border-t border-brand-border">
                <span className="text-sm font-bold text-brand-text">
                  {min != null ? `dès ${formatPriceFCFA(min)}` : 'Sur devis'}
                </span>
                <span className="flex items-center text-sm font-semibold text-brand-accent gap-2 group-hover:gap-3 transition-all">
                  Voir <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Packs (sobre) ----------------------------- */

function PacksRow() {
  const packs = getPackages();

  return (
    <div className="mt-14">
      <p className="text-center text-sm font-heading font-bold uppercase tracking-[0.18em] text-brand-text-muted mb-8">
        Ou plusieurs choses à la fois — nos packs à prix optimisé
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packs.map((pkg) => {
          const savings = computePackageSavings(pkg);
          return (
            <div
              key={pkg.id}
              className="p-7 rounded-card bg-brand-bg border border-brand-border flex flex-col gap-5 hover:shadow-premium transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading font-bold text-lg text-brand-text">{pkg.title}</h3>
                  <p className="text-sm text-brand-text-muted mt-1">{pkg.description}</p>
                </div>
                {savings > 0 && (
                  <span className="shrink-0 text-[11px] font-bold text-brand-wa bg-brand-wa/10 px-2.5 py-1 rounded-full whitespace-nowrap">
                    −{formatPriceFCFA(savings)}
                  </span>
                )}
              </div>
              <ul className="space-y-2 text-sm text-brand-text-muted flex-1">
                {pkg.services.map((line, i) => {
                  const s = getServiceById(line.serviceId);
                  return (
                    <li key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-brand-wa shrink-0" />
                      {line.customName ?? (s ? s.name : 'Service inclus')}
                      {line.quantity > 1 ? ` ×${line.quantity}` : ''}
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between pt-4 border-t border-brand-border">
                <span className="font-heading text-2xl font-extrabold text-brand-accent">{formatPriceFCFA(pkg.price)}</span>
                <a
                  href={getWALink(`Bonjour Fika 👋, je souhaite commander le pack : ${pkg.title}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWaClick({ context: 'home-pack', campaign: pkg.slug })}
                  className="inline-flex items-center gap-2 text-sm font-bold text-brand-text hover:text-brand-accent transition-colors"
                >
                  Commander <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- Process -------------------------------- */

const PROCESS_ICONS = [MessageCircle, UserSearch, ClipboardCheck, PackageCheck] as const;

/* --------------------- Plan animé d'exécution (avant catalogue) ------------- */

const FLOW_NODES = [
  { id: 'vous', label: 'Vous', caption: 'Votre besoin', Icon: MessageCircle },
  { id: 'fika', label: 'Fika', caption: 'Qualification', Icon: UserSearch },
  { id: 'expert', label: 'Expert', caption: 'Exécution', Icon: ClipboardCheck },
  { id: 'livre', label: 'Livré', caption: 'Résultat', Icon: PackageCheck },
] as const;

/**
 * Schéma d'orchestration animé : la demande circule le long du fil, chaque
 * nœud s'allume à son tour. Boucle douce, neutralisée si l'utilisateur
 * demande la réduction des animations.
 */
function ExecutionFlow() {
  const [active, setActive] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setAnimate(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % (FLOW_NODES.length + 1));
    }, 1400);
    return () => clearInterval(timer);
  }, [animate]);

  const total = FLOW_NODES.length;
  const progress = animate ? Math.min(active, total - 1) / (total - 1) : 1;

  return (
    <Section
      eyebrow="Le circuit Fika"
      title="Une demande. Un circuit maîtrisé."
      description="Vous n'avez pas à chercher qui peut le faire : votre demande suit un chemin balisé, du premier message jusqu'à la livraison."
      tone="surface"
      compact
    >
      <div className="max-w-4xl mx-auto">
        <div className="relative px-2 sm:px-6 py-10">
          {/* Rail de fond + progression animée (desktop & tablette) */}
          <div className="hidden sm:block absolute left-[12%] right-[12%] top-[4.75rem] h-[3px] rounded-full bg-brand-border" aria-hidden="true">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-accent/70 to-brand-accent origin-left"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: progress }}
              transition={{ duration: animate ? 1.2 : 0, ease: [0.16, 1, 0.3, 1] }}
            />
            {/* Jeton en circulation */}
            {animate && (
              <motion.span
                className="absolute -top-[7px] w-4 h-4 rounded-full bg-brand-accent shadow-[0_0_0_4px_rgba(180,74,20,0.16)]"
                initial={{ left: '0%' }}
                animate={{ left: `${progress * 100}%` }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ marginLeft: '-8px' }}
              />
            )}
          </div>

          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-y-10 gap-x-4 relative" aria-label="Circuit de traitement d'une demande">
            {FLOW_NODES.map((node, idx) => {
              const reached = !animate || idx <= active;
              const isCurrent = animate && idx === active;
              return (
                <li key={node.id} className="flex flex-col items-center text-center">
                  {/* Halo pulsant sur le nœud courant */}
                  <div className="relative mb-4">
                    {isCurrent && (
                      <motion.span
                        className="absolute inset-0 rounded-full bg-brand-accent/20"
                        initial={{ scale: 1, opacity: 0.7 }}
                        animate={{ scale: 1.7, opacity: 0 }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                        aria-hidden="true"
                      />
                    )}
                    <motion.div
                      animate={{ scale: isCurrent ? 1.08 : 1 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${
                        reached
                          ? 'bg-brand-accent text-white border-brand-accent shadow-premium'
                          : 'bg-brand-bg text-brand-border-dark border-brand-border'
                      }`}
                    >
                      <node.Icon className="w-6 h-6" />
                    </motion.div>
                    <span
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-[10px] font-heading font-extrabold flex items-center justify-center border-2 border-brand-surface transition-colors duration-500 ${
                        reached ? 'bg-brand-text text-white' : 'bg-brand-border text-brand-text-muted'
                      }`}
                      aria-hidden="true"
                    >
                      {idx + 1}
                    </span>
                  </div>

                  <p className={`font-heading font-bold text-sm sm:text-base transition-colors duration-500 ${reached ? 'text-brand-text' : 'text-brand-text-muted'}`}>
                    {node.label}
                  </p>
                  <p className="text-xs text-brand-text-muted mt-0.5">{node.caption}</p>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="text-center text-brand-text-muted font-serif italic text-lg mt-2 max-w-2xl mx-auto">
          Vous ne parlez qu&apos;à Fika, du début à la fin.
        </p>
      </div>
    </Section>
  );
}

function ProcessSection() {
  const stepCount = PROCESS_STEPS.length;

  return (
    <Section
      id="a-propos"
      eyebrow="Comment ça marche"
      title="Vous ne gérez rien."
      description="Notre mission est de simplifier l'accès aux compétences. Nous sommes votre unique intermédiaire."
    >
      {/* Circuit de traitement : cercles reliés par une ligne
          (figes, figures) — filement horizontal mobile, statique dès lg */}
      <div className="relative -mx-4 sm:mx-0">
        {/* Ligne de liaison continue derrière les cercles (lg+) */}
        <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px" aria-hidden="true">
          <div className="relative h-full">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-border-dark via-brand-border-dark to-brand-accent" />
            {/* Repères losanges aux points de jonction */}
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute top-1/2 rotate-45 w-2 h-2 bg-brand-surface border-2 border-brand-border-light"
                style={{ left: `calc(${((i + 0.5) / (stepCount - 1)) * 100}% - 4px)`, borderColor: 'var(--color-brand-border-dark)' }}
              />
            ))}
          </div>
        </div>

        <ol
          className="relative flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 pb-5 sm:pb-0 sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 lg:gap-6"
          aria-label="Les 4 étapes du processus Fika"
        >
          {PROCESS_STEPS.map((step, idx) => {
            const Icon = PROCESS_ICONS[idx];
            const isFinal = idx === stepCount - 1;
            return (
              <motion.li
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: idx * 0.06 }}
                className="relative shrink-0 snap-start w-[75%] sm:w-auto text-left"
              >
                {/* Segment pointillé vers l'étape suivante (mobile) */}
                {!isFinal && (
                  <span
                    aria-hidden="true"
                    className="lg:hidden absolute top-8 left-[4.5rem] w-[calc(95%-2rem)] border-t-2 border-dashed border-brand-border-dark/60"
                  />
                )}

                {/* Cercle d'étape : icône + pastille numérotée */}
                <div className="relative z-10 inline-flex mb-6">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center shadow-premium ${
                      isFinal
                        ? 'bg-brand-accent text-white ring-4 ring-brand-accent/20'
                        : 'bg-brand-surface border-2 text-brand-accent'
                    }`}
                    style={isFinal ? undefined : { borderColor: 'var(--color-brand-border)' }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-brand-text text-white text-[10px] font-heading font-extrabold flex items-center justify-center border-2 border-brand-bg">
                    {step.id}
                  </span>
                </div>

                <p className="text-xs font-heading font-bold uppercase tracking-widest text-brand-accent mb-2">Étape {step.id}</p>
                <h3 className="font-heading font-bold text-xl mb-2.5 text-brand-text">{step.title}</h3>
                <p className="text-brand-text-muted text-sm leading-relaxed">{step.desc}</p>
              </motion.li>
            );
          })}
        </ol>

        {/* Indicateur de filement (mobile uniquement) */}
        <div className="sm:hidden flex justify-center gap-1.5 pt-1" aria-hidden="true">
          {PROCESS_STEPS.map((s) => (
            <span key={s.id} className="w-1.5 h-1.5 rounded-full bg-brand-border-dark" />
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------- PortfolioSection --------------------------- */

function PortfolioSection() {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [published, setPublished] = useState<PublicPortfolioItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPublicPortfolio().then((list) => { if (alive) setPublished(list); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!lightboxImage) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImage(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [lightboxImage]);

  const isDemo = !published || published.length === 0;
  const items = isDemo
    ? PORTFOLIO
    : published.map((p) => ({ title: p.title, category: p.category, image: p.image }));

  return (
    <Section
      id="realisations"
      eyebrow="Réalisations"
      title="Le résultat parle pour nous."
      description="La qualité d'exécution que vous êtes en droit d'attendre."
      tone="surface"
    >
      {isDemo && (
        <p className="-mt-8 mb-10 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-text-muted bg-brand-bg border border-brand-border px-3 py-1.5 rounded-full">
            Exemples · nos premières réalisations arrivent
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: idx * 0.05 }}
          >
            {item.image ? (
              <button
                type="button"
                onClick={() => setLightboxImage(item.image ?? null)}
                aria-label={`Agrandir la réalisation : ${item.title ?? ''}`}
                className="group relative block w-full aspect-[4/5] rounded-card overflow-hidden bg-brand-surface border border-brand-border cursor-pointer shadow-premium hover:shadow-premium-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                {!loadedImages[item.image] && <div className="absolute inset-0 bg-brand-border animate-pulse" />}
                <img
                  src={item.image}
                  alt={item.title ?? ''}
                  width={600}
                  height={750}
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 ${loadedImages[item.image] ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setLoadedImages((prev) => ({ ...prev, [item.image as string]: true }))}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6 text-left">
                  <span className="text-brand-accent text-xs font-bold uppercase tracking-wider mb-2 block">{item.category}</span>
                  <h3 className="text-white font-heading font-bold text-xl">{item.title}</h3>
                </div>
              </button>
            ) : (
              <div className="relative block w-full aspect-[4/5] rounded-card overflow-hidden bg-brand-surface border border-brand-border shadow-premium">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-[repeating-linear-gradient(135deg,var(--color-brand-bg)_0px,var(--color-brand-bg)_12px,var(--color-brand-surface)_12px,var(--color-brand-surface)_24px)]">
                  <div className="w-14 h-14 rounded-2xl bg-brand-bg border border-dashed border-brand-border-dark flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-brand-border-dark" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-border-dark">Visuel en attente</p>
                  <div>
                    <span className="text-brand-accent text-xs font-bold uppercase tracking-wider mb-1 block">{item.category}</span>
                    <h3 className="text-brand-text font-heading font-bold text-lg leading-snug">{item.title}</h3>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Aperçu de la réalisation"
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-10"
            onClick={() => setLightboxImage(null)}
          >
            <button
              autoFocus
              type="button"
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              onClick={() => setLightboxImage(null)}
              aria-label="Fermer l'aperçu"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              src={lightboxImage}
              alt="Réalisation Fika en grand format"
              className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}

/* --------------------------- TestimonialsSection -------------------------- */

function TestimonialsSection() {
  const [current, setCurrent] = useState(0);
  const [verified, setVerified] = useState<PublicTestimonial[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPublicTestimonials().then((list) => { if (alive) setVerified(list); });
    return () => { alive = false; };
  }, []);

  const isDemo = !verified || verified.length === 0;
  const entries = isDemo
    ? TESTIMONIALS.map((t, i) => ({ id: `demo-${i}`, name: t.name ?? '', content: t.content ?? '', role: t.role ?? null }))
    : verified.map((v) => ({ id: v.id, name: v.name, content: v.content, role: v.serviceName }));

  useEffect(() => { setCurrent(0); }, [isDemo]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % entries.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [entries.length]);

  const t = entries[Math.min(current, entries.length - 1)];

  return (
    <Section
      eyebrow="Témoignages"
      title="Ce que disent nos clients"
      description="Des expériences réelles. Des professionnels satisfaits."
    >
      {isDemo && (
        <p className="-mt-8 mb-10 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-text-muted bg-brand-bg border border-brand-border px-3 py-1.5 rounded-full">
            Exemples · nos premiers avis vérifiés arrivent
          </span>
        </p>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -20, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="bg-brand-bg p-8 md:p-14 rounded-card border border-brand-border text-center shadow-premium relative"
            >
              <Quote className="w-12 h-12 text-brand-border-dark absolute top-8 left-8 opacity-50" aria-hidden="true" />
              <p className="text-xl md:text-2xl text-brand-text font-serif italic mb-10 relative z-10 leading-relaxed">
                &ldquo;{t.content}&rdquo;
              </p>
              <div className="flex flex-col items-center gap-1">
                <h3 className="font-heading font-bold text-brand-text text-lg">{t.name}</h3>
                {t.role && <span className="text-sm font-medium text-brand-text-muted">{t.role}</span>}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            type="button"
            onClick={() => setCurrent((c) => (c - 1 + entries.length) % entries.length)}
            className="w-11 h-11 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center text-brand-text hover:border-brand-border-dark hover:shadow-premium transition-all active:scale-95"
            aria-label="Témoignage précédent"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2" role="tablist" aria-label="Témoignages">
            {entries.map((entry, i) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCurrent(i)}
                role="tab"
                aria-selected={i === current}
                aria-label={`Témoignage ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === current ? 'w-8 bg-brand-accent' : 'w-2 bg-brand-border-dark hover:bg-brand-text-muted'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCurrent((c) => (c + 1) % entries.length)}
            className="w-11 h-11 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center text-brand-text hover:border-brand-border-dark hover:shadow-premium transition-all active:scale-95"
            aria-label="Témoignage suivant"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------- HomePage ------------------------------- */

export function HomePage() {
  const popular = getPopularServices(4);

  return (
    <div className="flex flex-col">
      <Hero />

      {/* Plan animé d'exécution : comprendre le circuit AVANT de choisir */}
      <ExecutionFlow />

      {/* Les 7 univers — jusqu'au prix d'entrée */}
      <Section
        id="services"
        eyebrow="Le catalogue"
        title="Ce que vous pouvez nous confier"
        description="7 grandes portes pour répondre à tous vos besoins, avec la même exigence de qualité."
      >
        <UniversePricingCards />
      </Section>

      {/* Services populaires en cartes de prix */}
      <Section
        eyebrow="Les plus demandés"
        title="Commandez en un message"
        description="Prix annoncés avant lancement, information nécessaire listée, expert sélectionné pour vous."
        tone="surface"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {popular.map((service, idx) => (
            <PricingCard key={service.id} service={service} idx={idx} featured={idx === 0} />
          ))}
        </div>
        <PacksRow />
      </Section>

      {/* Réassurance unique : la promesse ville */}
      <Section tone="dark" className="text-center">
        <div className="max-w-4xl mx-auto">
          <div className="w-20 h-20 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10 backdrop-blur-sm">
            <Truck className="w-10 h-10 text-brand-accent" />
          </div>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-8 tracking-tight">Livraison gratuite sur toute commande</h2>
          <p className="text-xl md:text-2xl text-brand-contrast-soft mb-10 max-w-2xl mx-auto font-serif italic">
            Vous commandez. Nous nous occupons de la livraison.
          </p>
          <p className="text-sm text-brand-contrast-muted font-medium tracking-wide uppercase">
            {DELIVERY_PROMISE}, sans exception.
          </p>
        </div>
      </Section>

      <ProcessSection />
      <PortfolioSection />
      <TestimonialsSection />

      {/* FAQ */}
      <Section id="faq" eyebrow="Questions fréquentes" title="On répond à tout" compact>
        <div className="max-w-3xl mx-auto space-y-4">
          {FAQS.map((faq, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
              className="p-6 md:p-8 rounded-card bg-brand-surface border border-brand-border"
            >
              <h3 className="font-heading font-bold text-lg mb-3 text-brand-text">{faq.q}</h3>
              <p className="text-brand-text-muted text-sm leading-relaxed">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* CTA final — action unique, demande hors catalogue fusionnée */}
      <Section tone="surface" className="text-center !py-10 md:!py-12" compact>
        <h2 className="font-heading text-3xl md:text-4xl font-bold mb-3 tracking-tight text-brand-text">Quelque chose à faire ?</h2>
        <p className="text-base md:text-lg text-brand-text-muted mb-6 max-w-xl mx-auto">
          Ne perdez pas votre temps à chercher qui peut s&apos;en charger. Parlez-nous.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="whatsapp" className="rounded-full px-7">
            <a
              href={getWALink('Bonjour Fika 👋, je souhaite parler à un conseiller.')}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWaClick({ context: 'home-final' })}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Nous contacter sur WhatsApp
            </a>
          </Button>
          <Button variant="secondary" className="rounded-full px-7" onClick={() => navigate('/demande')}>
            Décrire mon besoin
          </Button>
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-brand-text-muted text-xs font-medium uppercase tracking-wider">
          <MapPin className="w-4 h-4 text-brand-accent" /> {SITE_CITY} · Services digitaux & pratiques
        </p>
      </Section>
    </div>
  );
}
