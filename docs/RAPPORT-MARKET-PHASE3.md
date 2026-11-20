# FIKA MARKET — Rapport Phase 3 : recherche, filtres, tri & analytics

**Date :** 19/11/2026 · **Statut : livré, QA complète verte** · Précède : `RAPPORT-MARKET-PHASE2.md`

## 1. Périmètre livré (CDC « FIKA MARKET — Refonte classification + UX » v1.0, §4-5, §9)

| Exigence CDC | Livré | Où |
|---|---|---|
| Recherche immédiatement visible (§4.1) | Barre plein cadre en tête de l'accueil, suggestions produit en direct (5 max) avec photo + prix | `MarketHome.tsx` |
| Page « Tous les produits » (§4.2) | Nouvelle route `/boutique/tous` : grille complète, recherche vivante, filtres, tri, compteur | `MarketAll.tsx`, `App.tsx` |
| Recherche tolérante (§4.3) | Accents/casse ignorés, pluriel/préfixe de mot, 1 faute tolérée par mot ≥ 4 lettres (Levenshtein borné) | `shared.tsx` `searchProducts` |
| Filtres (§4.4) | Catégorie, marque, tag, disponibilité — options **dérivées des données réelles** (jamais de valeur fantôme) ; étiquettes actives retirables d'un clic ; panneau dédié mobile (bottom sheet) | `MarketAll.tsx`, `MarketCategory.tsx` |
| Tri (§4.3) | Pertinence (ordre catalogue — **aucune popularité artificielle**), nouveautés, prix croissant/décroissant | idem |
| État conservé (§4.4) | Recherche + filtres + tri persistés en `sessionStorage` (clé par page/catégorie), restaurés au retour d'une fiche ; le paramètre `?q=` prime à l'arrivée | `shared.tsx` `usePersistentState` |
| Zéro résultat honnête (§4.5) | Message dédié + issues réelles : catégories, « Demander un produit », WhatsApp | `MarketAll.tsx`, `MarketCategory.tsx` |
| Pages catégories (§5) | Sous-catégories visibles en pastilles (« Tous » = catégorie entière, aucun produit masqué), filtres contextuels marque/disponibilité, tri | `MarketCategory.tsx` |
| Fil d'Ariane (§5.4) | Accueil / Boutique / [Catégorie / Sous-catégorie] / Produit sur les 3 types de pages | idem |
| Historique de recherche | 5 dernières requêtes en `localStorage` (`fika:market-search-history`), jamais transmises | `shared.tsx` |
| Analytics §9 | Voir §3 | — |

## 2. Découpage du monolithe (676 lignes → 6 fichiers)

`src/components/market/Market.tsx` (supprimé) devient :

- `shared.tsx` — formatPrice, styles disponibilité, `useCatalog`, `ProductImage` (repli image morte mémorisé), `useCarouselIndex` + `ProductCard` (carousel 5 s + fondu, pause survol/focus, reduced-motion), `searchProducts`, historique, `usePersistentState`, étiquettes filtres.
- `MarketHome.tsx` — accueil éditorial : recherche visible, suggestions, cartes catégories (jamais vides — count réel), collections en carrousels horizontaux, CTA compté « Voir tous les produits (N) », réassurance réelle, état catalogue vide orienté demande.
- `MarketAll.tsx` — page « Tous les produits » (filtres desktop en ligne + bottom sheet mobile, tri, étiquettes, état vide).
- `MarketCategory.tsx` — page catégorie (sous-catégories, filtres contextuels, tri).
- `MarketProduct.tsx` — fiche : fil d'Ariane complet, marque et référence, encart « sur commande » (PREORDER), specs, variantes, quantité, recommandations même catégorie.
- `MarketOrder.tsx` — **panier + commande déplacés à l'identique** (règle : ne pas toucher la logique checkout/submit ; `queryParam` relu à chaque rendu, requestKey UUID, idempotence, validationsinchangées).

Comportements repris sans changement : événements `SHOP_VIEWED / CATEGORY_VIEWED / PRODUCT_VIEWED / ADD_TO_CART / CART_VIEWED / CHECKOUT_STARTED`, carousel (timings identiques), validation téléphone E.164, boutons panier/commande/WhatsApp.

## 3. Analytics (backend)

- **Migration `20261119200000_market_analytics_search_filter`** (déployée) : 4 `ALTER TYPE … ADD VALUE` — `SEARCH_PERFORMED`, `SEARCH_EMPTY`, `FILTER_USED`, `ORDER_CONFIRMED`.
- `POST /api/market/events` : meta étendue `query` (≤ 100 car.), `filters` (record<string,string>), `resultCount` (0-10 000) — **aucune donnée personnelle** ; rate-limit 60/min/IP inchangé, scopes séparés.
- Transition admin → `CONFIRMED` : crée `ORDER_CONFIRMED` (meta.orderNumber) **dans la transaction** (`admin-market.ts`) — conversion mesurée côté serveur uniquement, jamais déclarée par le client.
- Client : `SEARCH_PERFORMED`/`SEARCH_EMPTY` émis avec debounce 900 ms (une recherche « terminée », pas chaque frappe) ; `FILTER_USED` à l'application d'un filtre. `ORDER_CONFIRMED` volontairement absent de la liste des types client (`MARKET_ANALYTIC_TYPES`).

