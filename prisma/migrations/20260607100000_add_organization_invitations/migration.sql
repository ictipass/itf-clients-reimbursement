CREATE TABLE "OrganizationInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "acceptedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key"
ON "OrganizationInvitation"("tokenHash");

CREATE INDEX "OrganizationInvitation_organizationId_email_acceptedAt_revokedAt_idx"
ON "OrganizationInvitation"("organizationId", "email", "acceptedAt", "revokedAt");

CREATE INDEX "OrganizationInvitation_expiresAt_acceptedAt_revokedAt_idx"
ON "OrganizationInvitation"("expiresAt", "acceptedAt", "revokedAt");

ALTER TABLE "OrganizationInvitation"
ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
ADD CONSTRAINT "OrganizationInvitation_invitedById_fkey"
FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
ADD CONSTRAINT "OrganizationInvitation_acceptedById_fkey"
FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
