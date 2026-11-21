# Claim integration test

The `integration` CI job starts its own disposable PostgreSQL service, replays all
Prisma migrations, and exercises the real claim services against that database.
It does not connect to staging or production, and does not need their credentials.

The first scenario covers approved training and monitoring, eligibility and annual
payment gates, employer calculation, a pinned reimbursement-policy edition,
workspace and Area Office boundaries, named Area Office RO routing, and the RO's
reviewed calculation. It does not yet exercise a browser, the entire HQ/finance
workflow, file storage, or external payment/compliance APIs.

## Running locally (Command Prompt)

Use a **disposable local PostgreSQL database** named exactly
`itf_reimbursement_ci`. Never point these commands at your normal development,
staging, or production database: migrations run and test records are inserted.
For example, after creating that empty database on PostgreSQL listening on
`127.0.0.1:5432`, run from the reimbursement app directory:

```cmd
set "TEST_DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/itf_reimbursement_ci"
set "DATABASE_URL=%TEST_DATABASE_URL%"
set "DIRECT_URL=%TEST_DATABASE_URL%"
set "VERCEL_ENV=preview"
set "ELIGIBILITY_PROVIDER=TEST_RECORDS"
set "CLAIM_TEST_AS_OF=2027-01-15"
npm run db:test:migrate
npm run test:integration
```

Replace `ci:ci` only with credentials for that disposable local database.
`db:test:migrate` and `test:integration` both enforce the exact database name,
loopback host, matching connection URLs, preview test provider, and fixed claim
clock before writing. Run the test on a fresh database when you want a clean
baseline. The GitHub Actions job supplies and discards its own database.

For a staging assessment, check that both `verify` and `integration` CI jobs are
green on the proposed commit, then manually exercise a claim in staging with
the staging provider/configuration. The automated test cannot prove the deployed
environment's external integrations or browser behavior.
