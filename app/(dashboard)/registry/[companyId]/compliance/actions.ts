"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { createComplianceYear } from "@/lib/compliance";

function readOptionalString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalInteger(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return parsed;
}

function readRequiredInteger(formData: FormData, name: string) {
  const value = readOptionalInteger(formData, name);

  if (value === undefined) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function readOptionalMoney(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    return undefined;
  }

  const normalized = value.replaceAll(",", "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a valid amount.`);
  }

  return normalized;
}

function readOptionalDate(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

export async function createComplianceYearAction(companyId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  const nigerianEmployeeCount = readOptionalInteger(formData, "nigerianEmployeeCount");
  const expatriateEmployeeCount = readOptionalInteger(formData, "expatriateEmployeeCount");
  const suppliedTotalEmployeeCount = readOptionalInteger(formData, "totalEmployeeCount");
  const calculatedTotal =
    nigerianEmployeeCount !== undefined || expatriateEmployeeCount !== undefined
      ? (nigerianEmployeeCount ?? 0) + (expatriateEmployeeCount ?? 0)
      : undefined;
  const totalEmployeeCount = suppliedTotalEmployeeCount ?? calculatedTotal;

  await createComplianceYear({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    year: readRequiredInteger(formData, "year"),
    nigerianEmployeeCount,
    expatriateEmployeeCount,
    totalEmployeeCount,
    turnover: readOptionalMoney(formData, "turnover"),
    payrollTotal: readOptionalMoney(formData, "payrollTotal"),
    contributionAmount: readOptionalMoney(formData, "contributionAmount"),
    amountPaid: readOptionalMoney(formData, "amountPaid"),
    amountPaidInWords: readOptionalString(formData, "amountPaidInWords"),
    paymentMode: readOptionalString(formData, "paymentMode"),
    contributionPaidAt: readOptionalDate(formData, "contributionPaidAt"),
    annualPlanSubmittedAt: readOptionalDate(formData, "annualPlanSubmittedAt"),
    declarationName: readOptionalString(formData, "declarationName"),
    declarationPosition: readOptionalString(formData, "declarationPosition"),
    declarationPhone: readOptionalString(formData, "declarationPhone"),
    declaredAt: readOptionalDate(formData, "declaredAt"),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}
