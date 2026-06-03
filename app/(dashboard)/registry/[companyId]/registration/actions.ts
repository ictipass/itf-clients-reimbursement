"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  assessRegistrationContribution,
  completeRegistrationAtHeadquarters,
  getLegacyRegistrationReviewActions,
  getRegistrationApplicationKinds,
  confirmRegistrationContribution,
  forwardRegistrationToDivision,
  getRegistrationDeskTransitions,
  getRecommendationReleaseChannels,
  getRegistrationReceiptReviewActions,
  notifyRegistrationHeadquarters,
  recordLegacyRegistration,
  releaseRegistrationContribution,
  reviewLegacyRegistrationClaim,
  reviewRegistrationContributionReceipt,
  routeRegistrationApplication,
  submitRegistrationApplication,
  uploadRegistrationContributionReceipt,
  type LegacyRegistrationReviewAction,
  type RegistrationReceiptReviewAction,
  type RegistrationApplicationKind,
  type RegistrationDeskTransition,
} from "@/lib/registration";

type RecommendationReleaseChannel = ReturnType<typeof getRecommendationReleaseChannels>[number];

export async function submitRegistrationApplicationAction(companyId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await submitRegistrationApplication({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    registrationKind: readRegistrationApplicationKind(formData),
    claimedItfEmployerNumber: readOptionalString(formData, "claimedItfEmployerNumber"),
  });

  revalidatePath(`/dashboard`);
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

function readRegistrationApplicationKind(formData: FormData): RegistrationApplicationKind {
  const value = readOptionalString(formData, "registrationKind") ?? "NEW_EMPLOYER";
  const kinds = getRegistrationApplicationKinds();

  if (!kinds.includes(value as RegistrationApplicationKind)) {
    throw new Error("Unsupported registration type.");
  }

  return value as RegistrationApplicationKind;
}

function readLegacyRegistrationReviewAction(formData: FormData): LegacyRegistrationReviewAction {
  const value = readOptionalString(formData, "action");
  const actions = getLegacyRegistrationReviewActions();

  if (!value || !actions.includes(value as LegacyRegistrationReviewAction)) {
    throw new Error("Unsupported legacy registration review action.");
  }

  return value as LegacyRegistrationReviewAction;
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

  revalidatePath(`/dashboard`);
  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function reviewLegacyRegistrationClaimAction(
  companyId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await reviewLegacyRegistrationClaim({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    action: readLegacyRegistrationReviewAction(formData),
    note: readOptionalString(formData, "note"),
  });

  revalidatePath(`/dashboard`);
  revalidatePath(`/registry`);
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

  revalidatePath(`/dashboard`);
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
    releaseChannel: readReleaseChannel(formData),
    releaseNote: readOptionalString(formData, "releaseNote"),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function uploadRegistrationContributionReceiptAction(
  companyId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await uploadRegistrationContributionReceipt({
    companyId,
    uploadedByEmail: session.user.email,
    requesterRole: session.user.role,
    file: readRequiredFile(formData, "receipt"),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function reviewRegistrationContributionReceiptAction(
  companyId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await reviewRegistrationContributionReceipt({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    action: readReceiptReviewAction(formData),
    reviewNote: readOptionalString(formData, "reviewNote"),
  });

  revalidatePath(`/dashboard`);
  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function notifyRegistrationHeadquartersAction(companyId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await notifyRegistrationHeadquarters({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    note: readOptionalString(formData, "note"),
  });

  revalidatePath(`/dashboard`);
  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function forwardRegistrationToDivisionAction(companyId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await forwardRegistrationToDivision({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    note: readOptionalString(formData, "note"),
  });

  revalidatePath(`/dashboard`);
  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function completeRegistrationAtHeadquartersAction(
  companyId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await completeRegistrationAtHeadquarters({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    itfEmployerNumberId: readRequiredString(formData, "itfEmployerNumberId"),
    note: readOptionalString(formData, "note"),
  });

  revalidatePath(`/dashboard`);
  revalidatePath(`/registry`);
  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function recordLegacyRegistrationAction(companyId: string, formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await recordLegacyRegistration({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    itfEmployerNumber: readRequiredString(formData, "itfEmployerNumber"),
    note: readRequiredString(formData, "note"),
  });

  revalidatePath(`/dashboard`);
  revalidatePath(`/registry`);
  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

function readReleaseChannel(formData: FormData): RecommendationReleaseChannel {
  const value = readOptionalString(formData, "releaseChannel");
  const channels = getRecommendationReleaseChannels();

  if (!value || !channels.includes(value as RecommendationReleaseChannel)) {
    throw new Error("Unsupported recommendation release option.");
  }

  return value as RecommendationReleaseChannel;
}

function readReceiptReviewAction(formData: FormData): RegistrationReceiptReviewAction {
  const value = readOptionalString(formData, "action");
  const actions = getRegistrationReceiptReviewActions();

  if (!value || !actions.includes(value as RegistrationReceiptReviewAction)) {
    throw new Error("Unsupported receipt review action.");
  }

  return value as RegistrationReceiptReviewAction;
}

function readRequiredString(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function readRequiredFile(formData: FormData, name: string) {
  const value = formData.get(name);

  if (!(value instanceof File) || value.size === 0) {
    throw new Error(`${name} file is required.`);
  }

  return value;
}
