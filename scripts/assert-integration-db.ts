const databaseUrl = process.env.TEST_DATABASE_URL;
const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.DIRECT_URL;

if (!databaseUrl || !runtimeUrl || !migrationUrl ||
  databaseUrl !== runtimeUrl || databaseUrl !== migrationUrl) {
  throw new Error("Integration tests require identical, explicit TEST_DATABASE_URL, DATABASE_URL, and DIRECT_URL values.");
}

let parsed: URL;
try {
  parsed = new URL(databaseUrl);
} catch {
  throw new Error("TEST_DATABASE_URL is not a valid PostgreSQL URL.");
}

if (!["postgresql:", "postgres:"].includes(parsed.protocol) ||
  !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
  parsed.pathname !== "/itf_reimbursement_ci" ||
  parsed.search || parsed.hash) {
  throw new Error("Integration tests may use only the local itf_reimbursement_ci database.");
}

if (process.env.VERCEL_ENV !== "preview" ||
  process.env.ELIGIBILITY_PROVIDER !== "TEST_RECORDS" ||
  process.env.CLAIM_TEST_AS_OF !== "2027-01-15") {
  throw new Error("Integration tests require Preview test eligibility and the fixed 2027-01-15 claim clock.");
}

console.log("Isolated integration database and test eligibility configuration confirmed.");
