# Development annual eligibility API

This adapter lets the Reimbursement mode exercise annual compliance checks while the existing
compliance platform's production API contract is being agreed. It is available only when
`NODE_ENV=development`. It does not issue compliance certificates or accept contribution payments.

Vercel Preview staging uses direct test records instead of this loopback HTTP endpoint. See
[Staging Scheduler and Production Checklist](staging-scheduler-and-production-checklist.md).

## Local setup

1. Apply the migration and regenerate the client if this database has not been updated:

   ```cmd
   npx prisma migrate deploy
   npx prisma generate
   ```

2. Set a strong `ELIGIBILITY_DEV_API_SECRET` in `.env`. If it is absent, the existing `CRON_SECRET`
   is used for local development. Restart the development server after changing `.env`.
3. In **Settings → Contribution operating model**, choose **Reimbursement** and save the local
   endpoint, normally `http://127.0.0.1:3000/api/development/eligibility`. Change the port if
   the local server is running on another port.
4. Use **Check API availability**, then create a test result for an ITF number and training year.
   Mark payment settled, enter a positive paid amount, and mark the certificate issued with a
   certificate number to make that year eligible.
5. Add the employer company with the same ITF number. Starting a Training Plan checks the API
   automatically. Its detail page shows the stored result.

## Response contract

`GET /api/development/eligibility?workspaceId=...&itfEmployerNumber=...&year=2025` requires
`Authorization: Bearer <ELIGIBILITY_DEV_API_SECRET>` (or the local `CRON_SECRET` fallback).
It returns:

```json
{
  "itfEmployerNumber": "ITF-123",
  "year": 2025,
  "paymentSettled": true,
  "contributionPaid": "100000.00",
  "certificateIssued": true,
  "certificateNumber": "COC-2025-123"
}
```

Eligibility is granted only when the ITF number and year match the request, payment is settled,
the paid amount is positive, and a certificate number has been issued. A missing test entry is
ineligible. An unavailable endpoint or malformed response leaves the check **pending**. A
pending Training Plan may be prepared and submitted, but cannot be approved. Claims for training
in 2025 may first be created in 2026; claim approval and payment require a fresh eligible check.

## Pending checks

The admin page has **Check pending companies now**. A scheduler can also call the secret-protected
route `GET /api/cron/annual-eligibility` with `Authorization: Bearer <CRON_SECRET>`. It retries up to
50 pending company/year checks per invocation. Schedule this route on the deployment platform;
local Next.js development does not run cron jobs by itself.

The development endpoint accepts only loopback URLs entered in admin settings. A production
integration with the existing compliance platform will need its own authenticated adapter and
approved API contract before Reimbursement mode can be used in production.
