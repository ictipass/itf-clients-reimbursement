ALTER TABLE "User" ADD COLUMN "workflowEmailNotifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WorkItem" ADD COLUMN "emailNotifiedAt" TIMESTAMP(3);
CREATE INDEX "WorkItem_status_emailNotifiedAt_createdAt_idx" ON "WorkItem"("status", "emailNotifiedAt", "createdAt");
