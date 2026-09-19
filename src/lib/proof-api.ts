import type { PublicTestimonial } from './proof';

/**
 * Lectures publiques des preuves (P07).
 * Si l'API n'est pas jointe, on renvoie des tableaux vides : la vitrine
 * bascule alors sur des exemples explicitement marqués « démo » — aucune
 * fausse review n'est jamais écrite en base ni présentée comme vérifiée.
 */

export interface PublicPortfolioItem {
  id: string;
  title: string;
  category: string;
  image: string;
  description?: string | null;
  clientType?: string | null;
}

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!res.ok) return fallback;
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export const fetchPublicTestimonials = (): Promise<PublicTestimonial[]> =>
  safeGet<PublicTestimonial[]>('/api/testimonials', []);

export const fetchPublicPortfolio = (): Promise<PublicPortfolioItem[]> =>
  safeGet<PublicPortfolioItem[]>('/api/portfolio', []);
