CREATE TABLE "BankDirectoryEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "sortCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankDirectoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankDirectoryEntry_workspaceId_nameKey_key" ON "BankDirectoryEntry"("workspaceId", "nameKey");
CREATE INDEX "BankDirectoryEntry_workspaceId_isActive_name_idx" ON "BankDirectoryEntry"("workspaceId", "isActive", "name");

ALTER TABLE "BankDirectoryEntry" ADD CONSTRAINT "BankDirectoryEntry_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
