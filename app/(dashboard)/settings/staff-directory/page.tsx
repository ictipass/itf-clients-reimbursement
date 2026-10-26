import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { saveStaffDirectoryOptionAction, setStaffDirectoryOptionStatusAction } from "@/app/(dashboard)/settings/staff-directory/actions";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listStaffDirectoryOptions } from "@/lib/staff-directory-options";

export default async function StaffDirectorySettingsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !can(session.user.role, "workspace:manage")) return <p className="p-8">You do not have permission to manage staff directory options.</p>;
  const options = await listStaffDirectoryOptions(session.user.role);
  const { message } = await searchParams;
  return <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
    <Link href="/settings/users" className="text-sm font-semibold text-[#800020]">Back to users</Link>
    <h1 className="mt-3 text-3xl font-semibold">Departments and job titles</h1>
    <p className="mt-2 text-sm text-zinc-600">These are approved staff-directory values, separate from workflow permission roles. Existing values were copied into this catalogue during migration.</p>
    {message && <p className="mt-4 rounded-md bg-zinc-100 p-3 text-sm">{message}</p>}
    <a href="/settings/staff-directory/reference" className="mt-4 inline-flex rounded-md border px-3 py-2 text-sm font-semibold">Download configured lists (.xlsx)</a>
    <div className="mt-6 grid gap-6 md:grid-cols-2">{(["DEPARTMENT", "JOB_TITLE"] as const).map((kind) => <section key={kind} className="rounded-lg border bg-white p-4">
      <h2 className="text-lg font-semibold">{kind === "DEPARTMENT" ? "Departments" : "Job titles"}</h2>
      <form action={saveStaffDirectoryOptionAction} className="mt-3 flex gap-2"><input type="hidden" name="kind" value={kind} /><input name="name" required maxLength={100} placeholder={kind === "DEPARTMENT" ? "Department name" : "Job title"} className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm" /><button className="rounded-md bg-[#800020] px-3 text-sm font-semibold text-white">Add</button><FormActionProgress /></form>
      <ul className="mt-4 space-y-2">{options.filter((option) => option.kind === kind).map((option) => <li key={option.id} className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 p-2 text-sm"><span>{option.name}{!option.isActive && " (inactive)"}</span><form action={setStaffDirectoryOptionStatusAction}><input type="hidden" name="id" value={option.id} /><input type="hidden" name="isActive" value={String(!option.isActive)} /><button className="text-[#800020] underline">{option.isActive ? "Deactivate" : "Reactivate"}</button><FormActionProgress /></form></li>)}</ul>
    </section>)}</div>
  </div>;
}
