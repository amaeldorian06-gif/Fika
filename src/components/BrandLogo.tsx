import type { HTMLAttributes } from 'react';

/** Wordmark unique Fika — la signature Caveat et le point terre cuite sont partagés partout. */
export function BrandLogo({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="img"
      aria-label="Fika"
      className={`inline-flex items-baseline font-signature font-normal tracking-tight leading-none text-brand-text ${className}`}
      {...props}
    >
      <span>Fika</span><span className="ml-[-0.045em] text-brand-accent">.</span>
    </span>
  );
}
