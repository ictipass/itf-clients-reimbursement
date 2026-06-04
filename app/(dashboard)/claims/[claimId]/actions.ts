"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  getClaimEvidenceKinds,
  updateClaimForm,
  uploadClaimEvidence,
  type ClaimEvidenceKind,
} from "@/lib/claims";

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
