/* Refonte Market phase 2 : taxonomie du catalogue.
   Additif uniquement — aucune colonne supprimée, aucune donnée transformée.
   - MarketCategory : description, imageUrl, parentId (hiérarchie un niveau),
     archived (suppression logique — jamais de delete physique).
   - MarketProduct : shortDescription (requis pour publier désormais),
     brand, tags, subcategoryId, sourcingType (interne), archived.
   - Nouvelles tables MarketCollection + MarketCollectionItem (collections
     éditoriales, règle manuelle ou automatique). */

ALTER TABLE "MarketCategory" ADD COLUMN "description" TEXT;
ALTER TABLE "MarketCategory" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "MarketCategory" ADD COLUMN "parentId" TEXT;
ALTER TABLE "MarketCategory" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MarketProduct" ADD COLUMN "shortDescription" TEXT;
ALTER TABLE "MarketProduct" ADD COLUMN "brand" TEXT;
ALTER TABLE "MarketProduct" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MarketProduct" ADD COLUMN "subcategoryId" TEXT;
ALTER TABLE "MarketProduct" ADD COLUMN "sourcingType" TEXT;
ALTER TABLE "MarketProduct" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MarketCategory"
  ADD CONSTRAINT "MarketCategory_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "MarketCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketProduct"
  ADD CONSTRAINT "MarketProduct_subcategoryId_fkey"
  FOREIGN KEY ("subcategoryId") REFERENCES "MarketCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MarketCategory_parentId_idx" ON "MarketCategory"("parentId");
CREATE INDEX "MarketProduct_subcategoryId_idx" ON "MarketProduct"("subcategoryId");

CREATE TABLE "MarketCollection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rule" TEXT NOT NULL DEFAULT 'MANUAL',
    "priceThreshold" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketCollection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketCollection_slug_key" ON "MarketCollection"("slug");

CREATE TABLE "MarketCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketCollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketCollectionItem_collectionId_productId_key" ON "MarketCollectionItem"("collectionId", "productId");
CREATE INDEX "MarketCollectionItem_productId_idx" ON "MarketCollectionItem"("productId");

ALTER TABLE "MarketCollectionItem"
  ADD CONSTRAINT "MarketCollectionItem_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "MarketCollection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketCollectionItem"
  ADD CONSTRAINT "MarketCollectionItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "MarketProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
