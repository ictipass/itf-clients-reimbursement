"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { updateClaimSubmissionPolicy } from "@/lib/claim-policy";

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

export async function updateClaimSubmissionPolicyAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await updateClaimSubmissionPolicy({
    requesterRole: session.user.role,
    workspaceId: readRequiredString(formData, "workspaceId"),
    allowLateClaimSubmissions: formData.get("allowLateClaimSubmissions") === "on",
    revenueWorkflowMode: readRequiredString(formData, "revenueWorkflowMode"),
  });

  revalidatePath("/settings/claims");
  revalidatePath("/claims");
  redirect("/settings/claims");
}
