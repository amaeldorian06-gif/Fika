import { motion } from 'framer-motion';
import { ArrowRight, Flame, Truck } from 'lucide-react';
import type { Service } from '../lib/types';
import { getServiceCTA } from '../lib/whatsapp';
import { displayPrice, getCityPricing, pricingMode } from '../lib/pricing';
import { getCategoryBySlug } from '../lib/catalog';
import { Link } from '../router';
import { UniverseIcon } from './ui';

/**
 * Carte service (P10) — en-tête de marque uniforme (icône de l'univers sur
 * fond teinté) : toutes les cartes partagent exactement la même structure,
 * quelle que soit l'univers. Prix via lib/pricing et badges (populaire /
 * livré chez vous). Variantes : `compact` supprime la description pour les
 * grilles denses.
 */
export function ServiceCard({ service, idx = 0, compact = false }: { service: Service; idx?: number; compact?: boolean }) {
  const universe = getCategoryBySlug(service.categoryId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: idx * 0.05 }}
      className="h-full"
    >
      <Link
        to={`/service/${service.slug}`}
        className="group h-full rounded-card bg-brand-surface border border-brand-border flex flex-col overflow-hidden hover:shadow-premium-hover hover:border-brand-border-dark transition-all active:scale-[0.99]"
      >
        <div className={`flex items-center justify-between gap-3 px-6 pt-6 ${compact ? 'pb-0' : 'pb-4'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${universe?.color ?? 'bg-brand-bg'}`}>
            <UniverseIcon icon={universe?.icon ?? 'Wrench'} className="w-5 h-5 text-brand-accent" />
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end">
            {service.popular && (
              <span className="inline-flex items-center gap-1 bg-brand-bg text-brand-accent text-[10px] font-heading font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-brand-border">
                <Flame className="w-3 h-3" aria-hidden="true" /> Populaire
              </span>
            )}
            {service.deliveryIncluded && pricingMode(service) === 'STANDARD' && (
              <span className="inline-flex items-center gap-1 bg-brand-bg text-brand-wa text-[10px] font-heading font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-brand-border">
                <Truck className="w-3 h-3" aria-hidden="true" /> Livré
              </span>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 md:px-7 md:pb-7 flex flex-col flex-1 pt-4">
          <p className="text-[11px] font-heading font-bold uppercase tracking-[0.18em] text-brand-text-muted mb-2">
            {universe?.title ?? 'Service'}
          </p>
          <h3 className="font-heading font-bold text-xl text-brand-text mb-1.5 group-hover:text-brand-accent transition-colors">
            {service.name}
          </h3>
          <p className="font-heading font-bold text-brand-accent mb-3">
            {displayPrice(service, getCityPricing(service.id))}
          </p>
          {!compact && (
            <p className="text-sm text-brand-text-muted leading-relaxed flex-1">{service.shortDescription}</p>
          )}
          <div className="flex items-center text-sm font-semibold text-brand-accent gap-2 group-hover:gap-3 transition-all mt-4">
            {getServiceCTA(service.priceType)} <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
