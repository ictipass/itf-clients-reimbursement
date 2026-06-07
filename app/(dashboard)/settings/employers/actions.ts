"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { replaceEmployerAdministrators } from "@/lib/employer-access-management";
import { parseFormData } from "@/lib/validation";

const replacementSchema = z.object({
  organizationId: z.string().min(1),
  replacementEmail: z.email("Enter a valid replacement email address."),
  reason: z.string().trim().min(10, "Provide a clear reason of at least 10 characters."),
});

function redirectToEmployers(message: string) {
  redirect(`/settings/employers?message=${encodeURIComponent(message.slice(0, 180))}`);
}

export async function replaceEmployerAdministratorsAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");

  try {
    const values = parseFormData(replacementSchema, formData);
    await replaceEmployerAdministrators({
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      ...values,
    });
  } catch (error) {
    redirectToEmployers(error instanceof Error ? error.message : "Employer access could not be updated.");
  }

  revalidatePath("/settings/employers");
  revalidatePath("/employer/users");
  redirectToEmployers("Employer administrator access replaced.");
}
