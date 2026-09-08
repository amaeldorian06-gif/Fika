# Fika — Guide de mise en production

Ce document décrit le passage en production de bout en bout. Il complète le
`README.md` (développement) et l'audit (`AUDIT_FINAL.md`). **Aucune étape ne
doit être sautée le jour J.**

## 1. Variables d'environnement (production)

Copier `.env.example` → `.env` puis renseigner (toutes obligatoires sauf mention) :

| Variable | Exemple / génération | Note |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/fika` | Neon/Supabase ou Postgres managé |
| `VITE_WA_PHONE` | `+2376XXXXXXXX` | **E.164 obligatoire** (validé au démarrage). Numéro WhatsApp réel |
| `NEXT_PUBLIC_WA_PHONE` | idem | Alias Next.js (même valeur) |
| `APP_URL` | `https://fika.cm` | Domaine final (canonical, sitemap, OG) |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | Session admin — **jamais commitée** |
| `ADMIN_EMAIL` | `prenom@fika.cm` | Compte admin initial |
| `ADMIN_EMAIL` | e-mail du fondateur (déjà renseigné) | Identifiant de connexion `/admin` |
| `ADMIN_PASSWORD_HASH` | `node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'MotDePasse!'` | **Obligatoire en prod** (sinon le seed génère un mot de passe dev journalisé) |

Le domaine par défaut `fika.cm` est retenu dans tout le code via `SITE_URL`
(`lib/site.ts`) : changer `APP_URL` **et** régénérer `sitemap.xml` si le
domaine diffère.

## 2. Déploiement

### Option A — Vercel + Neon (recommandée)

1. importer le repo dans Vercel ; `vercel.json` (fourni) applique les headers
   de sécurité + HSTS + `X-Robots-Tag` sur `/admin` ;
2. créer la base Neon → copier `DATABASE_URL` dans les env vars Vercel ;
3. build command : `npm run build` ; le SDK Prisma est généré au postinstall ;
4. migrer + semer (voir §3) — depuis un poste local avec `DATABASE_URL` pointé
   sur la base Neon (direct connection).

### Option B — Node standalone + Postgres

1. provisionner Postgres (sauvegardes activées) ;
2. `npm ci && npm run build` ;
3. servir le dossier `dist/` derrière un reverse proxy (nginx/Caddy) :
   **reporter les mêmes headers** que `vercel.json` (CSP, HSTS, nosniff,
   X-Frame-Options, Referrer-Policy, Permissions-Policy) ;
4. exposer les routes API (`server/routes/*`) — contrats Next documentés dans
   chaque fichier.

### CSP — note importante

`script-src 'unsafe-inline'` est exigé par le bundle monofichier de preview.
En production Next (build segmenté), **durcir** : `script-src 'self'` + nonce.
Les autres directives restent inchangées.

## 3. Migration + seed (premier lancement)

```bash
npx prisma migrate deploy          # applique les migrations (never dev en prod)
npx tsx prisma/seed.ts             # ville Ngaoundéré + zones + AdminUser
npx tsx prisma/seed-catalog.ts     # 7 univers + 21 services + packs + prix ville
```

Le seed catalogue valide la cohérence tarifaire (packs < somme détail) et
journalise la remise réelle de chaque pack — vérifier la sortie.

## 3bis. Connexion au back-office (first login)

1. Vérifier que `.env` contient `ADMIN_EMAIL` et `ADMIN_PASSWORD` **ou**
   `ADMIN_PASSWORD_HASH` (le hash est prioritaire ; le mot de passe en clair
   est simplement haché en bcrypt au seed s'il est seul).
2. `npx tsx prisma/seed.ts` — le log indique « AdminUser « ... » OK ».
3. Ouvrir `https://fika.cm/#/admin` (ou le lien « Espace équipe » du pied de
   page) et se connecter. Session : 12 h, 5 tentatives/minute.
4. **Rotation recommandée après la première connexion réussie** : régénérer
   un hash avec la commande de §1, mettre à jour la base
   (`prisma.adminUser.update`) et chosir un mot de passe unique jamais partagé
   (un mot de passe ayant transité dans un message doit être considéré comme
   compromis d'usage).
5. Mot de passe oublié : régénérer `ADMIN_PASSWORD_HASH` via la commande §1
   et l'appliquer en base — aucune réinitialisation par e-mail en v1.

## 4. Sauvegarde / restauration (Postgres)

- **Automatique** : Neon = PITR jusqu'à 7 jours (plan gratuit) ; sinon
  `pg_dump` quotidien via cron :
  `pg_dump "$DATABASE_URL" -Fc -f fika-$(date +%F).dump` ;
- **Test de restauration mensuel** (une sauvegarde non testée n'existe pas) :
  `pg_restore -d "$DATABASE_URL_TEST" --clean fika-AAAA-MM-JJ.dump` ;
- Rétention : 30 jours.

## 5. Logs & monitoring

- **Uptime** : BetterStack/UptimeRobot sur `/` (200) et `/admin` (redirect) ;
- **Erreurs** : brancher Sentry (DSN via env) — aucun PII : le masquage
  téléphone (`maskPhoneE164`) est déjà la règle dans les logs maison ;
- **Analytics produit** : table `Event` (WACLICK/LEAD_VIEW) → `/admin/analytics` ;
- Vérifier après lancement : `Lead` entrants, `Event` WACLICK, marge vs cible.

## 6. Rollback

- Vercel : redeploy de l'artefact précédent (instantané, même base) ;
- Node : conserver les 2 derniers builds (`releases/AAAAMMDD-HHMM/`) +
  symlink `current` ; rollback = re-pointer le symlink + reload ;
- **Base** : les migrations Prisma étant additives, le rollback applicatif ne
  requiert pas de rollback schéma. En dernier recours : restaurer le dump
  précédent (perd les commandes passées entre-temps — à éviter).

## 7. Checklist go-live (jour J)

Reprendre la checklist finale de `AUDIT_FINAL.md` §Lancement — la dernière
case (« smoke test manuel du tunnel complet en production ») se coche
uniquement après vérification réelle sur le domaine final.
