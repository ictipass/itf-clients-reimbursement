"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { updateContributionOperatingModel } from "@/lib/claim-policy";

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

export async function updateContributionOperatingModelAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await updateContributionOperatingModel({
    requesterRole: session.user.role,
    workspaceId: readRequiredString(formData, "workspaceId"),
    revenueWorkflowMode: readRequiredString(formData, "revenueWorkflowMode"),
  });

  revalidatePath("/");
  revalidatePath("/settings/operating-model");
  revalidatePath("/settings/system");
  revalidatePath("/dashboard");
  revalidatePath("/management");
  revalidatePath("/registry");
  revalidatePath("/registry/[companyId]", "page");
  redirect("/settings/operating-model");
}
