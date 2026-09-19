import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, CheckCircle2, MessageCircle, Truck, MapPin, UserSearch,
  Wrench, Zap, Hammer, Smartphone, ShieldCheck,
  UserCheck, HelpCircle, Send, Star, ClipboardCheck, PackageCheck,
  Sparkles,
} from 'lucide-react';
import { getWALink } from '../lib/whatsapp';
import { trackWaClick } from '../lib/tracking';
import { DELIVERY_PROMISE, SITE_CITY } from '../lib/site';
import { categoryPriceLabel, computePackageSavings, displayPrice, formatPriceFCFA, getCityPricing } from '../lib/pricing';
import {
  getCategories, getPackages, getServiceById, getServiceBySlug, getServices,
} from '../lib/catalog';
import { Section } from './ds';
import { fetchPublicTestimonials } from '../lib/proof-api';
import type { PublicTestimonial } from '../lib/proof';
import { FAQS } from '../lib/data';
import { Button, UniverseIcon } from './ui';
import { Link, navigate } from '../router';
import { NeedIllustration } from './NeedIllustration';

/* ------------------------------- Preuve sociale -------------------------- */

function SocialProof() {
  const [reviews, setReviews] = useState<PublicTestimonial[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPublicTestimonials().then((list) => { if (alive) setReviews(list); });
    return () => { alive = false; };
  }, []);

  // Vraie preuve uniquement : masquée tant qu'il n'y a pas au moins 3 avis vérifiés en base
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

/* -------------------------------- 1. Hero -------------------------------- */

function Hero() {
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const, delay },
  });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:pt-16 grid lg:grid-cols-[1.25fr_1fr] items-center gap-6 lg:gap-12">
      <div className="text-center lg:text-left">
      <motion.div
        {...fade(0)}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold tracking-wide uppercase mb-6"
      >
        <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
        Coordination de services à Ngaoundéré
      </motion.div>

      <motion.h1
        {...fade(0.05)}
        className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-6xl font-extrabold tracking-tight text-brand-text mb-6 leading-[1.08]"
      >
        Un besoin. Une demande.<br />
        <span className="text-brand-accent font-serif italic font-medium">Fika s&apos;occupe du reste.</span>
      </motion.h1>

      <motion.p
        {...fade(0.1)}
        className="text-lg md:text-xl text-brand-text-muted mb-8 max-w-2xl mx-auto leading-relaxed"
      >
        Plomberie, électricité, travaux, réparation, transport et services utiles du quotidien. Décrivez votre besoin, nous trouvons et coordonnons la bonne personne.
      </motion.p>

      {/* Actions principales : Décrire mon besoin + Voir les services */}
      <motion.div {...fade(0.15)} className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-6">
        <Button
          size="lg"
          variant="primary"
          className="w-full sm:w-auto rounded-full px-8 shadow-premium text-base font-semibold"
          onClick={() => navigate('/demande')}
        >
          Décrire mon besoin <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full sm:w-auto rounded-full px-8 text-base"
          onClick={() => navigate('/services')}
        >
          Voir les services
        </Button>
      </motion.div>

      {/* WhatsApp immédiatement visible */}
      <motion.div {...fade(0.2)} className="inline-flex items-center gap-2 mb-10">
        <a
          href={getWALink(
            `Bonjour Fika 👋,\n\nJ'ai un besoin à vous confier :\n\nVille / quartier :\n\nPouvez-vous m'aider ?`
          )}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWaClick({ context: 'home-hero' })}
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-brand-surface border border-brand-border hover:border-[#25D366]/40 hover:bg-[#25D366]/5 text-sm font-medium text-brand-text transition-all group shadow-sm"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#25D366]" />
          </span>
          <MessageCircle className="w-4 h-4 text-[#25D366]" />
          <span>Parler à Fika sur WhatsApp</span>
          <ArrowRight className="w-3.5 h-3.5 text-brand-text-muted group-hover:text-[#25D366] group-hover:translate-x-0.5 transition-all" />
        </a>
      </motion.div>

      <p className="text-sm text-brand-text-muted">Pas besoin de connaître le nom du métier. Décrivez simplement votre problème.</p>
      <motion.div {...fade(0.3)} className="mt-6">
        <SocialProof />
      </motion.div>
      </div>
      <NeedIllustration />
    </section>
  );
}

