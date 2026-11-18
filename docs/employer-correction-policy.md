# Employer correction policy

An officer's employer-correction request on a registration, annual compliance return, or training-plan package is limited to organizational details. The request must state the details to correct. The employer administrator edits the company profile on `/registry/[companyId]`, and the change history records the previous and new values. If a legacy registration number itself was the problem, it is edited in that same profile correction form. Registration type, office, contribution and claim figures are not part of this correction form.

The employer can resubmit the returned workflow only after saving a company-detail change later than its latest correction request. Resubmission sends the unchanged package back to the reviewer. Original training-plan submission date and timeliness score are retained.

Submitted training-plan documents and imported rows, Form 4A details/participants/evidence, claim evidence, company supporting files, and annual-compliance evidence cannot be replaced or deleted by employers during correction. These checks are enforced in services, not only by hiding buttons. Draft uploads and editing remain available before first submission. Staff evidence required for downstream processing remains a separate authorized path.

The registration contribution-payment receipt review is a distinct payment-validation process: the Area Manager may still return a rejected receipt for a new payment-evidence submission. That exception does **not** reopen registration supporting files, training plans, or claims. Deciding whether payment-receipt rejection should become final, with a separate appeal/remediation path, requires a separate product decision.

## Manual assessment

1. As an employer, create a draft training plan, Form 4A, and claim; confirm normal draft uploads and edits still work.
2. Submit the plan, have an officer request organizational-detail correction with a note, and sign back in as the employer. Confirm the company-profile correction form appears, while plan-row import and evidence replacement do not.
3. Try a direct POST to the plan-upload endpoint or a submitted-document deletion action. Confirm the server refuses both. Repeat for submitted Form 4A, compliance evidence, and claim evidence.
4. Attempt resubmission before saving a company change; confirm it is refused. Save a valid company detail, confirm the correction history records old and new values, then resubmit and confirm the packet returns to the reviewing desk without changing the original plan submission date or timeliness score.
5. Check that a draft and a submitted package in a different company cannot be edited using the correction form; authorization and open-correction state must both be present.
