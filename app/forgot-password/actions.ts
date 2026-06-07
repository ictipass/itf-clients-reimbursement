"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { shouldExposeDevelopmentEmailLinks } from "@/lib/email";
import { requestPasswordReset } from "@/lib/password-recovery";
import { assertRateLimit } from "@/lib/rate-limit";
import { parseFormData } from "@/lib/validation";

const schema = z.object({ email: z.email("Enter a valid email address.") });

export async function requestPasswordResetAction(formData: FormData) {
  const values = parseFormData(schema, formData);
  await assertRateLimit({ key: `password-reset:${values.email.toLowerCase()}`, limit: 5, windowMs: 60 * 60 * 1000 });
  const result = await requestPasswordReset(values.email);
  const params = new URLSearchParams({ requested: "true" });
  if (result.token && shouldExposeDevelopmentEmailLinks()) params.set("token", result.token);
  redirect(`/forgot-password?${params}`);
}
