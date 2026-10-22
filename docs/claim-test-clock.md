# Claim test clock

Claims for training held in a year are first filed the following year. To test the 2026 claim workflow before 2027, set `CLAIM_TEST_AS_OF=2027-01-15` in **local development** or the Vercel **Preview** environment. Use a separate staging database with test companies and claims.

In Command Prompt, for a single local session:

```cmd
set CLAIM_TEST_AS_OF=2027-01-15
npm run dev
```

Alternatively, add `CLAIM_TEST_AS_OF=2027-01-15` to the local `.env` file and restart the development server. For Vercel staging, add the variable to the project's **Preview** environment and redeploy the Preview deployment. Do not add it to Production.

The setting accepts a strict `YYYY-MM-DD` date. It changes only the effective date used when **creating a claim** to check the earliest filing year and 30 June deadline. It does not alter training dates, actual database timestamps, annual-payment eligibility checks, or the date used in claim references. A banner on the Claims list and detail pages shows when the test clock is active. The application ignores this setting outside local development and Vercel Preview, including Vercel Production.

To test a 2026 claim, use an approved and monitored 2026 training request and ensure the company's **2026 annual payment** is positively verified (for example, with Preview test eligibility records). Set the test date in January 2027, create and process the claim, then remove the variable and redeploy Preview when finished. Never move real training dates or use production data for this test.
