export function isCompanyDetailCorrectionOpen(input: {
  registration?: { status: string; currentDesk: string } | null;
  trainingPlans?: Array<{ status: string; currentDesk: string }>;
  complianceYears?: Array<{ status: string }>;
}) {
  return (input.registration?.status === "CHANGES_REQUESTED" && input.registration.currentDesk === "COMPANY") ||
    input.trainingPlans?.some((plan) => plan.status === "CHANGES_REQUESTED" && plan.currentDesk === "COMPANY") === true ||
    input.complianceYears?.some((year) => year.status === "CHANGES_REQUESTED") === true;
}

export function isSubmittedArtifactEditable(status: string, currentDesk?: string) {
  return status === "DRAFT" && (currentDesk === undefined || currentDesk === "COMPANY");
}
