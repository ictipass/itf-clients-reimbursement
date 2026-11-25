import { Prisma } from "@/lib/generated/prisma/client";

import { getDb } from "@/lib/db";
import { canViewFsdAnalytics, type Role } from "@/lib/rbac";

/** Deliberately narrower than management-dashboard access: these are the FSD analytics owners. */
const claimStatuses = ["DRAFT", "SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED", "SETTLED", "ARCHIVED"] as const;
const policyEditions = ["EIGHTH_REVISED"] as const;

export class ClaimAnalyticsAccessError extends Error {}

export function canViewClaimAnalytics(role: Role) {
  return canViewFsdAnalytics(role);
}

export type ClaimAnalyticsFilters = {
  companyIds?: string[];
  areaOfficeIds?: string[];
  trainingYears?: number[];
  submissionYears?: number[];
  paymentYears?: number[];
  statuses?: string[];
  policyEditions?: string[];
  yearBasis?: "TRAINING" | "SUBMISSION" | "PAYMENT";
};

export type ClaimAnalyticsRequest = {
  requesterEmail: string;
  requesterRole: Role;
  filters?: ClaimAnalyticsFilters;
};

type NormalizedFilters = Required<Pick<ClaimAnalyticsFilters, "yearBasis">> & Omit<ClaimAnalyticsFilters, "yearBasis">;

export function normalizeClaimAnalyticsFilters(filters: ClaimAnalyticsFilters = {}): NormalizedFilters {
  const identifiers = (values: string[] | undefined, label: string) => {
    if (values === undefined) return undefined;
    if (!Array.isArray(values) || values.length > 50 || values.some((value) => typeof value !== "string" || !value.trim() || value.length > 128)) {
      throw new Error(`Select valid ${label} (up to 50).`);
    }
    return [...new Set(values)];
  };
  const years = (values: number[] | undefined, label: string) => {
    if (values === undefined) return undefined;
    if (!Array.isArray(values) || values.length > 50 || values.some((year) => !Number.isInteger(year) || year < 2000 || year > 2100)) {
      throw new Error(`Select valid ${label} (up to 50 years).`);
    }
    return [...new Set(values)];
  };
  const statuses = identifiers(filters.statuses, "claim statuses");
  if (statuses?.some((status) => !claimStatuses.includes(status as typeof claimStatuses[number]))) {
    throw new Error("Select a valid claim status.");
  }
  const editions = identifiers(filters.policyEditions, "policy editions");
  if (editions?.some((edition) => !policyEditions.includes(edition as typeof policyEditions[number]))) {
    throw new Error("Select a supported policy edition.");
  }
  if (filters.yearBasis && !["TRAINING", "SUBMISSION", "PAYMENT"].includes(filters.yearBasis)) {
    throw new Error("Select a valid analytics year basis.");
  }
  return {
    companyIds: identifiers(filters.companyIds, "companies"),
    areaOfficeIds: identifiers(filters.areaOfficeIds, "Area Offices"),
    trainingYears: years(filters.trainingYears, "training years"),
    submissionYears: years(filters.submissionYears, "submission years"),
    paymentYears: years(filters.paymentYears, "payment years"),
    statuses, policyEditions: editions, yearBasis: filters.yearBasis ?? "TRAINING",
  };
}

export function analyticsWorkspaceIds(role: Role, isActive: boolean, memberships: { role: Role; workspaceId: string; isActive: boolean }[]) {
  if (!isActive || !canViewFsdAnalytics(role)) throw new ClaimAnalyticsAccessError("You do not have permission to view FSD claim analytics.");
  const ids = [...new Set(memberships.filter((membership) => membership.isActive && membership.role === role)
    .map((membership) => membership.workspaceId))];
  if (!ids.length) throw new ClaimAnalyticsAccessError("An active FSD role assignment is required for claim analytics.");
  return ids;
}

async function scopeFor(input: ClaimAnalyticsRequest) {
  const user = await getDb().user.findUnique({
    where: { email: input.requesterEmail },
    select: { id: true, isActive: true, memberships: { select: { role: true, workspaceId: true, isActive: true } } },
  });
  return { workspaceIds: analyticsWorkspaceIds(input.requesterRole, user?.isActive ?? false, user?.memberships ?? []),
    userId: user!.id, role: input.requesterRole };
}

function inFilter(column: Prisma.Sql, values: (string | number)[] | undefined) {
  if (values === undefined) return Prisma.empty;
  if (values.length === 0) return Prisma.sql`AND FALSE`;
  return Prisma.sql`AND ${column} IN (${Prisma.join(values)})`;
}

