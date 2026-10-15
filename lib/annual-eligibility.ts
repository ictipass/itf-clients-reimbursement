import { z } from "zod";

import { getDb } from "@/lib/db";

const responseSchema = z.object({
  itfEmployerNumber: z.string().min(1),
  year: z.number().int(),
  paymentSettled: z.boolean(),
  contributionPaid: z.coerce.number().finite().nonnegative(),
  certificateIssued: z.boolean(),
  certificateNumber: z.string().nullable(),
});

function developmentApiSecret() {
  return process.env.ELIGIBILITY_DEV_API_SECRET || process.env.CRON_SECRET;
}

export type AnnualEligibilityResult = {
  status: "PENDING" | "ELIGIBLE" | "INELIGIBLE";
  message: string;
  contributionPaid?: number;
  certificateNumber?: string;
};

export function assessAnnualEligibility(value: z.infer<typeof responseSchema>): AnnualEligibilityResult {
  if (value.paymentSettled && value.contributionPaid > 0 && value.certificateIssued && value.certificateNumber) {
    return {
      status: "ELIGIBLE",
      message: `Payment settled and certificate ${value.certificateNumber} issued for ${value.year}.`,
      contributionPaid: value.contributionPaid,
      certificateNumber: value.certificateNumber,
    };
  }
  return { status: "INELIGIBLE", message: `Payment and an issued certificate are both required for ${value.year}.` };
}

export function validateDevelopmentEligibilityUrl(value: string) {
  if (process.env.NODE_ENV !== "development") throw new Error("The development eligibility API is available only in development.");
  const url = new URL(value);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.pathname !== "/api/development/eligibility" || url.username || url.password || url.search || url.hash) {
    throw new Error("Use the local development eligibility endpoint, for example http://127.0.0.1:3000/api/development/eligibility.");
  }
  return url.toString();
}

async function requestEligibility(endpoint: string, workspaceId: string, itfEmployerNumber: string, year: number) {
  const secret = developmentApiSecret();
  if (!secret) throw new Error("Development eligibility API secret is not configured.");
  const url = new URL(validateDevelopmentEligibilityUrl(endpoint));
  url.searchParams.set("workspaceId", workspaceId);
  url.searchParams.set("itfEmployerNumber", itfEmployerNumber);
  url.searchParams.set("year", String(year));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Eligibility API returned HTTP ${response.status}.`);
  const parsed = responseSchema.parse(await response.json());
  if (parsed.itfEmployerNumber !== itfEmployerNumber || parsed.year !== year) {
    throw new Error("Eligibility API returned a different employer or year.");
  }
  return parsed;
}

export async function checkDevelopmentEligibilityApi(endpoint: string) {
  const secret = developmentApiSecret();
  if (!secret) throw new Error("Development eligibility API secret is not configured.");
  const url = new URL(validateDevelopmentEligibilityUrl(endpoint));
  url.searchParams.set("health", "1");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Eligibility API returned HTTP ${response.status}.`);
  return true;
}

export async function verifyAnnualEligibility(companyId: string, year: number): Promise<AnnualEligibilityResult> {
  if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear() + 1) {
    throw new Error("Invalid training and compliance year.");
  }
  const db = getDb();
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      itfEmployerNumber: true,
      organization: { select: { workspace: { select: { id: true, revenueWorkflowMode: true, eligibilityEndpointUrl: true } } } },
      complianceYears: {
        where: { year, status: "APPROVED", certificate: { isNot: null } },
        select: { amountPaid: true, certificate: { select: { certificateNumber: true } } },
        take: 1,
      },
    },
  });
  if (!company?.itfEmployerNumber) throw new Error("Company has no ITF registration number.");
  const workspace = company.organization.workspace;
  let result: AnnualEligibilityResult;
  if (workspace.revenueWorkflowMode === "IN_APP_REVENUE") {
    const compliance = company.complianceYears[0];
    result = compliance?.amountPaid && Number(compliance.amountPaid) > 0 && compliance.certificate?.certificateNumber
      ? { status: "ELIGIBLE", message: `Local payment and certificate verified for ${year}.`, contributionPaid: Number(compliance.amountPaid), certificateNumber: compliance.certificate.certificateNumber }
      : { status: "INELIGIBLE", message: `Approved ${year} compliance, payment, and certificate are required.` };
  } else if (!workspace.eligibilityEndpointUrl) {
    result = { status: "PENDING", message: "Eligibility API endpoint has not been configured." };
  } else {
    try {
      const response = await requestEligibility(workspace.eligibilityEndpointUrl, workspace.id, company.itfEmployerNumber, year);
      result = assessAnnualEligibility(response);
    } catch {
      result = { status: "PENDING", message: "Eligibility API is unavailable or returned an invalid response. Verification will be retried." };
    }
  }
  await db.annualEligibilityCheck.upsert({
    where: { companyId_year: { companyId, year } },
    create: { companyId, year, status: result.status, contributionPaid: result.contributionPaid, certificateNumber: result.certificateNumber, source: workspace.revenueWorkflowMode, message: result.message, checkedAt: result.status === "PENDING" ? null : new Date() },
    update: { status: result.status, contributionPaid: result.contributionPaid ?? null, certificateNumber: result.certificateNumber ?? null, source: workspace.revenueWorkflowMode, message: result.message, checkedAt: result.status === "PENDING" ? null : new Date() },
  });
  return result;
}

export async function retryPendingAnnualEligibility(workspaceId?: string, limit = 50) {
  const pending = await getDb().annualEligibilityCheck.findMany({
    where: {
      status: "PENDING",
      ...(workspaceId ? { company: { organization: { workspaceId } } } : {}),
    },
    select: { companyId: true, year: true },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  const results = [];
  for (const item of pending) {
    const result = await verifyAnnualEligibility(item.companyId, item.year);
    results.push({ companyId: item.companyId, year: item.year, status: result.status });
  }
  return results;
}
