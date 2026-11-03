# Architecture — Fika 2.0

> Phase 2. Décision structurante : **monolithe modulaire sur la stack existante** (React 19 + Vite / Express 5 / Prisma + Supabase PostgreSQL). Justification complète dans `decisions.md` (D1).

## 1. Frontières métier

```
┌───────────────────────────────────────────────────────────────┐
│                        Application Fika                        │
├───────────────┬───────────────┬───────────────┬───────────────┤
│   Services    │     Market    │  Admin/Auth   │   Transverse  │
│ (existant)    │   (e-commerce)│               │               │
│ leads         │ catalogue     │ session       │ Customer      │
│ orders        │ commandes     │ fondateur     │ (annuaire tel)│
│ devis DEV-    │ devis MQT-    │ garde routes  │ DocumentCounter│
│ experts       │ paiements     │ admin         │ Event (analytics)│
│ paiements     │ appro/lots    │ audit AdminUser│ design system│
│ livraisons    │ remboursements│               │ SEO/meta      │
│ avis, exports │ dépenses/marges│              │ exports CSV   │
└───────────────┴───────────────┴───────────────┴───────────────┘
```

**Règle** : Market et Services ne partagent **aucun processus métier** — uniquement des capacités transverses (annuaire client par téléphone, compteurs de numérotation, session admin, composants visuels, Prisma). Une commande Market n'utilise jamais le modèle Order/Quote de Services, et réciproquement. Le seul point de jointure volontaire est `Customer` (une personne = un numéro = une fiche), ce qui est un partage de données, pas de logique.

## 2. Couches (par domaine Market)

| Couche | Rôle | Fichiers |
|---|---|---|
| Presentation | Pages, composants, états UI | `src/components/market/*`, `src/components/admin/AdminMarket*.tsx` |
| Application | Cas d'usage, orchestration, validation d'entrée (zod), transactions | `server/routes/market.ts`, `server/routes/admin-market.ts` |
| Domaine | Règles pures : statuts, transitions, marges, allocation, cycles de vie | `src/lib/market.ts` |
| Infrastructure | Persistance (Prisma), numérotation, cookies de session | `prisma/schema.prisma`, `server/lib/*`, `src/lib/prisma.ts` |

Le domaine ne connaît ni React ni Prisma → testable unitairement (23 tests V1, étendus en V2). Aucune règle métier dans les composants : l'UI lit `MARKET_TRANSITIONS`, `deriveMarketPaymentStatus`, `computeMarketMargin` etc.

## 3. Flux d'une commande (Vue sequence)

1. Client (SPA) → `POST /api/market/orders` (zod, idempotence requestKey, rate-limit IP, upsert Customer) → commande `REQUESTED` + événement.
2. Admin → vérification fournisseur (`SUPPLIER_CHECK`) → **création du devis** (`POST /api/admin/market/quotes`) : snapshot items + prix verrouillés, n° `MQT-AAAA-NNNN`, validité configurable → commande `AWAITING_CLIENT`, devis `SENT`.
3. Devis communiqué (message WhatsApp généré) ; réponse client **enregistrée par l'admin** (`quotes/response`) : ACCEPTED → commande `AWAITING_PAYMENT` ; REJECTED → commande reste `AWAITING_CLIENT` (annulation ensuite possible).
4. Paiements enregistrés (`PENDING`) puis **vérifiés** par l'admin (`review`) → première vérification fait passer la commande en `CONFIRMED` (garde : jamais avant).
5. Appro : lot `APR` (dépenses avec méthode d'allocation), affectation des items (coût fournisseur unitaire), **application de l'allocation** → coût rendu réel par article.
6. Réception/contrôle → livraison (frais + coût réel) → `DELIVERED`. Marge réelle = Σ prix confirmés + frais − Σ coûts rendus − coût livraison.
7. Exceptions : remboursements enregistrés (`market/refunds`), transitions `REFUND_PENDING` → `REFUNDED`.

## 4. Sécurité

- **Session admin** : cookie signé HMAC (AUTH_SECRET), compte fondateur codé (`server/lib/founder.ts`) — login indépendant de la base. Toutes les routes `/api/admin/*` derrière la garde ; vérifié 401 sinon.
- **Transitions** : validées uniquement côté serveur (`canTransition` + gardes métier : `CONFIRMED` exige prix complets ; `DELIVERED` exige paiements vérifiés ≥ total ; acceptation de devis seulement depuis `AWAITING_CLIENT`).
- **Projections** : `toPublicProduct` sélectionne explicitement les champs publics — les coûts fournisseurs ne sortent jamais (testé unitairement + e2e).
- **Suivi public** : code aléatoire 8 caractères sans données personnelles ; aucune coordonnée client dans la réponse.
- **RLS Supabase** : non activée car **aucun client n'accède à la base** — tout passe par l'API Express avec le service connection (clé jamais exposée au front). Voir `decisions.md` (D9).
- Anti-abus : rate-limit IP création commande + événements analytiques ; idempotence requestKey ; validation zod partout ; verrouillage des prix dans le devis.

## 5. Notifications & paiements (MVP)

WhatsApp = liens pré-remplis générés côté client/admin (aucune intégration API revendiquée). Paiements 100 % manuels : enregistrement → vérification par l'admin → historique. Aucun fournisseur de paiement intégré (décision business à venir).

## 6. Analytics

- Événements de funnel côté client (`shop_viewed`, `category_viewed`, `product_viewed`, `add_to_cart`, `checkout_started`, `order_submitted`) → `POST /api/market/events` (table dédiée).
- Événements métier (devis envoyé/accepté, paiement vérifié, commande livrée) **dérivés des données réelles** (tables Market), jamais auto-déclarés.
- KPIs admin : conversion demande→confirmée, panier moyen, marges réelles, délais moyens par étape — calculés sur données réelles uniquement.

## 7. Déploiement

Vercel (front + fonction API) + Supabase (PostgreSQL poolé IPv4). Migrations Prisma additives uniquement, appliquées depuis le poste avec accès base (`npx prisma migrate deploy`). Procédure inchangée — voir `docs/vercel-supabase.md`.
