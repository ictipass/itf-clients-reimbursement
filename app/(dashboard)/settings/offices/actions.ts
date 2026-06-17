"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  assignOfficeOfficer,
  createAreaOffice,
  getAreaOfficeOfficerRoles,
  getHeadquartersOfficerRoles,
  removeOfficeOfficer,
  updateAreaOfficeStatus,
  type OfficeOfficerRole,
  type OfficeScope,
} from "@/lib/area-office-management";

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

function readOfficeScope(formData: FormData): OfficeScope {
  const value = readRequiredString(formData, "officeScope");

  if (value !== "AREA_OFFICE" && value !== "HEADQUARTERS") {
    throw new Error("Unsupported office scope.");
  }

  return value;
}

function readOfficerRole(formData: FormData, officeScope: OfficeScope): OfficeOfficerRole {
  const value = readRequiredString(formData, "role");
  const roles: readonly string[] =
    officeScope === "AREA_OFFICE" ? getAreaOfficeOfficerRoles() : getHeadquartersOfficerRoles();

  if (!roles.includes(value)) {
    throw new Error("Unsupported office officer role.");
  }

  return value as OfficeOfficerRole;
}

function redirectToOfficeSettings(message?: string) {
  const suffix = message ? `?message=${encodeURIComponent(message.slice(0, 180))}` : "";

  redirect(`/settings/offices${suffix}`);
}

function revalidateOfficeSettings() {
  revalidatePath("/settings/offices");
  revalidatePath("/settings/users");
}

export async function assignOfficeOfficerAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    const officeScope = readOfficeScope(formData);

    await assignOfficeOfficer({
      requesterRole: session.user.role,
      officeScope,
      areaOfficeId: readOptionalString(formData, "areaOfficeId"),
      userId: readRequiredString(formData, "userId"),
      role: readOfficerRole(formData, officeScope),
    });
  } catch (error) {
    redirectToOfficeSettings(
      error instanceof Error ? error.message : "Office officer assignment failed.",
    );
  }

  revalidateOfficeSettings();
  redirectToOfficeSettings("Officer assignment saved.");
}

export async function createAreaOfficeAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await createAreaOffice({
      requesterRole: session.user.role,
      name: readRequiredString(formData, "name"),
      code: readOptionalString(formData, "code"),
      slug: readOptionalString(formData, "slug"),
    });
  } catch (error) {
    redirectToOfficeSettings(
      error instanceof Error ? error.message : "Area Office creation failed.",
    );
  }

  revalidateOfficeSettings();
  redirectToOfficeSettings("Area Office saved.");
}

export async function removeOfficeOfficerAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await removeOfficeOfficer({
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
      membershipId: readRequiredString(formData, "membershipId"),
    });
  } catch (error) {
    redirectToOfficeSettings(
      error instanceof Error ? error.message : "Office officer removal failed.",
    );
  }

  revalidateOfficeSettings();
  redirectToOfficeSettings("Officer assignment removed.");
}

export async function updateOfficeStatusAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await updateAreaOfficeStatus({
      requesterRole: session.user.role,
      areaOfficeId: readRequiredString(formData, "areaOfficeId"),
      isActive: readRequiredString(formData, "isActive") === "true",
    });
  } catch (error) {
    redirectToOfficeSettings(
      error instanceof Error ? error.message : "Office status update failed.",
    );
  }

  revalidateOfficeSettings();
  redirectToOfficeSettings("Office status updated.");
}
