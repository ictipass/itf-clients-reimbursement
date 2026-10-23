"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { readUploadedFile } from "@/lib/storage/staged-upload";
import type {
  ContributionVerificationSource,
  ContributionVerificationStatus,
} from "@/lib/claim-verification";
import {
  calculateAreaOfficeClaim,
  addClaimLine,
  attachTrainingsToClaim,
  deleteClaimLine,
  detachTrainingFromClaim,
  forwardClaimAlongWorkflow,
  forwardClaimToAreaReimbursementOfficer,
  forwardClaimToHeadOfTraining,
  getClaimEvidenceKinds,
  markClaimKiv,
  recheckClaimAnnualPayment,
  resumeClaimFromKiv,
  submitClaimToAreaManager,
  updateClaimAuditReview,
  updateClaimLine,
  updateClaimContributionVerification,
  updateClaimPaymentHandoff,
  updateClaimRecommendation,
  updateClaimForm,
  updateClaimStaffEntries,
  updateEmployerClaimCalculation,
  uploadClaimEvidence,
  type ClaimDesk,
  type ClaimEvidenceKind,
} from "@/lib/claims";
import type { ReimbursementAuditReviewStatus } from "@/lib/reimbursement-audit-review";
import type { ReimbursementPaymentHandoffStatus } from "@/lib/reimbursement-payment-schedule";
import { parseClaimStaffEntryLines } from "@/lib/reimbursement-staff";

function readOptionalString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalNumber(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    return undefined;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return number;
}

function readRequiredNumber(formData: FormData, name: string) {
  const number = readOptionalNumber(formData, name);

  if (number === undefined) {
    throw new Error(`${name} is required.`);
  }

  return number;
}

function readEvidenceKind(formData: FormData): ClaimEvidenceKind {
  const value = readOptionalString(formData, "kind");
  const kinds = getClaimEvidenceKinds();

  if (!value || !kinds.includes(value as ClaimEvidenceKind)) {
    throw new Error("Unsupported claim evidence kind.");
  }

  return value as ClaimEvidenceKind;
}

function readRequiredString(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export async function recheckClaimAnnualPaymentAction(claimId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  let result: "ELIGIBLE" | "INELIGIBLE" | "PENDING";
  try {
    const check = await recheckClaimAnnualPayment({
      claimId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
    });
    result = check.status;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Annual payment check failed.";
    redirect(`/claims/${claimId}?paymentCheckError=${encodeURIComponent(message.slice(0, 280))}#contribution-verification`);
  }
  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}?paymentCheck=${result}#contribution-verification`);
}

export async function updateClaimFormAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await updateClaimForm({
      claimId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      claimYear: readOptionalNumber(formData, "claimYear"),
      trainingContributionDue: readOptionalNumber(formData, "trainingContributionDue"),
      trainingContributionPaid: readOptionalNumber(formData, "trainingContributionPaid"),
      itfReceiptNumber: readOptionalString(formData, "itfReceiptNumber"),
      bankId: readOptionalString(formData, "bankId"),
      accountNumber: readOptionalString(formData, "accountNumber"),
      claimedAmount: readRequiredNumber(formData, "claimedAmount"),
      employerOfficerName: readOptionalString(formData, "employerOfficerName"),
      employerOfficerRank: readOptionalString(formData, "employerOfficerRank"),
      chiefExecutiveName: readOptionalString(formData, "chiefExecutiveName"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim form could not be saved.";
    redirect(`/claims/${claimId}?formError=${encodeURIComponent(message.slice(0, 280))}#claim-form`);
  }

  revalidatePath(`/claims`);
  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}?formSaved=1#claim-form`);
}

export async function submitClaimToAreaManagerAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await submitClaimToAreaManager({
      claimId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      note: readOptionalString(formData, "note"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim could not be submitted.";
    redirect(`/claims/${claimId}?routingError=${encodeURIComponent(message.slice(0, 280))}`);
  }

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
  redirect(`/claims/${claimId}`);
}

export async function forwardClaimToHeadOfTrainingAction(
  claimId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await forwardClaimToHeadOfTraining({
      claimId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      note: readOptionalString(formData, "note"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim could not be forwarded.";
    redirect(`/claims/${claimId}?routingError=${encodeURIComponent(message.slice(0, 280))}`);
  }

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
  redirect(`/claims/${claimId}`);
}

export async function forwardClaimToAreaReimbursementOfficerAction(
  claimId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await forwardClaimToAreaReimbursementOfficer({
    claimId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    note: readOptionalString(formData, "note"),
  });

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
  redirect(`/claims/${claimId}`);
}

export async function forwardClaimAlongWorkflowAction(
  claimId: string,
  fromDesk: ClaimDesk,
  toDesk: ClaimDesk,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await forwardClaimAlongWorkflow({
    claimId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    fromDesk,
    toDesk,
    note: readOptionalString(formData, "note"),
  });

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
  redirect(`/claims/${claimId}`);
}

export async function markClaimKivAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await markClaimKiv({
    claimId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    note: readOptionalString(formData, "note"),
  });

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
  redirect(`/claims/${claimId}`);
}

export async function resumeClaimFromKivAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await resumeClaimFromKiv({
    claimId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    note: readOptionalString(formData, "note"),
  });

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
  redirect(`/claims/${claimId}`);
}

export async function updateClaimPaymentHandoffAction(
  claimId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await updateClaimPaymentHandoff({
    claimId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    status: readRequiredString(formData, "paymentHandoffStatus") as ReimbursementPaymentHandoffStatus,
    paymentSystemReference: readOptionalString(formData, "paymentSystemReference"),
    paymentSystemStatus: readOptionalString(formData, "paymentSystemStatus"),
    note: readOptionalString(formData, "note"),
  });

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
  redirect(`/claims/${claimId}`);
}

export async function updateClaimAuditReviewAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await updateClaimAuditReview({
    claimId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    status: readRequiredString(
      formData,
      "auditReviewStatus",
    ) as ReimbursementAuditReviewStatus,
    observations: readOptionalString(formData, "auditObservations"),
    recommendation: readOptionalString(formData, "auditRecommendation"),
    auditedAmount: readOptionalNumber(formData, "auditedAmount"),
    varianceAmount: readOptionalNumber(formData, "varianceAmount"),
  });

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
  redirect(`/claims/${claimId}`);
}

export async function attachTrainingsToClaimAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await attachTrainingsToClaim({
    claimId,
    trainingRequestIds: formData
      .getAll("trainingRequestIds")
      .filter((value): value is string => typeof value === "string"),
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/training-requests");
  redirect(`/claims/${claimId}`);
}

export async function detachTrainingFromClaimAction(
  claimId: string,
  trainingRequestId: string,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await detachTrainingFromClaim({
    claimId,
    trainingRequestId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  revalidatePath(`/training-requests/${trainingRequestId}`);
  redirect(`/claims/${claimId}`);
}

export async function uploadClaimEvidenceAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    const file = await readUploadedFile(formData, "evidence", session.user.id);
    await uploadClaimEvidence({
      claimId,
      uploadedByEmail: session.user.email,
      requesterRole: session.user.role,
      kind: readEvidenceKind(formData),
      file,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim evidence could not be uploaded.";
    redirect(`/claims/${claimId}?evidenceError=${encodeURIComponent(message.slice(0, 280))}#claim-evidence`);
  }

  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}?evidenceSaved=1#claim-evidence`);
}

export async function updateClaimRecommendationAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await updateClaimRecommendation({
    claimId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    eligibleAmount: readOptionalNumber(formData, "eligibleAmount"),
    claimRecommendedAmount: readOptionalNumber(formData, "claimRecommendedAmount"),
    claimRecommendedInWords: readOptionalString(formData, "claimRecommendedInWords"),
    reviewerRemarks: readOptionalString(formData, "reviewerRemarks"),
  });

  revalidatePath(`/claims`);
  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}`);
}

export async function calculateAreaOfficeClaimAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");

  try {
    await calculateAreaOfficeClaim({
      claimId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      verified: {
        managementTrained: readOptionalNumber(formData, "managementTrained"),
        supervisoryTrained: readOptionalNumber(formData, "supervisoryTrained"),
        occupationalTrained: readOptionalNumber(formData, "occupationalTrained"),
        smallTrained: readOptionalNumber(formData, "smallTrained"),
        ldTrained: readOptionalNumber(formData, "ldTrained"),
        hseTrained: readOptionalNumber(formData, "hseTrained"),
        siwesStudentsAccepted: readRequiredNumber(formData, "siwesStudentsAccepted"),
        trainingPlanSubmittedPromptly: formData.get("trainingPlanSubmittedPromptly") === "on",
      },
      reviewerRemarks: readRequiredString(formData, "reviewerRemarks"),
      reviewedForm1A: formData.get("reviewedForm1A") === "on",
      reviewedForm2A: formData.get("reviewedForm2A") === "on",
      reviewedEvidence: formData.get("reviewedEvidence") === "on",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Area Office calculation could not be saved.";
    redirect(`/claims/${claimId}?areaCalculationError=${encodeURIComponent(message.slice(0, 280))}#area-office-calculation`);
  }

  revalidatePath("/claims");
  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}?areaCalculationSaved=1#area-office-calculation`);
}

