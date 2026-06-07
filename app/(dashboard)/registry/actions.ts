"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { createCompany } from "@/lib/registry";

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

function readOptionalDate(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

export async function createCompanyAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");

  await createCompany({
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    areaOfficeId: readRequiredString(formData, "areaOfficeId"),
    legalName: readRequiredString(formData, "legalName"),
    rcNumber: readOptionalString(formData, "rcNumber"),
    taxId: readOptionalString(formData, "taxId"),
    businessAddress: readOptionalString(formData, "businessAddress"),
    postalAddress: readOptionalString(formData, "postalAddress"),
    email: readOptionalString(formData, "email"),
    telephone: readOptionalString(formData, "telephone"),
    natureOfBusiness: readOptionalString(formData, "natureOfBusiness"),
    establishedAt: readOptionalDate(formData, "establishedAt"),
  });

  revalidatePath("/registry");
  redirect("/registry");
}
