ALTER TABLE "Membership"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deactivatedAt" TIMESTAMP(3),
ADD COLUMN "deactivatedById" TEXT,
ADD COLUMN "deactivatedReason" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Membership_organizationId_role_isActive_idx"
ON "Membership"("organizationId", "role", "isActive");

CREATE INDEX "Membership_userId_isActive_idx"
ON "Membership"("userId", "isActive");

ALTER TABLE "Membership"
ADD CONSTRAINT "Membership_deactivatedById_fkey"
FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
