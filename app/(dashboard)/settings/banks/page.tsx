import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { saveBankDirectoryEntryAction, setBankDirectoryEntryStatusAction } from "@/app/(dashboard)/settings/banks/actions";
import { authOptions } from "@/lib/auth";
import { listBankDirectoryWorkspaces } from "@/lib/bank-directory";
import { can } from "@/lib/rbac";

export default async function BankSettingsPage({ searchParams }: Readonly<{ searchParams: Promise<{ message?: string }> }>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !can(session.user.role, "workspace:manage")) notFound();
  const workspaces = await listBankDirectoryWorkspaces(session.user.role);
  const { message } = await searchParams;

  return <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
    <Link href="/settings" className="text-sm font-semibold text-[#800020]">Back to settings</Link>
    <h1 className="mt-3 text-3xl font-semibold">Accepted banks</h1>
    <p className="mt-2 text-sm text-zinc-600">Employers select an active bank. Its sort code is filled from this catalogue and cannot be entered manually. Verify each code before adding it.</p>
    {message ? <p className="mt-4 rounded-md bg-zinc-100 p-3 text-sm">{message}</p> : null}
    {workspaces.map((workspace) => <section key={workspace.id} className="mt-6 rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold">{workspace.name}</h2>
      <form action={saveBankDirectoryEntryAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="workspaceId" value={workspace.id} />
        <label className="grid gap-1 text-sm font-medium">Bank name<input name="name" required maxLength={100} className="min-h-10 rounded-md border px-3" /></label>
        <label className="grid gap-1 text-sm font-medium">Sort code<input name="sortCode" required inputMode="numeric" pattern="[0-9]{3,12}" className="min-h-10 rounded-md border px-3" /></label>
        <button className="min-h-10 self-end rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Add or update</button>
      </form>
      <div className="mt-5 grid gap-2">
        {workspace.bankDirectoryEntries.length === 0 ? <p className="text-sm text-zinc-500">No banks configured yet.</p> : null}
        {workspace.bankDirectoryEntries.map((bank) => <div key={bank.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-zinc-50 p-3 text-sm">
          <span><strong>{bank.name}</strong> · Sort code {bank.sortCode}{!bank.isActive ? " · Inactive" : ""}</span>
          <form action={setBankDirectoryEntryStatusAction}>
            <input type="hidden" name="id" value={bank.id} />
            <input type="hidden" name="isActive" value={String(!bank.isActive)} />
            <button className="font-semibold text-[#800020] underline">{bank.isActive ? "Deactivate" : "Reactivate"}</button>
          </form>
        </div>)}
      </div>
    </section>)}
  </div>;
}
