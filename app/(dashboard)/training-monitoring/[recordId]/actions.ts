"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  addTrainingMonitoringEvaluation,
  getTrainingMonitoringEvidenceKinds,
  getTrainingMonitoringTransitions,
  routeTrainingMonitoringRecord,
  updateTrainingMonitoringRecord,
  uploadTrainingMonitoringEvidence,
  type TrainingMonitoringEvidenceKind,
  type TrainingMonitoringTransition,
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

function readMonitoringTransition(formData: FormData): TrainingMonitoringTransition {
  const value = readOptionalString(formData, "transition");
  const transitions = getTrainingMonitoringTransitions();

  if (!value || !transitions.includes(value as TrainingMonitoringTransition)) {
    throw new Error("Unsupported Training Monitoring transition.");
  }

  return value as TrainingMonitoringTransition;
}

function readScore(formData: FormData) {
  const value = Number(readRequiredString(formData, "score"));

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error("Score must be between 1 and 5.");
  }

  return value;
}

function readOptionalDate(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid date.`);
  }

  return date;
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

export async function updateTrainingMonitoringRecordAction(
  recordId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await updateTrainingMonitoringRecord({
    recordId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    monitoringDate: readOptionalDate(formData, "monitoringDate"),
    startsAt: readOptionalDate(formData, "startsAt"),
    endsAt: readOptionalDate(formData, "endsAt"),
    meetingId: readOptionalString(formData, "meetingId"),
    passcode: readOptionalString(formData, "passcode"),
    virtualLink: readOptionalString(formData, "virtualLink"),
    monitoringOfficerName: readOptionalString(formData, "monitoringOfficerName"),
    monitoringOfficerTitle: readOptionalString(formData, "monitoringOfficerTitle"),
    headOfDivisionName: readOptionalString(formData, "headOfDivisionName"),
    directorName: readOptionalString(formData, "directorName"),
  });

  revalidatePath(`/training-monitoring/${recordId}`);
  redirect(`/training-monitoring/${recordId}`);
}

export async function routeTrainingMonitoringRecordAction(
  recordId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await routeTrainingMonitoringRecord({
    recordId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    transition: readMonitoringTransition(formData),
    note: readOptionalString(formData, "note"),
  });

  revalidatePath(`/training-monitoring`);
  revalidatePath(`/training-monitoring/${recordId}`);
  redirect(`/training-monitoring/${recordId}`);
}
