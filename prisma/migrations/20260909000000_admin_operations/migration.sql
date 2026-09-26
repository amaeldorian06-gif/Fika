-- Stop on legacy duplicates: resolve them explicitly after a backup; never delete data here.
CREATE UNIQUE INDEX "Order_leadId_key" ON "Order"("leadId");
ALTER TABLE "Payment"
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "confirmedById" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE UNIQUE INDEX "Payment_method_reference_key" ON "Payment"("method", "reference");
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "DocumentCounter" (
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("key")
);
