"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { readUploadedFile } from "@/lib/storage/staged-upload";
import {
  addTrainingParticipant,
  deleteTrainingParticipant,
  getTrainingRequestTransitions,
  getTrainingRequestEvidenceKinds,
  getTrainingAreas,
  routeTrainingRequest,
  reassignTrainingRequestReimbursementOfficer,
  submitTrainingRequest,
  updateTrainingRequestDetails,
  updateTrainingRequestSource,
  updateTrainingParticipant,
  uploadTrainingRequestEvidence,
  type TrainingRequestEvidenceKind,
  type TrainingArea,
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

export async function updateTrainingRequestDetailsAction(requestId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");

  const deliveryMode = readOptionalString(formData, "deliveryMode");
  if (deliveryMode !== "LOCAL_PHYSICAL" && deliveryMode !== "LOCAL_ONLINE") {
    throw new Error("Unsupported training delivery mode.");
  }

  const title = readOptionalString(formData, "title");
  const provider = readOptionalString(formData, "provider");
  const startsAt = readOptionalString(formData, "startsAt");
  const endsAt = readOptionalString(formData, "endsAt");
  const estimatedCost = Number(readOptionalString(formData, "estimatedCost"));

  if (!title || !provider || !startsAt || !endsAt || !Number.isFinite(estimatedCost)) {
    throw new Error("Title, provider, dates, and estimated cost are required.");
  }

  await updateTrainingRequestDetails({
    requestId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    title,
    description: readOptionalString(formData, "description"),
    provider,
    venue: readOptionalString(formData, "venue"),
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    estimatedCost,
    expectedOutcome: readOptionalString(formData, "expectedOutcome"),
    deliveryMode,
    onlineUrl: readOptionalString(formData, "onlineUrl"),
    onlinePassword: readOptionalString(formData, "onlinePassword"),
    onlineMeetingId: readOptionalString(formData, "onlineMeetingId"),
    onlineInstructions: readOptionalString(formData, "onlineInstructions"),
    adHocJustification: readOptionalString(formData, "adHocJustification"),
  });

  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

export async function updateTrainingRequestSourceAction(requestId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  await updateTrainingRequestSource({
    requestId,
    trainingPlanLineItemId: readOptionalString(formData, "trainingPlanLineItemId"),
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });
  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests/${requestId}`);
}

export async function routeTrainingRequestAction(requestId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await routeTrainingRequest({
      requestId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      transition: readTrainingRequestTransition(formData),
      note: readOptionalString(formData, "note"),
      assigneeUserId: readOptionalString(formData, "assigneeUserId"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The workflow action could not be completed.";
    redirect(`/training-requests/${requestId}?workflowError=${encodeURIComponent(message.slice(0, 240))}`);
  }

  revalidatePath(`/training-requests`);
  revalidatePath(`/training-requests/${requestId}`);
  redirect(`/training-requests?routed=1`);
}

export async function reassignTrainingRequestReimbursementOfficerAction(requestId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  try {
    await reassignTrainingRequestReimbursementOfficer({
      requestId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      assigneeUserId: readOptionalString(formData, "assigneeUserId") ?? "",
      reason: readOptionalString(formData, "reason") ?? "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request could not be reassigned.";
    redirect(`/training-requests/${requestId}?workflowError=${encodeURIComponent(message.slice(0, 240))}`);
  }
  revalidatePath("/training-requests");
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

  const file = await readUploadedFile(formData, "evidence", session.user.id);

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

function readParticipantInput(requestId: string, formData: FormData) {
  const name = readOptionalString(formData, "name");

  if (!name) {
    throw new Error("Participant name is required.");
  }

  const trainingArea = readOptionalString(formData, "trainingArea");
  if (trainingArea && !getTrainingAreas().includes(trainingArea as TrainingArea)) {
    throw new Error("Unsupported training area.");
  }

  return {
    requestId,
    name,
    jobTitle: readOptionalString(formData, "jobTitle"),
    trainingArea,
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
