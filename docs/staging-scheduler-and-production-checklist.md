# Staging scheduler test and production checklist

## Deployment model

Staging is a Vercel **Preview** deployment. Vercel's `vercel.json` cron schedule runs only
against the **Production** deployment of the Vercel project. On Hobby, each configured job can
run at most once daily; execution time is not exact. This app schedules eligibility retries at
03:00 UTC (04:00 Africa/Lagos) and workflow-email dispatch at 03:15 UTC (04:15 Africa/Lagos).
The schedules do not run on staging Preview. They are harmless until the Production environment
sets `SCHEDULED_JOBS_ENABLED=true` and `CRON_SECRET`.

System administrators can run either job on **Settings → Scheduled jobs** in Preview or
Production, independent of `SCHEDULED_JOBS_ENABLED`. Eligibility checks up to 50 pending
company/year records. Workflow-email dispatch processes up to 50 open high-priority work items
and can send real emails. The buttons act on the deployment's database; never point Preview at
Production data. The cron HTTP routes remain protected by `CRON_SECRET`.

## Preview staging setup and assessment

1. In the Vercel project, give **Preview** its own PostgreSQL database, `NEXTAUTH_SECRET`,
   `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, storage, and email settings. Apply migrations with
   `npx prisma migrate deploy` to that database. Do not copy Production secrets or data.
2. For the temporary test provider, set `ELIGIBILITY_PROVIDER=TEST_RECORDS` in **Preview only**.
   This reads the admin-created test results directly from Preview's database. No loopback URL
   or development API secret is needed in Preview. The test-record control is unavailable on
   Vercel Production, even if that value is accidentally set there.
3. In **Settings → Contribution operating model**, select Reimbursement, create a test result
   for a specific ITF number and training year, and onboard a company with the same ITF number.
   Check that verification returns eligible only for settled positive payment plus an issued
   certificate number; otherwise it returns ineligible.
4. To test a pending retry, first set Preview `ELIGIBILITY_PROVIDER=REAL_API` and redeploy.
   Initiate an eligibility check for the onboarded company; with no real adapter it must stay
   **PENDING** and approval must be blocked. Switch Preview back to `TEST_RECORDS`, redeploy,
   then use **Settings → Scheduled jobs → Run eligibility retry**. Confirm the checked count and
   the updated company/year status. This is a manual Preview test, not proof of automatic cron.
5. As a system admin, use **Run email dispatch** only with test recipients in the Preview
   database. Confirm the processed/delivered counts and delivery-attempt records. Test the
   protected cron routes separately: without a bearer secret they must return 401. A request
   with `Authorization: Bearer <CRON_SECRET>` returns `skipped: true` until
   `SCHEDULED_JOBS_ENABLED=true` in that deployment.
6. Check Vercel function logs, database records, and the audit log after each manual run.
   The Preview deployment will not acquire a daily Vercel cron merely by having `vercel.json`.

`ELIGIBILITY_PROVIDER=REAL_API` is currently a **fail-closed placeholder**, not an integration.
The current local HTTP development API remains restricted to `NODE_ENV=development`.

## Production go-live checklist

### Deployment and data

- [ ] Confirm who owns the Vercel project, production domain, DNS, deployment permissions,
      incident contact, and rollback authority; keep Preview and Production resources separate.
- [ ] Set the Vercel project root to this app, use a supported Node version, and verify the
      `prisma generate && next build` build and deployment health.
- [ ] Provision production PostgreSQL with TLS, restricted access, backups/restore testing,
      and connection capacity appropriate to serverless functions. For Prisma Postgres, set
      `DATABASE_URL` to the pooled hostname and `DIRECT_URL` to the direct hostname in each
      Vercel environment. Keep `DATABASE_POOL_MAX=1` on Vercel unless capacity testing
      justifies a larger per-instance pool. Run
      `npx prisma migrate deploy` against **production** in a controlled deployment step.
- [ ] Set strong, unique `NEXTAUTH_SECRET`, canonical HTTPS `NEXTAUTH_URL`, and
      `NEXT_PUBLIC_APP_URL`; configure Google OAuth callback/origin if Google sign-in is used.
- [ ] Provision private persistent object storage (`STORAGE_PROVIDER=vercel_blob` or `s3`),
      its credentials and lifecycle/backups. Do not use local disk for production evidence.
- [ ] Migrate and verify all legacy `LOCAL` document records before relying on them in Vercel.
      Complete direct-to-storage upload and large-download work for the current 10 MB file
      contract; hosted adapters alone do not bypass Vercel's 4.5 MB function payload limit.
- [ ] Configure Upstash Redis credentials for shared rate limiting and verify behaviour across
      multiple Vercel instances.

### Business and integration gates

- [ ] Confirm the operating mode and enforce it across all pages, actions, APIs, and exports.
      Reimbursement-mode compliance/registration enforcement remains an unfinished slice.
- [ ] Obtain the real compliance API contract, authentication, endpoint, network allowlist,
      response semantics, rate limits, outage policy, and test credentials. Implement and test
      the `REAL_API` adapter before using Reimbursement mode with real employers. The current
      `REAL_API` setting intentionally leaves checks pending and blocks approval.
- [ ] Ensure `ELIGIBILITY_PROVIDER=TEST_RECORDS` is **not** set in Production. Validate annual
      year matching, payment settlement/amount, certificate issuance, pending retries, and
      approval/payment gates end to end against the real provider.
- [ ] If Integrated mode is used, provision and test Remita credentials, callback/status flows,
      number registries, certificate templates/signatures, and BPP verification integration.
      Do not assume these are production-ready merely because local workflows exist.
- [ ] Approve policy for claim year, filing deadlines, reimbursement rate, review authority,
      exceptions, audit evidence, and production data retention.

### Security and operations

- [ ] Configure `EMAIL_DELIVERY_MODE=resend`, `RESEND_API_KEY`, and a verified-domain
      `EMAIL_FROM`; test invitations, password recovery, and workflow notifications.
- [ ] Configure a real malware scanning service or quarantine/manual review for uploads.
      The current local scanner is a development heuristic, not production antivirus.
- [ ] Rotate and scope all secrets. Set a unique `CRON_SECRET` (at least 16 random characters)
      only in the intended deployment environments. Never commit `.env` files.
- [ ] Review role-based access, administrator MFA/identity controls, audit logging, privacy,
      penetration testing, accessibility, and backup/restore procedures.
- [ ] Add error monitoring and alerts for pending eligibility backlog, cron failures, email
      delivery failures, payment reconciliation, and storage/database errors.
- [ ] Prevent overlapping manual/automatic email runs (for example with a durable lease) before
      enabling automation; the current dispatcher has no cross-invocation lock and simultaneous
      runs could send duplicate notifications.
- [ ] Only after production data and integrations are ready, set
      `SCHEDULED_JOBS_ENABLED=true` in Vercel **Production**, redeploy, and verify both jobs in
      Vercel Settings → Cron Jobs and function logs. On Hobby they run daily; the admin can
      trigger additional runs. Test the manual buttons before enabling automatic runs.
- [ ] Conduct a staging-to-production rehearsal with separate data, sign-off, rollback plan,
      and post-release monitoring. Do not release Reimbursement mode until the real eligibility
      provider and remaining mode enforcement are completed.
