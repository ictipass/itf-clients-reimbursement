import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  getTrainingPlanEvidenceKinds,
  uploadTrainingPlanEvidence,
  type TrainingPlanEvidenceKind,
} from "@/lib/training-plan";

export const dynamic = "force-dynamic";

function readRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function readEvidenceKind(formData: FormData): TrainingPlanEvidenceKind {
  const value = readRequiredString(formData, "kind");
  const evidenceKinds = getTrainingPlanEvidenceKinds();

  if (!evidenceKinds.includes(value as TrainingPlanEvidenceKind)) {
    throw new Error("Unsupported training plan evidence type.");
  }

  return value as TrainingPlanEvidenceKind;
}

function readRequiredFile(formData: FormData) {
  const value = formData.get("file");

  if (!(value instanceof File)) {
    throw new Error("Evidence file is required.");
  }

  return value;
}

export async function POST(
  request: Request,
  context: RouteContext<"/registry/[companyId]/training-plans/[submissionId]/evidence/upload">,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Authentication is required.", { status: 401 });
  }

  const { companyId, submissionId } = await context.params;

  try {
    const formData = await request.formData();

    await uploadTrainingPlanEvidence({
      companyId,
      submissionId,
      uploadedByEmail: session.user.email,
      requesterRole: session.user.role,
      kind: readEvidenceKind(formData),
      file: readRequiredFile(formData),
    });

    return new Response(null, {
      status: 303,
      headers: {
        Location: `/registry/${companyId}`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Training plan evidence upload failed.";

    return new Response(message, { status: 400 });
  }
}