function sourceSql(scope: { workspaceIds: string[]; userId: string; role: Role }, filters: NormalizedFilters) {
  const officeId = Prisma.sql`CASE WHEN rc."status" = 'ARCHIVED' THEN rc."archiveAreaOfficeId"
    ELSE COALESCE(rc."claimAreaOfficeId", c."areaOfficeId") END`;
  const trainingYear = Prisma.sql`rc."claimYear"`;
  // Prisma's timestamp(3) fields store UTC clock values without a PostgreSQL timezone.
  // AT TIME ZONE would reinterpret them in the database session timezone at year boundaries.
  const submissionYear = Prisma.sql`EXTRACT(YEAR FROM rc."submittedAt")::int`;
  const paymentYear = Prisma.sql`EXTRACT(YEAR FROM rc."paidAt")::int`;
  const yearBasis = filters.yearBasis === "PAYMENT" ? paymentYear : filters.yearBasis === "SUBMISSION" ? submissionYear : trainingYear;
  const namedOfficerScope = scope.role === "HQ_REIMBURSEMENT_OFFICER"
    ? Prisma.sql`wi."assignedUserId" = ${scope.userId}`
    : Prisma.sql`(wi."assignedUserId" IS NULL OR wi."assignedUserId" = ${scope.userId})`;
  const routedScope = scope.role === "DIRECTOR_FSD" ? Prisma.empty : Prisma.sql`
    AND (rc."status" = 'ARCHIVED' OR EXISTS (
      SELECT 1 FROM "WorkItem" wi WHERE wi."reimbursementClaimId" = rc."id"
        AND wi."app" = 'REIMBURSEMENT' AND wi."recordTier" = 'HOT'
        AND wi."assignedRole"::text = ${scope.role}
        AND ${namedOfficerScope}
    ))`;
  return Prisma.sql`
    WITH scoped AS (
      SELECT rc."id", rc."reference", rc."companyId", rc."claimYear", rc."submittedAt", rc."paidAt", rc."archivedAt",
        rc."status"::text AS "status", rc."policyEdition"::text AS "policyEdition",
        rc."claimedAmount", rc."claimRecommendedAmount", rc."paymentWithholdingTax", rc."paymentTaxOffset",
        CASE WHEN rc."status" = 'ARCHIVED' THEN COALESCE(rc."archiveCompanyName", c."legalName") ELSE c."legalName" END AS "companyName",
        c."legalName" AS "currentCompanyName",
        ${officeId} AS "areaOfficeId",
        CASE WHEN rc."status" = 'ARCHIVED' THEN COALESCE(rc."archiveAreaOfficeName", ao."name", 'Historical office unresolved')
          ELSE COALESCE(ao."name", 'Unassigned') END AS "areaOfficeName",
        ${yearBasis} AS "groupYear",
        (rc."paymentHandoffStatus" = 'PAID' AND rc."paidAt" IS NOT NULL) AS "isPaid",
        (rc."claimRecommendedAmount" IS NOT NULL AND rc."paymentWithholdingTax" IS NOT NULL
          AND rc."paymentTaxOffset" IS NOT NULL AND rc."claimRecommendedAmount" > 0
          AND rc."paymentWithholdingTax" >= 0 AND rc."paymentTaxOffset" >= 0
          AND rc."claimRecommendedAmount" > rc."paymentWithholdingTax" + rc."paymentTaxOffset") AS "completeBreakdown",
        EXISTS (SELECT 1 FROM "ReimbursementVoucherSignoff" s WHERE s."reimbursementClaimId" = rc."id"
          AND s."kind" = 'PAYMENT_APPROVED') AS "paymentApproved"
      FROM "ReimbursementClaim" rc
      JOIN "Company" c ON c."id" = rc."companyId"
      JOIN "Organization" org ON org."id" = c."organizationId"
      LEFT JOIN "AreaOffice" ao ON ao."id" = ${officeId}
      WHERE rc."recordTier" = 'HOT' AND rc."status" <> 'DRAFT'
        AND org."workspaceId" IN (${Prisma.join(scope.workspaceIds)}) ${routedScope}
        ${inFilter(Prisma.sql`rc."companyId"`, filters.companyIds)}
        ${inFilter(officeId, filters.areaOfficeIds)}
        ${inFilter(trainingYear, filters.trainingYears)}
        ${inFilter(submissionYear, filters.submissionYears)}
        ${inFilter(paymentYear, filters.paymentYears)}
        ${inFilter(Prisma.sql`rc."status"::text`, filters.statuses)}
        ${inFilter(Prisma.sql`rc."policyEdition"::text`, filters.policyEditions)}
    )`;
}

