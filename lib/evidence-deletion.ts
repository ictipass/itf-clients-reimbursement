import { isSubmittedArtifactEditable } from "@/lib/employer-correction";

export function isEvidenceWorkflowEditable(
  statuses: Array<string | null | undefined>,
) {
  const linkedStatuses = statuses.filter(
    (status): status is string => typeof status === "string",
  );

  return (
    linkedStatuses.length === 0 ||
    linkedStatuses.every((status) => isSubmittedArtifactEditable(status))
  );
}
