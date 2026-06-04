# Session Handoff

Last updated: 2026-06-03

## Current State

Development is proceeding slice by slice. The latest recorded workflow slice is:

- Slice 92: Training Approval Evidence Upload

Recent completed slices include:

- Slice 55: Compliance-driven registration policy
- Slice 56: Head of Division access to number registry
- Slice 57: Registration submit placement below evidence and compliance cards
- Slice 58: Training Plan compliance gate
- Slice 59: Registration RA direct correction return
- Slice 60: Evidence soft delete
- Slice 61: Registration-to-compliance UX guide and friendly compliance-blocked feedback
- Slice 63: Registered company compliance continuation path
- Slice 64: Legacy registered employer onboarding action
- Slice 65: Area Office scoped legacy employer onboarding for Revenue Accountants
- Slice 66: Employer onboarding type selection for new vs legacy registration submissions
- Slice 67: Legacy employer validation workflow at Revenue Accountant desk
- Slice 68: HQ-only annual compliance review and certificate issuance
- Slice 69: Compliance filing awareness for Area Office and HQ review work queue
- Slice 70: Dashboard distinction between action-required and awareness-only work items
- Slice 71: Current-year compliance gate for Training Plan and L&D submission
- Slice 72: Collapsible compliance year cards on company detail page
- Slice 73: Compliance year pagination on company detail page
- Slice 74: Collapsible Evidence Summary rows on company detail page
- Slice 75: Evidence Summary pagination on company detail page
- Slice 76: Role-specific focus panel on company detail page
- Slice 77: Compliance Area Office visibility panel
- Slice 78: Focused compliance review detail page
- Slice 79: Training Plan/L&D submission list page
- Slice 80: Focused Training Plan/L&D submission detail page
- Slice 81: Training Plan CSV parser preview
- Slice 82: Training Plan CSV import persistence
- Slice 83: Training Approval Request foundation
- Slice 84: Training Approval Request current desk tracking
- Slice 85: Training Approval Request evidence and decision detail page
- Slice 86: HQ Revenue Accountant RBAC cleanup for annual compliance authority
- Slice 87: Shared multi-officer queue labels on dashboard work items
- Slice 88: Explicit Area Manager final approval for Training Plan/L&D submission
- Slice 89: HOT/RO direct Training Plan correction return flow
- Slice 90: Training Approval Request creation from approved Training Plan line items
- Slice 91: Training Approval Request submit and routing detail actions
- Slice 92: Training Approval Request evidence upload
- Slice 93: Training Approval Request direct correction return flow
- Slice 94: Training Monitoring Form 6A/6B foundation
- Slice 95: Training Monitoring evidence and evaluation capture
- Slice 96: Training Monitoring edit form
- Slice 97: Training Monitoring submit and approval flow
- Slice 98: Training Monitoring work queue integration
- Slice 99: Training Approval participant management
- Slice 100: Training Approval completeness validation
- Slice 101: Claims creation from approved Training Approval Requests
- Slice 102: Claim Form 1 foundation
- Slice 103: Claim supporting evidence upload
- Slice 104: Claim Form 1B reviewer recommendation
- Slice 105: Claim Form 2A/2B calculation foundation
- Slice 106-115: production shell, role dashboards, app launcher, and context switcher

## Important Current Rules

