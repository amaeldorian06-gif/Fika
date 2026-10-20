-- CreateEnum
CREATE TYPE "ExpertVerificationLevel" AS ENUM ('NEW', 'PHONE_VERIFIED', 'PROFILE_VERIFIED', 'SKILL_DECLARED', 'SKILL_VERIFIED', 'FIKA_JOB_DONE', 'ACTIVE_PRO');

-- CreateEnum
CREATE TYPE "ExpertVerificationType" AS ENUM ('PHONE_CALL', 'ID_DOCUMENT', 'IN_PERSON', 'PRACTICAL_TEST', 'SITE_VISIT', 'REFERENCE_CHECK', 'COMPLETED_JOB', 'ADMIN_REVIEW');

-- AlterTable
ALTER TABLE "Expert" ADD COLUMN     "documents" TEXT,
ADD COLUMN     "firstAssignedAt" TIMESTAMP(3),
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "lastVerificationType" "ExpertVerificationType",
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "references" TEXT,
ADD COLUMN     "trade" TEXT,
ADD COLUMN     "verificationLevel" "ExpertVerificationLevel" NOT NULL DEFAULT 'NEW';

-- CreateTable
CREATE TABLE "ExpertVerification" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "from" "ExpertVerificationLevel",
    "to" "ExpertVerificationLevel" NOT NULL,
    "type" "ExpertVerificationType" NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpertVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpertVerification_expertId_idx" ON "ExpertVerification"("expertId");

-- AddForeignKey
ALTER TABLE "ExpertVerification" ADD CONSTRAINT "ExpertVerification_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertVerification" ADD CONSTRAINT "ExpertVerification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

