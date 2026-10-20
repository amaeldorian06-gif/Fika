-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "archiveBatchId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "archiveBatchId" TEXT,
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "operationsNotes" TEXT,
ADD COLUMN     "requestKey" TEXT;

-- CreateTable
CREATE TABLE "ExportBatch" (
    "id" TEXT NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "candidates" JSONB NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),
    "archivedOrders" INTEGER NOT NULL DEFAULT 0,
    "archivedLeads" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportBatch_createdAt_idx" ON "ExportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "LeadEvent_leadId_createdAt_idx" ON "LeadEvent"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_archiveBatchId_idx" ON "Order"("archiveBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_requestKey_key" ON "Lead"("requestKey");

-- CreateIndex
CREATE INDEX "Lead_archiveBatchId_idx" ON "Lead"("archiveBatchId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_archiveBatchId_fkey" FOREIGN KEY ("archiveBatchId") REFERENCES "ExportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_archiveBatchId_fkey" FOREIGN KEY ("archiveBatchId") REFERENCES "ExportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

