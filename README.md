# Fika — Setup base de données (fondation Prisma)

Stack : PostgreSQL + Prisma 5 (`prisma/schema.prisma`). Les pages restent sur
les données statiques (`src/lib/data.ts`) — la bascule DB est le chantier P03.

## 1. Variables d'environnement

```bash
cp .env.example .env
# Renseigner DATABASE_URL (PostgreSQL) et VITE_WA_PHONE (+23767164936, TODO_PROD)
```

## 2. Scripts npm à déclarer (package.json hors périmètre d'édition ici)

> À ajouter manuellement dans `package.json` :

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```

## 3. Mise en route

```bash
npm ci                          # dépendances (prisma, @prisma/client, bcryptjs, tsx)
npm run prisma:generate         # régénère le client typé
npm run prisma:migrate          # crée/applique la migration « foundation » (dev)
#  → si DATABASE_URL indisponible, appliquer le SQL de référence :
#    psql "$DATABASE_URL" -f prisma/migrations/20260101000000_foundation/migration.sql
npm run prisma:seed             # seed idempotent (ville, zones, AdminUser)
```

Le seed est **idempotent** (upserts sur clés uniques) : relancez-le autant de
fois que nécessaire, aucun doublon.

## 4. Ce que contient le seed

- **City** « Ngaoundéré » (active, position 1) ;
- **25 zones** TODO_PROD issues de la liste fournie (Ngaoundéré I & II urbain),
  toutes `deliveryIncluded=true` — à valider par le fondateur avant production ;
- **AdminUser** SUPERADMIN depuis `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`
  (hash bcrypt généré à la volée si absent, mot de passe dev à corriger) ;
- Catalogue (catégories/services/packs) : stubs vides en attente P03.

## 5. Tunnel /demande — test manuel hors-ligne (P05)

1. Ouvrir `/demande`, remplir le formulaire (validation française bloquante :
   besoin ≥ 10 caractères, quartier obligatoire, téléphone E.164 si renseigné,
   consentement obligatoire).
2. **En ligne** : le POST `/api/leads` enregistre le Lead (`source SITE`,
   `status NEW`, ville/quartier/budget) → écran de confirmation avec récap et
   référence `LEAD-XXXXXX` + CTA WhatsApp prérempli « Réf : demande #LEAD-XXXXXX ».
3. **Hors-ligne** (couper le réseau ou simuler l'absence d'API) : le fallback
   ouvre WhatsApp automatiquement avec le même message, mention
   « demande site, non enregistrée », puis affiche l'écran de repli.
4. Aucune erreur console applicative ; le numéro est toujours masqué
   (`+2376••• •• 78`) dans les récapitulatifs et logs serveur.

## 6. Back-office /admin (P06)

- **Accès** : `/admin/*` exige une session. Sans cookie valide, l'écran de
  connexion s'affiche ; chaque mutation serveur revérifie la session
  (défense en profondeur). L'admin est en `noindex, nofollow`.
- **Compte par défaut** (seed) : `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`.
  ⚠️ **Changement de mot de passe obligatoire avant mise en production** —
  le seed génère sinon un mot de passe de développement.
- **Secret de session** : `AUTH_SECRET` (≥ 32 caractères) — cookie httpOnly,
  SameSite=Lax, Secure en production, durée 12 h, 5 tentatives/min/IP.
- **Routes** : `/admin` (vue d'ensemble), `/admin/orders`, `/admin/orders/[id]`,
  `/admin/leads`, `/admin/clients`, `/admin/experts`, `/admin/analytics` (P08).
- **Aucun chiffre n'est codé en dur** : CA, marge, panier moyen, pipeline et top
  services sont des agrégats calculés (`lib/admin/kpi.ts` + `lib/pricing.ts`).
  Sans base connectée, l'interface affiche des états vides explicites.
- **Transitions de statut** : validées par `lib/admin/status.ts` (graphe + règles
  — un expert pour « Assignée », un paiement confirmé pour « Payée » et
  « Terminée ») et tracées dans `OrderEvent`.

## 7. Chaîne opérationnelle & preuve (P07)

Parcours complet, piloté de bout en bout par l'équipe Fika :

1. **Demande** (`/demande`) → `Lead` (`SITE`, `NEW`).
2. **Conversion** (admin › Demandes) → `Order` (`QUALIFYING`, `CMD-2026-xxxx`) + `OrderEvent`.
3. **Devis** (détail commande) → `Quote` (`DEV-2026-xxxx`) qui fixe `totalPrice`.
4. **Paiement confirmé** → transition `PAID` (bloquée sinon).
5. **Affectation** → `Task` + `TaskAssignment` + ligne `Cost EXPERT`
   (pré-remplie au coût habituel) ; l'expert passe indisponible ;
   la marge se recalcule immédiatement.
6. **Avancement** : tâche `ASSIGNED → IN_PROGRESS → REVIEW → COMPLETED`
   (mise à jour par l'admin, canal WhatsApp externe — le client n'a jamais
   de contact direct avec l'expert). À la clôture, l'expert redevient
   disponible et son compteur de missions progresse.
7. **Livraison** : statut `DeliveryStatus`, preuve (URL photo), coût interne
   tracé en `Cost DELIVERY`. **Frais client : toujours 0 F** à Ngaoundéré.
8. **Terminée** (`COMPLETED`, exige paiement confirmé) → « Demander un avis »
   (message WhatsApp prérempli) puis enregistrement de l'avis.
9. **Preuve publique** : `POST /api/reviews` n'accepte QUE des commandes
   `COMPLETED` sans avis existant (`orderId` unique en base **et** contrôle
   applicatif) ; note 1–5 ; `verified=true`. Le portfolio se publie depuis
   une commande terminée (`PortfolioItem.orderId`).
10. **Vitrine** : témoignages et réalisations proviennent de la base
    (pseudo + ville uniquement, jamais de nom complet ni de téléphone).
    Tant qu'aucune donnée réelle n'existe, la page affiche des exemples avec
    un badge « Exemples · nos premiers avis vérifiés arrivent » — **aucune
    fausse review n'est jamais écrite en base**.

Le score des experts est **calculé à la lecture** (`computeExpertScore`), jamais stocké.

## 8. Invariants rappelés par le schéma

- Argent en **Int FCFA** partout ; marge = `Order.totalPrice − Σ(Cost)`,
  calculée à la lecture — jamais stockée en doublon sur `Order`.
- **Livraison gratuite pour le client** à Ngaoundéré : règle métier
  (`Zone.deliveryIncluded=true`), le coût interne reste tracé (`Delivery.fee`).
- **1 avis public = 1 commande complétée** : `Review.orderId @unique`,
  `rating` 1–5 contraint au niveau applicatif.
