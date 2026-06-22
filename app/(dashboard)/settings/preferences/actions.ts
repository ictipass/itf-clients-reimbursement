"use server";

import { randomUUID } from "node:crypto";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function updateCalendarPreferenceAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  const enabled = formData.get("calendarFeedEnabled") === "on";

  const user = await getDb().user.findUnique({
    where: { email: session.user.email },
    select: { calendarFeedToken: true },
  });
  if (!user) throw new Error("User account was not found.");

  await getDb().user.update({
    where: { email: session.user.email },
    data: {
      calendarFeedEnabled: enabled,
      calendarFeedToken: enabled ? user.calendarFeedToken ?? randomUUID() : user.calendarFeedToken,
    },
  });
  revalidatePath("/settings/preferences");
  redirect("/settings/preferences");
}

export async function resetCalendarFeedAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  await getDb().user.update({
    where: { email: session.user.email },
    data: { calendarFeedToken: randomUUID(), calendarFeedEnabled: true },
  });
  revalidatePath("/settings/preferences");
  redirect("/settings/preferences");
}
