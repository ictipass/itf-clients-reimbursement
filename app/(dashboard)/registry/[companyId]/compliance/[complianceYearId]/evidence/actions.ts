"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { readUploadedFile } from "@/lib/storage/staged-upload";
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

export async function uploadComplianceEvidenceAction(
  companyId: string,
  complianceYearId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await uploadComplianceEvidence({
      companyId,
      complianceYearId,
      uploadedByEmail: session.user.email,
      requesterRole: session.user.role,
      kind: readEvidenceKind(formData),
      receiptIssuer: formData.get("receiptIssuer")?.toString(),
      receiptNumber: formData.get("receiptNumber")?.toString(),
      documentName: formData.get("documentName")?.toString(),
      file: await readUploadedFile(formData, "file", session.user.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence could not be uploaded.";
    redirect(`/registry/${companyId}/compliance/${complianceYearId}/evidence/new?error=${encodeURIComponent(message.slice(0, 280))}`);
  }

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
