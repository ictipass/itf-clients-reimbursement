import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { readUploadedFile } from "@/lib/storage/staged-upload";
import {
  getTrainingPlanEvidenceKinds,
  uploadTrainingPlanEvidence,
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

function redirectToCompany(companyId: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/registry/${companyId}`,
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

    await uploadTrainingPlanEvidence({
      companyId,
      submissionId,
      uploadedByEmail: session.user.email,
      requesterRole: session.user.role,
      kind: readEvidenceKind(formData),
      file: await readUploadedFile(formData, "file", session.user.id),
    });

    return redirectToCompany(companyId);
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
