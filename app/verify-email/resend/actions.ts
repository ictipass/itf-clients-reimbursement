"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { sendEmployerVerificationEmail, shouldExposeDevelopmentEmailLinks } from "@/lib/email";
import { createReplacementVerificationToken } from "@/lib/employer-accounts";
import { assertRateLimit } from "@/lib/rate-limit";
import { parseFormData } from "@/lib/validation";

const schema = z.object({ email: z.email("Enter a valid email address.") });

export async function resendVerificationAction(formData: FormData) {
  const values = parseFormData(schema, formData);
  await assertRateLimit({
    key: `verification-resend:${values.email.toLowerCase()}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  const result = await createReplacementVerificationToken(values.email);
  if (result) await sendEmployerVerificationEmail({ to: result.email, name: result.name, token: result.token });

  const params = new URLSearchParams({ requested: "true" });
  if (result?.token && shouldExposeDevelopmentEmailLinks()) params.set("token", result.token);
  redirect(`/verify-email/resend?${params}`);
}
