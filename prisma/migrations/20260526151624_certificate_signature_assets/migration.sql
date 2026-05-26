-- CreateEnum
CREATE TYPE "SignatureAssetKind" AS ENUM ('DIRECTOR_GENERAL_CE', 'DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE');

-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'SIGNATURE_IMAGE';

-- CreateTable
CREATE TABLE "SignatureAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "kind" "SignatureAssetKind" NOT NULL,
    "label" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "recordTier" "RecordTier" NOT NULL DEFAULT 'HOT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignatureAsset_workspaceId_kind_isActive_recordTier_idx" ON "SignatureAsset"("workspaceId", "kind", "isActive", "recordTier");

-- CreateIndex
CREATE INDEX "SignatureAsset_documentId_idx" ON "SignatureAsset"("documentId");

-- AddForeignKey
ALTER TABLE "SignatureAsset" ADD CONSTRAINT "SignatureAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureAsset" ADD CONSTRAINT "SignatureAsset_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
