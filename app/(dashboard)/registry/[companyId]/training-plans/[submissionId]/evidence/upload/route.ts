import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { readUploadedFile } from "@/lib/storage/staged-upload";
import {
  getTrainingPlanEvidenceKinds,
  uploadTrainingPlanEvidenceBatch,
  type TrainingPlanEvidenceKind,
} from "@/lib/training-plan";
import { getRateLimitFeedback } from "@/lib/rate-limit";

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

function redirectToTrainingPlan(submissionId: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/training-plans/${submissionId}`,
    },
  });
}

function redirectToUploadForm(input: {
  companyId: string;
  submissionId: string;
  message: string;
  kind?: string;
}) {
  const searchParams = new URLSearchParams({
    error: input.message.slice(0, 280),
  });

  if (input.kind) {
    searchParams.set("kind", input.kind);
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: `/registry/${input.companyId}/training-plans/${input.submissionId}/evidence/new?${searchParams.toString()}`,
    },
  });
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
  let selectedKind: string | undefined;

  try {
    const formData = await request.formData();
    const kindValue = formData.get("kind");

    selectedKind = typeof kindValue === "string" ? kindValue : undefined;

    const files = [];
    for (const [name, kind] of [["trainingPlanCsv", "TRAINING_PLAN_DOCUMENT"], ["personnelCv", "LD_PERSONNEL_CV"]] as const) {
      const value = formData.get(name);
      const reference = formData.get(`${name}UploadRef`);
      if ((value instanceof File && value.size > 0) || (typeof reference === "string" && reference.length > 0)) {
        files.push({ kind, file: await readUploadedFile(formData, name, session.user.id) });
      }
    }
    if (files.length === 0 && (formData.has("file") || formData.has("fileUploadRef"))) {
      files.push({ kind: readEvidenceKind(formData), file: await readUploadedFile(formData, "file", session.user.id) });
    }
    await uploadTrainingPlanEvidenceBatch({
      companyId,
      submissionId,
      uploadedByEmail: session.user.email,
      requesterRole: session.user.role,
      files,
    });

    return redirectToTrainingPlan(submissionId);
  } catch (error) {
    const rateLimit = getRateLimitFeedback(error);
    const message = rateLimit
      ? `${rateLimit.message} Your selected evidence type has been preserved for retry.`
      : error instanceof Error
        ? error.message
        : "Training plan evidence upload failed.";

    return redirectToUploadForm({
      companyId,
      submissionId,
      message,
      kind: selectedKind,
    });
  }
}
