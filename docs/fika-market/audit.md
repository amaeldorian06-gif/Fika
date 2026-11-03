# Audit technique — Fika 2.0

> Phase 1 du plan d'exécution. Baseline : commit `baa3063` (Fika Market V1), arbre Git propre, aucun changement non commité. Audit réalisé par inspection directe du code, la veille de toute modification.

## 1. Architecture réelle

**Monolithe modulaire** — pas Next.js :

| Couche | Technologie | Emplacement |
|---|---|---|
| Presentation | React 19 + Vite 6 (SPA, routeur par hash maison `src/router.tsx`) | `src/` |
| Application | Express 5 (même origine que le front, sert `/api` et le build) | `server/routes/`, `server/app.ts` |
| Domaine | Modules purs TypeScript (règles, transitions, calculs) | `src/lib/` |
| Infrastructure | Prisma 5 + PostgreSQL (Supabase, connexion poolée IPv4) | `prisma/`, `src/lib/prisma.ts` |

Fonctionnement : `server.ts` démarre Express ; en dev il monte Vite en middleware, en prod il sert `dist/`. Déploiement Vercel (fonction `api/index.ts`) + Supabase.

**Conséquence SEO** : le routeur est par hash (`/#/boutique/...`). Les crawlers voient une seule page HTML ; les métadonnées par produit sont gérées côté client (title, description, JSON-LD injectés dynamiquement). Un sitemap des routes racines publiques reste utile ; l'indexation profonde des produits nécessiterait du SSR (post-MVP).

## 2. Technologies en place

- React 19, Vite 6, TypeScript strict (2 tsconfig : app + api), Tailwind (tokens de design centralisés).
- Express 5, sessions admin par cookie signé HMAC (**compte fondateur codé dans `server/lib/founder.ts`, login/session indépendants de la base** — exigence fondateur).
- Prisma 5, 8 migrations appliquées (baseline documentée), `nextDocumentNumber` pour les numérotation CMD/DEV/MKT/APR.
- Vitest : **219 tests verts** (17 fichiers) au moment de l'audit.
- Aucune dépendance superflue : pas de librairie d'état, pas de UI kit externe, composants maison.

## 3. Fonts et identité

