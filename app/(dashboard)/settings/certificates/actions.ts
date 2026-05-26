"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  activateCertificateTemplate,
  createCertificateTemplate,
  retireCertificateTemplate,
  updateCertificatePlacementMetadata,
  uploadCertificateTemplateDesign,
} from "@/lib/certificates";

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

function readOptionalString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalDate(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid date.`);
  }

  return date;
}

function readRequiredNumber(formData: FormData, name: string) {
  const value = readRequiredString(formData, name);
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }

  return parsed;
}

async function requireSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.user.role) {
    throw new Error("Authentication is required.");
  }

  return {
    email: session.user.email,
    role: session.user.role,
  };
}

export async function createCertificateTemplateAction(formData: FormData) {
  const session = await requireSession();

  await createCertificateTemplate({
    requesterRole: session.role,
    workspaceId: readRequiredString(formData, "workspaceId"),
    name: readRequiredString(formData, "name"),
    code: readRequiredString(formData, "code"),
    version: readRequiredString(formData, "version"),
    effectiveFrom: readOptionalDate(formData, "effectiveFrom"),
    notes: readOptionalString(formData, "notes"),
  });

  revalidatePath("/settings/certificates");
  redirect("/settings/certificates");
}

export async function activateCertificateTemplateAction(formData: FormData) {
  const session = await requireSession();

  await activateCertificateTemplate({
    requesterRole: session.role,
    templateId: readRequiredString(formData, "templateId"),
  });

  revalidatePath("/settings/certificates");
  redirect("/settings/certificates");
}

export async function retireCertificateTemplateAction(formData: FormData) {
  const session = await requireSession();

  await retireCertificateTemplate({
    requesterRole: session.role,
    templateId: readRequiredString(formData, "templateId"),
  });

  revalidatePath("/settings/certificates");
  redirect("/settings/certificates");
}

export async function uploadCertificateTemplateDesignAction(formData: FormData) {
  const session = await requireSession();

  await uploadCertificateTemplateDesign({
    templateId: readRequiredString(formData, "templateId"),
    uploadedByEmail: session.email,
    requesterRole: session.role,
    file: readRequiredFile(formData, "design"),
  });

  revalidatePath("/settings/certificates");
  redirect("/settings/certificates");
}

export async function updateCertificatePlacementMetadataAction(formData: FormData) {
  const session = await requireSession();

  await updateCertificatePlacementMetadata({
    requesterRole: session.role,
    templateId: readRequiredString(formData, "templateId"),
    placementMetadata: {
      companyName: {
        x: readRequiredNumber(formData, "companyNameX"),
        y: readRequiredNumber(formData, "companyNameY"),
        fontSize: readRequiredNumber(formData, "companyNameFontSize"),
      },
      itfEmployerNumber: {
        x: readRequiredNumber(formData, "itfEmployerNumberX"),
        y: readRequiredNumber(formData, "itfEmployerNumberY"),
        fontSize: readRequiredNumber(formData, "itfEmployerNumberFontSize"),
      },
      certificateNumber: {
        x: readRequiredNumber(formData, "certificateNumberX"),
        y: readRequiredNumber(formData, "certificateNumberY"),
        fontSize: readRequiredNumber(formData, "certificateNumberFontSize"),
      },
      issuedAt: {
        x: readRequiredNumber(formData, "issuedAtX"),
        y: readRequiredNumber(formData, "issuedAtY"),
        fontSize: readRequiredNumber(formData, "issuedAtFontSize"),
      },
      directorGeneralSignature: {
        x: readRequiredNumber(formData, "directorGeneralSignatureX"),
        y: readRequiredNumber(formData, "directorGeneralSignatureY"),
        width: readRequiredNumber(formData, "directorGeneralSignatureWidth"),
        height: readRequiredNumber(formData, "directorGeneralSignatureHeight"),
      },
      directorRevenueSignature: {
        x: readRequiredNumber(formData, "directorRevenueSignatureX"),
        y: readRequiredNumber(formData, "directorRevenueSignatureY"),
        width: readRequiredNumber(formData, "directorRevenueSignatureWidth"),
        height: readRequiredNumber(formData, "directorRevenueSignatureHeight"),
      },
      qrCode: {
        x: readRequiredNumber(formData, "qrCodeX"),
        y: readRequiredNumber(formData, "qrCodeY"),
        width: readRequiredNumber(formData, "qrCodeWidth"),
        height: readRequiredNumber(formData, "qrCodeHeight"),
      },
    },
  });

  revalidatePath("/settings/certificates");
  redirect("/settings/certificates");
}
