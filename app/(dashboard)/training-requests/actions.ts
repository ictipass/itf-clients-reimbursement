"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { archiveDraftTrainingRequest } from "@/lib/training-request";

export async function archiveDraftTrainingRequestAction(requestId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await archiveDraftTrainingRequest({
    requestId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath("/training-requests");
  redirect("/training-requests");
}
