# Fika — Configuration Vercel + Supabase

## État de cette préparation

Le dépôt contient maintenant :
- `api/index.ts` : API Express exportée comme fonction Node Vercel, sans serveur permanent ;
- `vercel.json` : preset Vite, build frontend, routage `/api/*` vers la fonction ;
- `DIRECT_URL` Prisma 5 pour séparer les migrations du pooler transactionnel ;
- `.env.example` avec l'e-mail admin demandé, **sans mot de passe ni clé réelle**.

Les tests HTTP passent par le même export que la fonction Vercel. Le déploiement,
le routage effectif Vercel et l'accès Supabase n'ont pas été vérifiés à distance.

## Variables privées à renseigner

Dans **Vercel → projet Fika → Settings → Environment Variables** :

| Nom | Valeur attendue |
|---|---|
| `DATABASE_URL` | URL PostgreSQL du **Transaction pooler** Supabase, port 6543, avec `pgbouncer=true&connection_limit=1&sslmode=require` pour Prisma 5 |
| `DIRECT_URL` | URL du **Session pooler**, port 5432, pour les migrations ; connexion directe possible si le poste qui migre supporte IPv6 |
| `AUTH_SECRET` | Nouveau secret aléatoire d'au moins 32 caractères |
| `ADMIN_EMAIL` | `amaeldorian06@gmail.com` |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt du mot de passe admin choisi, jamais le mot de passe brut |
| `VITE_WA_PHONE` | Numéro WhatsApp public au format `+2376XXXXXXXX` |
| `APP_URL` | URL publique du déploiement ; les métadonnées SEO restent à aligner dans `src/lib/site.ts` et `public/sitemap.xml` |

`ADMIN_EMAIL` et `ADMIN_PASSWORD_HASH` servent au **seed du compte**. Le login
utilise ensuite la table `AdminUser` ; changer les variables sans relancer le seed
ne modifie pas le compte existant. Ce compte Fika n'est pas un compte Supabase Auth.

Sur Supabase, ouvrir le projet → **Connect** puis copier les deux chaînes exactes.
Utiliser le mot de passe du rôle **PostgreSQL**, pas celui du compte admin Fika.
Encoder les caractères spéciaux du mot de passe dans l'URL. Ne jamais préfixer
ces secrets par `VITE_`, qui les exposerait dans le JavaScript du navigateur.

**Pas de clé `anon` / publishable, `service_role` / secret API, JWT Supabase,
ni token personnel Vercel/GitHub nécessaire dans le code actuel.**
Ne transmettre aucun de ces secrets dans le chat, une issue ou un commit.

Le mot de passe admin précédemment exposé devrait être changé. S'il est conservé
malgré ce risque, utiliser uniquement son hash bcrypt dans le gestionnaire de
secrets ; il n'a pas été enregistré dans le dépôt ni configuré dans une base ici.

### Génération locale, sans mot de passe dans l'historique shell

Après `npm ci`, dans un terminal Bash de confiance :

```bash
# Secret de session à copier dans AUTH_SECRET :
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Mot de passe saisi sans écho ; seul le hash sera imprimé :
read -r -s -p 'Mot de passe admin : ' FIKA_PASSWORD; printf '\n'
printf '%s' "$FIKA_PASSWORD" | node -e "const fs=require('fs'); const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync(fs.readFileSync(0,'utf8'),12))"
unset FIKA_PASSWORD
```

Copier le hash dans `ADMIN_PASSWORD_HASH`, pas dans le formulaire de connexion.
Ne pas copier le résultat dans la conversation. Ces commandes ne créent pas le compte.

## Réglages et sécurité

- Vercel : **Framework Preset Vite**, Node **22.x**, build `npm run build:vercel`,
  output `dist`, installation `npm ci` (postinstall génère Prisma).
- Ne pas lancer `npm start` sur Vercel. La plateforme appelle `api/index.ts`.
- Le build Vercel ne produit pas le bundle serveur dans `dist` et n'exécute aucun
  seed ni migration automatiquement. Un déploiement preview ne doit pas réinitialiser
  le mot de passe ou écrire dans la production.
- Production et Preview : utiliser des bases/projets ou branches Supabase séparés,
  avec des variables propres. Ne pas partager la base de production avec une PR.
- Supabase : ces tables sont utilisées via Prisma, **pas via la Data API publique**.
  Désactiver la Data API si inutilisée, ou retirer les schémas/tables Fika de son
  exposition et vérifier les permissions/RLS. Ne jamais exposer `AdminUser`,
  `Customer`, `Payment` ou les autres tables internes via une clé publique.
- Les limites de connexion applicatives actuelles sont en mémoire et ne sont
  pas globales entre fonctions serverless. Configurer une règle Vercel Firewall
  sur `/api/auth/login` et prévoir un rate limiter partagé. Configurer la confiance
  proxy uniquement après vérification de la topologie, pas arbitrairement.

## Migration et création du compte (opération séparée)

Sur un poste/runner de confiance, avec les mêmes variables **dans un fichier
`.env` non versionné** ou un gestionnaire de secrets :

```bash
npm ci
npm run prisma:generate
# Sauvegarder la base et vérifier le schéma / doublons avant cette étape.
npm run prisma:deploy
NODE_ENV=production npm run prisma:seed
npm run prisma:seed:catalog
# Si le compte existait déjà et doit recevoir un nouveau mot de passe :
NODE_ENV=production npm run admin:seed
npm run setup:check
```

Après déploiement : `/api/health` doit répondre en JSON, `/api/admin/overview`
sans cookie doit répondre 401. Ouvrir **`https://VOTRE-SITE.vercel.app/#/admin`**
puis se connecter avec l'e-mail et le mot de passe correspondant au hash semé.
Vérifier actualisation, déconnexion et un parcours de test sur une base distincte.

## Git et publication

Les fichiers modifiés sont sauvegardés dans le checkout Arena, sur
`arena/01a08835-fika`. **Cela n'est pas un push GitHub ni un déploiement Vercel.**
Pour les publier : commit sur cette branche, push vers cette branche, puis PR
vers `main`. Si Vercel suit `main`, la production ne se mettra à jour qu'après
fusion et succès du déploiement. Ne pas fusionner sans les variables et la recette.

Références :
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/frameworks/backend/express
- https://supabase.com/docs/guides/database/prisma

La documentation Supabase récente utilise Prisma 7 ; Fika reste en Prisma 5.22
et configure donc `directUrl` dans `schema.prisma`, sans adaptateur Prisma 7.
