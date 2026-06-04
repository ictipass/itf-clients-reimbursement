"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  getTrainingRequestTransitions,
  routeTrainingRequest,
  submitTrainingRequest,
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
