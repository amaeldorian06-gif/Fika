# Modèle de données — Fika Market 2.0

> Phase 2. Le schéma V1 (11 tables) est étendu de façon **additive** : nouvelles tables + colonnes + valeurs d'enum. Aucune donnée existante modifiée ou supprimée (la base Market est vide au moment de la migration — fenêtre idéale).

## 1. Catalogue

### MarketCategory
`id, slug*, name, description?, position, active` — dynamique, jamais codée en dur dans l'UI. Quatre catégories initiales prévues (Maison & Cuisine, Accessoires Numériques, Étude & Bureau, Essentiels du Quotidien) créées par l'admin.

### MarketSupplier
`id, name*, contact?, note?, active` — multi-fournisseurs par conception, un seul actif au lancement. Coordonnées et conditions internes (admin only).

### MarketProduct
`id, slug*, reference*, name, categoryId→, supplierId?, description?, specs? (Json ≤12), images? (Json ≤6 URLs), priceSale (prix indicatif public), supplierPrice (admin), estimatedLandedCost (admin, coût rendu estimé), delayLabel?, availability (AVAILABLE|PREORDER|UNAVAILABLE), active, popular, **variants? (Json)**`

**Variants (nouveau)** : `[{ "name": "Couleur", "values": ["Noir", "Blanc"] }]` — dynamiques par produit, aucun attribut imposé. Décision D3 : colonne Json plutôt que table (pas de prix/stock par variante en MVP). La commande snapshot le choix en clair (`variantLabel`).

## 2. Commandes

### MarketOrder
`id, orderNumber* (MKT-), trackCode* (suivi public), requestKey* (idempotence), customerId→, name, phone, zoneName, address?, notes?, status, source, deliveryFee?, confirmedAt?, deliveredAt?, createdAt, updatedAt`

Statuts (16) : `REQUESTED, SUPPLIER_CHECK, AWAITING_CLIENT, AWAITING_PAYMENT*, CONFIRMED, PROCURING, SHIPPED_INBOUND, RECEIVED, READY, DELIVERING, DELIVERED, CANCELLED, DELAYED, REFUND_PENDING, REFUNDED, SUPPLY_FAILED` (* = nouveau). Mapping cahier des charges : submitted→REQUESTED, supplier_verification→SUPPLIER_CHECK, quote_sent & awaiting_customer_acceptance→AWAITING_CLIENT, awaiting_payment→AWAITING_PAYMENT, confirmed→CONFIRMED, processing/procurement_pending→PROCURING, shipped→SHIPPED_INBOUND, received & quality_checked→RECEIVED, ready_for_delivery→READY, out_for_delivery→DELIVERING, delivered→DELIVERED, exception→DELAYED|SUPPLY_FAILED.

**Quatre cycles de vie distincts** (exigence §8.3) : commande (ci-dessus), paiement (**dérivé**, §5), approvisionnement (lot, §4), livraison (MarketDelivery.status : PENDING|SCHEDULED|IN_TRANSIT|DELIVERED|FAILED). Aucun champ unique géant : chaque entité porte son état.

### MarketOrderItem
`id, orderId→, productId?, productName (snapshot), **variantLabel? (snapshot "Couleur : Noir")**, quantity, unitPrice? (prix confirmé), unitCostReal? (coût rendu réel — admin), procurementBatchId?`

**Invariants d'intégrité (§9.1)** : chaque item fige nom + référence + variante + quantité au moment de la commande ; les prix confirmés vivent sur l'item ; le devis porte son propre snapshot. **Modifier le catalogue ne touche jamais une commande ou un devis existants.** Montants FCFA en `Int` (§9.2) — jamais de flottant financier.

## 3. Devis (nouveau)

### MarketQuote
`id, quoteNumber* (MQT-AAAA-NNNN), orderId→, status (DRAFT|SENT|ACCEPTED|REJECTED|EXPIRED|CANCELLED), items (Json — snapshot [{productName, reference, variantLabel, quantity, unitPrice}]), deliveryFee, totalAmount, note?, validUntil?, sentAt?, acceptedAt?, rejectedAt?, createdById→, createdAt, updatedAt`

- **Prix verrouillés** à la création : `items` est un snapshot JSON immuable ; toute évolution du catalogue ou de la commande est sans effet (exigence §8.2).
- Référence, client, articles, quantités, prix unitaires, frais, total, validité configurable (défaut 7 jours), statut, dates — tous les champs exigés.
- Expiration : évaluée paresseusement à la lecture + refus d'acceptation après `validUntil`.
- Un devis REJECTED n'annule pas la commande (l'admin décide : relance, nouveau devis, annulation).

## 4. Approvisionnement

