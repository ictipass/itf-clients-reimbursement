"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertEmailDeliveryReady, getAppBaseUrl, sendOfficerWelcomeEmail } from "@/lib/email";
import { writeDevelopmentOfficerCredentials } from "@/lib/officer-provisioning";
import { createDirectoryUser, resetDirectoryUserLocalAccess, updateDirectoryUser, updateDirectoryUserManagementStatus, updateDirectoryUserStatus } from "@/lib/user-directory";
import { directoryUserSchema, parseFormData } from "@/lib/validation";

function redirectToUsers(message: string): never {
  redirect(`/settings/users?message=${encodeURIComponent(message.slice(0, 180))}`);
}

export async function createDirectoryUserAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  let user: Awaited<ReturnType<typeof createDirectoryUser>>;
  try {
    assertEmailDeliveryReady();
    const values = parseFormData(directoryUserSchema.omit({ userId: true }), formData);
    const office = String(formData.get("office") ?? "").trim();
    user = await createDirectoryUser({
      requesterRole: session.user.role,
      ...values,
      officeScope: !office ? "" : office === "HEADQUARTERS" ? "HEADQUARTERS" : "AREA_OFFICE",
      areaOfficeId: office === "HEADQUARTERS" ? undefined : office,
      role: String(formData.get("role") ?? "").trim(),
    });
  } catch (error) {
    redirectToUsers(error instanceof Error ? error.message : "User could not be saved.");
  }

  try {
    await writeDevelopmentOfficerCredentials({
      email: user.email,
      temporaryPassword: user.temporaryPassword,
      signInUrl: `${getAppBaseUrl()}/sign-in`,
    });
    const delivery = await sendOfficerWelcomeEmail({
      to: user.email,
      name: user.name,
      temporaryPassword: user.temporaryPassword,
    });
    if (delivery.delivered) {
      await getDb().user.update({
        where: { id: user.id },
        data: { welcomeEmailSentAt: new Date() },
      });
    }
  } catch (error) {
    revalidatePath("/settings/users");
    redirectToUsers(`User and office assignment saved, but welcome delivery failed. Reset local access to resend credentials. ${error instanceof Error ? error.message : ""}`);
  }

  revalidatePath("/settings/users");
  redirectToUsers("User saved.");
}

export async function updateDirectoryUserAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    const values = parseFormData(directoryUserSchema.required({ userId: true }), formData);
    await updateDirectoryUser({
      requesterRole: session.user.role,
      ...values,
    });
  } catch (error) {
    redirectToUsers(error instanceof Error ? error.message : "User could not be updated.");
  }

  revalidatePath("/settings/users");
  revalidatePath("/settings/offices");
  redirectToUsers("User updated.");
}

export async function updateDirectoryUserStatusAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  try {
    await updateDirectoryUserStatus({
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      userId: String(formData.get("userId") ?? ""),
      isActive: String(formData.get("isActive")) === "true",
    });
  } catch (error) {
    redirectToUsers(error instanceof Error ? error.message : "User status could not be updated.");
  }
  revalidatePath("/settings/users");
  redirectToUsers("User status updated.");
}

export async function resetDirectoryUserLocalAccessAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  try {
    const user = await resetDirectoryUserLocalAccess({
      requesterRole: session.user.role,
      userId: String(formData.get("userId") ?? ""),
    });
    await writeDevelopmentOfficerCredentials({
      email: user.email,
      temporaryPassword: user.temporaryPassword,
      signInUrl: `${getAppBaseUrl()}/sign-in`,
    });
    const delivery = await sendOfficerWelcomeEmail({
      to: user.email,
      name: user.name,
      temporaryPassword: user.temporaryPassword,
    });
    if (delivery.delivered) {
      await getDb().user.update({
        where: { id: user.id },
        data: { welcomeEmailSentAt: new Date() },
      });
    }
  } catch (error) {
    redirectToUsers(error instanceof Error ? error.message : "Local access could not be reset.");
  }
  revalidatePath("/settings/users");
  redirectToUsers("Local access reset and welcome credentials sent.");
}

export async function updateDirectoryUserManagementStatusAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  try {
    await updateDirectoryUserManagementStatus({
      requesterRole: session.user.role,
      userId: String(formData.get("userId") ?? ""),
      isManagement: String(formData.get("isManagement")) === "true",
    });
  } catch (error) {
    redirectToUsers(error instanceof Error ? error.message : "Management status could not be updated.");
  }
  revalidatePath("/settings/users");
  revalidatePath("/management");
  redirectToUsers("Management status updated.");
}