const factsSql = Prisma.sql`
  COUNT(*)::int AS "claimCount",
  COUNT(*) FILTER (WHERE "status" = 'ARCHIVED')::int AS "archivedCount",
  COUNT(*) FILTER (WHERE "status" IN ('SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'))::int AS "activeCount",
  COALESCE(SUM("claimedAmount") FILTER (WHERE "status" NOT IN ('DRAFT', 'REJECTED')), 0) AS "submittedClaimedGross",
  COALESCE(SUM("claimRecommendedAmount") FILTER (WHERE "status" IN ('SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED')), 0) AS "activeReviewedGross",
  COALESCE(SUM("claimRecommendedAmount") FILTER (WHERE "status" IN ('SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED')
    AND "paidAt" IS NULL AND "paymentApproved"), 0) AS "approvedOutstandingGross",
  COUNT(*) FILTER (WHERE "isPaid")::int AS "paidCount",
  COALESCE(SUM("claimRecommendedAmount") FILTER (WHERE "isPaid"), 0) AS "paidGross",
  COALESCE(SUM("paymentWithholdingTax" + "paymentTaxOffset") FILTER (WHERE "isPaid" AND "completeBreakdown"), 0) AS "paidDeductionsConfirmed",
  COALESCE(SUM("claimRecommendedAmount" - "paymentWithholdingTax" - "paymentTaxOffset")
    FILTER (WHERE "isPaid" AND "completeBreakdown"), 0) AS "paidNetConfirmed",
  COUNT(*) FILTER (WHERE "isPaid" AND NOT "completeBreakdown")::int AS "paidMissingBreakdown"`;

type RawFacts = {
  claimCount: number; archivedCount: number; activeCount: number; submittedClaimedGross: Prisma.Decimal;
  activeReviewedGross: Prisma.Decimal; approvedOutstandingGross: Prisma.Decimal; paidCount: number;
  paidGross: Prisma.Decimal; paidDeductionsConfirmed: Prisma.Decimal; paidNetConfirmed: Prisma.Decimal;
  paidMissingBreakdown: number;
};

export function serializeClaimAnalyticsFacts(row: RawFacts) {
  return {
    claimCount: Number(row.claimCount), archivedCount: Number(row.archivedCount), activeCount: Number(row.activeCount),
    submittedClaimedGross: row.submittedClaimedGross.toFixed(2), activeReviewedGross: row.activeReviewedGross.toFixed(2),
    approvedOutstandingGross: row.approvedOutstandingGross.toFixed(2), paidCount: Number(row.paidCount),
    paidGross: row.paidGross.toFixed(2), paidDeductionsConfirmed: row.paidDeductionsConfirmed.toFixed(2),
    paidNetConfirmed: row.paidNetConfirmed.toFixed(2), paidMissingBreakdown: Number(row.paidMissingBreakdown),
  };
}

type OfficeFacts = RawFacts & { areaOfficeId: string | null; areaOfficeName: string };
type YearFacts = RawFacts & { year: number | null };
type CompanyFacts = RawFacts & { companyId: string; companyName: string };

/** No personal bank/staff details leave this reporting service. All values are workspace-scoped in SQL. */
export async function getClaimAnalyticsSummary(input: ClaimAnalyticsRequest) {
  const filters = normalizeClaimAnalyticsFilters(input.filters);
  const source = sourceSql(await scopeFor(input), filters);
  const db = getDb();
  const [totals, offices, years, companies] = await db.$transaction([
    db.$queryRaw<RawFacts[]>(Prisma.sql`${source} SELECT ${factsSql} FROM scoped`),
    db.$queryRaw<OfficeFacts[]>(Prisma.sql`${source} SELECT "areaOfficeId", "areaOfficeName", ${factsSql} FROM scoped
      GROUP BY "areaOfficeId", "areaOfficeName" ORDER BY "areaOfficeName", "areaOfficeId"`),
    db.$queryRaw<YearFacts[]>(Prisma.sql`${source} SELECT "groupYear" AS "year", ${factsSql} FROM scoped
      GROUP BY "groupYear" ORDER BY "groupYear" DESC NULLS LAST`),
    db.$queryRaw<CompanyFacts[]>(Prisma.sql`${source} SELECT "companyId", "currentCompanyName" AS "companyName", ${factsSql} FROM scoped
      GROUP BY "companyId", "currentCompanyName" ORDER BY "currentCompanyName", "companyId"`),
  ]);
  return {
    yearBasis: filters.yearBasis,
    filters,
    totals: serializeClaimAnalyticsFacts(totals[0]),
    byAreaOffice: offices.map((row) => ({ areaOfficeId: row.areaOfficeId, areaOfficeName: row.areaOfficeName,
      ...serializeClaimAnalyticsFacts(row) })),
    byYear: years.map((row) => ({ year: row.year, ...serializeClaimAnalyticsFacts(row) })),
    byCompany: companies.map((row) => ({ companyId: row.companyId, companyName: row.companyName,
      ...serializeClaimAnalyticsFacts(row) })),
  };
}

