# Fika Market — Rapport d'audit et plan de modification (Phase 1)

Date : 19/11/2026 · Périmètre : classification du catalogue + expérience publique + administration
Cahier des charges : « Refonte de la classification du catalogue et de l'expérience utilisateur » v1.0

---

## 1. Constats d'audit (architecture réelle, vérifiée dans le code et la base)

### 1.1 Ce qui est déjà conforme

| Exigence du cahier | État actuel | Verdict |
|---|---|---|
| Source de vérité unique en base | `/api/market/catalog` lit la base ; aucun catalogue statique pour Market | ✅ |
| Statuts de disponibilité publics | Enum `AVAILABLE / PREORDER / UNAVAILABLE` = exactement Disponible / Sur commande / Indisponible | ✅ |
| Approvisionnement distinct de la classification | `supplierId` (fournisseur) séparé de `categoryId` ; aucune catégorie « importés » | ✅ |
| Coûts et marges privés | `supplierPrice`, `estimatedLandedCost` jamais retournés par l'API publique (vérifié e2e) | ✅ |
| SKU unique | `reference` unique | ✅ |
| Images en URLs (max 6), variantes dynamiques, specs | Champs JSON existants et fonctionnels | ✅ |
| Délai estimé jamais promis | `delayLabel` optionnel, libellé prudent | ✅ |
| Analytics de parcours | 7 événements réels : SHOP_VIEWED, CATEGORY_VIEWED, PRODUCT_VIEWED, ADD_TO_CART, CART_VIEWED, CHECKOUT_STARTED, ORDER_SUBMITTED | ✅ (partiel — §7) |
| Parcours de commande opérationnel | Panier → commande → suivi par `trackCode` → workflow admin complet | ✅ à préserver tel quel |

### 1.2 Écarts à combler

**Schéma (Prisma) — manques :**
- `MarketCategory` : pas de `description`, pas d'`imageUrl`, pas de `parentId` (aucune sous-catégorie), slug auto-généré à la création et non modifiable, pas de suppression logique.
- `MarketProduct` : pas de sous-catégorie, pas de `brand`, pas de `tags`, pas de statut de publication structuré (brouillon/publié/archivé — seul `active` existe).
- **Collections : inexistantes** (aucun modèle, aucune UI).
- Approvisionnement : pas de champ `sourcingType` explicite (local/national/international/partenaire) — aujourd'hui implicite via le fournisseur.

**Catégories actuelles (3, plates et incohérentes avec la cible) :**

| Catégorie actuelle | Produits | Problème |
|---|---|---|
| `accessoires` « Accessoires électroniques » | 11 (sticks wifi/Bluetooth, USB, chargeurs, support, souris, boîtier, manettes, câble SATA, LED 5 m) | Fourre-tout tech sans hiérarchie |
| `equipements-electroniques-et-menagers` « Équipements » | 3 ordinateurs portables | Nom long, positionnement flou |
| `e2e-nav-accessoires` « Accessoires Mode » | 2 (LIP TINT = cosmétique, STYLISH BAG = sac) | Mélange beauté + mode ; catégorie protégée utilisée par les tests e2e |

**Front public (`src/components/market/Market.tsx`, 676 lignes monolithiques) :**
- Recherche présente avec normalisation d'accents ✅ mais : pas de filtres, pas de tri, pas de sous-catégories, pas de collections, pas de fil d'Ariane, pas de suggestions, pas de message « sans résultat » enrichi d'alternatives, état non conservé au retour d'une fiche produit.
- Pas de page « Tous les produits » distincte de l'accueil.

**Administration :**
- CRUD produits complet (avec coûts privés) ✅, mais catégories limitées (nom/position/actif — pas de description, image, sous-catégorie, slug, prévisualisation), pas de gestion des collections.

### 1.3 Risques et contraintes identifiés

1. **Données de production** : 3 commandes réelles + `MarketOrderItem` référencent `productId` (jamais `categoryId`) → réaffecter les produits à de nouvelles catégories est **sûr** ; les anciennes catégories seront **désactivées** (suppression logique), jamais effacées.
2. **URLs publiques** : les slugs produits restent inchangés (aucune rupture) ; les slugs de catégories actuelles seront remplacés par les nouvelles catégories cibles — les anciennes pages catégorie deviennent des redirections vers la boutique (les 3 catégories actuelles n'ont pas d'historique SEO significatif, à valider).
3. **Tests e2e** : `nav-phase1` et `market-tout` utilisent la catégorie protégée `e2e-nav-accessoires` (seed de produits de test) → à conserver active pour les tests ou à migrer proprement dans les scripts.
4. **Migration** : additive uniquement (nouvelles colonnes nullables + nouvelles tables) — aucune donnée transformée, aucune suppression.

