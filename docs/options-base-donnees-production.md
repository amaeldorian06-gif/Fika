# Options de base de données pour la mise en production

**Date :** 02/11/2026 · **Décideur :** fondateur · **Statut :** à trancher

## 1. État vérifié (faits, pas d'hypothèses)

La base Supabase de production **est déjà connectée à l'application et à jour** :

- 43 tables publiques = schéma complet Prisma des deux univers (Services **et** Market v2) ;
- 10/10 migrations appliquées (dont backend Market 2.0 : devis, paiements, lots, allocation, remboursements) ;
- 38 services, 1 client, Market vidé post-tests ;
- suivi public par code (MKT-2026-XXXX + trackCode) fonctionnel et testé e2e.

Le guide `FIKA_DATABASE_IMPLEMENTATION_GUIDE.md` décrit un **autre socle**, jamais appliqué :
aucune fonction `fika_*`, aucune table `country_payment_methods` n'existe en base. Le fichier
SQL correspondant (`fika_core_schema_supabase.sql`) **n'est pas disponible** (non joint).

## 2. Ce que chaque univers utilise réellement (données + fichiers)

| Besoin | Fika Services | Fika Market | Couvert aujourd'hui |
|---|---|---|---|
| Catalogue | Service, Category, prix par ville | MarketCategory, MarketProduct, variantes | ✓ |
| Commandes / demandes | Lead, Order, Quote, Event | MarketOrder + items + events (16 statuts) | ✓ |
| Exécution | Expert, Task, Assignment, Review | MarketSupplier, lots d'appro, dépenses, allocation | ✓ |
| Argent | Payment (confirmé par l'équipe) | MarketPayment, MarketQuote, MarketRefund, marge réelle | ✓ (hors paiement en ligne, interdit avant validation) |
| Géographie | City (active), Zone | MarketDelivery | ✓ (Ngaoundéré seule active) |
| **Fichiers — images** | PortfolioItem (URLs) | MarketProduct.images (URLs) | ✓ en URLs externes |
| **Fichiers — exigences client** | ServiceRequirement `kind=FILE` (CV, briefs…) | — | **modélisé, pas implémenté** (aucun upload) |
| **Fichiers — preuves de livraison** | — | photo de remise | **absent** |
| **Fichiers — documents** | devis/reçus (DocumentCounter = références) | — | **références sans fichiers** |

**Constat :** le modèle de données est sain et complet pour les deux univers. Le vrai manque
n'est pas « une autre base », c'est le **stockage de fichiers** (buckets + upload + liaison).

## 3. Les options

### Option 1 — Étendre la base actuelle + Supabase Storage (recommandée)

On garde le socle Prisma/Express testé, et on ajoute ce qui manque vraiment :

1. **Buckets Supabase Storage** (même projet, zéro migration d'infrastructure) :
   - `market-products` (lecture publique) — photos produits gérées par l'équipe ;
   - `delivery-proofs` (privé) — preuves de livraison, accès admin + lien signé client ;
   - `service-files` (privé) — fichiers d'exigences clients (CV, briefs), upload via route serveur ;
   - `portfolio` (lecture publique).
2. **Tables de liaison** (migrations Prisma légères) : `ServiceRequestFile`, preuve jointe à
   `MarketOrderEvent`, etc. La base stocke des **métadonnées + URLs**, jamais de binaire.
3. **Emprunts ciblés au guide** (sa valeur réelle) : jetons de suivi hachés SHA-256 avec
   expiration (durcissement du trackCode actuel), activation contrôlée des moyens de
   paiement le jour où l'encaissement en ligne sera validé.

- **Effort :** jours (pas semaines). **Risque :** faible — migrations additives, rien à réécrire.
- **Coût Supabase :** inchangé (Storage inclus dans le plan actuel au volume MVP).

### Option 2 — Refondre sur le socle du guide (auth Supabase native)

Appliquer `fika_core_schema_supabase.sql` et réécrire le backend autour de `auth.users`,
RLS et `service_role`.

- **Bloqué dès aujourd'hui :** le fichier SQL n'existe pas dans le workspace.
- Le guide lui-même impose : projet Supabase de **développement** d'abord, comparaison,
  **fusion** sans casser l'existant — pas d'exécution directe en production.
- **Effort :** plusieurs semaines à mois (réécriture des routes, nouvelle auth, RLS partout,
  re-tests complets). **Risque :** élevé — deux modèles de sécurité contradictoires, rupture
  de tout ce qui est testé et déployé. Contredit la décision du 20/10 (« bâtir sur l'existant »).
- **Ce que ça apporterait de plus :** comptes clients natifs, RLS déclarative, structure
  multi-pays prête pour le paiement en ligne — des besoins **post-MVP** par convention.

### Option 3 — Deux bases séparées (une par univers)

Deux projets Supabase : Fika Services d'un côté, Fika Market de l'autre.

- **Avantage théorique :** isolation maximale des deux métiers.
- **Inconvénients rédhibitoires :** le client **commun** (même personne, même téléphone),
  la vue fondateur unifiée (overview v2 croisée), et la future cross-vente imposeraient des
  synchronisations permanentes. Double coût opérationnel, double surface de secrets.
- **Verdict :** à écarter — la séparation logique actuelle (préfixes Market\*, routes
  distinctes, aucun couplage dangereux) donne déjà l'isolation sans le double fardeau.

## 4. Comparatif

| Critère | Opt. 1 Étendre | Opt. 2 Refondre | Opt. 2 bases |
|---|---|---|---|
| Couvre les besoins des 2 univers | ✓ | ✓ | ✓ (en silos) |
| Gère les fichiers (buckets) | ✓ à ajouter | ✓ à recâbler | ✓ ×2 |
| Effort | **jours** | semaines/mois | semaines |
| Risque de régression | **faible** | élevé | élevé |
| Comptes clients / RLS | pas nécessaires au MVP | natifs | natifs |
| Dépend du SQL manquant | non | **oui** | non |
| Compatible déploiement immédiat | **oui** | non | non |

## 5. Recommandation

**Option 1.** La base actuelle est déjà « fonctionnelle et pertinente » — elle prend en charge
les deux univers, avec 250 tests verts et un e2e complet. Le manque réel est le stockage de
fichiers, qui se résout par Supabase Storage + migrations additives, sans toucher à ce qui
marche. Les idées de valeur du guide (jetons hachés, paiements désactivés par défaut,
buckets) s'adoptent **au moment où le besoin arrive**, dans le schéma existant.

## 6. Prochaines étapes si option 1 retenue

1. Créer les 4 buckets (règles d'accès : public en lecture pour images/portfolio, privé
   pour preuves et fichiers clients) — opérations depuis le sandbox, secrets protégés.
2. Migration Prisma : `ServiceRequestFile`, preuve sur événement de livraison, champ
   `storagePath` là où des URLs libres suffisaient.
3. Route serveur d'upload validée (type MIME, taille max, nom nettoyé) — jamais de binaire
   en base, jamais de secret exposé.
4. Implémenter les exigences `kind=FILE` dans le parcours demande (UI + stockage).
5. (En parallèle, indépendant de la base) déploiement du code 2.0 : push GitHub → Vercel.