/** Selector options are drawn from the same authorized rows, so names do not reveal unreached work. */
export async function getClaimAnalyticsDimensions(input: ClaimAnalyticsRequest, companySearch = "") {
  if (companySearch.length > 100) throw new Error("Search term is too long.");
  const source = sourceSql(await scopeFor(input), normalizeClaimAnalyticsFilters());
  const selected = normalizeClaimAnalyticsFilters(input.filters).companyIds ?? [];
  const companyMatch = companySearch.trim()
    ? Prisma.sql`WHERE ("currentCompanyName" ILIKE ${`%${companySearch.trim()}%`} ${selected.length ? Prisma.sql`OR "companyId" IN (${Prisma.join(selected)})` : Prisma.empty})`
    : Prisma.empty;
  const selectedFirst = selected.length ? Prisma.sql`CASE WHEN "id" IN (${Prisma.join(selected)}) THEN 0 ELSE 1 END,` : Prisma.empty;
  const db = getDb();
  const [companies, offices] = await db.$transaction([
    db.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`${source} SELECT "id", "name" FROM (
      SELECT DISTINCT "companyId" AS "id", "currentCompanyName" AS "name" FROM scoped ${companyMatch}
    ) dimensions ORDER BY ${selectedFirst} "name", "id" LIMIT ${101 + selected.length}`),
    db.$queryRaw<{ id: string | null; name: string }[]>(Prisma.sql`${source} SELECT DISTINCT "areaOfficeId" AS "id", "areaOfficeName" AS "name"
      FROM scoped ORDER BY "name", "id"`),
  ]);
  return { companies: companies.slice(0, 100 + selected.length), companyLimitReached: companies.length > 100 + selected.length, offices };
}

type DetailRow = {
  id: string; reference: string; companyId: string; companyName: string; areaOfficeId: string | null;
  areaOfficeName: string; claimYear: number | null; submittedAt: Date | null; paidAt: Date | null;
  archivedAt: Date | null; status: string; policyEdition: string; claimedAmount: Prisma.Decimal;
  claimRecommendedAmount: Prisma.Decimal | null; paymentWithholdingTax: Prisma.Decimal | null;
  paymentTaxOffset: Prisma.Decimal | null; isPaid: boolean; completeBreakdown: boolean;
};

/** Keyset pagination is stable for large reports and avoids loading export-sized result sets into memory. */
export async function listClaimAnalyticsDetails(input: ClaimAnalyticsRequest & { afterId?: string; limit?: number }) {
  const filters = normalizeClaimAnalyticsFilters(input.filters);
  const scope = await scopeFor(input);
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Select a page size between 1 and 500.");
  if (input.afterId !== undefined && (typeof input.afterId !== "string" || !input.afterId || input.afterId.length > 128)) {
    throw new Error("Invalid analytics cursor.");
  }
  const cursor = input.afterId ? Prisma.sql`WHERE "id" < ${input.afterId}` : Prisma.empty;
  const rows = await getDb().$queryRaw<DetailRow[]>(Prisma.sql`
    ${sourceSql(scope, filters)} SELECT "id", "reference", "companyId", "companyName", "areaOfficeId", "areaOfficeName",
      "claimYear", "submittedAt", "paidAt", "archivedAt", "status", "policyEdition", "claimedAmount",
      "claimRecommendedAmount", "paymentWithholdingTax", "paymentTaxOffset", "isPaid", "completeBreakdown"
    FROM scoped ${cursor} ORDER BY "id" DESC LIMIT ${limit + 1}`);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    rows: page.map((row) => ({
      id: row.id, reference: row.reference, companyId: row.companyId, companyName: row.companyName,
      areaOfficeId: row.areaOfficeId, areaOfficeName: row.areaOfficeName, claimYear: row.claimYear,
      submittedAt: row.submittedAt?.toISOString() ?? null, paidAt: row.paidAt?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null, status: row.status, policyEdition: row.policyEdition,
      claimedAmount: row.claimedAmount.toFixed(2),
      currentRecommendationGross: row.claimRecommendedAmount?.toFixed(2) ?? null,
      paidGross: row.isPaid ? row.claimRecommendedAmount?.toFixed(2) ?? null : null,
      paidNetConfirmed: row.isPaid && row.completeBreakdown
        ? row.claimRecommendedAmount!.minus(row.paymentWithholdingTax!).minus(row.paymentTaxOffset!).toFixed(2) : null,
      paidMissingBreakdown: row.isPaid && !row.completeBreakdown,
    })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}