---

## 2. Proposition de reclassification des 16 produits réels

Mapping vers la taxonomie cible (§2.1 du cahier) — **proposition modifiable** :

| Produit | Catégorie cible | Sous-catégorie |
|---|---|---|
| Chargeur Lenovo USB, Chargeur Dell, Câble sata 3k, Multiplicateur usb type C | Téléphones & Technologie | Chargeurs et câbles |
| Stick wifi, Stick Bluetooth | Téléphones & Technologie | Gadgets et petits équipements |
| Souris hp, Support laptop, Boîtier 3.0 Toshiba, Manettes pc | Téléphones & Technologie | Supports et accessoires |
| ThinkPad E495, Probook 430 G7, ThinkPad 13 | Téléphones & Technologie | Ordinateurs et périphériques *(sous-cat. à créer — non prévue au cahier, justifiée par l'assortiment réel)* |
| LED 5m | Maison & Cuisine | Décoration et ambiance |
| STYLISH BAG | Mode & Accessoires | Sacs et maroquinerie |
| LIP TINT | Beauté & Soins | Soin personnel |
| (produits e2e de test) | Catégorie de test conservée | — |

Conséquence : **Maison & Cuisine (1 produit), Mode & Accessoires (1), Beauté & Soins (1)** seraient des catégories à 1 produit — sous le seuil éditorial de 4 produits du §2.3. Options : (a) les créer masquées et ne montrer que « Téléphones & Technologie » dans la navigation au départ ; (b) attendre l'assortiment. **Recommandation : option (a)** — classification posée dès maintenant, visibilité progressive.

## 3. Plan de modification (Phases 2-4)

### Phase 2 — Classification et administration
1. Migration additive : `MarketCategory` (+`description`, +`imageUrl`, +`parentId` auto-relation, +`archived`, slug modifiable) ; `MarketProduct` (+`subcategoryId` nullable, +`brand`, +`tags String[]`, +`sourcingType`, +`archived`) ; nouvelles tables `MarketCollection` + `MarketCollectionItem`.
2. Admin : gestion complète des catégories (sous-catégories, description, image, ordre, compteur de produits actifs, lien de prévisualisation), fiches produits étendues, **gestion des collections** (Sélection Fika manuelle ; Nouveautés et Petits prix par règle automatique), statut de publication clair (brouillon / publié / archivé).
3. Reclassification des 16 produits selon le mapping validé ; anciennes catégories désactivées (logique, réversible).
4. API publique : catégories hiérarchiques + collections exposées ; filtres de confidentialité inchangés (aucun coût).

### Phase 3 — Expérience publique
1. Accueil : recherche immédiatement visible, cartes catégories illustrées (catégories actives non vides uniquement), Sélection Fika, Nouveautés, réassurance réelle.
2. Page catégorie : description, sous-catégories visibles, fil d'Ariane, filtres contextuels, tri (nouveautés, prix ↑↓, pertinence), conservation d'état (recherche/filtres/tri au retour d'une fiche).
3. Recherche : suggestions, message sans résultat + alternatives, historique récent (localStorage minimal).
4. Fiches produits : fil d'Ariane, variantes, modalités « sur commande » explicites, recommandations same-category.
5. Analytics : + événements SEARCH (avec résultat/sans résultat), FILTER_USED.

### Phase 4 — Tests et recette
Batterie e2e complète existante (12 suites) + nouvelles suites (catégories hiérarchiques, collections, filtres/tri, conservation d'état, confidentialité) + QA largeurs 320-1280 + vérification images + rapport de recette.

---

## 4. Decisions à valider par le fondateur

1. Le mapping des 16 produits (§2) — notamment LED 5 m → Maison & Cuisine, et la sous-catégorie « Ordinateurs et périphériques ».
2. Catégories à 1 produit : créées mais masquées de la navigation (recommandation) ?
3. Anciennes catégories : désactivation logique + redirection vers la boutique.
4. Seuil « Petits prix » : valeur configurable (proposition initiale : ≤ 5 000 F).
