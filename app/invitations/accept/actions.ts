"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { acceptOrganizationInvitation } from "@/lib/employer-members";

export async function acceptOrganizationInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/invitations/accept?token=${token}`)}`);
  }

  try {
    await acceptOrganizationInvitation({ token, requesterEmail: session.user.email });
  } catch (error) {
    redirect(`/invitations/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(error instanceof Error ? error.message : "Invitation could not be accepted.")}`);
  }

  redirect("/dashboard");
}
