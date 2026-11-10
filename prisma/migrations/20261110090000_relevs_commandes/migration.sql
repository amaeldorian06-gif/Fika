/* Relevés par commande : dépenses rattachables à une commande + catégories
   de dépenses générales (achat, loyer, communication). Additif uniquement. */

-- AlterEnum
ALTER TYPE "MarketExpenseCategory" ADD VALUE 'PURCHASE';
ALTER TYPE "MarketExpenseCategory" ADD VALUE 'RENT';
ALTER TYPE "MarketExpenseCategory" ADD VALUE 'COMMUNICATION';

-- AddOptionalColumn
ALTER TABLE "MarketExpense" ADD COLUMN "orderId" TEXT;

-- CreateIndex
CREATE INDEX "MarketExpense_orderId_idx" ON "MarketExpense"("orderId");

-- AddForeignKey
ALTER TABLE "MarketExpense" ADD CONSTRAINT "MarketExpense_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
