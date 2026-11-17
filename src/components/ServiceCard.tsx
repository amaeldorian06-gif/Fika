import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Flame, Truck } from 'lucide-react';
import type { Service } from '../lib/types';
import { getServiceCTA } from '../lib/whatsapp';
import { displayPrice, getCityPricing, pricingMode } from '../lib/pricing';
import { getCategoryBySlug, serviceImage } from '../lib/catalog';
import { Link } from '../router';
import { UniverseIcon } from './ui';

/**
 * Carte service (P10) — en-tête de marque uniforme : toutes les cartes
 * partagent exactement la même structure, quelle que soit l'univers.
 * Photo réelle si elle existe (bucket service-photos, convention
 * `<slug>.jpg`) en bannière de hauteur fixe ; sinon repli sur un bloc
 * teinté aux couleurs de l'univers avec l'icône centrée — la grille reste
 * stable, même pendant que les photos arrivent une à une. Prix via
 * lib/pricing et badges (populaire / livré chez vous). Variantes :
 * `compact` supprime la description pour les grilles denses.
 */
export function ServiceCard({ service, idx = 0, compact = false }: { service: Service; idx?: number; compact?: boolean }) {
  const universe = getCategoryBySlug(service.categoryId);
  const [noPhoto, setNoPhoto] = useState(false);

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
        <div className={`relative h-40 sm:h-44 shrink-0 overflow-hidden ${noPhoto ? universe?.color ?? 'bg-brand-bg' : 'bg-brand-bg'}`}>
          {noPhoto ? (
            <UniverseIcon icon={universe?.icon ?? 'Wrench'} className="w-10 h-10 text-brand-accent absolute inset-0 m-auto" />
          ) : (
            <>
              <img
                src={serviceImage(service.slug)}
                alt={`Illustration — ${service.name}`}
                loading="lazy"
                onError={() => setNoPhoto(true)}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
              />
              <span className={`absolute bottom-3 left-4 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${universe?.color ?? 'bg-brand-bg'}`}>
                <UniverseIcon icon={universe?.icon ?? 'Wrench'} className="w-5 h-5 text-brand-accent" />
              </span>
            </>
          )}
          {(service.popular || (service.deliveryIncluded && pricingMode(service) === 'STANDARD')) && (
            <div className="absolute top-3 right-4 flex flex-wrap gap-1.5 justify-end">
              {service.popular && (
                <span className="inline-flex items-center gap-1 bg-brand-surface/90 backdrop-blur-sm text-brand-accent text-[10px] font-heading font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-brand-border">
                  <Flame className="w-3 h-3" aria-hidden="true" /> Populaire
                </span>
              )}
              {service.deliveryIncluded && pricingMode(service) === 'STANDARD' && (
                <span className="inline-flex items-center gap-1 bg-brand-surface/90 backdrop-blur-sm text-brand-wa text-[10px] font-heading font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-brand-border">
                  <Truck className="w-3 h-3" aria-hidden="true" /> Livré
                </span>
              )}
            </div>
          )}
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
