-- Fika — migration « proof_chain » (P07, SQL de référence).
-- Rattache les réalisations publiées à leur commande d'origine : une preuve
-- publique dérive toujours d'une transaction réelle (comme Review.orderId).
-- À régénérer via `npx prisma migrate dev --name proof_chain`.

ALTER TABLE "PortfolioItem" ADD COLUMN "orderId" TEXT;

ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PortfolioItem_serviceId_active_idx" ON "PortfolioItem"("serviceId", "active");
