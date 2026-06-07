"use server";

import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  activeOrganizationCookie,
  listAvailableEmployerOrganizations,
} from "@/lib/organization-context";

export async function selectActiveOrganizationAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");

  const organizationId = String(formData.get("organizationId") ?? "");
  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const returnTo = requestedReturnTo.startsWith("/") ? requestedReturnTo : "/dashboard";
  const organizations = await listAvailableEmployerOrganizations(session.user.email);
  if (!organizations.some((organization) => organization.id === organizationId)) {
    throw new Error("You do not have active access to the selected organization.");
  }

  (await cookies()).set(activeOrganizationCookie, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  revalidatePath("/", "layout");
  redirect(returnTo);
}