/* ----------------------- 2. Section Comment ça marche --------------------- */

const HOW_IT_WORKS_STEPS = [
  {
    num: '01',
    title: 'Vous nous dites ce dont vous avez besoin',
    desc: 'Un message WhatsApp, un appel ou le formulaire : décrivez simplement votre panne, vos travaux ou votre course sans jargon technique.',
    Icon: MessageCircle,
  },
  {
    num: '02',
    title: 'Nous trouvons et sélectionnons le bon professionnel',
    desc: 'Fika choisit dans son réseau l’artisan ou technicien adapté à votre problème et disponible à Ngaoundéré, puis le missionne et le suit.',
    Icon: UserSearch,
  },
  {
    num: '03',
    title: "Nous coordonnons l'intervention et contrôlons l'exécution",
    desc: 'Tarif convenu d’avance sans mauvaise surprise, planification du rendez-vous, suivi sur place et vérification de la conformité.',
    Icon: ClipboardCheck,
  },
  {
    num: '04',
    title: 'Vous validez le résultat',
    desc: "L'intervention est réalisée, vous contrôlez la qualité des travaux avec nous et votre problème est réglé en toute sérénité.",
    Icon: PackageCheck,
  },
];

function HowItWorksSection() {
  return (
    <Section
      id="comment-ca-marche"
      eyebrow="Le principe Fika"
      title="Comment ça marche"
      description="Une demande. Un intermédiaire unique responsable. Un problème réglé sans que vous ayez à courir après des ouvriers."
      tone="surface"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {HOW_IT_WORKS_STEPS.map((step, idx) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: idx * 0.08 }}
            className="p-7 rounded-card bg-brand-bg border border-brand-border relative flex flex-col justify-between shadow-premium hover:border-brand-border-dark transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-brand-surface border border-brand-border flex items-center justify-center text-brand-accent">
                  <step.Icon className="w-6 h-6" />
                </div>
                <span className="font-heading font-extrabold text-2xl text-brand-border-dark">
                  {step.num}
                </span>
              </div>
              <h3 className="font-heading font-bold text-lg text-brand-text mb-2.5 leading-snug">
                {step.title}
              </h3>
              <p className="text-sm text-brand-text-muted leading-relaxed">
                {step.desc}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-brand-border/60 flex items-center text-xs font-semibold text-brand-accent">
              <span>Étape {step.num}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Button
          size="lg"
          variant="primary"
          className="rounded-full px-8"
          onClick={() => navigate('/demande')}
        >
          Faire une demande maintenant <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </Section>
  );
}

/* ------------------- 3. Section Besoins les plus fréquents ----------------- */

interface CommonNeed {
  id: string;
  title: string;
  slug: string;
  categoryName: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge: string;
  preset: string;
}

/** Prix affiché sur une carte « besoin courant » : toujours celui du catalogue (source unique). */
function needPriceLabel(slug: string): string {
  const service = getServiceBySlug(slug);
  return service ? displayPrice(service, getCityPricing(service.id)) : 'Sur devis';
}

