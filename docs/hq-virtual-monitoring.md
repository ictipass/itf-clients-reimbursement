# Headquarters virtual monitoring

Approved local online training now creates Form 6B monitoring at the HQ Reimbursement Officer desk. The HQ RO records findings and evidence, then sends the report to the Head of Reimbursement Division. The Head accepts or rejects with a reason, or returns it to the HQ RO. DFSD releases the decision to the employer or returns it to the Head for reconsideration. Physical training retains the existing Area Office RO → HOT → AM route.

The Monitoring navigation and calendar are available to these three HQ roles. The calendar lists virtual training across Area Offices; Area Office calendars and dashboard counts list only physical monitoring in their assigned offices. The calendar feed likewise separates HQ virtual and Area Office physical entries. A linked approved Form 4A opens read-only for HQ monitoring staff. No new environment variable is required.

Deploy the migration before testing the application. It reassigns open virtual monitoring records and their open work items to the corresponding HQ desks, including reports already with HOT or AM. Completed decisions are not rewritten; their historic Area Office decision trail remains intact, while the virtual record is available in the HQ calendar. No employer upload is moved or deleted.

## Staging assessment

1. Apply the migration to the staging database and deploy the matching code.
2. Approve one local online Form 4A and one physical Form 4A. Check that the online monitoring entry appears in the HQ RO calendar and work queue, while the physical entry appears only in the assigned Area Office calendar and work queue.
3. Open the online record as HQ RO, upload monitoring evidence, record an evaluation, and submit it. Confirm the Head of Reimbursement Division receives it, then accepts or rejects it with a reason. Have DFSD release it and confirm the employer sees the feedback. Repeat once using a return-for-correction action.
4. Confirm an Area Office officer cannot open or act on the virtual record, an HQ monitoring officer cannot open or act on the physical record, and an officer redeployed out of their Area Office cannot still see its physical record.
5. Open the virtual record's Form 4A link as an HQ monitoring officer. Confirm it is readable but has no training-approval edit or routing controls.
6. If staging has a previously open virtual monitoring entry, confirm it moved to the equivalent HQ desk and did not disappear from the work queue.

The HQ RO work queue is shared by that role; named officer assignment for virtual monitoring is not part of this slice. The transaction prevents two simultaneous routing actions from both succeeding, but editing fields on a shared draft is not exclusively locked to one HQ RO.
