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
    company: {
      ...(companyQuery ? { OR: [
        { legalName: { contains: companyQuery, mode: "insensitive" as const } },
        { itfEmployerNumber: { contains: companyQuery, mode: "insensitive" as const } },
      ] } : {}),
      ...(areaOfficeQuery ? { areaOffice: { name: { contains: areaOfficeQuery, mode: "insensitive" as const } } } : {}),
    },
  };
  const db = getDb();
  const [total, claims] = await db.$transaction([
    db.reimbursementClaim.count({ where }),
    db.reimbursementClaim.findMany({
      where,
      select: {
        id: true, reference: true, claimYear: true,
        company: { select: { id: true, legalName: true, itfEmployerNumber: true, areaOffice: { select: { name: true } } } },
      },
      orderBy: [{ company: { legalName: "asc" } }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const grouped = Map.groupBy(claims, (claim) => claim.company.areaOffice?.name ?? "No Area Office assigned");
  const groups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      <Link href="/claims" className="text-sm font-semibold text-[#800020]">← Back to claims</Link>
      <h1 className="mt-4 text-3xl font-semibold">Archived reimbursement claims</h1>
      <p className="mt-2 text-sm text-zinc-600">Browse read-only employer profiles and claim packets grouped by Area Office. Area Office staff see only their jurisdiction.</p>
      <form className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1 text-sm">Employer or ITF number<input name="company" defaultValue={companyQuery} className="min-h-10 rounded-md border border-zinc-200 px-3" /></label>
        <label className="grid gap-1 text-sm">Area Office<input name="areaOffice" defaultValue={areaOfficeQuery} className="min-h-10 rounded-md border border-zinc-200 px-3" /></label>
        <button className="min-h-10 self-end rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Find archived claims</button>
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
                  <Link href={`/registry/${claim.company.id}`} className="font-semibold text-[#800020] hover:underline">{claim.company.legalName}</Link>
                  <p className="mt-1 text-zinc-600">ITF No. {claim.company.itfEmployerNumber ?? "Not recorded"} · Claim {claim.reference} · Training year {claim.claimYear ?? "Not recorded"}</p>
                </div>
                <Link href={`/claims/${claim.id}`} className="w-fit self-center rounded-md border border-zinc-200 px-3 py-2 font-semibold">View archived claim</Link>
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