`src/index.css` charge Inter (corps), Plus Jakarta Sans (titres), Caveat (signature), **Playfair Display (serif éditorial — token `--font-serif` déjà présent, non exploité)**. La palette Fika (#F8F5EF, terracotta #B86F52, noir #242321, gris #89857F, blanc) est en tokens Tailwind.

## 4. Fonctionnalités existantes

**Fika Services (production, vérifié e2e)** : accueil éditorial, catalogue 38 services / 5 univers, fiches service, formulaire de demande (validation zod partagée, téléphone CM normalisé E.164, idempotence), back-office complet (leads, qualification, conversion en commande, devis, experts, paiements, coûts, livraisons, avis, exports CSV/ZIP quotidiens, archivage réversible, analytiques).

**Fika Market V1 (livré, non encore poussé en production)** : catalogue/fiche produit (projection publique sans coûts), commande publique idempotente (requestKey UUID, rate-limit IP), suivi par code personnel, 15 statuts avec transitions contrôlées serveur, confirmation de prix final, paiements manuels vérifiés, lots d'approvisionnement, livraisons, marge réelle par commande livrée, KPIs, exports CSV.

## 5. Routes

**Publiques** : `/`, `/services`, `/univers/:slug`, `/service/:slug`, `/demande`, `/mentions-legales`, `/cgv`, `/confidentialite`, `/boutique`, `/boutique/categorie/:slug`, `/boutique/produit/:slug`, `/boutique/commande`, `/boutique/suivi`.

**API publique** : `GET /api/market/catalog|product/:slug`, `POST /api/market/orders`, `GET /api/market/orders/track`, `POST /api/leads`, `GET /api/testimonials|portfolio`…

**Admin** (`/admin/*`, garde session) : overview, orders, orders/:id, leads, clients, experts, reports, analytics + `market/{overview,products,categories,suppliers,orders,orders/:id,batches}` et 18 routes POST market.

## 6. Schéma de base

Services : Customer, Lead, Order/OrderItem, Payment, Cost, Event, Expert, Verification, Review, Portfolio, DocumentCounter, AdminUser, ExportBatch…
Market (V1) : MarketCategory, MarketSupplier, MarketProduct (images/specs en Json, coûts admin-only), MarketOrder (trackCode, requestKey uniques), MarketOrderItem (snapshot prix), MarketOrderEvent (journal), MarketPayment, MarketProcurementBatch, MarketDelivery, MarketReturn (réservé, inutilisé).

## 7. Composants réutilisables

`Button` (variantes + asChild), `Field/Input/Select/Textarea`, `EmptyState`, `StatusBadge`, `useAsync`, `KpiCard`, layout Header/Footer. Système cohérent — le design system demandé existe déjà ; il sera étendu (gallery, accordions, cart badge) sans refonte.

## 8. Problèmes identifiés

1. **V1 Market manque les entités du modèle 2.0** : pas de devis formels (la confirmation de prix est en ligne sur la commande), pas de variantes, pas de panier, pas d'enregistrements de remboursement, pas de dépenses de lot/allouées, cycle de vie paiement implicite, statuts lot simplifiés (5 au lieu de 9), pas d'événements analytiques Market.
2. **Bug historique corrigé en V1** (à conserver en mémoire) : les routes market avaient été enregistrées avant `express.json()` → corps non parsé. Réglé, testé.
3. **`nextDocumentNumber`** : pour tout préfixe ≠ CMD, il compte les `quote` (devis Services) pour initialiser le compteur — accidentellement inoffensif pour MKT/APR mais **faux par construction pour un futur préfixe devis Market**. À corriger avant d'ajouter `MQT`.
4. Routeur hash = plafond SEO produit (cf. §1).
5. `MarketReturn` déclaré mais jamais câblé — à remplacer par `MarketRefund` (remboursements réels) plutôt que de garder un modèle mort.
6. La page d'accueil actuelle n'a pas d'entrée Boutique structurée (seul le header/footer l'exposent) — la section éditoriale Market de la home 2.0 reste à construire.

## 9. Risques de régression

- Modifier la home / le header touche au parcours Services **en production** → changements additifs, tests e2e Services à rejouer.
- Ajouter des valeurs d'enum Postgres est additif (sûr) ; les transitions modifiées doivent rester rétro-compatibles pour les tests et l'UI admin existants (les boutons de transition se génèrent depuis `MARKET_TRANSITIONS`).
- La base est **vide côté Market** (0 commande après nettoyage e2e) → fenêtre idéale pour faire évoluer le modèle sans migration de données.
- La base est la base **de production** (Supabase) → migrations additives uniquement, jamais destructives.

## 10. Recommandations

1. **Garder la stack existante** (voir `decisions.md` D1) — le cahier des charges lui-même impose « prioriser les technologies du projet » et « décisions finales basées sur l'audit ».
2. Étendre le module Market existant (pas de réécriture) : devis, remboursements, dépenses/allouées, variantes, panier, statuts complémentaires.
3. Corriger `nextDocumentNumber` ( mapping préfixe → table) avant d'introduire `MQT`.
4. Frontend 2.0 : réutiliser `--font-serif` (Playfair Display) pour l'expérience éditoriale Market — aucun ajout de dépendance.
5. Remplacer `MarketReturn` (mort) par `MarketRefund` dans la même migration.

## 11. Plan d'exécution (rappel)

Phase 1 audit ✔ (ce document) → Phase 2 architecture/modèle/décisions → Phase 3 design system & pages publiques → Phase 4 backend Market → Phase 5 administration → Phase 6 intégration → Phase 7 tests → Phase 8 livraison. L'ordre 4→3 est inversé en pratique (le backend conditionne les interfaces) sans impact sur les livrables.
