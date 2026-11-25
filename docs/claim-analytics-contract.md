# FSD claim analytics contract (slices 04–05)

The server-side reporting and authorization layer powers `/analytics` and `/analytics/export`. `getClaimAnalyticsSummary` returns totals by company, Area Office and year, and `listClaimAnalyticsDetails` returns a privacy-minimized, cursor-paged claim list. Every request rechecks the current user and active role membership. Data is confined to the member's workspace and `HOT` record tier. No bank account, participant, or staff-list fields are returned.

## Who sees what

- Director FSD: submitted, reviewed, rejected, paid and archived claim facts across their active workspace. Employer drafts are never included.
- Head of Reimbursement Division and named HQ RO: only claims that have reached their role (and, for a named assignment, the selected officer), plus archived claims in their active workspace. A claim cannot appear merely because it was submitted to the Area Office or because another HQ RO received it. The owner confirmed this restricted HQ RO scope on 24 November 2026.
- Users without an active account and an active matching role membership receive no analytics. Area Office staff, employer roles and other HQ roles are not granted this FSD-only service.

This mirrors the existing archive rule permitting FSD roles to retrieve historical paid packets. A transferred/deactivated officer loses access to current work through membership validation. An archived claim is grouped by its captured original Area Office; an unresolved legacy office is labeled rather than silently mapped to the company's current office. Active claims use the Area Office captured at submission, falling back to current office only for older records that lack the captured field.

The company breakdown groups by stable company ID and labels the company with its current legal name so a rename does not split its totals. Archived detail rows still display the frozen historical name from the payment packet.

## Filters and figures

Filters accept up to 50 company IDs, Area Office IDs, training years, submission years, payment years, statuses, and supported policy editions. These filters are intersected. An explicitly empty list returns no claims, not all claims. Training year is `claimYear`; submission and payment years use UTC timestamps. Selecting a payment year excludes claims without a payment date. The year grouping is separately chosen as training, submission or payment year, so a 2025 training paid in 2026 appears in the appropriate year under each view.

Figures follow [financial reporting facts](financial-reporting-facts.md):

| Figure | Meaning |
| --- | --- |
| Submitted claimed gross | Employer `claimedAmount` on non-draft, non-rejected claims in the filter. It is a demand figure, not an award. |
| Active reviewed gross | Current recommended amount on submitted, in-review, correction-requested or approved claims; not a final award. |
| Approved outstanding gross | Current recommended amount on those active claims with DG payment approval and no `paidAt`; before deductions. |
| Paid gross | Recommended award on claims with `PAID` handoff and `paidAt`. |
| Confirmed deductions and net paid | WHT plus Tax Off and gross less both deductions, only where the paid claim has a complete positive, valid breakdown. Missing/invalid breakdowns are counted separately; they are never treated as zero deductions. |
| Archived count | Claims marked `ARCHIVED`; archive status alone is not proof of payment. |

Amounts are returned as exact two-decimal strings from PostgreSQL aggregation, not floating-point display totals. The detail service returns no more than 500 rows per call, ordered by claim ID with a next cursor. This lets slice 05 stream large authorized exports in chunks without holding all rows in memory. `paidNetConfirmed` is a recorded application figure, not yet a bank-reconciled settlement ledger. Partial payments and reversals remain unmodeled pending the outgoing-payment contract.

## Screens and exports

The Claim Analytics navigation entry is shown only to Director FSD, Head of Reimbursement Division and HQ reimbursement officers. The filter form accepts one or many companies and Area Offices, comma-separated training/submission/payment years, claim status, policy edition and year grouping. Company selector options themselves come from authorized claim rows; searching does not reveal unreached companies. The page shows totals, year/office comparisons, a capped company comparison and 50-row claim pages. Only archived details link to the read-only claim packet, because the Director's national summary can include active claims not yet routed to their desk.

Those same three roles may download only their scoped records in CSV or Excel format, up to 5,000 claims per report. The server repeats role/membership checks; hiding a button is not the authorization control. Both formats contain a report ID, generation time in UTC, applied filters, metric definitions and privacy-minimized claim rows. An audit event with report ID, actor, format, filters, time and count must be written before the file is served; an audit-write failure prevents delivery. Excel also has total, year, original-office and company breakdown sheets. CSV neutralizes formula-like company/reference values, and Excel writes them as text. No bank account, staff number, participant, email or phone fields are exported.

The generation timestamp is **not** a point-in-time database snapshot: aggregates and cursor pages are separate queries. A change that alters the detail row count causes the export to fail and ask for a retry, but an in-place amount edit during generation can still produce mixed-time facts. These exports are labeled operational, not official financial statements. Finance must sign off the metric dictionary and an appropriate snapshot/signature policy before official use. There is no scheduled report cadence in this slice. The 5,000-row limit and role set are conservative implementation defaults pending ITF policy approval.

## Verification and next step

The pure unit tests check role/filter boundaries, report limit, provenance, CSV injection safety and Excel cell types. `integration/claim-analytics.test.ts` uses the guarded local `itf_reimbursement_ci` database to prove workspace isolation, selector privacy, pre-routing privacy, original-office grouping, UTC payment/training-year separation, gross/net totals, and export of more than 1,000 cursor-paged rows. Do not point the integration test at development, staging or production data. In staging, use `/analytics` and both export formats against known claims; there is no new schema migration or environment variable for slice 05.

The metric definitions here are the implementation baseline; Finance should sign them off before using exports as official statements. Confirm whether the existing `/management` dashboard should adopt historical-office attribution rather than its current-office grouping.
