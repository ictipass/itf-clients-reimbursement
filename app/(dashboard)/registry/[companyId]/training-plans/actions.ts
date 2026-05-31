"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  createTrainingPlanSubmission,
  submitTrainingPlanSubmission,
  type TrainingPlanPersonnelInput,
} from "@/lib/training-plan";

function readOptionalString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readRequiredInteger(formData: FormData, name: string) {
  const value = readOptionalString(formData, name);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 2000) {
    throw new Error(`${name} must be a valid year.`);
  }

  return parsed;
}

function readPersonnel(formData: FormData): TrainingPlanPersonnelInput[] {
  const names = formData.getAll("ldPersonnelName");
  const positions = formData.getAll("ldPersonnelPosition");
  const emails = formData.getAll("ldPersonnelEmail");
  const phones = formData.getAll("ldPersonnelPhone");
  const personnel: TrainingPlanPersonnelInput[] = [];

  for (let index = 0; index < names.length; index += 1) {
    const name = readStringEntry(names[index]);
    const position = readStringEntry(positions[index]) || undefined;
    const email = readStringEntry(emails[index]) || undefined;
    const phone = readStringEntry(phones[index]) || undefined;

    if (!name && !position && !email && !phone) {
      continue;
    }

    if (!name) {
      throw new Error("Each L&D personnel entry must include a name.");
    }

    personnel.push({
      name,
      position,
      email,
      phone,
    });
  }

  if (personnel.length === 0) {
    throw new Error("At least one L&D personnel entry is required.");
  }

  return personnel;
}

function readStringEntry(value: FormDataEntryValue | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createTrainingPlanSubmissionAction(
  companyId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await createTrainingPlanSubmission({
    companyId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    year: readRequiredInteger(formData, "year"),
    personnel: readPersonnel(formData),
    trainingPlanSummary: readOptionalString(formData, "trainingPlanSummary"),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}

export async function submitTrainingPlanSubmissionAction(
  companyId: string,
  submissionId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await submitTrainingPlanSubmission({
    companyId,
    submissionId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
    note: readOptionalString(formData, "note"),
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}
