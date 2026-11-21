CREATE TABLE "ReimbursementPolicyActivation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "previousEdition" "ReimbursementPolicyEdition" NOT NULL,
  "edition" "ReimbursementPolicyEdition" NOT NULL,
  "implementationKey" TEXT NOT NULL,
  "approvalReference" TEXT NOT NULL,
  "activatedById" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReimbursementPolicyActivation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReimbursementPolicyActivation_workspaceId_activatedAt_idx"
  ON "ReimbursementPolicyActivation"("workspaceId", "activatedAt");

ALTER TABLE "ReimbursementPolicyActivation"
  ADD CONSTRAINT "ReimbursementPolicyActivation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReimbursementPolicyActivation"
  ADD CONSTRAINT "ReimbursementPolicyActivation_activatedById_fkey"
  FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
