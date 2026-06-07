"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { registerEmployerAccount } from "@/lib/employer-accounts";
import { assertRateLimit } from "@/lib/rate-limit";
import { parseFormData } from "@/lib/validation";

const registrationSchema = z
  .object({
    firstName: z.string().trim().min(2, "First name is required.").max(80),
    lastName: z.string().trim().min(2, "Last name is required.").max(80),
    email: z.email("Enter a valid email address.").transform((value) => value.toLowerCase()),
    password: z.string().min(12, "Password must contain at least 12 characters.").max(128),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function registerEmployerAccountAction(formData: FormData) {
  let verificationToken: string | null = null;

  try {
    const values = parseFormData(registrationSchema, formData);
    await assertRateLimit({
      key: `employer-registration:${values.email}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    const result = await registerEmployerAccount(values);
    verificationToken = result.token;
  } catch (error) {
    redirect(`/get-started?error=${encodeURIComponent(error instanceof Error ? error.message : "Account registration failed.")}`);
  }

  const params = new URLSearchParams({ registered: "true" });
  if (process.env.NODE_ENV !== "production" && verificationToken) params.set("token", verificationToken);
  redirect(`/get-started?${params}`);
}
