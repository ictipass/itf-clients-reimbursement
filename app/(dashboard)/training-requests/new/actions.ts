"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { createAdHocTrainingRequest } from "@/lib/training-request";

function required(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export async function createAdHocTrainingRequestAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");

  const deliveryMode = required(formData, "deliveryMode");
  if (deliveryMode !== "LOCAL_PHYSICAL" && deliveryMode !== "LOCAL_ONLINE") {
    throw new Error("Unsupported training delivery mode.");
  }

  const request = await createAdHocTrainingRequest({
    companyId: required(formData, "companyId"),
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    title: required(formData, "title"),
    provider: required(formData, "provider"),
    startsAt: new Date(required(formData, "startsAt")),
    endsAt: new Date(required(formData, "endsAt")),
    estimatedCost: Number(required(formData, "estimatedCost")),
    deliveryMode,
    venue: String(formData.get("venue") ?? "").trim() || undefined,
    adHocJustification: required(formData, "adHocJustification"),
  });

  redirect(`/training-requests/${request.id}`);
}
