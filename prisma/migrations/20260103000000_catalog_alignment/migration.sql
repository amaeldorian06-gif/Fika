-- Fika — migration « catalog_alignment » (P03, SQL de référence).
-- Alignement du catalogue sur les besoins produit : facettes de navigation,
-- SEO, visuel local, pricing par ville. À régénérer via
-- `npx prisma migrate dev --name catalog_alignment` dès que DATABASE_URL est dispo.

CREATE TYPE "BudgetLevel" AS ENUM ('FAIBLE', 'MOYEN', 'ELEVE');
CREATE TYPE "DelayLevel" AS ENUM ('RAPIDE', 'STANDARD', 'LONG');
CREATE TYPE "NeedType" AS ENUM ('CREATION', 'OPTIMISATION', 'CONSULTING', 'PRODUCTION', 'SUPPORT', 'INTERVENTION');

ALTER TABLE "Service"
    ADD COLUMN "popular" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "image" TEXT,
    ADD COLUMN "seoTitle" TEXT,
    ADD COLUMN "seoDescription" TEXT,
    ADD COLUMN "budget" "BudgetLevel" NOT NULL DEFAULT 'FAIBLE',
    ADD COLUMN "delai" "DelayLevel" NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN "typeBesoin" "NeedType" NOT NULL DEFAULT 'CREATION',
    ADD COLUMN "howItWorks" JSONB,
    ADD COLUMN "faqs" JSONB;

ALTER TABLE "Service"
    ALTER COLUMN "howItWorks" SET DATA TYPE JSONB,
    ALTER COLUMN "faqs" SET DATA TYPE JSONB;

-- Per-city pricing overrides (+ marge cible), repli automatique sur le service.
CREATE TABLE "ServiceCityPrice" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "targetMargin" DOUBLE PRECISION,
    "deliveryIncluded" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ServiceCityPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceCityPrice_serviceId_cityId_key" ON "ServiceCityPrice"("serviceId", "cityId");

ALTER TABLE "ServiceCityPrice" ADD CONSTRAINT "ServiceCityPrice_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceCityPrice" ADD CONSTRAINT "ServiceCityPrice_cityId_fkey"
    FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
