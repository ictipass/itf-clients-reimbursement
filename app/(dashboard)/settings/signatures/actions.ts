"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  getSignatureAssetKinds,
  uploadSignatureAsset,
  type SignatureAssetKind,
} from "@/lib/signatures";

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

function readOptionalDate(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid date.`);
  }

  return date;
}

function readSignatureAssetKind(formData: FormData): SignatureAssetKind {
  const value = readRequiredString(formData, "kind");
  const kinds = getSignatureAssetKinds();

  if (!kinds.includes(value as SignatureAssetKind)) {
    throw new Error("Unsupported signature kind.");
  }

  return value as SignatureAssetKind;
}

export async function uploadSignatureAssetAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await uploadSignatureAsset({
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    workspaceId: readRequiredString(formData, "workspaceId"),
    kind: readSignatureAssetKind(formData),
    label: readRequiredString(formData, "label"),
    effectiveFrom: readOptionalDate(formData, "effectiveFrom"),
    file: readRequiredFile(formData, "signature"),
  });

  revalidatePath("/settings/signatures");
  redirect("/settings/signatures");
}
