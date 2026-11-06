# Architecture des données & chaîne d'affichage des images

> Référence technique Fika 2.0 — rédigé le 04/11/2026. Décrit la structure de la
> base de production (Supabase PostgreSQL) et le trajet complet d'une image de
> produit, de l'upload administrateur jusqu'à l'affichage chez le visiteur.

## 1. La base de données — 44 tables, 7 domaines

Schéma source : `prisma/schema.prisma` (baseline `prisma/migrations/0_init`).
**Principe fondamental : aucun fichier binaire en base** — les tables ne
stockent que des URL et des métadonnées ; les fichiers vivent dans Supabase
Storage (buckets, voir §3).

### 1.1 Référentiel géographique

| Table | Rôle |
|---|---|
| `City` | Villes actives — Ngaoundéré seule ville active |
| `Zone` | Quartiers rattachés à une ville (25 zones) |

### 1.2 Catalogue services (partie publique du site)

| Table | Rôle |
|---|---|
| `Category` | 12 catégories (5 actives du catalogue public + 7 restaurées, inactives) |
| `Service` | 38 services — slug unique, prix/devis, disponibilité, SEO |
| `ServiceRequirement` | 105 exigences du formulaire — kinds `TEXT` (72), `OPTION` (10), `QUANTITY` (6), `FILE` (17) |
| `ServiceCityPrice` | Surcharges par ville (fonctionnalité inactive) |
| `Package`, `PackageService` | Packs (retirés du produit, conservés pour l'historique) |

### 1.3 Clients & demandes

| Table | Rôle |
|---|---|
| `Customer` | Un client = un numéro de téléphone unique (upsert sur `phone`) |
| `Lead` | Demandes du formulaire — code `LEAD-XXXXXX`, statuts, source |
| `LeadEvent` | Historique des changements de statut |
| `ServiceRequestFile` | **Métadonnées** des pièces jointes client : `bucket`, `path` (UUID), `originalName` (nettoyé ≤ 120), `mimeType`, `sizeBytes`, `requirementLabel`, `leadId` (rattachement tardif à la soumission) |

### 1.4 Opérations services

`Order` (numérotation `CMD-AAAA-NNNN` via `DocumentCounter`), `OrderItem`,
`OrderEvent`, `Quote`, `Payment`, `Cost`, `Delivery`, `Task`,
`TaskAssignment`, `DocumentCounter`, `Event`, `ExportBatch`, `AdminUser`.

### 1.5 Experts & preuve sociale

`Expert`, `ExpertVerification`, `Review`, `Testimonial`, `PortfolioItem`.

### 1.6 Fika Market (14 tables)

| Table | Rôle |
|---|---|
| `MarketCategory` | Catégories boutique (ex. Accessoires) — position d'affichage |
| `MarketSupplier` | Fournisseurs — **interne**, jamais affiché au public |
| `MarketProduct` | Le produit (détail ci-dessous) |
| `MarketOrder`, `MarketOrderItem`, `MarketOrderEvent` | Commandes boutique + historique d'états |
| `MarketPayment` | Paiements MTN MoMo / Orange Money / cash, confirmés en admin |
| `MarketRefund`, `MarketExpense` | Remboursements et dépenses (allocation des coûts) |
| `MarketDelivery` | Livraisons (zones, frais, statuts) |
| `MarketDeliveryProof` | **Métadonnées** des photos de preuve de livraison (bucket privé) |
| `MarketProcurementBatch` | Lots d'approvisionnement (marge traçable par lot) |
| `MarketQuote` | Devis confirmés avant engagement |
| `MarketAnalyticEvent` | Événements boutique (vues produit, etc.) — jamais de données personnelles |

### 1.7 `MarketProduct` en détail

```prisma
model MarketProduct {
  slug                String  @unique
  reference           String  @unique   // code interne, ex. FK-MKT-001
  name                String
  categoryId          String            // → MarketCategory
  supplierId          String?           // → MarketSupplier (optionnel)
  description         String? @db.Text
  specs               Json?   // [{ label, value }] — caractéristiques (max 12)
  images              Json?   // [url] — photos (max 6), JAMAIS de binaire
  variants            Json?   // [{ name, values }] — couleur, taille…
  priceSale           Int               // prix de vente public, FCFA entier
  supplierPrice       Int     = 0       // ADMIN ONLY — prix fournisseur
  estimatedLandedCost Int     = 0       // ADMIN ONLY — coût rendu estimé
  delayLabel          String?           // délai affiché, jamais promis sans vérif.
  availability        MarketAvailability = PREORDER
  active              Boolean = true    // visible dans la boutique
  popular             Boolean = false   // mis en avant
}
```

## 2. Les 4 buckets Supabase Storage

| Bucket | Visibilité | Limite | Types acceptés | Usage |
|---|---|---|---|---|
| `market-products` | **public** (lecture) | 5 Mo | JPEG, PNG, WebP | Photos produits (URL publiques) |
| `portfolio` | **public** (lecture) | 5 Mo | JPEG, PNG, WebP | Réalisations (usage futur) |
| `service-files` | **privé** | 8 Mo | PDF, JPEG, PNG, WebP | Pièces jointes des demandes clients |
| `delivery-proofs` | **privé** | 8 Mo | JPEG, PNG, WebP | Preuves de livraison Market |

Création idempotente : `prisma/storage-buckets.mjs` (reprise après sinistre).
Buckets privés = consultation uniquement par **URL signée à durée limitée**,
générée côté serveur (`signedObjectUrl`).

## 3. Chaîne complète d'une image du catalogue

### Étape A — Upload (administrateur)

```
Bouton « Ajouter des photos » (AdminMarket.tsx)
        │  fichier binaire en multipart (FormData)
        ▼
POST /api/admin/files/product-image          [server/routes/files.ts]
        │  ✔ session admin obligatoire (middleware /api/admin)
        │  ✔ busboy : un seul champ « file », limites champs/bytes
        │  ✔ MIME vérifié par magic bytes (JPEG/PNG/WebP réels)
        │  ✔ taille ≤ 5 Mo
        │  ✔ chemin = products/<UUID>.jpg (jamais le nom du fichier client)
        ▼
server/lib/storage.ts → uploadObject()
        │  REST POST vers Supabase avec la clé service_role
        │  (clé lue uniquement côté serveur, jamais dans le navigateur)
        ▼
Bucket PUBLIC « market-products »
        │
        ▼
{ url: "https://<projet>.supabase.co/storage/v1/object/public/
         market-products/products/<uuid>.jpg" }
        │  l'URL est ajoutée au champ « images » du formulaire produit
        ▼
« Enregistrer » → POST /api/admin/market/products
        ▼
MarketProduct.images = ["https://…jpg"]     ← URL seule en base
```

### Étape B — Affichage (visiteur)

```
Visiteur ouvre /#/boutique
        ▼
Le front (Market.tsx) appelle GET /api/market/catalog
        ▼
server/routes/market.ts → getMarketCatalog()
   • prisma.marketProduct.findMany({ active: true })
     tri : popular (desc) puis nom
   • toPublicProduct : champs publics uniquement
     (supplierPrice et estimatedLandedCost JAMAIS envoyés au navigateur)
        ▼
JSON → Market.tsx rend la carte produit :
   <img src={product.images[0]} loading="lazy" />
        ▼
Le NAVIGATEUR charge l'image DIRECTEMENT depuis Supabase
   https://<projet>.supabase.co/storage/v1/object/public/market-products/…
        ▼
Règle CSP (vercel.json) : img-src autorise l'hôte exact du projet
        → la photo s'affiche ✓
```

## 4. Points de sécurité

1. **Bucket `market-products` public en lecture** : quiconque a l'URL peut
   *voir* une photo (principe d'une boutique), mais **personne ne peut y
   écrire** — l'upload ne passe que par la route admin (session, magic bytes,
   limites de taille).
2. **Fichiers clients (`service-files`) : privé**. Mêmes contrôles à l'upload
   (route publique rate-limitée 10/min, 8 Mo, PDF/images), mais consultation
   uniquement par URL signée à durée limitée depuis l'admin.
3. **La base ne contient que des pointeurs** : si la base est perdue, les
   fichiers existent encore ; si le stockage est perdu, les métadonnées
   pointent dans le vide. D'où :
   - sauvegarde base : `npm run db:backup` → `backups/` (lecture seule,
     jamais commité) ;
   - fichiers hébergés dans votre projet Supabase (sous votre contrôle).

## 5. Fichiers concernés (pour s'y retrouver)

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | Source de vérité du schéma (44 tables) |
| `prisma/migrations/0_init/` | Baseline SQL unique (rebaselinée post-incident) |
| `prisma/backup-database.mjs` | Sauvegarde complète lecture seule |
| `prisma/storage-buckets.mjs` | Création idempotente des 4 buckets |
| `server/lib/storage.ts` | Client REST Storage (upload, URL publique/signée) |
| `server/routes/files.ts` | 3 routes d'upload (validation complète) |
| `server/routes/market.ts` | Catalogue public (`getMarketCatalog`) |
| `src/lib/admin/market-api.ts` | Client front admin (`uploadProductImage`) |
| `src/components/admin/AdminMarket.tsx` | UI admin : formulaire + upload photos |
| `src/components/market/Market.tsx` | Boutique publique : rendu `<img>` |
| `vercel.json` | En-têtes de sécurité dont la CSP `img-src` |
