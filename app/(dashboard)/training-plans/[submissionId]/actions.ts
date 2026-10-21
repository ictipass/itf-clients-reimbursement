"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { readUploadedFile } from "@/lib/storage/staged-upload";
import { createTrainingRequestFromLineItem } from "@/lib/training-request";
import { importTrainingPlanCsv } from "@/lib/training-plan";

export async function importTrainingPlanCsvAction(
  companyId: string,
  submissionId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  const file = await readUploadedFile(formData, "trainingPlanCsv", session.user.id);

  try {
    await importTrainingPlanCsv({
      companyId,
      submissionId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      file,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Training plan file could not be imported.";
    redirect(`/training-plans/${submissionId}?importError=${encodeURIComponent(message.slice(0, 280))}`);
  }

  revalidatePath(`/training-plans/${submissionId}`);
  revalidatePath(`/registry/${companyId}`);
  redirect(`/training-plans/${submissionId}`);
}

export async function createTrainingRequestFromLineItemAction(submissionId: string, lineItemId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  const request = await createTrainingRequestFromLineItem({
    lineItemId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/training-requests`);
  revalidatePath(`/training-plans/${submissionId}`);
  redirect(`/training-requests/${request.id}`);
}
