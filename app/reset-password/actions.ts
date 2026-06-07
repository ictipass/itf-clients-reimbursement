"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { resetPassword } from "@/lib/password-recovery";
import { parseFormData } from "@/lib/validation";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(12, "Password must contain at least 12 characters.").max(128),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export async function resetPasswordAction(formData: FormData) {
  try {
    const values = parseFormData(schema, formData);
    await resetPassword(values);
  } catch (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error instanceof Error ? error.message : "Password could not be reset.")}`);
  }
  redirect("/sign-in?reset=true");
}
