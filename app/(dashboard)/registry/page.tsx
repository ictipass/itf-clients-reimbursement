import Link from "next/link";

import { listEmployerCompanies } from "@/lib/registry";

export default async function RegistryPage() {
  const companies = await listEmployerCompanies();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Employer registry</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Company onboarding records are loaded from PostgreSQL and filtered to active
            operational records by default.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
          <span className="font-semibold text-[#800020]">{companies.length}</span>{" "}
          {companies.length === 1 ? "company" : "companies"}
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/registry/new"
          className="inline-flex min-h-11 items-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white"
        >
          New company
        </Link>
      </div>

      {companies.length === 0 ? (
        <section className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-8">
          <h2 className="text-xl font-semibold tracking-tight">No employer records yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            The foundation database has workspace and admin seed data, but no employer
            company records. The next registry slice can add the create-company workflow.
          </p>
        </section>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">ITF No.</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-t border-zinc-100">
                  <td className="px-4 py-4 align-top">
                    <p className="font-semibold text-zinc-950">{company.legalName}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      RC: {company.rcNumber ?? "Not provided"}
                    </p>
                    {company.natureOfBusiness ? (
                      <p className="mt-1 text-xs text-zinc-500">{company.natureOfBusiness}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top text-zinc-700">
                    {company.organization.name}
                  </td>
                  <td className="px-4 py-4 align-top text-zinc-700">
                    {company.itfEmployerNumber ?? "Pending"}
                  </td>
                  <td className="px-4 py-4 align-top text-zinc-700">
                    <p>{company.email ?? "No email"}</p>
                    <p className="mt-1 text-xs text-zinc-500">{company.telephone ?? "No phone"}</p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className="rounded-full bg-[#800020]/10 px-3 py-1 text-xs font-semibold text-[#65001a]">
                      {company.status.replaceAll("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
