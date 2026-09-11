# Fika — Déploiement Vercel / Node + PostgreSQL

Mise à jour : 9 septembre 2026. Le runtime réel est **Express + Vite + Prisma**,
pas Next.js. Les anciens contrats Next dans certains commentaires sont historiques.

## Prérequis

- Node compatible Vite 7 (Node 22.12+ recommandé), npm et PostgreSQL.
- Accès réseau aux binaires Prisma pendant l'installation/génération.
- HTTPS, sauvegardes de base et gestionnaire de secrets.
- `DATABASE_URL`, `DIRECT_URL` (migration), `AUTH_SECRET` (≥32 caractères aléatoires), `ADMIN_EMAIL`,
  `ADMIN_PASSWORD_HASH` (bcrypt), `VITE_WA_PHONE` au build ; `PORT` facultatif.
- Les secrets précédemment versionnés doivent être **renouvelés** : mot de passe
  PostgreSQL, mot de passe admin et secret de session. Les retirer du code ne
  les retire pas de l'historique Git.

`APP_URL` documente l'URL du déploiement ; à ce stade les métadonnées publiques
utilisent encore `src/lib/site.ts` et `public/sitemap.xml`. Les mettre à jour
ensemble si le domaine n'est pas `fika.cm`.

## Installation

```bash
npm ci
npm run prisma:generate
# Sauvegarder et vérifier le schéma cible AVANT de migrer.
npm run prisma:deploy
NODE_ENV=production npm run prisma:seed
npm run prisma:seed:catalog
npm run typecheck
npm test
npm run build
npm start
```

Les migrations Prisma ne migrent **pas** automatiquement les anciennes tables
Drizzle (`admin_users`, `orders`, etc.). Si elles contiennent de vraies données,
préparer et tester une reprise spécifique avant la bascule.

Le processus Node doit rester actif (service de l'hébergeur, conteneur ou systemd).
Configurer le reverse proxy vers le port Node ; `/api` et le site doivent rester
sur la même origine. Le dossier `dist` seul n'est pas un backend.

### Vercel + Supabase (cible retenue)

L'adaptateur `api/index.ts` et les rewrites `/api/*` sont maintenant fournis.
Vercel sert le build Vite et appelle l'API comme fonction Node. Le serveur permanent
`npm start` reste réservé aux déploiements Node classiques.

Suivre **[docs/vercel-supabase.md](docs/vercel-supabase.md)** pour les variables,
le pooler, la migration séparée et le compte admin. Le build Vercel est
`npm run build:vercel` ; ne pas migrer/semer automatiquement au build.

### Proxy et sécurité

- Définir `TRUST_PROXY_HOPS` uniquement selon le nombre réel de proxys de confiance.
  Sans cela, tous les visiteurs derrière un proxy peuvent partager la même limite.
  Ne jamais accepter arbitrairement un `X-Forwarded-For` provenant d'Internet.
- Cookie httpOnly, SameSite=Lax, Secure en production, signé pour 12 h.
- Limites de tentatives en mémoire : prévoir Redis/store partagé en multi-instance,
  et un contrôle de débit au reverse proxy, notamment sur les routes Event.
- Les mutations exigent du JSON ; les requêtes explicitement cross-site sont refusées.
- Ajouter au proxy CSP adaptée aux ressources, HSTS, Referrer-Policy et les autres
  headers de sécurité. Le fichier `vercel.json` ne s'applique pas au serveur Node.
- Le mode de prévisualisation autorise les hôtes `.e2b.app` dans Vite.

Exécuter `npm run setup:check` pour contrôler la configuration en lecture seule.
La migration `20260909000000_admin_operations` doit être appliquée ; elle bloque
si des anciennes commandes partagent le même lead (réconciliation préalable requise).

## Accès et renouvellement admin

Adresse : **`https://VOTRE-DOMAINE/#/admin`**, également via « Espace équipe ».
Identifiant : `ADMIN_EMAIL`. Mot de passe : celui correspondant au hash fourni.
Aucun identifiant de secours ni mot de passe par défaut.

Pour créer ou renouveler un compte : configurer `ADMIN_EMAIL` et le nouveau
`ADMIN_PASSWORD_HASH`, puis `NODE_ENV=production npm run admin:seed`.
Changer aussi `AUTH_SECRET` pour invalider globalement les cookies existants.
La déconnexion efface le cookie du navigateur ; les jetons signés ne disposent
pas encore d'une révocation individuelle côté serveur.

## Recette avant ouverture

1. Sans cookie : `/api/admin/overview` et `POST /api/reviews` doivent répondre 401.
2. Connexion, actualisation de page, navigation puis déconnexion admin.
3. Déposer une demande réelle de test : même référence dans le récap et l'admin.
4. Convertir la demande, créer un devis, ajouter un coût : vérifier les lignes DB.
5. Affecter un expert de test, modifier la tâche et la livraison ; vérifier la marge.
6. Tester la saisie d'un reçu et sa confirmation manuelle dans « Paiements et
   reçus ». Vérifier les acomptes, références uniques et le solde intégral avant
   passage à « Payée ». Aucun opérateur MoMo/Orange Money n'est intégré. Voir
   `docs/admin-operations.md` et appliquer la nouvelle migration avant usage.
7. Vérifier les avis et réalisations depuis une commande terminée et consentie.
8. Couper la DB : erreur visible, aucun chiffre fictif ni succès simulé.
9. Sauvegarde + restauration sur base séparée ; test mensuel ensuite.

`/api/health` est un indicateur de vie du processus, pas un test DB. Prévoir une
surveillance applicative et DB distincte, sans données personnelles dans les logs.
Voir `docs/audit-2026-09-09.md` pour les autres chantiers avant production.
