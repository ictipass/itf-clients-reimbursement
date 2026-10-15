"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { updateContributionOperatingModel } from "@/lib/claim-policy";
import { checkDevelopmentEligibilityApi, retryPendingAnnualEligibility, validateDevelopmentEligibilityUrl, verifyAnnualEligibility } from "@/lib/annual-eligibility";
import { getDb } from "@/lib/db";
import { isTestEligibilityConfigurationAllowed } from "@/lib/eligibility-provider";
import { canManageClaimPolicy } from "@/lib/rbac";

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

export async function updateContributionOperatingModelAction(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await updateContributionOperatingModel({
    requesterRole: session.user.role,
    workspaceId: readRequiredString(formData, "workspaceId"),
    revenueWorkflowMode: readRequiredString(formData, "revenueWorkflowMode"),
  });

  revalidatePath("/");
  revalidatePath("/settings/operating-model");
  revalidatePath("/settings/system");
  revalidatePath("/dashboard");
  revalidatePath("/management");
  revalidatePath("/registry");
  revalidatePath("/registry/[companyId]", "page");
  redirect("/settings/operating-model");
}

async function authorizedWorkspace(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !canManageClaimPolicy(session.user.role)) {
    throw new Error("You do not have permission to manage eligibility verification.");
  }
  const workspaceId = readRequiredString(formData, "workspaceId");
  const workspace = await getDb().workspace.findFirst({ where: { id: workspaceId, isActive: true } });
  if (!workspace) throw new Error("Workspace was not found.");
  if (!isTestEligibilityConfigurationAllowed()) throw new Error("Test eligibility settings are unavailable in this deployment.");
  return workspace;
}

function readYear(formData: FormData) {
  const year = Number(readRequiredString(formData, "year"));
  if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear() + 1) {
    throw new Error("Enter a valid training and compliance year.");
  }
  return year;
}

export async function saveDevelopmentEligibilityEndpointAction(formData: FormData) {
  const workspace = await authorizedWorkspace(formData);
  if (process.env.NODE_ENV !== "development") throw new Error("The local test endpoint can only be configured in local development.");
  const endpoint = validateDevelopmentEligibilityUrl(readRequiredString(formData, "endpointUrl"));
  await getDb().workspace.update({ where: { id: workspace.id }, data: { eligibilityEndpointUrl: endpoint } });
  revalidatePath("/settings/operating-model");
  redirect("/settings/operating-model?eligibilityMessage=Endpoint%20saved");
}

export async function saveDevelopmentEligibilityRecordAction(formData: FormData) {
  const workspace = await authorizedWorkspace(formData);
  const itfEmployerNumber = readRequiredString(formData, "itfEmployerNumber");
  const year = readYear(formData);
  const contributionPaid = Number(readRequiredString(formData, "contributionPaid"));
  const paymentSettled = formData.get("paymentSettled") === "on";
  const certificateIssued = formData.get("certificateIssued") === "on";
  const certificateNumber = String(formData.get("certificateNumber") ?? "").trim() || null;
  if (itfEmployerNumber.length > 80 || !Number.isFinite(contributionPaid) || contributionPaid < 0 || contributionPaid > 999999999999.99) {
    throw new Error("Enter a valid ITF number and contribution amount.");
  }
  if (certificateIssued && !certificateNumber) throw new Error("An issued certificate requires its number.");
  await getDb().developmentEligibilityRecord.upsert({
    where: { workspaceId_itfEmployerNumber_year: { workspaceId: workspace.id, itfEmployerNumber, year } },
    create: { workspaceId: workspace.id, itfEmployerNumber, year, contributionPaid, paymentSettled, certificateIssued, certificateNumber },
    update: { contributionPaid, paymentSettled, certificateIssued, certificateNumber },
  });
  revalidatePath("/settings/operating-model");
  redirect("/settings/operating-model?eligibilityMessage=Test%20record%20saved");
}

export async function checkDevelopmentEligibilityAction(formData: FormData) {
  const workspace = await authorizedWorkspace(formData);
  if (process.env.NODE_ENV !== "development") throw new Error("The local test endpoint can only be checked in local development.");
  if (!workspace.eligibilityEndpointUrl) throw new Error("Save an eligibility endpoint first.");
  let available = false;
  try {
    available = await checkDevelopmentEligibilityApi(workspace.eligibilityEndpointUrl);
  } catch {
    // Availability checks must report an outage without changing eligibility records.
  }
  revalidatePath("/settings/operating-model");
  redirect(`/settings/operating-model?eligibilityMessage=${available ? "API%20available" : "API%20unavailable"}`);
}

export async function verifyDevelopmentCompanyAction(formData: FormData) {
  const workspace = await authorizedWorkspace(formData);
  const itfEmployerNumber = readRequiredString(formData, "itfEmployerNumber");
  const year = readYear(formData);
  const company = await getDb().company.findFirst({
    where: { itfEmployerNumber, organization: { workspaceId: workspace.id }, isActive: true },
    select: { id: true },
  });
  if (!company) {
    redirect("/settings/operating-model?eligibilityError=No%20active%20onboarded%20company%20has%20this%20ITF%20registration%20number.%20Create%20the%20company%20first%2C%20or%20check%20the%20number.");
  }
  const result = await verifyAnnualEligibility(company.id, year);
  revalidatePath("/settings/operating-model");
  redirect(`/settings/operating-model?eligibilityMessage=${encodeURIComponent(result.status)}`);
}

export async function retryPendingDevelopmentEligibilityAction(formData: FormData) {
  const workspace = await authorizedWorkspace(formData);
  const results = await retryPendingAnnualEligibility(workspace.id);
  revalidatePath("/settings/operating-model");
  redirect(`/settings/operating-model?eligibilityMessage=${encodeURIComponent(`Checked ${results.length} pending companies`)}`);
}
