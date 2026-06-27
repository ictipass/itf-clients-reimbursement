"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  addClaimLine,
  attachTrainingsToClaim,
  deleteClaimLine,
  detachTrainingFromClaim,
  getClaimEvidenceKinds,
  updateClaimLine,
  updateClaimRecommendation,
  updateClaimForm,
  updateClaimStaffEntries,
  updateEmployerClaimCalculation,
  uploadClaimEvidence,
  type ClaimEvidenceKind,
} from "@/lib/claims";
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

export async function updateClaimFormAction(claimId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await updateClaimForm({
    claimId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    claimYear: readOptionalNumber(formData, "claimYear"),
    trainingContributionDue: readOptionalNumber(formData, "trainingContributionDue"),
    trainingContributionPaid: readOptionalNumber(formData, "trainingContributionPaid"),
    itfReceiptNumber: readOptionalString(formData, "itfReceiptNumber"),
    bankName: readOptionalString(formData, "bankName"),
    accountNumber: readOptionalString(formData, "accountNumber"),
    sortCode: readOptionalString(formData, "sortCode"),
    claimedAmount: readRequiredNumber(formData, "claimedAmount"),
    employerOfficerName: readOptionalString(formData, "employerOfficerName"),
    employerOfficerRank: readOptionalString(formData, "employerOfficerRank"),
    chiefExecutiveName: readOptionalString(formData, "chiefExecutiveName"),
  });

  revalidatePath(`/claims`);
  revalidatePath(`/claims/${claimId}`);
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

  const file = formData.get("evidence");

  if (!(file instanceof File)) {
    throw new Error("Evidence file is required.");
  }

  await uploadClaimEvidence({
    claimId,
    uploadedByEmail: session.user.email,
    requesterRole: session.user.role,
    kind: readEvidenceKind(formData),
    file,
  });

  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}`);
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

  await updateClaimLine({
    ...readClaimLineInput(claimId, formData),
    lineId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/claims/${claimId}`);
  redirect(`/claims/${claimId}`);
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
