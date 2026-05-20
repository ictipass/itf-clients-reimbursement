import Link from "next/link";

import { createCompanyAction } from "@/app/(dashboard)/registry/actions";
import { listAreaOffices, listEmployerOrganizations } from "@/lib/registry";

export default async function NewCompanyPage() {
  const [organizations, areaOffices] = await Promise.all([
    listEmployerOrganizations(),
    listAreaOffices(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
      <div className="mb-6">
        <Link href="/registry" className="text-sm font-semibold text-[#800020]">
          Back to registry
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">New employer company</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Capture the first Form 7A employer profile fields. Evidence uploads and review
          decisions will come in later slices.
        </p>
      </div>

      <form action={createCompanyAction} className="grid gap-6 rounded-lg border border-zinc-200 bg-white p-6">
        <label className="grid gap-2 text-sm font-medium">
          Employer organization
          <select
            name="organizationId"
            required
            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
          >
            <option value="">Select organization</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>

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
      </form>
    </div>
  );
}