- New companies must complete registration before compliance filing.
- Registration completion assigns the ITF employer number and opens the current-year compliance draft.
- Legacy registered employers can be activated by authorized ITF users by recording the existing ITF employer number with an audit note.
- Area Office Revenue Accountants can record legacy ITF employer numbers only for companies in their assigned Area Office.
- Employer-submitted legacy registrations store the claimed ITF number on the registration application until ITF validates it.
- Validating an employer-submitted legacy claim activates the company, records the ITF employer number, and opens the current-year compliance draft.
- Annual compliance review and certificate issuance are restricted to Head of Reimbursement Division, HQ reimbursement/accountant role, and system/workspace administrators.
- Annual compliance submission creates awareness work items for AM, HORIC, and RA in the company's Area Office, plus actionable HQ review items for HOD and HQ reimbursement/accountant role.
- Dashboard attention counts separate action-required items from awareness-only items so Area Office officers can track compliance filings without certificate authority.
- Annual compliance certificates, not registration certificates, are the downloadable certificate path.
- Training Plan and L&D submission requires approved/certified compliance for that training year.
- The company detail page and Training Plan create page use current-year compliance to unlock current-year Training Plan entry.
- Compliance years are displayed as collapsible cards, with the most recent year open by default.
- Compliance years are paginated inside the company detail page using `compliancePage`.
- Company evidence summary rows are collapsible, with document actions inside the expanded row.
- Company evidence summary rows are paginated using `evidencePage`.
- Company detail page shows a role-focus panel so each user understands their expected desk responsibility.
- Compliance card shows Area Office awareness roles separately from HQ certificate action roles.
- Annual compliance years link to `/registry/[companyId]/compliance/[complianceYearId]/review` for focused HQ review.
- `/training-plans` lists Training Plan/L&D submissions with filters by company, year, status, and desk.
- `/training-plans/[submissionId]` shows focused Training Plan personnel, evidence, decisions, and workflow actions.
- `/training-plans/csv-preview` validates and previews Training Plan CSV files in the browser without saving rows.
- Training Plan CSV imports are stored as `TrainingPlanLineItem` rows linked to the submission.
- Training Approval Requests can optionally link back to structured Training Plan line items, and `/training-requests` lists Form 4A request records.
- Training Approval Requests now track `currentDesk` with the Area Office training workflow desk enum.
- `/training-requests/[requestId]` shows Training Approval Request detail, evidence, source Training Plan row, and decision trail.
- Annual compliance review/certificate authority is `HEAD_OF_DIVISION` plus `HQ_REVENUE_ACCOUNTANT`; `HQ_REIMBURSEMENT_OFFICER` remains for reimbursement/claims work.
- Dashboard work items label direct assignment versus shared role/Area Office desk queues.
- Training Plan final approval is an explicit AM transition that sets status `APPROVED` and records `approvedAt`.
- HOT and Area Office Reimbursement Officer can return Training Plan submissions directly to company for correction.
- Approved Training Plan line items can create draft Form 4A Training Approval Requests.
- Training Approval Request detail page can submit and route Form 4A requests through AM/HOT/RO approval desks.
- Training Approval Request evidence uploads are stored as private `Document` rows linked by `trainingRequestId`.
- Area Manager, Head of Training, and Area Office Reimbursement Officer can return Training Approval Requests directly to company for correction.
- Approved Training Approval Requests can open Form 6A or 6B Training Monitoring records.
- `/training-monitoring` lists monitoring records and `/training-monitoring/[recordId]` shows the focused monitoring detail.
- Training Monitoring records can store uploaded evidence and 1-5 evaluation ratings by section/rating area.
- Training Monitoring detail page can edit monitoring date/time, meeting details, and officer signature metadata.
- Training Monitoring records can move through draft/submitted/in-review/approved or changes-requested states.
- Training Monitoring workflow creates dashboard work items for HOT and Area Office Reimbursement Officer queues.
- Training Approval detail page can add, edit, and delete participant rows before employer submission.
- Training Approval submission requires core request fields, at least one participant, and at least one evidence document.
- Employers can create reimbursement claim drafts from approved Form 4A requests with approved monitoring records.
- Claim detail page captures Claim Form 1 employer claim/payment/declaration fields.
- Claim detail page can upload and view claim supporting evidence.
- Claim review roles can record Form 1B eligible/recommended amounts and remarks.
- Claim detail page can create, update, and delete Form 2A/2B calculation rows.
- Dashboard shell now uses a grouped side navbar, account menu, workspace app launcher, and context switcher.
- `/dashboard` now renders focused views for employer, Area Office, HQ reviewer, and system admin roles.
- Uploaded evidence can be soft-deleted from active workflow views while preserving audit history.

## Validation Habit

Recent slices have been checked with:

- `npx prisma generate`
- `npx prisma validate`
- `npx next typegen`
- `npx tsc --noEmit`
- `npm run lint`

If resuming after switching projects, start with:

```bash
git status --short
npx prisma validate
npx next typegen
npx tsc --noEmit
```

Then continue from the next slice in `docs/implementation-slices.md`.
