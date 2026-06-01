"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
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

function readRequiredFile(formData: FormData) {
  const value = formData.get("file");

  if (!(value instanceof File)) {
    throw new Error("Evidence file is required.");
  }

  return value;
}

export async function uploadCompanyEvidenceAction(formData: FormData) {
  const companyId = readRequiredString(formData, "companyId");

  await uploadCompanyEvidence({
    companyId,
    uploadedByEmail: process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@itf.local",
    kind: readEvidenceKind(formData),
    file: readRequiredFile(formData),
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
