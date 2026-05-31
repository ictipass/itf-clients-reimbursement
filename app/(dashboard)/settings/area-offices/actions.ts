"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  assignAreaOfficeOfficer,
  getAreaOfficeOfficerRoles,
  removeAreaOfficeOfficer,
  updateAreaOfficeStatus,
  type AreaOfficeOfficerRole,
} from "@/lib/area-office-management";

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function readOfficerRole(formData: FormData): AreaOfficeOfficerRole {
  const value = readRequiredString(formData, "role");
  const roles = getAreaOfficeOfficerRoles();

  if (!roles.includes(value as AreaOfficeOfficerRole)) {
    throw new Error("Unsupported Area Office officer role.");
  }

  return value as AreaOfficeOfficerRole;
}

function redirectToAreaOfficeSettings(message?: string) {
  const suffix = message ? `?message=${encodeURIComponent(message.slice(0, 180))}` : "";

  redirect(`/settings/area-offices${suffix}`);
}

export async function assignAreaOfficeOfficerAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await assignAreaOfficeOfficer({
      requesterRole: session.user.role,
      areaOfficeId: readRequiredString(formData, "areaOfficeId"),
      userId: readRequiredString(formData, "userId"),
      role: readOfficerRole(formData),
    });
  } catch (error) {
    redirectToAreaOfficeSettings(
      error instanceof Error ? error.message : "Area Office officer assignment failed.",
    );
  }

  revalidatePath("/settings/area-offices");
  redirectToAreaOfficeSettings("Officer assignment saved.");
}

export async function removeAreaOfficeOfficerAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  try {
    await removeAreaOfficeOfficer({
      requesterRole: session.user.role,
      membershipId: readRequiredString(formData, "membershipId"),
    });
  } catch (error) {
    redirectToAreaOfficeSettings(
      error instanceof Error ? error.message : "Area Office officer removal failed.",
    );
  }

  revalidatePath("/settings/area-offices");
  redirectToAreaOfficeSettings("Officer assignment removed.");
}

export async function updateAreaOfficeStatusAction(formData: FormData) {
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
    redirectToAreaOfficeSettings(
      error instanceof Error ? error.message : "Area Office status update failed.",
    );
  }

  revalidatePath("/settings/area-offices");
  redirectToAreaOfficeSettings("Area Office status updated.");
}