const COMMON_NEEDS: CommonNeed[] = [
  {
    id: 'plomberie',
    title: 'Fuite d’eau, canalisation bouchée, robinetterie',
    slug: 'intervention-plomberie',
    categoryName: 'Maison & Travaux',
    desc: 'Dépannage d’urgence sous évier, WC bouché, robinet qui fuit, soudure et raccordement de tuyauterie.',
    Icon: Wrench,
    badge: 'Plomberie',
    preset: "J'ai un problème de plomberie (fuite d'eau, canalisation bouchée ou robinetterie)",
  },
  {
    id: 'electricite',
    title: 'Panne électrique, court-circuit, installation de prises',
    slug: 'intervention-electricite',
    categoryName: 'Maison & Travaux',
    desc: 'Disjoncteur qui saute, coupure partielle, recherche de panne, raccordement tableau et prises.',
    Icon: Zap,
    badge: 'Électricité',
    preset: "J'ai une panne électrique (disjoncteur qui saute, court-circuit ou prises)",
  },
  {
    id: 'telephone',
    title: 'Écran de téléphone cassé, problème de charge, réparation',
    slug: 'reparation-telephone',
    categoryName: 'Réparation & Maintenance',
    desc: 'Changement d’écran tactile, connecteur de charge usé, remplacement batterie, désoxydation.',
    Icon: Smartphone,
    badge: 'Téléphonie',
    preset: "J'ai un écran de téléphone cassé ou un problème de charge à réparer",
  },
  {
    id: 'demenagement',
    title: 'Déplacement de meubles, transport de matériel, déménagement',
    slug: 'demenagement-local',
    categoryName: 'Transport & Logistique',
    desc: 'Véhicule utilitaire adapté, manutentionnaires de confiance, transport sécurisé partout à Ngaoundéré.',
    Icon: Truck,
    badge: 'Transport',
    preset: "J'ai besoin de déplacer des meubles, transporter du matériel ou organiser un déménagement",
  },
  {
    id: 'electromenager',
    title: 'Réparation de congélateur, frigo ou climatiseur',
    slug: 'reparation-electromenager',
    categoryName: 'Réparation & Maintenance',
    desc: 'Frigo qui ne refroidit plus, moteur silencieux, fuite ou recharge de gaz, dépannage compresseur.',
    Icon: Wrench,
    badge: 'Froid & Appareils',
    preset: "Mon congélateur ou frigo ne refroidit plus, ou mon climatiseur est en panne",
  },
  {
    id: 'maconnerie',
    title: 'Petits travaux de maçonnerie, carrelage ou peinture',
    slug: 'travaux-maconnerie',
    categoryName: 'Maison & Travaux',
    desc: 'Reprise de fissures, cloisons, pose de carrelage neuf, rafraîchissement des murs et finitions propres.',
    Icon: Hammer,
    badge: 'Travaux',
    preset: "J'ai des travaux de maçonnerie, carrelage ou peinture à réaliser",
  },
];

function CommonNeedsSection() {
  return (
    <Section
      id="besoins-frequents"
      eyebrow="Situations du quotidien"
      title="Les besoins les plus fréquents"
      description="Au lieu d'un catalogue abstrait de métiers, voici les situations réelles que nous résolvons chaque jour à Ngaoundéré. Cliquez pour lancer la prise en charge."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {COMMON_NEEDS.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: idx * 0.05 }}
            className="group p-6 sm:p-7 rounded-card bg-brand-surface border border-brand-border hover:border-brand-border-dark hover:shadow-premium-hover transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-bg border border-brand-border flex items-center justify-center text-brand-accent group-hover:scale-105 transition-transform">
                  <item.Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-brand-text-muted bg-brand-bg border border-brand-border px-3 py-1 rounded-full">
                  {item.badge}
                </span>
              </div>

              <h3 className="font-heading font-bold text-xl text-brand-text mb-2.5 leading-snug">
                {item.title}
              </h3>
              <p className="text-sm text-brand-text-muted mb-5 leading-relaxed">
                {item.desc}
              </p>
            </div>

            <div className="pt-4 border-t border-brand-border">
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-brand-text-muted font-bold block">
                    Tarif indicatif
                  </span>
                  <span className="text-sm font-bold text-brand-text">
                    {needPriceLabel(item.slug)}
                  </span>
                </div>
                <Link
                  to={`/service/${item.slug}`}
                  className="text-xs font-semibold text-brand-accent hover:underline flex items-center gap-1"
                >
                  Fiche & tarif <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <Button
                variant="primary"
                size="sm"
                className="w-full rounded-full text-xs font-semibold py-2.5"
                onClick={() =>
                  navigate(
                    `/demande?service=${item.slug}&need=${encodeURIComponent(item.preset)}`
                  )
                }
              >
                Demander cette intervention
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          to="/services"
          className="inline-flex items-center gap-2 text-sm font-bold text-brand-accent hover:underline"
        >
          Voir toutes nos interventions et tarifs indicatifs <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Section>
  );
}

/* ---------------- 4. Section Promesse & Confiance Fika -------------------- */

