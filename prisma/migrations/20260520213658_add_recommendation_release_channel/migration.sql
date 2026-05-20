-- CreateEnum
CREATE TYPE "RecommendationReleaseChannel" AS ENUM ('DASHBOARD', 'DASHBOARD_AND_EMAIL');

-- AlterTable
ALTER TABLE "RegistrationContributionAssessment" ADD COLUMN     "releaseChannel" "RecommendationReleaseChannel";
