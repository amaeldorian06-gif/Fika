# Fika Market — Rapport de Phase 2 : Classification et administration

Date : 19/11/2026 · Commit : `fb03bf9` · Prérequis : audit Phase 1 validé (`9afcf2a`)
Cahier des charges : « Refonte de la classification du catalogue et de l'expérience utilisateur » v1.0

---

## 1. Migration de base de données (additive, testée)

`prisma/migrations/20261119100000_market_taxonomy_phase2` — **aucune colonne supprimée, aucune donnée transformée, aucune table perdue** :

| Modèle | Ajouts |
|---|---|
| `MarketCategory` | `description`, `imageUrl`, `parentId` (hiérarchie **un seul niveau**), `archived` |
| `MarketProduct` | `shortDescription`, `brand`, `tags[]`, `subcategoryId`, `sourcingType` (interne), `archived` |
| Nouveau `MarketCollection` | slug, nom, description, règle (`MANUAL` / `NEW_ARRIVALS` / `PRICE_BELOW`), `priceThreshold` configurable, position, active |
| Nouveau `MarketCollectionItem` | produit ordonné dans une collection manuelle (unique par paire, cascade) |

Vérifications : `prisma validate` ✓, `migrate deploy` appliqué ✓, interrogation réelle des nouveaux champs/tables ✓. Contraintes FK : parent `RESTRICT` (jamais de suppression en cascade d'une catégorie), sous-catégorie produit `SET NULL`.

## 2. Reclassification réelle des données (script `scripts/reclassify-market.mts`, idempotent, conservé)

- **16 produits réaffectés par slug exact** (vérification préalable : un slug inconnu aurait fait échouer le script). **Slugs et URLs produits inchangés.**
- 4 catégories cibles : **Téléphones & Technologie** (visible, 13 produits), **Maison & Cuisine / Mode & Accessoires / Beauté & Soins** (créées **masquées** : 1 produit chacune, sous le seuil éditorial de 4 — règle validée).
- 7 sous-catégories : Chargeurs et câbles, Gadgets et petits équipements, Supports et accessoires, Ordinateurs et périphériques (Techno) ; Décoration et ambiance ; Sacs et maroquinerie ; Soin personnel.
- **3 anciennes catégories archivées logiquement** (`active=false, archived=true`) — conservées en base, aucune suppression physique. Les commandes (4) référencent les produits, jamais les catégories : aucun impact.
- `shortDescription` rétro-complétée pour les 16 produits depuis la **première phrase de leur description existante** (dérivation fidèle, jamais inventée).
- 4 collections créées : **Sélection Fika** (manuelle, **vide — curation à faire par le fondateur**), **Nouveautés** (automatique), **Petits prix ≤ 5 000 F** (automatique, seuil configurable), **Idées cadeaux** (manuelle, inactive jusqu'à curation).

## 3. API (évolution de l'existant, pas de seconde source de vérité)

- `GET /api/market/catalog` : catégories **hiérarchiques** (racines actives + sous-catégories, description, image) ; produits enrichis (sous-catégorie, marque, tags, description courte, date de publication) ; produits **archivés exclus**. Champs existants inchangés → front actuel et e2e compatibles.
- **Nouveau `GET /api/market/collections`** : collections actives, produits résolus **à la lecture** (règles automatiques jamais figées) ; collection vide = jamais renvoyée.
- `GET /api/market/product/:slug` : archivés exclus.
- Admin : `GET/POST /api/admin/market/collections`, `/collections/delete`, `/collections/items` (+`/remove`, `/move`).
- **Confidentialité vérifiée par tests** : `supplierPrice`, `estimatedLandedCost`, `sourcingType`, `archived` jamais dans les réponses publiques.

## 4. Règles de publication (CDC §6, appliquées côté serveur)

Pour **publier** (rendre actif) : description courte ≥ 3 car., **au moins une photo**, **délai estimé obligatoire si « sur commande »**. Un brouillon incomplet reste enregistrable (masqué). **Archiver** ≠ masquer : le produit sort du catalogue ; restaurable en brouillon à tout moment. Messages d'erreur explicites remontés dans l'interface.

## 5. Administration

- **Catégories** : cartes racine + sous-catégories, compteur de produits publiés, état (Visible/Masquée/Archivée), lien « Aperçu public » ; formulaire étendu (slug modifiable avec unicité, description, image, parent racine uniquement, position, archivage protégé).
- **Collections** : création/édition/suppression (réservée aux collections — aucune catégorie ne se supprime), choix de règle, seuil configurable, **items manuels ordonnables (↑↓)**, ajout depuis les produits publiés.
- **Produits** : sous-catégorie **filtrée selon la catégorie choisie**, marque, tags (recherche), approvisionnement (LOCAL/NATIONAL/IMPORT/PARTNER — interne), description courte, état **Brouillon/Publié/Archivé** avec actions dédiées (Publier/Masquer/Archiver/Restaurer) ; le toggle transmet tous les champs (aucun écrasement silencieux — leçon du 13/11 conservée).

## 6. Qualité — tout vert

`tsc` ✓ · **vitest 308/308** (dont **14 nouveaux tests** : règles de publication, sous-catégorie invalide, un seul niveau de hiérarchie, slugs uniques, collections auto/doublons/seuil) · e2e : admin-essentiel **41/41**, nav-phase1 **65/65**, market-tout **17/17**, parcours-produit **36/36**, qa-largeurs **94/94**, hero-layout **70/70**, commandes-reception **24/24**, services-ux **19/19**, routage-seo **15/15**, analytics-searches **18/18**, search-services **11/11**, temoignage-reel **22/22**, market-image-fallback **3/3**, demande-fichier-smoke **9/9**.
Tests fonctionnels API admin effectués en direct : ajout/réordonnancement/retrait d'items, refus sur collection automatique, auto-référence de parent refusée, publication incomplète refusée.

## 7. Limitations et hypothèses documentées

1. **Descriptions produits pauvres** : la description source de 13 accessoires est « 200F de frais de transport » — la description courte la reprend telle quelle (fidélité à la donnée, aucune invention marketing). **À enrichir via l'admin** (champ dédié, 160 car.).
2. **Marques non renseignées** : aucune caractéristique « Marque » n'existait en base — le champ `brand` est créé vide partout, à compléter via l'admin.
3. **Front public volontairement inchangé** (périmètre Phase 3) : la boutique affiche la section « Téléphones & Technologie » et une section « Autres produits » (LED 5 m, STYLISH BAG, LIP TINT — visible et achetable, en attendant l'activation des catégories). Les collections ne sont pas encore affichées (API prête).
4. **Pages des anciennes catégories** : vides mais accessibles (aucun produit) — redirections propres prévues en Phase 3 avec la nouvelle navigation.
5. `e2e/cleanup.mjs` adapté : la catégorie e2e est désormais **remise en état archivé** (jamais supprimée/recréée active) pour respecter « catégories vides jamais affichées ».
6. Sélection Fika vide et Idées cadeaux inactives : curation éditoriale réservée au fondateur.
7. Base partagée dev/prod : la reclassification est déjà effective côté données ; le code partira en prod au prochain push — **7 commits en attente** : `a131ae5`, `6d1f711`, `c638f7b`, `9afcf2a`, `fb03bf9`, `06618ee`, `8ef4087` (ce dernier : inversion des CTA de la page d'accueil, progression découverte → action dans les deux univers).

## 8. Prochaine étape — Phase 3 : expérience publique

Accueil (recherche visible, cartes catégories, collections), page « Tous les produits » (filtres contextuels, tri, état conservé), pages catégories avec sous-catégories et fil d'Ariane, recherche enrichie (suggestions, alternatives, historique), fiches produits, événements analytics SEARCH/FILTER. **Validation du fondateur sur cette Phase 2 attendue avant de commencer.**
