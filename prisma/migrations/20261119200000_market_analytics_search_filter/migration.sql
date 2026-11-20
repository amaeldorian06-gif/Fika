/* Refonte Market phase 3 : événements analytics de recherche et filtres.
   Additif uniquement — valeurs d'enum ajoutées, aucune valeur retirée.
   - SEARCH_PERFORMED : recherche avec résultats (meta.query, meta.resultCount)
   - SEARCH_EMPTY     : recherche sans résultat (meta.query)
   - FILTER_USED      : filtre appliqué sur une liste (meta.filters)
   - ORDER_CONFIRMED  : commande confirmée par Fika (émis côté serveur,
     meta.orderNumber) — mesure la conversion réelle, sans donnée personnelle. */

ALTER TYPE "MarketAnalyticEventType" ADD VALUE 'SEARCH_PERFORMED';
ALTER TYPE "MarketAnalyticEventType" ADD VALUE 'SEARCH_EMPTY';
ALTER TYPE "MarketAnalyticEventType" ADD VALUE 'FILTER_USED';
ALTER TYPE "MarketAnalyticEventType" ADD VALUE 'ORDER_CONFIRMED';
