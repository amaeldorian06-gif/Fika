import type { MarketAnalyticType } from './market';

/**
 * Télémétrie funnel Fika Market — fire-and-forget, silencieuse en cas d'échec
 * (la navigation ne doit jamais dépendre de la télémétrie). Seuls les
 * événements pré-commande sont déclarés par le client ; les indicateurs
 * commerciaux (devis, paiements, livraisons) sont dérivés des données réelles
 * côté serveur.
 */
export function trackMarketEvent(
  type: MarketAnalyticType,
  data: { productId?: string; slug?: string; category?: string } = {},
): void {
  try {
    void fetch('/api/market/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...data }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore — jamais bloquant
  }
}
