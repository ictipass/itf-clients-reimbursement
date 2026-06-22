import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resetCalendarFeedAction, updateCalendarPreferenceAction } from "@/app/(dashboard)/settings/preferences/actions";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export default async function PreferencesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/sign-in");
  const [user, headerList] = await Promise.all([
    getDb().user.findUnique({
      where: { email: session.user.email },
      select: { calendarFeedEnabled: true, calendarFeedToken: true, workflowEmailNotifications: true },
    }),
    headers(),
  ]);
  if (!user) redirect("/sign-in");
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const feedUrl = user.calendarFeedToken ? `${protocol}://${host}/api/calendar/${user.calendarFeedToken}` : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">Settings</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Personal preferences</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600">Configure notifications and connect your private ITF schedule to Google Calendar, Apple Calendar, Outlook, or another calendar app.</p>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Calendar subscription</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Your feed includes training approvals and monitoring entries within your organization or office scope. Treat its URL like a password.</p>
        <form action={updateCalendarPreferenceAction} className="mt-5 grid gap-4">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input name="calendarFeedEnabled" type="checkbox" defaultChecked={user.calendarFeedEnabled} />
            Enable my private calendar feed
          </label>
          <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Save preference</button>
        </form>
        {user.calendarFeedEnabled && feedUrl ? (
          <div className="mt-5 rounded-md bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Subscription URL</p>
            <code className="mt-2 block break-all text-sm text-zinc-800">{feedUrl}</code>
            <p className="mt-3 text-xs leading-5 text-zinc-500">In Google Calendar, use “Other calendars” → “From URL”. Most mobile calendar apps offer “Add subscribed calendar”.</p>
            <form action={resetCalendarFeedAction}>
              <button className="mt-3 min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold">Reset private link</button>
            </form>
          </div>
        ) : null}
      </section>
    </div>
  );
}
