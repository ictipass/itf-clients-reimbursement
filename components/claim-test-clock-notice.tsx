import { getClaimFilingClock } from "@/lib/claim-test-clock";

export function ClaimTestClockNotice() {
  let testDate: string | null = null;
  let configurationError: string | null = null;
  try {
    testDate = getClaimFilingClock().testDate;
  } catch (error) {
    configurationError = error instanceof Error ? error.message : "Claim test date is invalid.";
  }

  if (configurationError) {
    return <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">Claim test-clock configuration error: {configurationError}</p>;
  }
  if (!testDate) return null;

  return (
    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
      Test-only claim filing date: {testDate}. This affects claim-year and filing-deadline checks only;
      actual timestamps and annual-payment verification are unchanged.
    </p>
  );
}
