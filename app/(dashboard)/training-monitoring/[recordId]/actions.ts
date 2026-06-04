"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  addTrainingMonitoringEvaluation,
  getTrainingMonitoringEvidenceKinds,
  uploadTrainingMonitoringEvidence,
  type TrainingMonitoringEvidenceKind,
} from "@/lib/training-monitoring";

function readOptionalString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readRequiredString(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function readEvidenceKind(formData: FormData): TrainingMonitoringEvidenceKind {
  const value = readOptionalString(formData, "kind");
  const kinds = getTrainingMonitoringEvidenceKinds();

  if (!value || !kinds.includes(value as TrainingMonitoringEvidenceKind)) {
    throw new Error("Unsupported Training Monitoring evidence kind.");
  }

  return value as TrainingMonitoringEvidenceKind;
}

function readScore(formData: FormData) {
  const value = Number(readRequiredString(formData, "score"));

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error("Score must be between 1 and 5.");
  }

  return value;
}

export async function uploadTrainingMonitoringEvidenceAction(
  recordId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  const file = formData.get("evidence");

  if (!(file instanceof File)) {
    throw new Error("Evidence file is required.");
  }

  await uploadTrainingMonitoringEvidence({
    recordId,
    uploadedByEmail: session.user.email,
    requesterRole: session.user.role,
    kind: readEvidenceKind(formData),
    file,
  });

  revalidatePath(`/training-monitoring/${recordId}`);
  redirect(`/training-monitoring/${recordId}`);
}

export async function addTrainingMonitoringEvaluationAction(
  recordId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await addTrainingMonitoringEvaluation({
    recordId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    section: readRequiredString(formData, "section"),
    ratingArea: readRequiredString(formData, "ratingArea"),
    score: readScore(formData),
    note: readOptionalString(formData, "note"),
  });

  revalidatePath(`/training-monitoring/${recordId}`);
  redirect(`/training-monitoring/${recordId}`);
}
