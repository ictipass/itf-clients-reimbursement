import { Prisma } from "@/lib/generated/prisma/client";
import { getDb } from "@/lib/db";

export type ClaimFinancialFacts = {
  paidCount: number;
  paidGross: number;
  paidDeductions: number;
  paidNetConfirmed: number;
  paidMissingBreakdown: number;
  archivedCount: number;
  activeCount: number;
  activeClaimed: number;
  activeReviewed: number;
  approvedOutstandingGross: number;
};

type ClaimReportingRow = {
  areaOfficeId: string | null;
  paidCount: bigint;
  paidGross: Prisma.Decimal;
  paidDeductions: Prisma.Decimal;
  paidNetConfirmed: Prisma.Decimal;
  paidMissingBreakdown: bigint;
  archivedCount: bigint;
  activeCount: bigint;
  activeClaimed: Prisma.Decimal;
  activeReviewed: Prisma.Decimal;
  approvedOutstandingGross: Prisma.Decimal;
};

export function emptyClaimFinancialFacts(): ClaimFinancialFacts {
  return {
    paidCount: 0, paidGross: 0, paidDeductions: 0, paidNetConfirmed: 0,
    paidMissingBreakdown: 0, archivedCount: 0, activeCount: 0,
    activeClaimed: 0, activeReviewed: 0, approvedOutstandingGross: 0,
  };
}

export function combineClaimFinancialFacts(rows: ClaimFinancialFacts[]): ClaimFinancialFacts {
  return rows.reduce((total, row) => ({
    paidCount: total.paidCount + row.paidCount,
    paidGross: total.paidGross + row.paidGross,
    paidDeductions: total.paidDeductions + row.paidDeductions,
    paidNetConfirmed: total.paidNetConfirmed + row.paidNetConfirmed,
    paidMissingBreakdown: total.paidMissingBreakdown + row.paidMissingBreakdown,
    archivedCount: total.archivedCount + row.archivedCount,
    activeCount: total.activeCount + row.activeCount,
    activeClaimed: total.activeClaimed + row.activeClaimed,
    activeReviewed: total.activeReviewed + row.activeReviewed,
    approvedOutstandingGross: total.approvedOutstandingGross + row.approvedOutstandingGross,
  }), emptyClaimFinancialFacts());
}

function toFacts(row: ClaimReportingRow): ClaimFinancialFacts {
  return {
    paidCount: Number(row.paidCount),
    paidGross: Number(row.paidGross),
    paidDeductions: Number(row.paidDeductions),
    paidNetConfirmed: Number(row.paidNetConfirmed),
    paidMissingBreakdown: Number(row.paidMissingBreakdown),
    archivedCount: Number(row.archivedCount),
    activeCount: Number(row.activeCount),
    activeClaimed: Number(row.activeClaimed),
    activeReviewed: Number(row.activeReviewed),
    approvedOutstandingGross: Number(row.approvedOutstandingGross),
  };
}

/** Claim year is the training year. Payment and archive years use UTC event timestamps. */
export async function getClaimFinancialFactsByOffice(input: { year?: number; areaOfficeIds?: string[] }) {
  if (input.year !== undefined && (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100)) {
    throw new Error("Select a valid reporting year.");
  }
  if (input.areaOfficeIds?.length === 0) return new Map<string | null, ClaimFinancialFacts>();
  const start = input.year === undefined ? null : new Date(Date.UTC(input.year, 0, 1));
  const end = input.year === undefined ? null : new Date(Date.UTC(input.year + 1, 0, 1));
  const claimYear = input.year === undefined ? Prisma.empty : Prisma.sql`AND rc."claimYear" = ${input.year}`;
  const paymentYear = start && end ? Prisma.sql`AND rc."paidAt" >= ${start} AND rc."paidAt" < ${end}` : Prisma.empty;
  const archiveYear = start && end ? Prisma.sql`AND rc."archivedAt" >= ${start} AND rc."archivedAt" < ${end}` : Prisma.empty;
  const officeScope = input.areaOfficeIds
    ? Prisma.sql`AND c."areaOfficeId" IN (${Prisma.join(input.areaOfficeIds)})`
    : Prisma.empty;
  const paid = Prisma.sql`rc."paymentHandoffStatus" = 'PAID' AND rc."paidAt" IS NOT NULL ${paymentYear}`;
  const completeBreakdown = Prisma.sql`rc."claimRecommendedAmount" IS NOT NULL
    AND rc."paymentWithholdingTax" IS NOT NULL AND rc."paymentTaxOffset" IS NOT NULL
    AND rc."claimRecommendedAmount" > 0
    AND rc."paymentWithholdingTax" >= 0 AND rc."paymentTaxOffset" >= 0
    AND rc."claimRecommendedAmount" > rc."paymentWithholdingTax" + rc."paymentTaxOffset"`;
  const missingBreakdown = Prisma.sql`rc."claimRecommendedAmount" IS NULL
    OR rc."paymentWithholdingTax" IS NULL OR rc."paymentTaxOffset" IS NULL
    OR rc."claimRecommendedAmount" <= 0
    OR rc."paymentWithholdingTax" < 0 OR rc."paymentTaxOffset" < 0
    OR rc."claimRecommendedAmount" <= rc."paymentWithholdingTax" + rc."paymentTaxOffset"`;
  const active = Prisma.sql`rc."status" IN ('SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED') ${claimYear}`;
  const rows = await getDb().$queryRaw<ClaimReportingRow[]>(Prisma.sql`
    SELECT c."areaOfficeId" AS "areaOfficeId",
      COUNT(*) FILTER (WHERE ${paid}) AS "paidCount",
      COALESCE(SUM(rc."claimRecommendedAmount") FILTER (WHERE ${paid}), 0) AS "paidGross",
      COALESCE(SUM(rc."paymentWithholdingTax" + rc."paymentTaxOffset") FILTER (WHERE ${paid} AND ${completeBreakdown}), 0) AS "paidDeductions",
      COALESCE(SUM(rc."claimRecommendedAmount" - rc."paymentWithholdingTax" - rc."paymentTaxOffset") FILTER (WHERE ${paid} AND ${completeBreakdown}), 0) AS "paidNetConfirmed",
      COUNT(*) FILTER (WHERE ${paid} AND (${missingBreakdown})) AS "paidMissingBreakdown",
      COUNT(*) FILTER (WHERE rc."status" = 'ARCHIVED' ${archiveYear}) AS "archivedCount",
      COUNT(*) FILTER (WHERE ${active}) AS "activeCount",
      COALESCE(SUM(rc."claimedAmount") FILTER (WHERE ${active}), 0) AS "activeClaimed",
      COALESCE(SUM(rc."claimRecommendedAmount") FILTER (WHERE ${active}), 0) AS "activeReviewed",
      COALESCE(SUM(rc."claimRecommendedAmount") FILTER (WHERE ${active}
        AND rc."paidAt" IS NULL AND EXISTS (
          SELECT 1 FROM "ReimbursementVoucherSignoff" s
          WHERE s."reimbursementClaimId" = rc."id" AND s."kind" = 'PAYMENT_APPROVED'
        )), 0) AS "approvedOutstandingGross"
    FROM "ReimbursementClaim" rc
    JOIN "Company" c ON c."id" = rc."companyId"
    WHERE rc."recordTier" = 'HOT' ${officeScope}
    GROUP BY c."areaOfficeId"
  `);
  return new Map(rows.map((row) => [row.areaOfficeId, toFacts(row)]));
}