export async function updateClaimContributionVerificationAction(
  claimId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await updateClaimContributionVerification({
      claimId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      status: readRequiredString(
        formData,
        "contributionVerificationStatus",
      ) as ContributionVerificationStatus,
      source: readRequiredString(
        formData,
        "contributionVerificationSource",
      ) as ContributionVerificationSource,
      note: readOptionalString(formData, "contributionVerificationNote"),
      externalVerificationProvider: readOptionalString(
        formData,
        "externalVerificationProvider",
      ),
      externalVerificationReference: readOptionalString(
        formData,
        "externalVerificationReference",
      ),
      externalVerificationMessage: readOptionalString(
        formData,
        "externalVerificationMessage",
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence assessment could not be saved.";
    redirect(`/claims/${claimId}?assessmentError=${encodeURIComponent(message.slice(0, 280))}#contribution-verification`);
  }

  revalidatePath(`/claims`);
  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}?assessmentSaved=1#contribution-verification`);
}

function readRequiredPositiveNumber(formData: FormData, name: string) {
  const number = readRequiredNumber(formData, name);

  if (number < 0) {
    throw new Error(`${name} cannot be negative.`);
  }

  return number;
}

function readTrainingEmphasisRank(formData: FormData, name: string) {
  const rank = readRequiredNumber(formData, name);

  if (rank !== 1 && rank !== 2 && rank !== 3) {
    throw new Error(`${name} must be 1, 2, or 3.`);
  }

  return rank;
}

export async function updateEmployerClaimCalculationAction(
  claimId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  const employerScale = readOptionalString(formData, "employerScale");
  const trainingContributionPaid = readRequiredPositiveNumber(
    formData,
    "trainingContributionPaid",
  );
  const siwesStudentsAccepted = readOptionalNumber(formData, "siwesStudentsAccepted");
  const trainingPlanSubmittedPromptly = formData.get("trainingPlanSubmittedPromptly") === "on";

  if (employerScale === "SMALL") {
    await updateEmployerClaimCalculation({
      claimId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      calculation: {
        employerScale,
        trainingContributionPaid,
        smallScaleTraining: {
          totalStaff: readRequiredPositiveNumber(formData, "smallTotalStaff"),
          totalTrained: readRequiredPositiveNumber(formData, "smallTotalTrained"),
        },
        siwesStudentsAccepted,
        trainingPlanSubmittedPromptly,
      },
    });
  } else if (employerScale === "MEDIUM_LARGE") {
    await updateEmployerClaimCalculation({
      claimId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      calculation: {
        employerScale,
        trainingContributionPaid,
        emphasisRanks: {
          MANAGEMENT: readTrainingEmphasisRank(formData, "managementEmphasisRank"),
          SUPERVISORY: readTrainingEmphasisRank(formData, "supervisoryEmphasisRank"),
          OCCUPATIONAL: readTrainingEmphasisRank(formData, "occupationalEmphasisRank"),
        },
        trainingAreas: {
          MANAGEMENT: {
            totalStaff: readRequiredPositiveNumber(formData, "managementTotalStaff"),
            totalTrained: readRequiredPositiveNumber(formData, "managementTotalTrained"),
          },
          SUPERVISORY: {
            totalStaff: readRequiredPositiveNumber(formData, "supervisoryTotalStaff"),
            totalTrained: readRequiredPositiveNumber(formData, "supervisoryTotalTrained"),
          },
          OCCUPATIONAL: {
            totalStaff: readRequiredPositiveNumber(formData, "occupationalTotalStaff"),
            totalTrained: readRequiredPositiveNumber(formData, "occupationalTotalTrained"),
          },
        },
        learningDevelopmentPersonnel:
          readOptionalNumber(formData, "ldTotalStaff") !== undefined ||
          readOptionalNumber(formData, "ldTotalTrained") !== undefined
            ? {
                totalStaff: readRequiredPositiveNumber(formData, "ldTotalStaff"),
                totalTrained: readRequiredPositiveNumber(formData, "ldTotalTrained"),
              }
            : undefined,
        healthSafetyEnvironment:
          readOptionalNumber(formData, "hseTotalWorkforce") !== undefined ||
          readOptionalNumber(formData, "hseTotalTrained") !== undefined
            ? {
                totalWorkforce: readRequiredPositiveNumber(formData, "hseTotalWorkforce"),
                totalTrained: readRequiredPositiveNumber(formData, "hseTotalTrained"),
              }
            : undefined,
        siwesStudentsAccepted,
        trainingPlanSubmittedPromptly,
      },
    });
  } else {
    throw new Error("Unsupported employer scale.");
  }

  revalidatePath(`/claims`);
  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}`);
}

export async function updateClaimStaffEntriesAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await updateClaimStaffEntries({
    claimId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    entries: [
      ...parseClaimStaffEntryLines(
        readOptionalString(formData, "managementStaff") ?? "",
        "MANAGEMENT",
      ),
      ...parseClaimStaffEntryLines(
        readOptionalString(formData, "supervisoryStaff") ?? "",
        "SUPERVISORY",
      ),
      ...parseClaimStaffEntryLines(
        readOptionalString(formData, "occupationalStaff") ?? "",
        "OCCUPATIONAL",
      ),
    ],
  });

  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}`);
}

