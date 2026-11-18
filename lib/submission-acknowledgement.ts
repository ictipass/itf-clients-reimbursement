export const EMPLOYER_SUBMISSION_ACKNOWLEDGEMENT = "employerSubmissionAcknowledged";

export function assertEmployerSubmissionAcknowledged(formData: FormData) {
  if (formData.get(EMPLOYER_SUBMISSION_ACKNOWLEDGEMENT) !== "yes") {
    throw new Error("Review and confirm the submission disclaimer before submitting.");
  }
}
