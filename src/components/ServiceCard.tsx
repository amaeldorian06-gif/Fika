import { motion } from 'framer-motion';
import { ArrowRight, Flame, Truck } from 'lucide-react';
import type { Service } from '../lib/types';
import { getServiceCTA } from '../lib/whatsapp';
import { displayPrice, getCityPricing } from '../lib/pricing';
import { getCategoryBySlug } from '../lib/catalog';
import { Link } from '../router';

/**
 * Carte service premium (P10) : visuel de marque, catégorie, prix via
 * lib/pricing et tags (populaire / livré chez vous). Variantes : `compact`
 * supprime la description pour les grilles denses.
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
        {service.image && !compact && (
          <div className="relative aspect-[16/9] overflow-hidden bg-brand-bg border-b border-brand-border">
            <img
              src={service.image}
              alt={service.name}
              width={1200}
              height={675}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {service.popular && (
                <span className="inline-flex items-center gap-1 bg-white/95 backdrop-blur text-brand-accent text-[10px] font-heading font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                  <Flame className="w-3 h-3" /> Populaire
                </span>
              )}
              {service.deliveryIncluded && (
                <span className="inline-flex items-center gap-1 bg-white/95 backdrop-blur text-brand-wa text-[10px] font-heading font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                  <Truck className="w-3 h-3" /> Livré
                </span>
              )}
            </div>
          </div>
        )}

        <div className="p-6 md:p-7 flex flex-col flex-1">
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
