# Audit sécuritaire — Plateforme Fika

Date : 8 janvier 2026 · Périmètre : site public, tunnel de demande, back-office admin, API de référence (`server/routes/*`), base de données Prisma/PostgreSQL.
Méthode : revue de code exhaustive, cartographie des flux, grep de secrets, contrôle des invariants d'orchestration (pas de marketplace, pas de paiement client→expert).

## 🎯 Verdict : **POSTURE SOLide POUR LE LANCEMENT** — 3 points de durcissement planifiés

---

## 1. Modèle de menaces et couverture

| Menace | Mesure en place | Statut |
|---|---|---|
| Deviner le mot de passe admin | bcrypt coût 10 + rate-limit 5 tentatives/min/IP + message d'échec identique (anti-énumération) | ✅ |
| Vol de session (cookie) | `HttpOnly` (inaccessible au JS) + `SameSite=Lax` (anti-CSRF) + `Secure` en prod + TTL 12 h + signature HMAC-SHA256 | ✅ |
| CSRF sur mutations admin | Cookie SameSite=Lax + mutations en `application/json` + re-vérification serveur de la session à chaque requête | ✅ |
| Injection SQL | ORM Prisma paramétré de bout en bout — aucune requête texte | ✅ |
| Injection de gabarit / XSS dans les messages WhatsApp | Échappement `sanitize()` des variables + remplacement global (tests unitaires dédiés) | ✅ |
| Injection JSON-LD / metadata | Contenu contrôlé par `lib/seo.ts` (aucune donnée utilisateur) | ✅ |
| Énumération des utilisateurs via l'API leads | Validation zod stricte + aucun leak d'existence côté réponse | ✅ |
| Fuite de PII | `maskPhoneE164` systématique (logs, récap, réponses publiques) ; avis = pseudo + initiale uniquement (test anti-fuite) | ✅ |
| Secret commité dans le repo | Grep exhaustif : 0 hash, 0 clé, 0 JWT, 0 token ; `AUTH_SECRET` jamais par défaut en dur ; `.env` hors git | ✅ |
| Déni de service sur /api/leads, /login | Rate-limit mémoire (10 et 5 req/min/IP) | ✅⚠️ voir §3 |
| Prise en compte SMS/WhatsApp spoof | Aucune autorisation par numéro : l'admin ne lie une commande qu'au customer créé côté serveur | ✅ |
| Indexation de l'espace admin | `noindex, nofollow` meta + header `X-Robots-Tag` + `/admin` exclu du sitemap | ✅ |

## 2. Contrôles applicatifs (preuve)

1. **Authentification** : `bcryptjs.compare` sur hash stocké ; comparaison à temps constant (`timingSafeEqual`) de la signature de session ; session expirée = ré-authentification obligatoire.
2. **Autorisation** : chaque mutation serveur du back-office démarre par `adminId` (session) — pas d'acces anonyme possible même si le cookie est supprimé/bidouillé (vérif signature + exp).
3. **Validation** : zod sur toutes les entrées (login, leads, reviews, coûts, devis, experts, tâches, livraison, events) ; rejets typés 400/409 — aucune exception interne exposée.
4. **Headers HTTP** (`vercel.json` + reverse proxy équivalent) : CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` restrictive, `Strict-Transport-Security` preload, `X-Robots-Tag` sur `/admin`.
5. **Invariants métier verrouillés** : livraison toujours facturée 0 F au client (coût tracé interne) ; avis publié uniquement sur commande `COMPLETED` (DB + API + tests) ; aucun expert exhibé au client (pas de marketplace).

## 3. Points de durcissement (plan, sans blocage lancement)

| Priorité | Item | Détail + échéance |
|---|---|---|
| Haute | **Rate-limit multi-instance** | Le store en mémoire ne tient pas derrière plusieurs réplicas : brancher Redis/Upstash avant scale-out. Échéance : avant l'activation du second pod. |
| Haute | **CSP renforcée (segmentation)** | `script-src 'unsafe-inline'` exigée par le preview monofichier : en build Next segmenté, passer à `script-src 'self'` + nonce. Échéance : à la prestation de déploiement définitif. |
| Moyenne | **Rotation des secrets** | `AUTH_SECRET` et mot de passe admin : procédure de rotation documentée à exécuter tous les 90 jours (invalide les sessions actives par conception). |
| Moyenne | **Journalisation & alertes** | Brancher Sentry (sans PII) + alertes BetterStack sur erreurs 5xx et pics de rate-limit ; rétention 30 j. |
| Moyenne | **Tests périodiques de restauration backup** | Procédure écrite (README-PRODUCTION §4) : à exécuter mensuellement. |
| Basse | **2FA admin** | Session actuelle suffisante pour 1-2 admin ; à planifier à l'ouverture multi-comptes (TOTP). |
| Basse | **Audit de dépendances en CI** | `npm audit` au commit + Dependabot/Renovate activés sur le repo. |

## 4. Surfaces par zone

- **Site public** : aucune saisie de session, aucun secret côté client ; le numéro WhatsApp est un contact (par nature public), la validation E.164 évite toute erreur de routage.
- **Tunnel /demande** : consentement explicite, honeypot naturel (rate-limit), aucune création de compte.
- **API `/api/events/*`** : validation zod, slug inconnu toléré sans fuite, aucune donnée sensible acceptée.
- **API `/api/admin/*`** : tout exige `getCurrentAdmin` ; les identifiants de commande sont opaques (cuid), non énumérables.

## 5. Journal des audits passés

- P01 : purge des artifacts (0 picsum / 0 domaine fantôme / 0 numéro dupliqué).
- P09 : canonical + robots + og locaux (suppression des OG distantes).
- P12 : grep final — 0 secret en dur ; `vercel.json` (headers) livré ; `npm audit` planifié jour J.

Recommandation de clôture : **passe en production dès levée des TODO_PROD liés aux données**, sous réserve d'exécuter les trois points de durcissement « haute priorité » avant le volume significatif.
