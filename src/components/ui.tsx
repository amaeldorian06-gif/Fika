import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';

/* ------------------------------ Button ------------------------------ */

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-brand-text text-white hover:bg-black shadow-premium hover:shadow-premium-hover',
        primary: 'bg-brand-text text-white hover:bg-black shadow-premium hover:shadow-premium-hover',
        secondary: 'bg-white text-brand-text border border-brand-border hover:border-brand-border-dark shadow-sm hover:shadow-premium',
        outline: 'border border-brand-border bg-transparent hover:bg-brand-surface text-brand-text',
        ghost: 'hover:bg-brand-surface text-brand-text',
        link: 'underline-offset-4 hover:underline text-brand-text',
        whatsapp: 'bg-brand-wa text-white hover:bg-brand-wa-hover shadow-premium hover:shadow-premium-hover',
      },
      size: {
        default: 'h-12 py-3 px-6 text-base',
        sm: 'h-10 px-4 text-sm',
        lg: 'h-14 px-8 text-lg',
        icon: 'h-12 w-12',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/* --------------------------------- Slot --------------------------------- */
/**
 * Slot interne : rend l'enfant unique à la place du <button> en fusionnant
 * className, props et refs. Permet un vrai rendu polymorphe (ex. <Button
 * asChild><a href=...>) sans jamais imbriquer <button> et <a>.
 */

type SlotChildProps = Record<string, unknown> & { ref?: React.Ref<HTMLElement> };

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (node) => {
    refs.forEach((r) => {
      if (typeof r === 'function') r(node);
      else if (r && typeof r === 'object') {
        (r as { current: T | null }).current = node;
      }
    });
  };
}

const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  function Slot({ children, ...slotProps }, ref) {
    if (!React.isValidElement(children)) return null;
    const child = children as React.ReactElement<SlotChildProps>;
    const childProps = child.props;
    const merged: SlotChildProps = {
      ...slotProps,
      ...childProps, // les props de l'enfant (href, target, onClick...) priment
      className: cn(slotProps.className, childProps.className as string | undefined),
      ref: mergeRefs<HTMLElement>(childProps.ref, ref),
    };
    return React.cloneElement(child, merged);
  },
);
Slot.displayName = 'Slot';

/* --------------------------------- Button -------------------------------- */

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className);
    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button ref={ref} type={type ?? 'button'} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };

/* ------------------------------- Badge ------------------------------ */

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand-text text-white hover:bg-black',
        secondary: 'border-transparent bg-brand-border text-brand-text hover:bg-brand-border-dark',
        destructive: 'border-transparent bg-red-500 text-white hover:bg-red-600',
        outline: 'text-brand-text border-brand-border',
        accent: 'border-transparent bg-brand-accent text-white',
        whatsapp: 'border-transparent bg-brand-wa/10 text-brand-wa',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/* --------------------------- SectionHeader -------------------------- */

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  align?: 'left' | 'center';
}

export function SectionHeader({ title, description, align = 'center', className, ...props }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'mb-12 md:mb-16',
        align === 'center' ? 'text-center mx-auto max-w-2xl' : 'text-left max-w-2xl',
        className,
      )}
      {...props}
    >
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3 }}
        className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight text-brand-text"
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
          className="text-lg text-brand-text-muted leading-relaxed"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}

/* ------------------------------- Icons ------------------------------ */

import {
  MonitorSmartphone, Zap, FileText, Wrench, Home as HomeIcon, Truck, Briefcase, Plus,
} from 'lucide-react';

export function UniverseIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const cls = className ?? 'w-5 h-5';
  switch (icon) {
    case 'MonitorSmartphone': return <MonitorSmartphone className={cls} />;
    case 'Zap': return <Zap className={cls} />;
    case 'FileText': return <FileText className={cls} />;
    case 'Wrench': return <Wrench className={cls} />;
    case 'HomeIcon': return <HomeIcon className={cls} />;
    case 'Truck': return <Truck className={cls} />;
    case 'Briefcase': return <Briefcase className={cls} />;
    case 'Plus': return <Plus className={cls} />;
    default: return <Plus className={cls} />;
  }
}
