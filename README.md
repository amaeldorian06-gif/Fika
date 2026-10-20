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
2. Se connecter avec le **compte admin intégré au code** (identifiant + hash
   bcrypt dans `server/lib/founder.ts`) — la connexion et la session ne
   consultent **jamais** la base : elles restent possibles même si la base est
   indisponible. Les écritures créent la ligne d'audit `AdminUser` automatiquement.
   Pour changer le mot de passe : mettre à jour le hash dans `server/lib/founder.ts`
   puis redéployer.
3. Les exports quotidiens (ZIP : demandes, clients, commandes, paiements, coûts,
   statistiques) et l'archivage **réversible** de la vue courante se gèrent dans
   « Exports & archives ». Aucune remise à zéro destructive.

### Première installation

```bash
npm ci
cp .env.example .env
# Renseigner DATABASE_URL (et DIRECT_URL pour les migrations). Le reste est optionnel.
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

Générer un secret de session avec :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Stocker les secrets dans `.env` non versionné ou dans le gestionnaire de secrets
de l'hébergeur, jamais dans le code ni dans la conversation.

### Changer le mot de passe admin

Le hash bcrypt vit dans `server/lib/founder.ts` :

```bash
node -e "console.log(require('bcryptjs').hashSync('NOUVEAU_MOT_DE_PASSE', 12))"
```

Remplacer la constante, commit, redéployer. Pour invalider toutes les anciennes sessions après une compromission, renouveler `AUTH_SECRET` : toutes les sessions signées avec l'ancien secret deviennent invalides.

 change pas son rôle.
Le seed général `prisma:seed` conserve le mot de passe d'un compte existant.
Pour invalider toutes les anciennes sessions après une compromission, renouveler
également `AUTH_SECRET` et redémarrer le serveur. Pas de récupération par e-mail en v1.

