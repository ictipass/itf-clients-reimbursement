"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import {
  changeEmployerMemberRole,
  getEmployerRoles,
  inviteEmployerMember,
  revokeEmployerInvitation,
  type EmployerRole,
} from "@/lib/employer-members";
import { deactivateMembership, reactivateMembership } from "@/lib/membership-lifecycle";
import { shouldExposeDevelopmentEmailLinks } from "@/lib/email";
import { parseFormData } from "@/lib/validation";

const inviteSchema = z.object({
  email: z.email("Enter a valid email address.").transform((email) => email.toLowerCase()),
  role: z.enum(getEmployerRoles()),
});

function redirectToMembers(message: string, token?: string) {
  const params = new URLSearchParams({ message: message.slice(0, 180) });
  if (shouldExposeDevelopmentEmailLinks() && token) params.set("token", token);
  redirect(`/employer/users?${params}`);
}

async function requireEmployerAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.role !== "EMPLOYER_ADMIN") {
    throw new Error("An employer administrator account is required.");
  }
  return {
    email: session.user.email,
    role: session.user.role,
  };
}

export async function inviteEmployerMemberAction(formData: FormData) {
  let token: string | undefined;

  try {
    const user = await requireEmployerAdmin();
    const values = parseFormData(inviteSchema, formData);
    token = (await inviteEmployerMember({ requesterEmail: user.email, ...values })).token;
  } catch (error) {
    redirectToMembers(error instanceof Error ? error.message : "Invitation could not be created.");
  }

  revalidatePath("/employer/users");
  redirectToMembers("Invitation created.", token);
}

export async function deactivateEmployerMemberAction(formData: FormData) {
  try {
    const user = await requireEmployerAdmin();
    await deactivateMembership({
      requesterEmail: user.email,
      requesterRole: user.role,
      membershipId: String(formData.get("membershipId") ?? ""),
      reason: String(formData.get("reason") ?? "Employer administrator removed access."),
    });
  } catch (error) {
    redirectToMembers(error instanceof Error ? error.message : "Member access could not be removed.");
  }

  revalidatePath("/employer/users");
  redirectToMembers("Member access deactivated.");
}

export async function reactivateEmployerMemberAction(formData: FormData) {
  try {
    const user = await requireEmployerAdmin();
    await reactivateMembership({
      requesterEmail: user.email,
      requesterRole: user.role,
      membershipId: String(formData.get("membershipId") ?? ""),
    });
  } catch (error) {
    redirectToMembers(error instanceof Error ? error.message : "Member access could not be restored.");
  }

  revalidatePath("/employer/users");
  redirectToMembers("Member access reactivated.");
}

export async function revokeEmployerInvitationAction(formData: FormData) {
  try {
    const user = await requireEmployerAdmin();
    await revokeEmployerInvitation({
      requesterEmail: user.email,
      invitationId: String(formData.get("invitationId") ?? ""),
    });
  } catch (error) {
    redirectToMembers(error instanceof Error ? error.message : "Invitation could not be revoked.");
  }

  revalidatePath("/employer/users");
  redirectToMembers("Invitation revoked.");
}

export async function changeEmployerMemberRoleAction(formData: FormData) {
  try {
    const user = await requireEmployerAdmin();
    const role = String(formData.get("role") ?? "");
    if (!getEmployerRoles().includes(role as EmployerRole)) throw new Error("Unsupported employer role.");
    await changeEmployerMemberRole({
      requesterEmail: user.email,
      membershipId: String(formData.get("membershipId") ?? ""),
      role: role as EmployerRole,
    });
  } catch (error) {
    redirectToMembers(error instanceof Error ? error.message : "Member role could not be changed.");
  }

  revalidatePath("/employer/users");
  redirectToMembers("Member role updated.");
}
