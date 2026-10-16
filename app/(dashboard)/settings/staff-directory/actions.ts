"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { saveStaffDirectoryOption, setStaffDirectoryOptionStatus, type StaffOptionKind } from "@/lib/staff-directory-options";

function done(message: string) {
  revalidatePath("/settings/staff-directory");
  revalidatePath("/settings/users");
  redirect(`/settings/staff-directory?message=${encodeURIComponent(message.slice(0, 180))}`);
}

export async function saveStaffDirectoryOptionAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  try {
    await saveStaffDirectoryOption({ requesterRole: session.user.role, kind: String(formData.get("kind")) as StaffOptionKind, name: String(formData.get("name") ?? "") });
  } catch (error) { done(error instanceof Error ? error.message : "Option could not be saved."); }
  done("Directory option saved.");
}

export async function setStaffDirectoryOptionStatusAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  try {
    await setStaffDirectoryOptionStatus({ requesterRole: session.user.role, id: String(formData.get("id") ?? ""), isActive: formData.get("isActive") === "true" });
  } catch (error) { done(error instanceof Error ? error.message : "Option could not be updated."); }
  done("Directory option updated.");
}
