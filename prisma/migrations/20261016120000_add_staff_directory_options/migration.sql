CREATE TYPE "StaffDirectoryOptionKind" AS ENUM ('DEPARTMENT', 'JOB_TITLE');

CREATE TABLE "StaffDirectoryOption" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "StaffDirectoryOptionKind" NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffDirectoryOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffDirectoryOption_workspaceId_kind_key_key" ON "StaffDirectoryOption"("workspaceId", "kind", "key");
CREATE INDEX "StaffDirectoryOption_workspaceId_kind_isActive_idx" ON "StaffDirectoryOption"("workspaceId", "kind", "isActive");
ALTER TABLE "StaffDirectoryOption" ADD CONSTRAINT "StaffDirectoryOption_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve existing free-text staff values as managed options in each active workspace.
INSERT INTO "StaffDirectoryOption" ("id", "workspaceId", "kind", "name", "key")
SELECT md5(random()::text || clock_timestamp()::text), w."id", 'DEPARTMENT'::"StaffDirectoryOptionKind", v."name", lower(trim(v."name"))
FROM "Workspace" w
CROSS JOIN (SELECT DISTINCT trim("department") AS "name" FROM "User" WHERE "department" IS NOT NULL AND trim("department") <> '') v
WHERE w."isActive" = true
ON CONFLICT ("workspaceId", "kind", "key") DO NOTHING;

INSERT INTO "StaffDirectoryOption" ("id", "workspaceId", "kind", "name", "key")
SELECT md5(random()::text || clock_timestamp()::text), w."id", 'JOB_TITLE'::"StaffDirectoryOptionKind", v."name", lower(trim(v."name"))
FROM "Workspace" w
CROSS JOIN (SELECT DISTINCT trim("jobTitle") AS "name" FROM "User" WHERE "jobTitle" IS NOT NULL AND trim("jobTitle") <> '') v
WHERE w."isActive" = true
ON CONFLICT ("workspaceId", "kind", "key") DO NOTHING;
