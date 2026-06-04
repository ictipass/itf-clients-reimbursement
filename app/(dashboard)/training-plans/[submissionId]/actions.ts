"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
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

  const file = formData.get("trainingPlanCsv");

  if (!(file instanceof File)) {
    throw new Error("Training Plan CSV is required.");
  }

  await importTrainingPlanCsv({
    companyId,
    submissionId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    file,
  });

  revalidatePath(`/training-plans/${submissionId}`);
  revalidatePath(`/registry/${companyId}`);
  redirect(`/training-plans/${submissionId}`);
}

export async function createTrainingRequestFromLineItemAction(lineItemId: string) {
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
  redirect(`/training-requests/${request.id}`);
}