const TRUST_PILLARS = [
  {
    title: 'Un seul interlocuteur responsable',
    desc: 'Vous ne perdez plus votre temps à chercher des ouvriers au hasard, comparer des devis ou relancer plusieurs numéros. Fika prend la responsabilité intégrale de la mission.',
    Icon: ShieldCheck,
  },
  {
    title: 'Des professionnels sélectionnés et suivis',
    desc: 'Chaque professionnel entre dans le réseau Fika par étapes : téléphone confirmé, profil contrôlé, compétence vérifiée quand nous avons pu la tester ou la voir, puis interventions Fika réalisées. Nous n’affichons un contrôle que s’il a réellement eu lieu.',
    Icon: UserCheck,
  },
  {
    title: 'Un prix validé avec vous avant toute intervention',
    desc: 'Pas de prix inventé : Fika construit le devis (professionnel, déplacement, matériel) et vous le confirme avant tout commencement. Les petits services numériques gardent leur prix fixe.',
    Icon: ClipboardCheck,
  },
  {
    title: 'Suivi et garantie d’exécution',
    desc: 'Fika encadre l’intervention et contrôle le travail avant clôture. En cas de défaut persistant, nous réintervenons jusqu’à satisfaction.',
    Icon: CheckCircle2,
  },
  {
    title: 'Déplacement organisé par Fika',
    desc: 'Le déplacement du professionnel est organisé par Fika et intégré au devis que vous validez. Pour les documents, la livraison à Ngaoundéré est incluse. Aucun frais caché.',
    Icon: Truck,
  },
];

