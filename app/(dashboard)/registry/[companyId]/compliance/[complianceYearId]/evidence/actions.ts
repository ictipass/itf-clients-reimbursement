"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  attachExistingPaymentEvidence,
  getComplianceEvidenceKinds,
  uploadComplianceEvidence,
  type ComplianceEvidenceKind,
} from "@/lib/compliance";

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function readEvidenceKind(formData: FormData): ComplianceEvidenceKind {
  const value = readRequiredString(formData, "kind");
  const evidenceKinds = getComplianceEvidenceKinds();

  if (!evidenceKinds.includes(value as ComplianceEvidenceKind)) {
    throw new Error("Unsupported compliance evidence type.");
  }

  return value as ComplianceEvidenceKind;
}

function readRequiredFile(formData: FormData) {
  const value = formData.get("file");

  if (!(value instanceof File)) {
    throw new Error("Evidence file is required.");
  }

  return value;
}

export async function uploadComplianceEvidenceAction(
  companyId: string,
  complianceYearId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await uploadComplianceEvidence({
    companyId,
    complianceYearId,
    uploadedByEmail: session.user.email,
    requesterRole: session.user.role,
    kind: readEvidenceKind(formData),
    documentName: formData.get("documentName")?.toString(),
    file: readRequiredFile(formData),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function attachExistingPaymentEvidenceAction(
  companyId: string,
  complianceYearId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await attachExistingPaymentEvidence({
    companyId,
    complianceYearId,
    documentId: readRequiredString(formData, "documentId"),
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}