function readClaimLineInput(claimId: string, formData: FormData) {
  const trainingArea = readOptionalString(formData, "trainingArea");

  if (!trainingArea) {
    throw new Error("Training area is required.");
  }

  return {
    claimId,
    trainingArea,
    totalWorkforce: readOptionalNumber(formData, "totalWorkforce"),
    totalTrained: readOptionalNumber(formData, "totalTrained"),
    emphasisNumber: readOptionalNumber(formData, "emphasisNumber"),
    contributionPaid: readOptionalNumber(formData, "contributionPaid"),
    employerClaimAmount: readOptionalNumber(formData, "employerClaimAmount"),
    referencePage: readOptionalString(formData, "referencePage"),
    percentAwarded: readOptionalNumber(formData, "percentAwarded"),
    amountAwarded: readOptionalNumber(formData, "amountAwarded"),
    remarks: readOptionalString(formData, "remarks"),
  };
}

export async function addClaimLineAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await addClaimLine({
    ...readClaimLineInput(claimId, formData),
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}`);
}

export async function updateClaimLineAction(
  claimId: string,
  lineId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await updateClaimLine({
      ...readClaimLineInput(claimId, formData),
      lineId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calculation row could not be saved.";
    redirect(`/claims/${claimId}?lineError=${encodeURIComponent(message.slice(0, 280))}#calculations`);
  }

  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}?lineSaved=1#calculations`);
}

export async function deleteClaimLineAction(claimId: string, lineId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await deleteClaimLine({
    claimId,
    lineId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}`);
}
