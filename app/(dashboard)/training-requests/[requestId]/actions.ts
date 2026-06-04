"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { createClaimFromTrainingRequest } from "@/lib/claims";
import {
  createTrainingMonitoringRecord,
  getTrainingMonitoringModes,
  type TrainingMonitoringModeInput,
} from "@/lib/training-monitoring";
import {
  addTrainingParticipant,
  deleteTrainingParticipant,
  getTrainingRequestTransitions,
  getTrainingRequestEvidenceKinds,
  routeTrainingRequest,
  submitTrainingRequest,
  updateTrainingParticipant,
  uploadTrainingRequestEvidence,
  type TrainingRequestEvidenceKind,
  type TrainingRequestTransition,
} from "@/lib/training-request";

function readOptionalString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readTrainingRequestTransition(formData: FormData): TrainingRequestTransition {
  const value = readOptionalString(formData, "transition");
  const transitions = getTrainingRequestTransitions();

  if (!value || !transitions.includes(value as TrainingRequestTransition)) {
    throw new Error("Unsupported Training Approval Request transition.");
  }

  return value as TrainingRequestTransition;
}

function readMonitoringMode(formData: FormData): TrainingMonitoringModeInput {
  const value = readOptionalString(formData, "mode");
  const modes = getTrainingMonitoringModes();

  if (!value || !modes.includes(value as TrainingMonitoringModeInput)) {
    throw new Error("Unsupported Training Monitoring mode.");
  }

  return value as TrainingMonitoringModeInput;
}

export async function submitTrainingRequestAction(requestId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await submitTrainingRequest({
    requestId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    note: readOptionalString(formData, "note"),
  });

  revalidatePath(`/training-requests`);
  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

export async function routeTrainingRequestAction(requestId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await routeTrainingRequest({
    requestId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    transition: readTrainingRequestTransition(formData),
    note: readOptionalString(formData, "note"),
  });

  revalidatePath(`/training-requests`);
  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

function readEvidenceKind(formData: FormData): TrainingRequestEvidenceKind {
  const value = readOptionalString(formData, "kind");
  const kinds = getTrainingRequestEvidenceKinds();

  if (!value || !kinds.includes(value as TrainingRequestEvidenceKind)) {
    throw new Error("Unsupported Training Approval evidence kind.");
  }

  return value as TrainingRequestEvidenceKind;
}

export async function uploadTrainingRequestEvidenceAction(requestId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  const file = formData.get("evidence");

  if (!(file instanceof File)) {
    throw new Error("Evidence file is required.");
  }

  await uploadTrainingRequestEvidence({
    requestId,
    uploadedByEmail: session.user.email,
    requesterRole: session.user.role,
    kind: readEvidenceKind(formData),
    file,
  });

  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

export async function createTrainingMonitoringRecordAction(
  requestId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  const record = await createTrainingMonitoringRecord({
    trainingRequestId: requestId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    mode: readMonitoringMode(formData),
  });

  revalidatePath(`/training-requests/${requestId}`);
  revalidatePath(`/training-monitoring`);
  redirect(`/training-monitoring/${record.id}`);
}

function readParticipantInput(requestId: string, formData: FormData) {
  const name = readOptionalString(formData, "name");

  if (!name) {
    throw new Error("Participant name is required.");
  }

  return {
    requestId,
    name,
    jobTitle: readOptionalString(formData, "jobTitle"),
    trainingArea: readOptionalString(formData, "trainingArea"),
    educationalQualification: readOptionalString(formData, "educationalQualification"),
    nationality: readOptionalString(formData, "nationality"),
    courseTitle: readOptionalString(formData, "courseTitle"),
    courseOrganiser: readOptionalString(formData, "courseOrganiser"),
    venue: readOptionalString(formData, "venue"),
  };
}

export async function addTrainingParticipantAction(requestId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await addTrainingParticipant({
    ...readParticipantInput(requestId, formData),
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

export async function updateTrainingParticipantAction(
  requestId: string,
  participantId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await updateTrainingParticipant({
    ...readParticipantInput(requestId, formData),
    participantId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

export async function deleteTrainingParticipantAction(
  requestId: string,
  participantId: string,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await deleteTrainingParticipant({
    requestId,
    participantId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

export async function createClaimFromTrainingRequestAction(requestId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await createClaimFromTrainingRequest({
    trainingRequestId: requestId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/claims`);
  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/claims`);
}
