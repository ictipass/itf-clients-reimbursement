# HQ computation table fidelity

The claim page contains the eleven columns of the supplied computation sheet. It now gives a visible sideways-scroll cue and makes the table keyboard-focusable so the right-hand expenditure, award, and remarks columns are discoverable. The footer shows both the recommended percentage and the corresponding naira amount. The award formula is unchanged: each row's column C is the lower of A and verified B, subject to the 8th-edition overall contribution cap.

Newly archived paid claims capture all eleven HQ row fields, sheet metadata, and reviewer names/times in their immutable payment-packet snapshot. The downloadable packet adds a separate landscape computation-sheet page before the voucher. Previously archived packets remain downloadable, but fields omitted from their old snapshots are labelled `N/A`; the app does not substitute later mutable claim data or an audited award for the historic HQ recommendation. No database migration or new environment variable is needed.

## Staging assessment

1. Open a submitted claim with a prepared HQ computation table as an authorized officer. Scroll the table horizontally (or focus it and use the keyboard) and confirm columns B, C, and Remarks are visible. For each row, check C is the lower of A and B. Confirm the footer displays the percentage and recommended naira amount together.
2. Complete a disposable claim through payment recording and archive it. Download its archived payment packet. Confirm the landscape sheet has all eleven headings, company and payment metadata, each row, the amount in words, percentage and naira recommendation, and preparer/Head of Division details. Confirm the voucher and evidence index remain present.
3. If staging has an archived packet from before this change, download it. It must still open; historically uncaptured column values should say `N/A`, not appear as invented values.
4. Compare a claim subject to the 50% cap. The sheet must show the cap adjustment separately while its final recommendation stays at the policy-capped value.

Audit-versus-FSD discrepancy reconciliation is a separate workflow slice. This change does not alter the current decision routing or automatically reconcile differing calculation snapshots.
