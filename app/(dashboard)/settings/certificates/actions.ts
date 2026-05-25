"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { uploadCertificateTemplateDesign } from "@/lib/certificates";

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function readRequiredFile(formData: FormData, name: string) {
  const value = formData.get(name);

  if (!(value instanceof File) || value.size === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export async function uploadCertificateTemplateDesignAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await uploadCertificateTemplateDesign({
    templateId: readRequiredString(formData, "templateId"),
    uploadedByEmail: session.user.email,
    requesterRole: session.user.role,
    file: readRequiredFile(formData, "design"),
  });

  revalidatePath("/settings/certificates");
  redirect("/settings/certificates");
}
