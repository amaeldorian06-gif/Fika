import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Check, ChevronRight, Clock, FileText, FileUp, ListChecks,
  MessageCircle, ShieldCheck, Sparkles, TextCursorInput, Truck, Hash, X,
} from 'lucide-react';
import type { RequirementKind, ServiceRequirement } from '../lib/types';
import { getCategoryBySlug, getServiceBySlug, getServices } from '../lib/catalog';
import { getServiceCTA, getWALink } from '../lib/whatsapp';
import { compileMessage } from '../lib/whatsapp/engine';
import { trackWaClick, trackLeadView } from '../lib/tracking';
import { displayPrice, getCityPricing } from '../lib/pricing';
import { DELIVERY_PROMISE, SITE_CITY } from '../lib/site';
import { Badge, Button } from './ui';
import { ServiceCard } from './ServiceCard';
import { Link } from '../router';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

const KIND_META: Record<RequirementKind, { label: string; Icon: typeof FileText }> = {
  TEXT: { label: 'Texte', Icon: TextCursorInput },
  FILE: { label: 'Fichier', Icon: FileUp },
  OPTION: { label: 'Choix', Icon: ListChecks },
  QUANTITY: { label: 'Quantité', Icon: Hash },
};

function RequirementRow({ req }: { req: ServiceRequirement }) {
  const { label, Icon } = KIND_META[req.kind];
  return (
    <li className="flex items-center gap-3 bg-white p-3 rounded-xl border border-brand-border text-sm font-medium text-brand-text shadow-sm">
      <Icon className="w-4 h-4 text-brand-accent shrink-0" />
      <span className="flex-1">{req.label}</span>
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${req.required ? 'bg-brand-accent/10 text-brand-accent' : 'bg-brand-bg text-brand-text-muted border border-brand-border'}`}>
        {req.required ? 'Requis' : 'Optionnel'}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">{label}</span>
    </li>
  );
}

export function ServicePage({ slug }: { slug: string }) {
  const service = getServiceBySlug(slug);

  if (!service) {
    return (
      <div className="min-h-screen pt-24 pb-16 max-w-3xl mx-auto px-4 text-center">
        <h1 className="font-heading text-3xl font-bold mb-4 text-brand-text">Service introuvable</h1>
        <p className="text-brand-text-muted mb-8">Ce service n&apos;existe pas ou plus. Décrivez-nous votre besoin, nous trouverons une solution.</p>
        <Button asChild variant="primary" className="rounded-full">
          <Link to="/demande">Décrire mon besoin</Link>
        </Button>
      </div>
    );
  }

  const universe = getCategoryBySlug(service.categoryId);
  const related = getServices({ categoryId: service.categoryId }).filter((s) => s.id !== service.id).slice(0, 3);

  // Attribution P08 : chaque consultation de fiche alimente les sources.
  useEffect(() => {
    trackLeadView({ serviceSlug: service.slug, universeSlug: service.categoryId });
  }, [service.slug, service.categoryId]);

  // Campagne d'attribution : fiche vue depuis un pack (?pack=<slug> dans le hash).
  const campaign = (() => {
    if (typeof window === 'undefined') return null;
    const query = window.location.hash.split('?')[1];
    return query ? new URLSearchParams(query).get('pack') : null;
  })();

  // Message prérempli intelligent (moteur P04) : service + prix + champs requis.
  const waMessage = compileMessage(service, {
    context: 'service-page',
    campaign,
    city: SITE_CITY,
  });
  const cityPricing = getCityPricing(service.id);
  const price = displayPrice(service, cityPricing);
  const requirements = [...service.requirements].sort((a, b) => a.position - b.position);

  return (
    <div className="min-h-screen bg-brand-bg pt-8 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <motion.div {...fadeUp(0)} className="flex items-center gap-2 text-sm text-brand-text-muted mb-8 flex-wrap">
          <Link to="/" className="inline-flex items-center hover:text-brand-accent transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Accueil
          </Link>
          {universe && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to={`/univers/${universe.slug}`} className="hover:text-brand-accent transition-colors">
                {universe.title}
              </Link>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-brand-text font-semibold">{service.name}</span>
        </motion.div>

        {/* Visuel local de marque (photos réelles : TODO_PROD) */}
        {service.image && (
          <motion.div {...fadeUp(0.03)} className="mb-10 rounded-3xl overflow-hidden border border-brand-border bg-brand-surface">
            {/* Image LCP : ratio fixe (pas de CLS), priorité élevée, dimensions explicites */}
            <img
              src={service.image}
              alt={service.name}
              width={1200}
              height={514}
              fetchPriority="high"
              decoding="async"
              className="w-full aspect-[21/9] object-cover"
            />
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div {...fadeUp(0.05)}>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {service.popular && <Badge variant="accent">Populaire</Badge>}
                {service.deliveryIncluded && (
                  <Badge variant="whatsapp" className="gap-1.5">
                    <Truck className="w-3 h-3" /> Livraison incluse
                  </Badge>
                )}
                {universe && <Badge variant="secondary">{universe.title}</Badge>}
              </div>
              <h1 className="font-heading text-4xl md:text-5xl font-extrabold tracking-tight text-brand-text mb-4">
                {service.name}
              </h1>
              <p className="text-lg md:text-xl text-brand-text-muted font-serif italic">
                {service.shortDescription}
              </p>
            </motion.div>

            {service.fullDescription && (
              <motion.div {...fadeUp(0.1)} className="bg-brand-surface border border-brand-border rounded-2xl p-8">
                <h2 className="text-xl font-heading font-bold text-brand-text mb-4">En quoi consiste ce service</h2>
                <p className="text-brand-text-muted leading-relaxed">{service.fullDescription}</p>
              </motion.div>
            )}

            {/* How it works */}
            {service.howItWorks && service.howItWorks.length > 0 && (
              <motion.div {...fadeUp(0.15)} className="bg-brand-surface border border-brand-border rounded-2xl p-8">
                <h2 className="text-xl font-heading font-bold text-brand-text mb-6">Comment ça se passe</h2>
                <div className="space-y-0">
                  {service.howItWorks.map((step, idx) => (
                    <div key={idx} className="flex gap-5 relative">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-brand-text text-white flex items-center justify-center font-heading font-bold text-sm shrink-0 z-10">
                          {idx + 1}
                        </div>
                        {idx < service.howItWorks!.length - 1 && <div className="w-px flex-1 bg-brand-border" />}
                      </div>
                      <div className="pb-8">
                        <h3 className="font-heading font-bold text-brand-text mb-1 pt-2">{step.title}</h3>
                        <p className="text-sm text-brand-text-muted leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Included / Excluded */}
            {(service.includedItems.length > 0 || service.excludedItems.length > 0) && (
              <motion.div {...fadeUp(0.2)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {service.includedItems.length > 0 && (
                  <div className="bg-brand-surface border border-brand-border rounded-2xl p-8">
                    <h2 className="text-lg font-heading font-bold text-brand-text mb-5 flex items-center gap-2">
                      <Check className="w-5 h-5 text-brand-wa" /> Ce qui est inclus
                    </h2>
                    <ul className="space-y-3">
                      {service.includedItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-brand-text-muted">
                          <Check className="w-4 h-4 text-brand-wa shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {service.excludedItems.length > 0 && (
                  <div className="bg-brand-surface border border-brand-border rounded-2xl p-8">
                    <h2 className="text-lg font-heading font-bold text-brand-text mb-5 flex items-center gap-2">
                      <X className="w-5 h-5 text-brand-accent" /> Ce qui n&apos;est pas inclus
                    </h2>
                    <ul className="space-y-3">
                      {service.excludedItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-brand-text-muted">
                          <X className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}

            {/* Champs à compléter (ServiceRequirement) */}
            {requirements.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-brand-bg border border-brand-border rounded-2xl p-8"
              >
                <h2 className="text-xl font-heading font-bold text-brand-text mb-4">Préparez ces informations</h2>
                <p className="text-brand-text-muted text-sm mb-6">Pour traiter votre demande efficacement, préparez ces éléments :</p>
                <ul className="space-y-3">
                  {requirements.map((req, idx) => (
                    <RequirementRow key={idx} req={req} />
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Délai estimé */}
            {service.estimatedDuration && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="bg-brand-surface border border-brand-border rounded-2xl p-6 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-brand-accent" />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">Délai estimé</p>
                  <p className="font-heading font-bold text-brand-text text-lg">{service.estimatedDuration}</p>
                </div>
              </motion.div>
            )}

            {/* FAQs */}
            {service.faqs && service.faqs.length > 0 && (
              <motion.div {...fadeUp(0.35)} className="space-y-4">
                <h2 className="text-xl font-heading font-bold text-brand-text">Questions fréquentes</h2>
                {service.faqs.map((faq, idx) => (
                  <div key={idx} className="bg-brand-surface border border-brand-border rounded-2xl p-6">
                    <h3 className="font-heading font-bold text-brand-text mb-2">{faq.q}</h3>
                    <p className="text-sm text-brand-text-muted leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Colonne commande (sticky) */}
          <div className="lg:col-span-1">
            <motion.div
              {...fadeUp(0.1)}
              className="sticky top-28 bg-brand-surface border border-brand-border rounded-3xl p-8 shadow-premium"
            >
              <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">
                Tarif — Ngaoundéré
              </p>
              <p className="font-heading text-3xl font-extrabold text-brand-accent mb-2">
                {price}
              </p>
              <p className="text-sm text-brand-text-muted mb-8 leading-relaxed">
                Prix annoncé avant lancement. Aucune surprise.
              </p>

              <Button asChild variant="whatsapp" size="lg" className="w-full rounded-2xl mb-4">
                <a
                  href={getWALink(waMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWaClick({ serviceSlug: service.slug, context: 'service-page', campaign })}
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  {getServiceCTA(service.priceType)}
                </a>
              </Button>

              <p className="text-xs text-center text-brand-text-muted mb-8">
                Réponse rapide sur WhatsApp, 7j/7.
              </p>

              <ul className="space-y-4 pt-6 border-t border-brand-border">
                {/* Invariant ville : affiché sur TOUTES les fiches */}
                <li className="flex items-center gap-3 text-sm font-medium text-brand-text-muted">
                  <Truck className="w-5 h-5 text-brand-accent shrink-0" /> {DELIVERY_PROMISE}
                </li>
                <li className="flex items-center gap-3 text-sm font-medium text-brand-text-muted">
                  <ShieldCheck className="w-5 h-5 text-brand-accent shrink-0" /> Expert vérifié et sélectionné
                </li>
                <li className="flex items-center gap-3 text-sm font-medium text-brand-text-muted">
                  <Sparkles className="w-5 h-5 text-brand-accent shrink-0" /> Interlocuteur unique Fika
                </li>
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Services liés */}
        {related.length > 0 && (
          <div className="mt-24">
            <h2 className="text-2xl font-heading font-bold mb-8 text-brand-text">Dans le même univers</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((s, idx) => (
                <ServiceCard key={s.id} service={s} idx={idx} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Espace pour la barre sticky mobile */}
      <div className="h-24 lg:hidden" aria-hidden="true" />

      {/* Barre CTA sticky mobile (P10) : prix + action toujours accessibles */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-brand-surface/95 backdrop-blur-xl border-t border-brand-border px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted truncate">{service.name}</p>
            <p className="font-heading font-extrabold text-brand-accent leading-tight">{price}</p>
          </div>
          <a
            href={getWALink(waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWaClick({ serviceSlug: service.slug, context: 'service-page', campaign })}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-brand-wa text-white text-sm font-bold px-6 min-h-[44px] hover:bg-brand-wa-hover active:scale-[0.97] transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Commander
          </a>
        </div>
      </div>
    </div>
  );
}