## 4. QA — tout vert

- `tsc` : OK · **vitest 308/308** (dont nouvelles assertions `ORDER_CONFIRMED` : créé à la transition CONFIRMED uniquement, avec le numéro de commande).
- E2E : **market-tout 40/40** (réécrit pour la Phase 3 — accueil éditorial, suggestions, fil d'Ariane, recherche vivante, filtres, tri, étiquettes, état conservé au retour, zéro résultat, carousel, reduced-motion, **analytics vérifiés en base**) · market-image-fallback 3/3 (reciblé `/boutique/tous`) · nav-phase1 65/65 · parcours-produit 36/36 · qa-largeurs 94/94 · hero-layout 70/70 · routage-seo 15/15 · search-services 11/11 · services-ux 19/19 · admin-essentiel 41/41 · admin-analytics-searches 18/18 · commandes-reception 24/24 · temoignage-reel 22/22 · demande-fichier-smoke 9/9.
- Données : seed + cleanup exécutés ; 16 produits publiés, collections intactes ; commandes réelles intactes (5 — voir §6).

## 5. Incident découvert et corrigé : les tests unitaires envoyaient de VRAIS e-mails

**Constat.** Vitest charge le `.env` local (résolution Vite) : avec `GMAIL_APP_PASSWORD` renseigné, chaque commande/demande créée par les tests unitaires déclenchait un envoi SMTP réel (~600 ms/ordre d'où des timeouts 5 s sur les tests de rate-limit) **et polluait la boîte du destinataire**.

**Correction.**
1. `market.test.ts` + `leads-flow.test.ts` : mock de `../lib/notify` — seules `sendMarketOrderAlert`/`sendLeadAlert` sont mockées (rendus et helpers restent réels). Aucun envoi réel depuis les tests ; vitest repassé de ~15 s à ~1,8 s.
2. Batterie E2E jouée avec GMAIL/NOTIFY temporairement commentés dans `.env` (aucune alerte partie pendant la QA), puis **restaurés** — serveur redémarré, alertes de nouveau actives en local.

**Impact honestement signalé :** environ une centaine d'e-mails « Nouvelle commande Fika Market MKT-2026-0007 » (numéro issu des mocks, quasi identiques) sont partis vers hello1247778@gmail.com pendant mes runs de diagnostic d'aujourd'hui (avant correction). Ils se suppriment en bloc (fil de discussion Gmail). Aucune donnée n'a été écrite en base par ces envois (prisma mocké). La commande réelle MKT-2026-0056 (voir §6) a par contre déclenché une vraie alerte — comportement attendu.

## 6. Remarques d'état

- **MKT-2026-0056** : commande réelle créée depuis le site à 20:46 (utilisateur, quartier Manwi, Boîtier 3.0 Toshiba) puis passée AWAITING_CLIENT → AWAITING_PAYMENT depuis l'admin à 20:55-20:56. C'est un test en direct de l'utilisateur — **conservée intacte**. La base contient donc 5 commandes.
- Serveur dev : `fika-market-alertes-actives-f73ad82f` (port 3000, override pool /tmp/db-url-override.txt), alertes e-mail actives.
- Captures : `/home/user/market-p3-*.png` (accueil, accueil mobile, tous+recherche, tous+filtres, filtres mobile, catégorie, fiche produit).

## 7. Limitations connues (inchangées ou nouvelles)

- Tri « pertinence » = ordre du catalogue (position/actualité) : aucun signal de popularité public n'existe — volontaire (CDC §4.3).
- Historique de recherche : localStorage navigateur uniquement, non synchronisé (pas de compte client).
- Le tri/filtres s'appliquent côté client sur le catalogue public complet (16 produits) ; à grande échelle (> ~200 produits), une recherche serveur sera nécessaire — signalé dès maintenant.
- Catalogue Services toujours statique ; segments analytics persistants non implémentés (données événements brutes disponibles côté admin).
- Prod : **10+1 commits en attente de push** (voir Git) ; alertes e-mail en prod attendent toujours les variables Vercel (`GMAIL_APP_PASSWORD`, `GMAIL_USER`, `NOTIFY_EMAIL` optionnel).

## 8. Git

Commit Phase 3 : découpage composants + routes + UX + analytics + tests (voir `git log`). Migration 20261119200000 **déjà déployée** en base — le push Vercel rejouera `migrate deploy` sans effet.
