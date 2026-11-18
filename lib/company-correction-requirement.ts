import { getDb } from "@/lib/db";

type CorrectedWorkflow =
  | { registrationApplicationId: string }
  | { trainingPlanSubmissionId: string }
  | { complianceYearId: string };

export async function assertCompanyDetailsCorrectedAfterReturn(companyId: string, workflow: CorrectedWorkflow) {
  const db = getDb();
  const lastReturn = await db.decision.findFirst({
    where: { companyId, action: "REQUEST_CHANGES", ...workflow },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!lastReturn) throw new Error("The employer correction request could not be verified.");

  const correction = await db.decision.findFirst({
    where: {
      companyId,
      action: "REOPEN",
      reason: { startsWith: "Employer corrected organizational details:" },
      createdAt: { gt: lastReturn.createdAt },
    },
    select: { id: true },
  });
  if (!correction) throw new Error("Save corrected organizational details on the company profile before resubmitting. Submitted files remain locked.");
}
