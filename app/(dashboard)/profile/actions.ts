"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { changeUserPassword, updateUserProfile } from "@/lib/profile";
import { parseFormData } from "@/lib/validation";

function back(message: string) {
  redirect(`/profile?message=${encodeURIComponent(message.slice(0, 180))}`);
}

export async function updateProfileAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  try {
    const values = parseFormData(z.object({ name: z.string().trim().min(2), phoneNumber: z.string().optional() }), formData);
    await updateUserProfile({ email: session.user.email, ...values, workflowEmailNotifications: formData.get("workflowEmailNotifications") === "on" });
  } catch (error) {
    back(error instanceof Error ? error.message : "Profile could not be updated.");
  }
  revalidatePath("/profile");
  back("Profile updated.");
}

export async function changePasswordAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  try {
    const values = parseFormData(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(12).max(128),
      confirmPassword: z.string(),
    }).refine((value) => value.newPassword === value.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] }), formData);
    await changeUserPassword({ email: session.user.email, role: session.user.role, ...values });
  } catch (error) {
    back(error instanceof Error ? error.message : "Password could not be changed.");
  }
  redirect("/password-change-complete");
}
