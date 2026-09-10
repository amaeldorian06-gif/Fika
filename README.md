# Fika

Application React 19 + Vite, API Express 5 et PostgreSQL via Prisma 5.
Le serveur sert le site **et** `/api` sur la même origine. Le catalogue public
reste statique (`src/lib/catalog-data.ts`) ; le seed catalogue aligne ses IDs en base.

## Hébergement retenu : Vercel + Supabase

Le frontend Vite et l'API Node sont préparés pour Vercel. Voir
[le guide Vercel/Supabase](docs/vercel-supabase.md) pour les variables privées,
les connexions poolées, les migrations et la publication depuis GitHub.
`DIRECT_URL` est désormais requis pour les migrations Prisma ; en local sans
pooler, il peut être identique à `DATABASE_URL`.

## Accéder au dashboard admin

1. Ouvrir **`https://VOTRE-DOMAINE/#/admin`** (en local :
   `http://localhost:3000/#/admin`). Le lien **« Espace équipe »** du pied de page
   ouvre le même écran. `/admin` redirige aussi vers `/#/admin` avec le serveur Node.
2. Se connecter avec l'e-mail défini dans **`ADMIN_EMAIL`** et le mot de passe
   correspondant au **`ADMIN_PASSWORD_HASH`** utilisé pour créer le compte.
   **Il n'existe plus de mot de passe par défaut.** Le hash n'est pas à saisir
   dans le formulaire de connexion.
3. Le compte doit exister dans `AdminUser` et être actif. Les rôles actuels
   sont `SUPERADMIN` et `OPS` ; les deux accèdent aux opérations.

### Première installation

```bash
npm ci
cp .env.example .env
# Renseigner DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_EMAIL et ADMIN_PASSWORD_HASH.
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run prisma:seed:catalog
npm run dev
```

**Avant toute migration d'une base existante : sauvegarde et vérification du
schéma.** L'ancien serveur utilisait des tables Drizzle en snake_case, différentes
des tables Prisma. `prisma:deploy` ne transfère pas ces anciennes données : prévoir
un import contrôlé si cette ancienne base a servi. Ne pas utiliser `db:push` en production.

Pour un essai local uniquement, `ADMIN_PASSWORD` (12 caractères minimum) peut
remplacer le hash ; le seed le hache. En production, le hash est obligatoire.
Générer un secret de session avec :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Stocker les secrets dans `.env` non versionné ou dans le gestionnaire de secrets
de l'hébergeur, jamais dans le code ni dans la conversation.

### Créer le compte ou renouveler son mot de passe

Renseigner les nouvelles valeurs dans l'environnement, puis :

```bash
npm run admin:seed
```

Cette commande crée le compte ou **remplace son mot de passe** pour l'e-mail
indiqué ; elle ne réactive pas un compte désactivé et ne change pas son rôle.
Le seed général `prisma:seed` conserve le mot de passe d'un compte existant.
Pour invalider toutes les anciennes sessions après une compromission, renouveler
également `AUTH_SECRET` et redémarrer le serveur. Pas de récupération par e-mail en v1.

### Si la connexion ne marche pas

- **Service indisponible** : vérifier `DATABASE_URL`, les migrations, le client
  Prisma généré et `AUTH_SECRET` (32 caractères minimum).
- **E-mail ou mot de passe incorrect** : vérifier le compte, son activation et
  le mot de passe effectivement semé ; changer `.env` seul ne change pas la base.
- **Trop de tentatives** : attendre une minute (5 essais/minute/IP).
- **Hébergement statique seul** : il ne fournit pas les API ; démarrer le serveur
  Node ou utiliser l'adaptateur Vercel fourni. Un simple déploiement du dossier `dist` n'est pas suffisant.
- En production, HTTPS est requis pour le cookie `Secure`. Ne pas appeler une API
  sur `localhost` depuis le navigateur déployé ; les URLs sont relatives à `/api`.

## Opérations ajoutées après l'audit

Les écrans **Experts**, la conversion des demandes sans téléphone et les **paiements
manuels** sont maintenant utilisables. Un reçu doit être vérifié explicitement,
et seul le paiement intégral permet le statut « Payée ». Aucune opération MTN/Orange
n'est déclenchée automatiquement. Une nouvelle migration protège les références de
reçus, la conversion et la numérotation.

Voir [le guide des opérations](docs/admin-operations.md) avant activation.
`npm run setup:check` contrôle la configuration en lecture seule, sans afficher
les secrets. Les anciennes données Drizzle restent à reprendre si nécessaire.

## Connexions raccordées

| Parcours | API / stockage |
|---|---|
| Connexion, restauration de session, déconnexion | `/api/auth/login`, `/me`, `/logout` ; cookie signé httpOnly, 12 h |
| Formulaire de demande → admin Demandes | `POST /api/leads` → Lead / Customer |
| Conversion, devis, coûts, statuts | `/api/admin/leads/convert`, `/api/admin/orders/*` |
| Reçus manuels et vérification | `/api/admin/payments`, `/api/admin/payments/review` |
| Affectation, tâches, livraison | `/api/admin/orders/assign`, `/api/admin/tasks/status`, `/api/admin/orders/delivery` |
| Clients, experts, KPI, analytics et export | `/api/admin/*` → données Prisma, DTO adaptés à l'interface |
| Avis et réalisations | Écriture authentifiée, lectures publiques `/api/testimonials`, `/api/portfolio` |
| Clics WhatsApp et vues | `/api/events/waclick`, `/api/events/leadview` → Event |

Toutes les routes admin et la création d'avis vérifient la session serveur.
Les erreurs ne basculent **jamais** sur des données de démonstration : elles sont
signalées avec possibilité de réessayer. `preview-store.ts` est un ancien jeu de
fixtures, non utilisé par le client API. Les anciens scripts `seed-data.ts`,
`test-db.ts`, `update-server*.ts` et `src/db/` sont des vestiges Drizzle : **ne pas
les utiliser** pour ce serveur ni pour mettre à jour une base réelle.

WhatsApp utilise un lien `wa.me` avec `VITE_WA_PHONE` : ce n'est pas une intégration
WhatsApp Business API. Les clics ne créent pas automatiquement de commandes.

## Vérification et production

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm start` active le mode production et écoute `0.0.0.0:$PORT` (3000 par défaut).
`/api/health` vérifie que le serveur répond, **pas** la disponibilité de PostgreSQL.
Voir [README-PRODUCTION.md](README-PRODUCTION.md) et
[l'audit du 9 septembre 2026](docs/audit-2026-09-09.md) pour les limites et suites.
Les anciens jalons d'`AUDIT_FINAL.md` sont historiques, pas une certification de production.
