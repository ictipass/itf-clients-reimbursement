"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { createClaim } from "@/lib/claims";

export async function createClaimAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  let claim: Awaited<ReturnType<typeof createClaim>>;
  try {
    claim = await createClaim({
      trainingRequestIds: formData
        .getAll("trainingRequestIds")
        .filter((value): value is string => typeof value === "string"),
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim could not be created.";
    redirect(`/claims?createError=${encodeURIComponent(message.slice(0, 280))}`);
  }

  revalidatePath("/claims");
  revalidatePath("/training-requests");
  redirect(`/claims/${claim.id}`);
}
