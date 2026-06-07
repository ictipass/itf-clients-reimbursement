"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { registerEmployerAccount } from "@/lib/employer-accounts";
import { sendEmployerVerificationEmail, shouldExposeDevelopmentEmailLinks } from "@/lib/email";
import { getOrganizationInvitation } from "@/lib/employer-members";
import { assertRateLimit } from "@/lib/rate-limit";
import { parseFormData } from "@/lib/validation";

const registrationSchema = z
  .object({
    firstName: z.string().trim().min(2, "First name is required.").max(80),
    lastName: z.string().trim().min(2, "Last name is required.").max(80),
    email: z.email("Enter a valid email address.").transform((value) => value.toLowerCase()),
    password: z.string().min(12, "Password must contain at least 12 characters.").max(128),
    confirmPassword: z.string(),
    invitationToken: z.string().optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function registerEmployerAccountAction(formData: FormData) {
  let verificationToken: string | null = null;

  try {
    const values = parseFormData(registrationSchema, formData);
    const invitation = values.invitationToken
      ? await getOrganizationInvitation(values.invitationToken)
      : null;
    if (invitation && invitation.email !== values.email) {
      throw new Error("Register with the email address that received the invitation.");
    }
    await assertRateLimit({
      key: `employer-registration:${values.email}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    const result = await registerEmployerAccount(values);
    verificationToken = result.token;
    await sendEmployerVerificationEmail({
      to: values.email,
      name: `${values.firstName} ${values.lastName}`,
      token: result.token,
      next: values.invitationToken
        ? `/invitations/accept?token=${encodeURIComponent(values.invitationToken)}`
        : undefined,
    });
  } catch (error) {
    redirect(`/get-started?error=${encodeURIComponent(error instanceof Error ? error.message : "Account registration failed.")}`);
  }

  const params = new URLSearchParams({ registered: "true" });
  if (shouldExposeDevelopmentEmailLinks() && verificationToken) params.set("token", verificationToken);
  const invitationToken = String(formData.get("invitationToken") ?? "");
  if (invitationToken) params.set("invitationToken", invitationToken);
  redirect(`/get-started?${params}`);
}
