"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { saveBankDirectoryEntry, setBankDirectoryEntryStatus } from "@/lib/bank-directory";

function finish(message: string) {
  revalidatePath("/settings/banks");
  redirect(`/settings/banks?message=${encodeURIComponent(message.slice(0, 200))}`);
}

export async function saveBankDirectoryEntryAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  try {
    await saveBankDirectoryEntry({
      requesterRole: session.user.role,
      workspaceId: String(formData.get("workspaceId") ?? ""),
      name: String(formData.get("name") ?? ""),
      sortCode: String(formData.get("sortCode") ?? ""),
    });
  } catch (error) {
    finish(error instanceof Error ? error.message : "Bank could not be saved.");
  }
  finish("Bank saved. Existing claims retain their recorded bank details; new selections use this sort code.");
}

export async function setBankDirectoryEntryStatusAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  try {
    await setBankDirectoryEntryStatus({
      requesterRole: session.user.role,
      id: String(formData.get("id") ?? ""),
      isActive: formData.get("isActive") === "true",
    });
  } catch (error) {
    finish(error instanceof Error ? error.message : "Bank status could not be updated.");
  }
  finish("Bank status updated.");
}