### MarketProcurementBatch
`id, reference* (APR-), supplierId?, status, totalCost, note?, expectedAt?, receivedAt?, createdAt, updatedAt` + `items` (MarketOrderItem[])

Statuts (9, mapping §10 du cahier des charges) : `PLANNED, ORDERED, SUPPLIER_PROCESSING*, SHIPPED, CUSTOMS_PROCESSING*, RECEIVED, INSPECTED*, CANCELLED` (* = nouveaux ; planifié→commandé→traitement fournisseur→expédié→dédouanement→reçu→contrôlé).

### MarketExpense (nouveau)
`id, batchId?, label, category (FREIGHT|INSURANCE|CUSTOMS|CLEARANCE|LOCAL_TRANSPORT|PACKAGING|OTHER), amount (Int FCFA), allocationMethod (VALUE|QUANTITY|FLAT), note?, incurredAt, createdById→, createdAt`

**Coût de revient (§9.3)** = prix fournisseur unitaire + quote-part des dépenses du lot. Allocation :
- `VALUE` (défaut) : part_i = dépense × (valeur items_i / Σ valeurs du lot) — pour fret/douane proportionnels ;
- `QUANTITY` : dépense × (quantités_i / Σ quantités) — pour frais à l'unité ;
- `FLAT` : répartition égale entre items distincts.

L'application de l'allocation ajoute la quote-part au `unitCostReal` de chaque item du lot (action explicite de l'admin, arrondi entier FCFA). Les allocations ne sont pas stockées : recalculées à la lecture depuis les dépenses (source de vérité unique). Les entités `market_shipments`/`market_shipment_events` du cahier des charges sont différées post-MVP (D7) : le lot porte le suivi international.

## 5. Finance

### MarketPayment
`id, orderId→, amount, method (MTN_MOMO|ORANGE_MONEY|CASH), reference?, status (PENDING|CONFIRMED|REJECTED), createdById→, confirmedById→, confirmedAt?, createdAt`

**Cycle de vie paiement (§8.3) — DÉRIVÉ, jamais stocké** (`deriveMarketPaymentStatus` dans le domaine) :

| État dérivé | Condition |
|---|---|
| `unpaid` | aucun paiement, total connu ou non |
| `pending_verification` | ≥ 1 paiement PENDING, aucun confirmé |
| `failed` | tous les paiements REJECTED, aucun confirmé/pending |
| `partially_paid` | 0 < confirmés < total |
| `paid` | confirmés ≥ total |
| `refund_pending` | commande `REFUND_PENDING` |
| `partially_refunded` | remboursements > 0 et < confirmés |
| `refunded` | remboursements ≥ paiements confirmés |

Distinction estimé/confirmé/réel (§9.2) : `estimatedLandedCost` (produit, estimé) vs `unitCostReal` (item, réel) vs paiements confirmés (encaissé) — jamais écrasement d'une valeur par une autre.

### MarketRefund (nouveau — remplace le modèle mort MarketReturn)
`id, orderId→, amount, method?, reference?, reason?, recordedById→, createdAt` — un remboursement est un fait enregistré (pas de cycle de vérification en MVP : l'admin enregistre ce qui a été réellement remboursé).

## 6. Journal & analytics

- `MarketOrderEvent` : journal horodaté de chaque transition (from, to, note, acteur) = piste d'audit de la commande.
- `MarketAnalyticEvent` (nouveau) : `id, type (SHOP_VIEWED|CATEGORY_VIEWED|PRODUCT_VIEWED|ADD_TO_CART|CHECKOUT_STARTED|ORDER_SUBMITTED), productId?, meta?, createdAt` — funnel public, rate-limité, sans données personnelles. Les événements postérieurs à la commande (devis accepté, paiement vérifié, livré) sont dérivés des tables métier, pas auto-déclarés.

## 7. Index & contraintes

Uniques : `slug` (catégorie, produit), `reference` (produit), `orderNumber`, `trackCode`, `requestKey`, `quoteNumber`, `reference` (lot). Index : `categoryId`, `active` (produit), `orderId` (items/events/payments/delivery/refunds), `batchId` (expenses), `createdAt` (analytics). FK explicites partout ; cascade restreinte (pas de suppression en cascade de commandes).

## 8. Vues financières admin (§9.3)

Par commande : coût estimé (Σ estimatedLandedCost au moment de la commande — approximatif, non stocké en V1), **coût rendu réel** (Σ unitCostReal×q + coût livraison), **marge brute** (revenu confirmé − coût réel), **contribution après coûts variables** = même calcul (les coûts variables — fret, douane, livraison — sont déjà dans le coût réel ; les coûts fixes de la société ne sont PAS déduits → jamais étiqueté « bénéfice net »). Par lot : dépenses, coût alloué, marge agrégée des commandes liées.
