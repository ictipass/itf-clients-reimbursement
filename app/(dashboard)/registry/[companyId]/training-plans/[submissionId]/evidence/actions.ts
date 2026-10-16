"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { readUploadedFile } from "@/lib/storage/staged-upload";
import {
  getTrainingPlanEvidenceKinds,
  uploadTrainingPlanEvidence,
  type TrainingPlanEvidenceKind,
} from "@/lib/training-plan";

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function readEvidenceKind(formData: FormData): TrainingPlanEvidenceKind {
  const value = readRequiredString(formData, "kind");
  const evidenceKinds = getTrainingPlanEvidenceKinds();

  if (!evidenceKinds.includes(value as TrainingPlanEvidenceKind)) {
    throw new Error("Unsupported training plan evidence type.");
  }

  return value as TrainingPlanEvidenceKind;
}

export async function uploadTrainingPlanEvidenceAction(
  companyId: string,
  submissionId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await uploadTrainingPlanEvidence({
    companyId,
    submissionId,
    uploadedByEmail: session.user.email,
    requesterRole: session.user.role,
    kind: readEvidenceKind(formData),
    file: await readUploadedFile(formData, "file", session.user.id),
  });

  revalidatePath(`/registry/${companyId}`);
  revalidatePath(`/training-plans/${submissionId}`);
  redirect(`/training-plans/${submissionId}`);
}
