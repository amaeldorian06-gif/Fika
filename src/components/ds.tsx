import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, MessageCircle, Truck } from 'lucide-react';
import type { Service } from '../lib/types';
import { displayPrice, getCityPricing } from '../lib/pricing';
import { getWALink } from '../lib/whatsapp';
import { compileMessage } from '../lib/whatsapp/engine';
import { trackWaClick } from '../lib/tracking';
import { SITE_CITY } from '../lib/site';
import { cn } from '../utils/cn';

/**
 * Design System Fika (P10) — composants d'armature réutilisables.
 * Voir docs/design.md pour les variantes et règles d'usage.
 */

/* ------------------------------ Container --------------------------------- */

const CONTAINER_SIZES = {
  default: 'max-w-7xl',
  wide: 'max-w-[90rem]',
  medium: 'max-w-5xl',
  narrow: 'max-w-3xl',
} as const;

export function Container({
  children, size = 'default', className,
}: { children: ReactNode; size?: keyof typeof CONTAINER_SIZES; className?: string }) {
  return (
    <div className={cn('mx-auto px-4 sm:px-6 lg:px-8', CONTAINER_SIZES[size], className)}>
      {children}
    </div>
  );
}

/* ------------------------------- Section ---------------------------------- */

interface SectionProps {
  id?: string;
  /** Petit libellé de chapitre (couleur accent, tracking large). */
  eyebrow?: string;
  title?: string;
  description?: string;
  align?: 'left' | 'center';
  /** Variante de fond : none (bg page), surface (blanc bordé), dark (encre). */
  tone?: 'default' | 'surface' | 'dark';
  compact?: boolean;
  children: ReactNode;
  className?: string;
}

export function Section({
  id, eyebrow, title, description, align = 'center', tone = 'default', compact = false, children, className,
}: SectionProps) {
  const hasHeader = eyebrow || title || description;
  return (
    <section
      id={id}
      className={cn(
        compact ? 'py-section-sm' : 'py-section',
        tone === 'surface' && 'bg-brand-surface border-y border-brand-border',
        tone === 'dark' && 'bg-brand-text text-white relative overflow-hidden',
        className,
      )}
    >
      {tone === 'dark' && (
        <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent/40 via-transparent to-transparent" />
        </div>
      )}
      <Container className={tone === 'dark' ? 'relative z-10' : undefined}>
        {hasHeader && (
          <div className={cn('mb-12 md:mb-16', align === 'center' ? 'text-center mx-auto max-w-2xl' : 'text-left max-w-2xl')}>
            {eyebrow && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'inline-flex items-center gap-2 text-[11px] font-heading font-bold uppercase tracking-[0.2em] mb-4',
                  tone === 'dark' ? 'text-brand-accent' : 'text-brand-accent',
                )}
              >
                <span className="w-6 h-px bg-brand-accent" aria-hidden="true" />
                {eyebrow}
                {align === 'center' && <span className="w-6 h-px bg-brand-accent" aria-hidden="true" />}
              </motion.p>
            )}
            {title && (
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'font-heading text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight',
                  tone === 'dark' ? 'text-white' : 'text-brand-text',
                )}
              >
                {title}
              </motion.h2>
            )}
            {description && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'mt-4 text-lg leading-relaxed',
                  tone === 'dark' ? 'text-brand-contrast-soft font-serif italic' : 'text-brand-text-muted',
                )}
              >
                {description}
              </motion.p>
            )}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}

/* ------------------------------ PricingCard -------------------------------- */

interface PricingCardProps {
  service: Service;
  /** Met en avant le meilleur rapport (liseré accent + légère élévation). */
  featured?: boolean;
  idx?: number;
}

/**
 * Carte de prix complète : prix via lib/pricing (seule source), délai,
 * inclusions, badge de gratuite Ngaoundéré et CTA WhatsApp motorisé (P04).
 */
export function PricingCard({ service, featured = false, idx = 0 }: PricingCardProps) {
  const pricing = getCityPricing(service.id);
  const message = compileMessage(service, { context: 'home-pricing', city: SITE_CITY });
  const included = service.includedItems.slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: idx * 0.06 }}
      className={cn(
        'relative h-full p-8 rounded-card bg-brand-surface border flex flex-col',
        featured
          ? 'border-brand-accent shadow-card-lift'
          : 'border-brand-border hover:shadow-premium-hover hover:border-brand-border-dark transition-all',
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-6 bg-brand-accent text-white text-[10px] font-heading font-bold uppercase tracking-widest px-3 py-1 rounded-full">
          Le plus demandé
        </span>
      )}

      <h3 className="font-heading font-bold text-xl text-brand-text mb-1">{service.name}</h3>
      <p className="font-heading text-3xl font-extrabold text-brand-accent mb-2">
        {displayPrice(service, pricing)}
      </p>
      <p className="text-sm text-brand-text-muted mb-6 leading-relaxed">{service.shortDescription}</p>

      {included.length > 0 && (
        <ul className="space-y-2.5 mb-6 flex-1">
          {included.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-brand-text-muted">
              <Check className="w-4 h-4 text-brand-wa shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 pt-4 border-t border-brand-border">
        <p className="flex items-center gap-2 text-xs font-bold text-brand-wa">
          <Truck className="w-4 h-4" /> Livraison gratuite à {SITE_CITY}
        </p>
        <a
          href={getWALink(message)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWaClick({ serviceSlug: service.slug, context: 'home-pricing' })}
          className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-wa px-6 py-3.5 text-sm font-bold text-white shadow-premium hover:bg-brand-wa-hover transition-colors active:scale-[0.98]"
        >
          <MessageCircle className="w-4 h-4" />
          Commander
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </a>
      </div>
    </motion.div>
  );
}
