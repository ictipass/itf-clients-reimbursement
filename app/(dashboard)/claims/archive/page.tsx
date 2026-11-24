import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { canBrowseArchivedClaims, getClaimVisibilityWhere } from "@/lib/claim-visibility";
import { getDb } from "@/lib/db";

function archiveHref(page: number, company?: string, areaOffice?: string) {
  const params = new URLSearchParams();
  if (company) params.set("company", company);
  if (areaOffice) params.set("areaOffice", areaOffice);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/claims/archive?${query}` : "/claims/archive";
}

export default async function ArchivedClaimsPage({ searchParams }: Readonly<{
  searchParams: Promise<{ company?: string; areaOffice?: string; page?: string }>;
}>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !canBrowseArchivedClaims(session.user.role)) notFound();

  const query = await searchParams;
  const companyQuery = query.company?.trim().slice(0, 100) || undefined;
  const areaOfficeQuery = query.areaOffice?.trim().slice(0, 100) || undefined;
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 50;
  const visibilityWhere = await getClaimVisibilityWhere({ email: session.user.email, role: session.user.role });
  const where = {
    recordTier: "HOT" as const,
    status: "ARCHIVED" as const,
    AND: [visibilityWhere],
    ...(companyQuery ? { OR: [
      { reference: { contains: companyQuery, mode: "insensitive" as const } },
      { archiveCompanyName: { contains: companyQuery, mode: "insensitive" as const } },
      { archiveItfEmployerNumber: { contains: companyQuery, mode: "insensitive" as const } },
    ] } : {}),
    ...(areaOfficeQuery ? { archiveAreaOfficeName: { contains: areaOfficeQuery, mode: "insensitive" as const } } : {}),
  };
  const db = getDb();
  const [total, claims] = await db.$transaction([
    db.reimbursementClaim.count({ where }),
    db.reimbursementClaim.findMany({
      where,
      select: {
        id: true, reference: true, claimYear: true, archiveAreaOfficeName: true,
        archiveCompanyName: true, archiveItfEmployerNumber: true, archiveVersion: true,
      },
      orderBy: [{ archiveAreaOfficeName: "asc" }, { archiveCompanyName: "asc" }, { archivedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const grouped = Map.groupBy(claims, (claim) => claim.archiveAreaOfficeName ?? "Historical Area Office unresolved");
  const groups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <Link href="/claims" className="text-sm font-semibold text-[#800020]">← Back to claims</Link>
      <h1 className="mt-4 text-3xl font-semibold">Archived reimbursement claims</h1>
      <p className="mt-2 text-sm text-zinc-600">Browse read-only claim packets grouped by their archived Area Office. Area Office staff see only claims from their submission-time jurisdiction. Unresolved legacy attribution requires records review.</p>
      <form className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1 text-sm">Employer, ITF number or claim reference<input name="company" defaultValue={companyQuery} className="min-h-10 rounded-md border border-zinc-200 px-3" /></label>
        <label className="grid gap-1 text-sm">Archived Area Office<input name="areaOffice" defaultValue={areaOfficeQuery} className="min-h-10 rounded-md border border-zinc-200 px-3" /></label>
        <button className="min-h-10 self-end rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Find archived claims</button>
        <FormActionProgress />
      </form>
      <p className="mt-5 text-sm text-zinc-600">{total} archived claim{total === 1 ? "" : "s"} found · Page {page} of {pageCount}</p>
      {groups.length === 0 ? <p className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 text-sm">No archived claims match your access and filters.</p> : null}
      {groups.map(([office, officeClaims]) => (
        <section key={office} className="mt-6 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold">{office}</h2>
          <div className="mt-4 grid gap-3">
            {officeClaims.map((claim) => (
              <div key={claim.id} className="grid gap-2 rounded-md border border-zinc-100 p-4 text-sm md:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-semibold text-zinc-950">{claim.archiveCompanyName ?? "Historical employer name unavailable"}</p>
                  <p className="mt-1 text-zinc-600">ITF No. {claim.archiveItfEmployerNumber ?? "Not captured"} · Claim {claim.reference} · Training year {claim.claimYear ?? "Not recorded"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/claims/${claim.id}`} className="w-fit rounded-md border border-zinc-200 px-3 py-2 font-semibold">View archived claim</Link>
                  {claim.archiveVersion === 1 || claim.archiveVersion === 2
                    ? <Link href={`/claims/${claim.id}/archive-packet`} target="_blank" rel="noopener noreferrer" className="w-fit rounded-md border border-[#800020] px-3 py-2 font-semibold text-[#800020]">Open packet PDF</Link>
                    : <span className="w-fit rounded-md border border-amber-300 bg-amber-50 px-3 py-2 font-semibold text-amber-950">Legacy packet not captured</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <nav className="mt-6 flex gap-3 text-sm font-semibold" aria-label="Archived claims pages">
        {page > 1 ? <Link href={archiveHref(page - 1, companyQuery, areaOfficeQuery)} className="rounded-md border border-zinc-200 px-4 py-2">Previous</Link> : null}
        {page < pageCount ? <Link href={archiveHref(page + 1, companyQuery, areaOfficeQuery)} className="rounded-md border border-zinc-200 px-4 py-2">Next</Link> : null}
      </nav>
    </div>
  );
}
