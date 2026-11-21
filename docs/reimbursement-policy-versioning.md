# Reimbursement policy editions

The 8th Revised Reimbursement Edition is the only implemented calculation. The application already stores its edition on each claim and on Area Office, HQ and Audit calculation snapshots. Those saved editions are not changed when a workspace selects a different active edition.

The policy activation ledger added in this slice records the workspace, previous and selected editions, exact calculator implementation key, formal approval reference, authenticated administrator and activation time. An audit event is written in the same database transaction. An unrecorded 8th-edition baseline remains active for existing workspaces; administrators may record its formal approval without recalculating or modifying any claim. The Settings → Claims form does not offer an unimplemented edition.

Before activating a future edition:

1. Obtain the formally approved edition, effective-date rules and full award tables. Decide whether the edition applies at claim creation or by training year; the current cutover rule is **new claims only**.
2. Add a distinct `ReimbursementPolicyEdition` enum value and database migration. Do not change the meaning of `EIGHTH_REVISED` or reuse its implementation key.
3. Implement the edition's calculator branch and review all other policy-dependent formulas and display labels, including the HQ computation-table cap and archive packet. Add regression tests for both editions and each officer's calculation path.
4. Add the edition to the supported registry with its own implementation key, then deploy the code and migration before activating it in Settings → Claims with the formal approval reference.
5. Test a claim created before and after activation. The older claim must continue using its original edition through Area Office, HQ, Audit and archive. Record the activation and rollback procedure before production cutover.

Do not activate a new edition by editing `Workspace.activeReimbursementEdition` in the database. The approved activation action is the only supported path; it verifies the administrator's active workspace assignment and writes an auditable record.
