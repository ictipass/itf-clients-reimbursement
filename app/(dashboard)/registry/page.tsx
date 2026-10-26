import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getRegistryCompanyAttention } from "@/lib/attention";
import { isItfRole } from "@/lib/rbac";
import { listEmployerCompanies } from "@/lib/registry";

function readValue(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || undefined;
}

function registryHref(input: { query?: string; status?: string; areaOffice?: string; attention?: boolean; page?: number }) {
  const params = new URLSearchParams();
  if (input.query) params.set("query", input.query);
  if (input.status) params.set("status", input.status);
  if (input.areaOffice) params.set("areaOffice", input.areaOffice);
  if (input.attention) params.set("attention", "1");
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/registry?${query}` : "/registry";
}

export default async function RegistryPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const queryParams = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Authentication is required.");
  const query = readValue(queryParams.query);
  const status = readValue(queryParams.status);
  const areaOffice = readValue(queryParams.areaOffice);
  const hasItfScope = isItfRole(session.user.role);
  const attentionOnly = hasItfScope && readValue(queryParams.attention) === "1";
  const attentionByCompany = hasItfScope
    ? await getRegistryCompanyAttention({ requesterEmail: session.user.email, requesterRole: session.user.role })
    : new Map<string, Array<{ title: string; href: string }>>();
  const requestedPage = Number.parseInt(readValue(queryParams.page) ?? "1", 10);
  const registry = await listEmployerCompanies({
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    query,
    status,
    areaOffice,
    attentionCompanyIds: attentionOnly ? [...attentionByCompany.keys()] : undefined,
    page: Number.isInteger(requestedPage) ? requestedPage : 1,
  });
  const { companies } = registry;
  const canCreateCompany = session.user.role === "EMPLOYER_ADMIN";

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {hasItfScope ? "Employer registry" : "Your companies"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            {hasItfScope
              ? "Review employer onboarding records available to your ITF registry role."
              : "Manage only the companies owned by your employer organization."}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
          <span className="font-semibold text-[#800020]">{registry.total}</span>{" "}
          {registry.total === 1 ? "company" : "companies"}
        </div>
      </div>

      {canCreateCompany ? <div className="mt-6">
        <Link
          href="/registry/new"
          className="inline-flex min-h-11 items-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white"
        >
          New company
        </Link>
      </div> : null}

      {hasItfScope ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href={registryHref({ query, status, areaOffice, attention: !attentionOnly })}
            className={`inline-flex min-h-10 items-center rounded-md border px-4 font-semibold ${attentionOnly ? "border-[#800020] bg-[#800020] text-white" : "border-[#800020] bg-white text-[#800020]"}`}
          >
            {attentionOnly ? "Show all employers" : "Needs attention"}
          </Link>
          <span className="text-zinc-600">{attentionByCompany.size} employer{attentionByCompany.size === 1 ? "" : "s"} with open Registry work</span>
        </div>
      ) : null}

      <form className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-4">
        {attentionOnly ? <input type="hidden" name="attention" value="1" /> : null}
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Company, RC, ITF No. or email
          <input name="query" defaultValue={query} className="min-h-10 rounded-md border border-zinc-200 px-3" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Area office
          <input name="areaOffice" defaultValue={areaOffice} className="min-h-10 rounded-md border border-zinc-200 px-3" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Status
          <select name="status" defaultValue={status ?? ""} className="min-h-10 rounded-md border border-zinc-200 px-3">
            <option value="">Any status</option>
            {["DRAFT", "PENDING_REGISTRATION", "ACTIVE", "SUSPENDED", "ARCHIVED"].map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="min-h-10 flex-1 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Apply filters</button>
          <Link href="/registry" className="inline-flex min-h-10 items-center rounded-md border border-zinc-200 px-3 text-sm font-semibold">Clear</Link>
        </div>
        <FormActionProgress />
      </form>

      {companies.length === 0 ? (
        <section className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-8">
          <h2 className="text-xl font-semibold tracking-tight">{attentionOnly ? "No employers need attention" : "No employer records yet"}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            {attentionOnly ? "No open Registry work matches these filters." : "No company is linked to your current organization or operational scope."}
          </p>
        </section>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Company</th>
                {hasItfScope ? <th className="px-4 py-3 font-semibold">Organization</th> : null}
                <th className="px-4 py-3 font-semibold">Area office</th>
                <th className="px-4 py-3 font-semibold">ITF No.</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                {hasItfScope ? <th className="px-4 py-3 font-semibold">Attention</th> : null}
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className={`border-t border-zinc-100 ${attentionByCompany.has(company.id) ? "bg-amber-50/60" : ""}`}>
                  <td className="px-4 py-4 align-top">
                    <Link
                      href={`/registry/${company.id}`}
                      className="font-semibold text-zinc-950 transition hover:text-[#800020]"
                    >
                      {company.legalName}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      RC: {company.rcNumber ?? "Not provided"}
                    </p>
                    {company.natureOfBusiness ? (
                      <p className="mt-1 text-xs text-zinc-500">{company.natureOfBusiness}</p>
                    ) : null}
                  </td>
                  {hasItfScope ? (
                    <td className="px-4 py-4 align-top text-zinc-700">
                      {company.organization.name}
                    </td>
                  ) : null}
                  <td className="px-4 py-4 align-top text-zinc-700">
                    {company.areaOffice?.name ?? "Not selected"}
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
                  {hasItfScope ? (
                    <td className="px-4 py-4 align-top">
                      {attentionByCompany.get(company.id)?.length ? (
                        <div className="grid gap-2">
                          <span className="w-fit rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                            {attentionByCompany.get(company.id)?.length} open action{attentionByCompany.get(company.id)?.length === 1 ? "" : "s"}
                          </span>
                          {attentionByCompany.get(company.id)?.slice(0, 2).map((item, index) => (
                            <Link key={`${item.href}-${index}`} href={item.href} className="text-xs font-semibold text-[#800020] underline underline-offset-2">
                              {item.title}
                            </Link>
                          ))}
                          {(attentionByCompany.get(company.id)?.length ?? 0) > 2 ? (
                            <Link href={`/registry/${company.id}`} className="text-xs font-semibold text-zinc-700 underline underline-offset-2">View all company work</Link>
                          ) : null}
                        </div>
                      ) : <span className="text-xs text-zinc-400">—</span>}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {registry.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-zinc-600">
          <p>Page {registry.page} of {registry.totalPages}</p>
          <div className="flex gap-2">
            {registry.page > 1 ? <Link className="rounded-md border border-zinc-200 bg-white px-3 py-2 font-semibold" href={registryHref({ query, status, areaOffice, attention: attentionOnly, page: registry.page - 1 })}>Previous</Link> : null}
            {registry.page < registry.totalPages ? <Link className="rounded-md border border-zinc-200 bg-white px-3 py-2 font-semibold" href={registryHref({ query, status, areaOffice, attention: attentionOnly, page: registry.page + 1 })}>Next</Link> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
