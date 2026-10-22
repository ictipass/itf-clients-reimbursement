type ClaimClockEnvironment = Partial<Record<"NODE_ENV" | "VERCEL_ENV" | "CLAIM_TEST_AS_OF", string>>;

export function getClaimFilingClock(
  environment: ClaimClockEnvironment = process.env,
  realNow = new Date(),
) {
  const configuredDate = environment.CLAIM_TEST_AS_OF?.trim();
  const testEnvironment = environment.VERCEL_ENV !== "production" &&
    (environment.NODE_ENV === "development" || environment.VERCEL_ENV === "preview");

  if (!configuredDate || !testEnvironment) {
    return { now: realNow, testDate: null };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(configuredDate);
  if (!match) {
    throw new Error("CLAIM_TEST_AS_OF must be a valid YYYY-MM-DD date.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const effectiveDate = new Date(Date.UTC(year, month - 1, day, 12));
  if (year < 2000 || year > 2100 || effectiveDate.getUTCFullYear() !== year ||
    effectiveDate.getUTCMonth() !== month - 1 || effectiveDate.getUTCDate() !== day) {
    throw new Error("CLAIM_TEST_AS_OF must be a valid YYYY-MM-DD date.");
  }

  return { now: effectiveDate, testDate: configuredDate };
}
