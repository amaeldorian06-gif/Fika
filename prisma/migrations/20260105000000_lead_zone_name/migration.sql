-- Fika — migration « lead_zone_name » (P05, SQL de référence).
-- Le tunnel /demande collecte le quartier en texte libre (seed-catalog des
-- zones) ; la résolution fine vers Zone viendra avec l'admin (P06+).
-- À régénérer via `npx prisma migrate dev --name lead_zone_name`.

ALTER TABLE "Lead" ADD COLUMN "zoneName" TEXT;
