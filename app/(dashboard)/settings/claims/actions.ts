"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { activateReimbursementPolicy, updateClaimSubmissionPolicy } from "@/lib/claim-policy";

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
    requesterEmail: session.user.email,
    workspaceId: readRequiredString(formData, "workspaceId"),
    allowLateClaimSubmissions: formData.get("allowLateClaimSubmissions") === "on",
  });

  revalidatePath("/settings/claims");
  revalidatePath("/claims");
  redirect("/settings/claims");
}

export async function activateReimbursementPolicyAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/sign-in");
  }

  try {
    await activateReimbursementPolicy({
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      workspaceId: readRequiredString(formData, "workspaceId"),
      edition: readRequiredString(formData, "edition"),
      approvalReference: readRequiredString(formData, "approvalReference"),
      approvalConfirmed: formData.get("approvalConfirmed") === "on",
    });
  } catch (error) {
    const knownPrefixes = [
      "Only an administrator",
      "Workspace was not found.",
      "An active administrator assignment",
      "Unsupported reimbursement policy edition:",
      "Enter the formal policy approval reference",
      "Confirm that this policy edition",
      "This policy edition is already active",
      "workspaceId is required.",
      "edition is required.",
      "approvalReference is required.",
    ];
    const message = error instanceof Error && knownPrefixes.some((prefix) => error.message.startsWith(prefix))
      ? error.message
      : "Policy activation could not be saved. Please retry or contact the administrator.";
    redirect(`/settings/claims?policyError=${encodeURIComponent(message.slice(0, 180))}`);
  }

  revalidatePath("/settings/claims");
  revalidatePath("/dashboard");
  revalidatePath("/claims");
  redirect("/settings/claims?policySaved=1");
}
