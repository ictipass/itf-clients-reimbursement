-- AlterTable
ALTER TABLE "User"
ADD COLUMN "staffNumber" TEXT,
ADD COLUMN "phoneNumber" TEXT,
ADD COLUMN "department" TEXT,
ADD COLUMN "jobTitle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_staffNumber_key" ON "User"("staffNumber");