function TrustSection() {
  return (
    <Section
      eyebrow="Pourquoi passer par Fika plutôt que chercher soi-même ?"
      title="Un intermédiaire responsable de A à Z"
      description="Nous ne sommes pas un simple annuaire de numéros. Nous prenons l'entière responsabilité de la bonne exécution de votre prestation."
      tone="surface"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TRUST_PILLARS.map((p, idx) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: idx * 0.06 }}
            className={`p-7 rounded-card bg-brand-bg border border-brand-border flex flex-col justify-between shadow-premium ${
              idx === 4 ? 'md:col-span-2 lg:col-span-1' : ''
            }`}
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-brand-surface border border-brand-border flex items-center justify-center text-brand-accent mb-5">
                <p.Icon className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-lg text-brand-text mb-3 leading-snug">
                {p.title}
              </h3>
              <p className="text-sm text-brand-text-muted leading-relaxed">
                {p.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* --------------- 5. Section Packs / Combos du quotidien ------------------ */

function PacksSection() {
  const packs = getPackages();

  return (
    <Section
      id="packs"
      eyebrow="Combos du quotidien"
      title="Packs d'interventions coordonnées"
      description="Fika sait coordonner plusieurs interventions d'un coup pour vous faire gagner du temps et réduire les coûts."
    >
      <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-6 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3">
        {packs.map((pkg) => {
          const savings = computePackageSavings(pkg);
          return (
            <div
              key={pkg.id}
              className="shrink-0 snap-start w-[85%] md:w-auto p-7 rounded-card bg-brand-surface border border-brand-border flex flex-col gap-5 hover:shadow-premium-hover transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-0.5 rounded-full mb-2">
                    <Sparkles className="w-3.5 h-3.5" /> Pack coordonné
                  </div>
                  <h3 className="font-heading font-bold text-lg text-brand-text">{pkg.title}</h3>
                  <p className="text-sm text-brand-text-muted mt-1">{pkg.description}</p>
                </div>
                {savings > 0 && (
                  <span className="shrink-0 text-xs font-bold text-[#25D366] bg-[#25D366]/10 px-2.5 py-1 rounded-full whitespace-nowrap">
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
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-brand-text-muted font-bold block">
                    Prix du pack (services à prix fixe, livraison incluse)
                  </span>
                  <span className="font-heading text-2xl font-extrabold text-brand-accent">
                    {formatPriceFCFA(pkg.price)}
                  </span>
                </div>
                <a
                  href={getWALink(`Bonjour Fika 👋, je souhaite commander le pack coordonné : ${pkg.title}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWaClick({ context: 'home-pack', campaign: pkg.slug })}
                  className="inline-flex items-center gap-2 text-sm font-bold text-brand-text hover:text-brand-accent transition-colors bg-brand-bg px-4 py-2 rounded-full border border-brand-border hover:border-brand-accent"
                >
                  Commander <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------------- 6. Section "Vous ne trouvez pas votre besoin ?" --------- */

function ProblemSection() {
  const [problemText, setProblemText] = useState('');

  const handleDemande = () => {
    const text = problemText.trim();
    if (text) {
      navigate(`/demande?need=${encodeURIComponent(text)}`);
    } else {
      navigate('/demande');
    }
  };

  const handleWhatsApp = () => {
    const text = problemText.trim();
    const msg = text
      ? `Bonjour Fika 👋,\n\nVoici ma situation :\n"${text}"\n\nPouvez-vous me dire comment vous pouvez m'aider et organiser l'intervention ?`
      : `Bonjour Fika 👋,\n\nJ'ai un problème chez moi mais je ne sais pas exactement quel professionnel appeler. Pouvez-vous m'aider ?`;
    trackWaClick({ context: 'home-problem' });
    window.open(getWALink(msg), '_blank');
  };

  return (
    <Section tone="surface" className="relative overflow-hidden" id="besoin-particulier">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold tracking-wide uppercase mb-4">
          <HelpCircle className="w-3.5 h-3.5" /> Votre situation est particulière ?
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-text mb-4 tracking-tight">
          Vous ne trouvez pas votre besoin ?
        </h2>
        <p className="text-base sm:text-lg text-brand-text-muted mb-8 leading-relaxed max-w-2xl mx-auto">
          Décrivez-la en 2 minutes ou écrivez-nous directement sur WhatsApp. Vous n&apos;avez pas besoin de connaître le nom exact du métier : nous trouvons la compétence et nous coordonnons l&apos;intervention.
        </p>

        <div className="bg-brand-bg p-6 sm:p-8 rounded-3xl border border-brand-border shadow-premium text-left">
          <label
            htmlFor="problem-input"
            className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2"
          >
            Expliquez votre situation avec vos propres mots
          </label>
          <textarea
            id="problem-input"
            rows={3}
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            placeholder="Ex : J'ai une fuite sous l'évier qui coule dans le placard, ou mon disjoncteur saute dès que j'allume le chauffe-eau..."
            className="w-full bg-brand-surface border border-brand-border focus:border-brand-accent rounded-2xl p-4 text-brand-text placeholder:text-brand-text-muted/60 text-sm sm:text-base outline-none transition-all resize-none mb-4"
          />

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs text-brand-text-muted font-medium">Exemples fréquents :</span>
            {[
              "Fuite d'eau sous l'évier",
              "Mon frigo ne refroidit plus",
              "Déménagement ce samedi",
              "Serrure de porte bloquée",
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setProblemText(example)}
                className="text-xs px-3 py-1 rounded-full bg-brand-surface hover:bg-brand-border text-brand-text-muted hover:text-brand-text border border-brand-border transition-colors cursor-pointer"
              >
                {example}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              variant="primary"
              className="flex-1 rounded-full text-sm sm:text-base font-semibold"
              onClick={handleDemande}
            >
              <Send className="w-4 h-4 mr-2" />
              Décrire mon problème
            </Button>
            <Button
              size="lg"
              variant="whatsapp"
              className="flex-1 rounded-full text-sm sm:text-base font-semibold"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Expliquer sur WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* -------------------- Univers / Catégories de services ------------------- */

function UniversePricingCards() {
  const universes = getCategories();
  const services = getServices();

  return (
    <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {universes.map((cat, idx) => {
        const catServices = services.filter((s) => s.categoryId === cat.id);
        const priceLabel = categoryPriceLabel(catServices);
        const examples = (cat.examples ?? '')
          .split('·')
          .map((e) => e.trim())
          .filter(Boolean)
          .slice(0, 3);

        return (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: idx * 0.05 }}
            className="shrink-0 snap-start w-[85%] sm:w-auto"
          >
            <Link
              to={`/univers/${cat.slug}`}
              className="group block h-full p-7 rounded-card bg-brand-surface border border-brand-border hover:shadow-premium-hover hover:border-brand-border-dark transition-all active:scale-[0.99] flex flex-col justify-between"
            >
              <div>
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-5 ${cat.color}`}
                >
                  <UniverseIcon icon={cat.icon} className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-bold text-xl mb-3 text-brand-text">
                  {cat.title}
                </h3>
                <ul className="space-y-1.5 mb-6">
                  {examples.map((ex, i) => (
                    <li key={i} className="text-sm text-brand-text-muted flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-brand-accent shrink-0" aria-hidden="true" />
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-brand-border">
                <span className="text-sm font-bold text-brand-text">
                  {priceLabel}
                </span>
                <span className="flex items-center text-sm font-semibold text-brand-accent gap-1 group-hover:gap-2 transition-all">
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

/* ----------------------- 7. FAQ Pratique & Rassurante --------------------- */

function FaqSection() {
  return (
    <Section
      id="faq"
      eyebrow="Transparence & Sérénité"
      title="Questions fréquentes"
      description="Comment fonctionne Fika au quotidien pour vos interventions et travaux à Ngaoundéré."
      compact
    >
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
            <h3 className="font-heading font-bold text-lg mb-2.5 text-brand-text">{faq.q}</h3>
            <p className="text-brand-text-muted text-sm leading-relaxed">{faq.a}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ----------------- Promesse Ville : Déplacement & Livraison -------------- */

function DeliveryBanner() {
  return (
    <Section tone="dark" className="text-center !py-12 md:!py-16">
      <div className="max-w-4xl mx-auto">
        <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 backdrop-blur-sm">
          <Truck className="w-8 h-8 text-brand-accent" />
        </div>
        <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
          Un prix clair, validé avant de commencer
        </h2>
        <p className="text-lg md:text-xl text-brand-contrast-soft mb-6 max-w-2xl mx-auto font-serif italic">
          Coût du professionnel, déplacement et matériel : tout est dans le devis que vous acceptez. Rien ne démarre sans votre accord.
        </p>
        <p className="text-xs text-brand-contrast-muted font-medium tracking-wide uppercase">
          {DELIVERY_PROMISE}
        </p>
      </div>
    </Section>
  );
}

/* ----------------------- 8. CTA Final & Contact Rapide ------------------- */

function FinalCtaSection() {
  return (
    <Section tone="surface" className="text-center !py-16 md:!py-20">
      <div className="max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-semibold tracking-wide uppercase mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
          Prise en charge directe
        </div>

        <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 tracking-tight text-brand-text">
          Un problème à résoudre ?<br />
          <span className="text-brand-accent font-serif italic font-medium">Fika s&apos;occupe du reste.</span>
        </h2>
        <p className="text-base sm:text-lg text-brand-text-muted mb-8 leading-relaxed">
          Plomberie, électricité, travaux, réparation, transport et services utiles du quotidien. Expliquez-nous simplement votre besoin : nous mobilisons la bonne compétence et organisons tout.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" variant="whatsapp" className="rounded-full px-8 shadow-premium">
            <a
              href={getWALink(
                `Bonjour Fika 👋,\n\nJ'ai un besoin à vous confier :\n\nVille / quartier :\n\nPouvez-vous m'aider ?`
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWaClick({ context: 'home-final' })}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Discuter sur WhatsApp
            </a>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full px-8"
            onClick={() => navigate('/demande')}
          >
            Décrire mon besoin
          </Button>
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-brand-text-muted text-xs font-semibold uppercase tracking-wider">
          <MapPin className="w-4 h-4 text-brand-accent" /> {SITE_CITY} · Service de coordination et d&apos;intervention
        </p>
      </div>
    </Section>
  );
}

/* -------------------------------- HomePage ------------------------------- */

export function HomePage() {
  return (
    <div className="flex flex-col">
      {/* 1. Hero : Promesse immédiate + double CTA + WhatsApp visible + recherche dynamique */}
      <Hero />

      {/* 2. Section "Comment ça marche" (4 étapes claires d'orchestration) */}
      <HowItWorksSection />

      {/* 3. Section "Besoins les plus fréquents" (Situations concrètes du quotidien) */}
      <CommonNeedsSection />

      {/* 4. Section Promesse & Confiance Fika (5 piliers de réassurance) */}
      <TrustSection />

      {/* 5. Section Packs / Combos du quotidien (Interventions coordonnées) */}
      <PacksSection />

      {/* 6. Section "Vous ne trouvez pas votre besoin ?" (Formulaire express & WhatsApp) */}
      <ProblemSection />

      {/* Exploration de toutes les catégories de services */}
      <Section
        id="services"
        eyebrow="Toutes nos compétences"
        title="Nos 5 grands univers de services"
        description="Parcourez l'ensemble des interventions et tarifs indicatifs disponibles à Ngaoundéré."
        tone="surface"
      >
        <UniversePricingCards />
      </Section>

      {/* Réassurance : prix validé avant démarrage, déplacement organisé par Fika */}
      <DeliveryBanner />

      {/* 7. FAQ Pratique & Rassurante (Paiement, litiges, délais, statut des artisans) */}
      <FaqSection />

      {/* 8. CTA Final & Contact rapide */}
      <FinalCtaSection />
    </div>
  );
}

