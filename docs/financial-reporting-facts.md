# Financial reporting facts

This is the reporting contract for the management dashboard and the starting point for extended analytics. The reporting year is interpreted per measure; it is not one universal claim date.

| Measure | Meaning | Year basis |
| --- | --- | --- |
| Claim/training year | `ReimbursementClaim.claimYear` is the year the training took place. A 2026 training claim is normally submitted in 2027. | Training year |
| Active claim requests | Sum of employer `claimedAmount` on submitted, in-review, correction-requested or approved claims. Draft, rejected and archived claims are excluded. | Training year |
| Current review amount | Sum of `claimRecommendedAmount` on those active claims. It may change during review and is **not** a final award. | Training year |
| DG-approved, not paid | Gross recommended award on active claims with a `PAYMENT_APPROVED` sign-off and no `paidAt`. It is before WHT and Tax Off. | Training year |
| Recorded paid claim | Payment handoff is `PAID` and `paidAt` is present. `SETTLED` workflow status is not required: successful current payments move directly to `ARCHIVED`. | UTC year of `paidAt` |
| Gross award on paid claims | Sum of `claimRecommendedAmount` for recorded paid claims. | UTC payment year |
| Confirmed deductions | Sum of WHT plus Tax Off for paid claims with a valid, complete award/deduction breakdown. | UTC payment year |
| Confirmed net paid | Gross award less WHT and Tax Off **for those complete paid records only**. Paid records with missing or invalid breakdowns are counted and flagged, never silently assumed to have zero deductions. | UTC payment year |
| Archived claims | Count of claims with status `ARCHIVED`, using `archivedAt`. This is a document/workflow count, not proof of a bank settlement. | UTC archive year |
| Paid registration invoices | Sum of `ContributionInvoice.amount` where status is `PAID`. An assessment/recommendation is not cash received. | Payment year from `paidAt` |
| Annual paid contribution | Sum of `ComplianceYear.amountPaid` on approved annual compliance records. It is a recorded/approved compliance value, not a bank reconciliation ledger. | Compliance year |

The dashboard does not combine registration payment-year receipts with compliance-year amounts into one “total revenue” number. Those year bases differ. Amounts are stored as two-decimal PostgreSQL numerics; aggregation is performed in PostgreSQL before conversion for dashboard display. No partial-payment or reversal ledger exists yet; those require an approved finance contract before “net paid” can be treated as fully bank-reconciled cash.

Area Office claim grouping currently uses the company's **current** `areaOfficeId`, including an unassigned bucket. It does not assert the office that handled a historic claim. The archive reliability slice must preserve original-office attribution. The statistics page labels this limitation.

## Assessment

On `/management`, select a training/payment year and an Area Office. Verify an active claim appears in the training-year request and review figures; after DG approval it appears in gross approved-outstanding; after the RSA records payment it disappears from outstanding and appears in paid and archive figures for the **payment year**. Confirm the paid figure equals the e-payment schedule's payable amount, not the gross award. A paid legacy record without confirmed WHT and Tax Off should raise a reconciliation warning and not inflate confirmed net paid. Check HQ claim-payment totals against the office breakdown, including inactive or unassigned offices.

The isolated database test `integration/claim-reporting.test.ts` exercises these transitions with fixed dates and deductions; it runs through `npm run test:integration` only against the safeguarded local `itf_reimbursement_ci` database or in the CI PostgreSQL job. Never point integration tests at staging or production.
