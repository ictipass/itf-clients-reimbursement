CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "EmailDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "EmailDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailDeliveryAttempt_recipient_attemptedAt_idx" ON "EmailDeliveryAttempt"("recipient", "attemptedAt");
CREATE INDEX "EmailDeliveryAttempt_status_attemptedAt_idx" ON "EmailDeliveryAttempt"("status", "attemptedAt");
