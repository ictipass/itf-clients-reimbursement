"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { createJurisdictionChangeRequest, decideJurisdictionChangeRequest } from "@/lib/jurisdiction-change";

function value(formData: FormData, name: string) {
  const result = String(formData.get(name) ?? "").trim();
  if (!result) throw new Error(`${name} is required.`);
  return result;
}

export async function createJurisdictionChangeRequestAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  await createJurisdictionChangeRequest({
    companyId: value(formData, "companyId"),
    toAreaOfficeId: value(formData, "toAreaOfficeId"),
    reason: value(formData, "reason"),
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });
  revalidatePath("/jurisdiction-requests");
  revalidatePath("/dashboard");
  redirect("/jurisdiction-requests");
}

export async function decideJurisdictionChangeRequestAction(requestId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  const decision = value(formData, "decision");
  if (decision !== "APPROVED" && decision !== "REJECTED") throw new Error("Unsupported decision.");
  await decideJurisdictionChangeRequest({
    requestId,
    decision,
    reviewNote: String(formData.get("reviewNote") ?? "").trim() || undefined,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });
  revalidatePath("/jurisdiction-requests");
  revalidatePath("/registry");
  revalidatePath("/dashboard");
  redirect("/jurisdiction-requests");
}
