"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { createDirectoryUser, updateDirectoryUser, updateDirectoryUserStatus } from "@/lib/user-directory";
import { directoryUserSchema, parseFormData } from "@/lib/validation";

function redirectToUsers(message: string) {
  redirect(`/settings/users?message=${encodeURIComponent(message.slice(0, 180))}`);
}

export async function createDirectoryUserAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    const values = parseFormData(directoryUserSchema.omit({ userId: true }), formData);
    await createDirectoryUser({
      requesterRole: session.user.role,
      ...values,
    });
  } catch (error) {
    redirectToUsers(error instanceof Error ? error.message : "User could not be saved.");
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
