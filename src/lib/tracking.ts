import type { WaContext } from './whatsapp/engine';

/**
 * Capture des clics WhatsApp (analytics P08).
 * Envoie un beacon POST /api/events/waclick. Échec totalement silencieux :
 * l'absence d'API ne doit JAMAIS bloquer ni signaler une conversion.
 */

export type TrackedEventType = 'WACLICK' | 'LEAD_VIEW' | 'SERVICE_SEARCH';

export interface WaClickPayload {
  serviceSlug?: string;
  context: WaContext;
  campaign?: string | null;
  ref?: string;
}

export interface LeadViewPayload {
  serviceSlug: string;
  /** Univers d'où provient la visite (attribution). */
  universeSlug?: string | null;
}

/** Trace la consultation d'une fiche service (source d'attribution P08). */
export function trackLeadView(payload: LeadViewPayload): void {
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return;
    const body = JSON.stringify(payload);
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/events/leadview', blob)) return;
    }
    void fetch('/api/events/leadview', {
      method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* noop volontaire */
  }
}

const API_PATH = '/api/events/waclick';

export function trackWaClick(payload: WaClickPayload): void {
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return;
    const body = JSON.stringify(payload);

    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(API_PATH, blob)) return;
    }

    void fetch(API_PATH, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => undefined); // noop volontaire
  } catch {
    /* noop volontaire — tracking best-effort uniquement */
  }
}

export interface ServiceSearchPayload {
  query: string;
  results: number;
}

/**
 * Trace une recherche sur /services (après stabilisation de la frappe).
 * Sert à mesurer l'efficacité de la recherche et à repérer les demandes
 * sans résultat. Aucune donnée personnelle : la requête seule, tronquée.
 */
export function trackServiceSearch(payload: ServiceSearchPayload): void {
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return;
    if (!payload.query || payload.query.trim().length < 2) return;
    const body = JSON.stringify({ query: payload.query.trim().slice(0, 80), results: payload.results });
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/events/service-search', blob);
      return;
    }
    void fetch('/api/events/service-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  } catch {
    /* silencieux par conception */
  }
}

export type FunnelStep =
  | 'PATH_SELECTED'
  | 'FORM_STARTED'
  | 'VALIDATION_ERROR'
  | 'REQUEST_SUBMITTED'
  | 'INQUIRY_STARTED'
  | 'INQUIRY_SUBMITTED';

/**
 * Trace une étape du parcours (mesure d'usage). Aucune donnée personnelle :
 * étape + univers + NOM du champ en échec (jamais sa valeur).
 */
export function trackFunnelStep(
  step: FunnelStep,
  data: { universe?: 'services' | 'market'; field?: string } = {},
): void {
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return;
    const body = JSON.stringify({ step, ...data });
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/events/funnel', blob);
      return;
    }
    void fetch('/api/events/funnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  } catch {
    /* silencieux par conception */
  }
}
