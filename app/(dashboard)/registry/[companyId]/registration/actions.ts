"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  assessRegistrationContribution,
  confirmRegistrationContribution,
  getRegistrationDeskTransitions,
  releaseRegistrationContribution,
  routeRegistrationApplication,
  submitRegistrationApplication,
  type RegistrationDeskTransition,
} from "@/lib/registration";

export async function submitRegistrationApplicationAction(companyId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await submitRegistrationApplication({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

function readOptionalString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readDeskTransition(formData: FormData): RegistrationDeskTransition {
  const value = readOptionalString(formData, "transition");
  const transitions = getRegistrationDeskTransitions();

  if (!value || !transitions.includes(value as RegistrationDeskTransition)) {
    throw new Error("Unsupported registration desk transition.");
  }

  return value as RegistrationDeskTransition;
}

export async function routeRegistrationApplicationAction(companyId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await routeRegistrationApplication({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    transition: readDeskTransition(formData),
    reason: readOptionalString(formData, "reason"),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

function readRequiredMoney(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  const normalized = value.replaceAll(",", "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a valid amount.`);
  }

  return normalized;
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

export async function assessRegistrationContributionAction(companyId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await assessRegistrationContribution({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    payrollBasis: readOptionalMoney(formData, "payrollBasis"),
    turnoverBasis: readOptionalMoney(formData, "turnoverBasis"),
    recommendedAmount: readRequiredMoney(formData, "recommendedAmount"),
    assessmentNote: readOptionalString(formData, "assessmentNote"),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function confirmRegistrationContributionAction(companyId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await confirmRegistrationContribution({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    reviewNote: readOptionalString(formData, "reviewNote"),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function releaseRegistrationContributionAction(companyId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await releaseRegistrationContribution({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    releaseNote: readOptionalString(formData, "releaseNote"),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}
