"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  createManagedNumbers,
  getManagedNumberTypes,
  type ManagedNumberType,
} from "@/lib/managed-numbers";

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function readOptionalString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function readManagedNumberType(formData: FormData): ManagedNumberType {
  const value = readRequiredString(formData, "type");
  const types = getManagedNumberTypes();

  if (!types.includes(value as ManagedNumberType)) {
    throw new Error("Unsupported managed number type.");
  }

  return value as ManagedNumberType;
}

export async function createManagedNumbersAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await createManagedNumbers({
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    workspaceId: readRequiredString(formData, "workspaceId"),
    type: readManagedNumberType(formData),
    values: readRequiredString(formData, "values").split(/\r?\n|,/),
    policyCode: readOptionalString(formData, "policyCode"),
    batchCode: readOptionalString(formData, "batchCode"),
    notes: readOptionalString(formData, "notes"),
  });

  revalidatePath("/settings/numbers");
  redirect("/settings/numbers");
}
