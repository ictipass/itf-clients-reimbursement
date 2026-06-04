# Session Handoff

Last updated: 2026-06-03

## Current State

Development is proceeding slice by slice. The latest recorded workflow slice is:

- Slice 77: Compliance Area Office Visibility Panel

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
