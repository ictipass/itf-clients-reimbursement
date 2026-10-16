"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { readUploadedFile } from "@/lib/storage/staged-upload";
import { deleteCompanyEvidence, getCompanyEvidenceKinds, uploadCompanyEvidence } from "@/lib/evidence";
import type { CompanyEvidenceKind } from "@/lib/evidence";

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function readEvidenceKind(formData: FormData): CompanyEvidenceKind {
  const value = readRequiredString(formData, "kind");
  const evidenceKinds = getCompanyEvidenceKinds();

  if (!evidenceKinds.includes(value as CompanyEvidenceKind)) {
    throw new Error("Unsupported evidence type.");
  }

  return value as CompanyEvidenceKind;
}

export async function uploadCompanyEvidenceAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  const companyId = readRequiredString(formData, "companyId");

  await uploadCompanyEvidence({
    companyId,
    uploadedByEmail: session.user.email,
    kind: readEvidenceKind(formData),
    documentName: formData.get("documentName")?.toString(),
    file: await readUploadedFile(formData, "file", session.user.id),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function deleteCompanyEvidenceAction(companyId: string, documentId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await deleteCompanyEvidence({
    companyId,
    documentId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}
