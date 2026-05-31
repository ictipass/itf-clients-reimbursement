"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { createDirectoryUser } from "@/lib/user-directory";

function readOptionalString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readRequiredString(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function redirectToUsers(message: string) {
  redirect(`/settings/users?message=${encodeURIComponent(message.slice(0, 180))}`);
}

export async function createDirectoryUserAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await createDirectoryUser({
      requesterRole: session.user.role,
      name: readRequiredString(formData, "name"),
      staffNumber: readOptionalString(formData, "staffNumber"),
      email: readRequiredString(formData, "email"),
      phoneNumber: readOptionalString(formData, "phoneNumber"),
      department: readOptionalString(formData, "department"),
      jobTitle: readOptionalString(formData, "jobTitle"),
    });
  } catch (error) {
    redirectToUsers(error instanceof Error ? error.message : "User could not be saved.");
  }

  revalidatePath("/settings/users");
  redirectToUsers("User saved.");
}
