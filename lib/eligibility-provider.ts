type EligibilityEnvironment = Partial<Record<"NODE_ENV" | "VERCEL_ENV" | "ELIGIBILITY_PROVIDER", string>>;

export function usesPreviewEligibilityRecords(environment: EligibilityEnvironment = process.env) {
  return environment.VERCEL_ENV === "preview" &&
    environment.ELIGIBILITY_PROVIDER === "TEST_RECORDS";
}

export function isTestEligibilityConfigurationAllowed(environment: EligibilityEnvironment = process.env) {
  return environment.NODE_ENV === "development" || usesPreviewEligibilityRecords(environment);
}
