import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { can } from "@/lib/rbac";

export default async function EmailDeliveryPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user?.role ?? "EMPLOYER_VIEWER", "workspace:manage")) {
    return <p className="mx-auto max-w-7xl px-6 py-8 text-sm">You do not have permission to view email delivery.</p>;
  }
  const attempts = await getDb().emailDeliveryAttempt.findMany({
    orderBy: { attemptedAt: "desc" },
    take: 100,
  });
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:px-8">
      <section><p className="text-sm font-semibold uppercase text-[#800020]">Settings</p><h1 className="mt-2 text-3xl font-semibold">Email delivery</h1><p className="mt-2 text-sm text-zinc-600">Recent transactional delivery attempts. Private action tokens are never stored here.</p></section>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Attempted</th></tr></thead>
          <tbody className="divide-y divide-zinc-100">{attempts.map((attempt) => <tr key={attempt.id}><td className="px-4 py-3">{attempt.recipient}</td><td className="px-4 py-3">{attempt.subject}</td><td className="px-4 py-3">{attempt.provider}</td><td className="px-4 py-3">{attempt.status}</td><td className="px-4 py-3">{attempt.attemptedAt.toLocaleString("en-NG")}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
