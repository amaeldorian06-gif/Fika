import type { WaContext } from './whatsapp/engine';

/**
 * Capture des clics WhatsApp (analytics P08).
 * Envoie un beacon POST /api/events/waclick. Échec totalement silencieux :
 * l'absence d'API ne doit JAMAIS bloquer ni signaler une conversion.
 */

export type TrackedEventType = 'WACLICK' | 'LEAD_VIEW';

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
