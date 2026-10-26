import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { createCompanyAction } from "@/app/(dashboard)/registry/actions";
import { authOptions } from "@/lib/auth";
import { listAreaOffices } from "@/lib/registry";
import { getActiveRevenueWorkflowMode, usesInAppRevenueWorkflow } from "@/lib/revenue-workflow";

export default async function NewCompanyPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "EMPLOYER_ADMIN") redirect("/registry");
  const areaOffices = await listAreaOffices();
  const integrated = usesInAppRevenueWorkflow(await getActiveRevenueWorkflowMode());

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
      <div className="mb-6">
        <Link href="/registry" className="text-sm font-semibold text-[#800020]">
          Back to registry
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{integrated ? "New employer company" : "Add an existing ITF employer"}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          {integrated
            ? "Capture the Form 7A employer profile. Your first company creates your employer organization automatically; later companies remain within that organization."
            : "Enter the company's existing ITF registration number. Annual contribution and certificate eligibility will be checked against the compliance platform when training is submitted."}
        </p>
      </div>

      <form action={createCompanyAction} className="grid gap-6 rounded-lg border border-zinc-200 bg-white p-6">
        {!integrated ? (
          <label className="grid gap-2 text-sm font-medium">
            Existing ITF registration number
            <input name="itfEmployerNumber" required maxLength={80} className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
        ) : null}
        <label className="grid gap-2 text-sm font-medium">
          Area office of choice
          <select
            name="areaOfficeId"
            required
            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
          >
            <option value="">Select area office</option>
            {areaOffices.map((areaOffice) => (
              <option key={areaOffice.id} value={areaOffice.id}>
                {areaOffice.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Name of establishment
            <input
              name="legalName"
              required
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Date established
            <input
              name="establishedAt"
              type="date"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            RC number
            <input name="rcNumber" className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Tax ID
            <input name="taxId" className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Email address
            <input
              name="email"
              type="email"
              className="min-h-11 rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Telephone number
            <input name="telephone" className="min-h-11 rounded-md border border-zinc-300 px-3" />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          Nature of business
          <input name="natureOfBusiness" className="min-h-11 rounded-md border border-zinc-300 px-3" />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Business address
          <textarea
            name="businessAddress"
            rows={3}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Postal address
          <textarea
            name="postalAddress"
            rows={3}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
          <Link
            href="/registry"
            className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold"
          >
            Cancel
          </Link>
          <button className="min-h-11 rounded-md bg-[#800020] px-5 text-sm font-semibold text-white">
            Create company
          </button>
        </div>
        <FormActionProgress />
      </form>
    </div>
  );
}
