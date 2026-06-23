# Developer Maintenance and Extension Guide

Last reviewed: 22 June 2026

## Purpose

This guide helps future developers safely maintain, extend, and adapt the ITF Integrated
Contribution and Reimbursement Platform as policies change. It is organized by stable
architectural boundaries rather than by a single implementation timeline.

## Technology Baseline

- Next.js 16 App Router
- React 19
- TypeScript
- Prisma 7 with PostgreSQL
- NextAuth/Auth.js v4 integration
- Argon2 portal-password hashing
- Tailwind CSS
- Private object storage through local, Vercel Blob, or S3 adapters
- Resend transactional email through HTTPS
- Upstash Redis optional shared rate limiting
- `pdf-lib` for certificate generation
- Node test runner through `tsx`

Before changing Next.js behavior, read the relevant local documentation under
`node_modules/next/dist/docs/`.

## Local Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev:webpack
```

Before running `npm run db:seed`, set `SYSTEM_ADMIN_INITIAL_PASSWORD` in the local environment.
The seed creates only the first system administrator and marks that account for password change.

Use Webpack locally on the current development machine because Turbopack has previously hung during
route compilation.

## Verification Commands

```bash
npm test
npm run verify
npx prisma migrate status
```

`npm run verify` validates Prisma, TypeScript, ESLint, and the Next.js Webpack production build.

## Repository Map

| Location | Responsibility |
| --- | --- |
| `app/` | Pages, layouts, Server Actions, and Route Handlers |
| `lib/` | Domain services, authorization, integrations, validation, and infrastructure adapters |
| `prisma/schema.prisma` | Transactional domain schema |
| `prisma/migrations/` | Immutable ordered database migration history |
| `prisma/seed.ts` | Foundation and development seed data |
| `tests/` | Automated unit tests; integration tests should be added here |
| `docs/` | Architecture, operations, workflows, and support documentation |
| `data/` | Source/reference data used for seeding |
| `storage/` | Local private development storage, excluded from public serving |
| `proxy.ts` | Next.js 16 route-level authentication and feature access guard |

## Core Architectural Rules

### Identity Is Separate From Access

`User` represents a person. `Membership` grants that person a role in a Workspace, employer
organization, Headquarters, or Area Office.

- Never delete a user merely because employment or assignment changes.
- Deactivate the membership or account.
- Only active users and active memberships authorize access.
- Preserve actor, reason, and timestamps for access changes.

### Employer Data Must Be Tenant-Isolated

Every employer read and mutation must be constrained by an active employer membership and the
selected active organization.

Relevant modules:

- `lib/organization-context.ts`
- `lib/registry.ts`
- `lib/employer-members.ts`
- `lib/membership-lifecycle.ts`

Never trust an organization or company ID received from a browser without checking the signed-in
user's active membership.

### Role Checks and Scope Checks Are Both Required

RBAC answers whether a role may perform a type of action. Membership scope answers where that
action may be performed.

- Permission definitions: `lib/rbac.ts`
- Feature/page gates: `lib/feature-gates.ts`
- Navigation visibility: `lib/navigation.ts`
- Route-level guard: `proxy.ts`
- Domain services: final authority checks

Hiding a button is not authorization. Every mutation must check authority inside its server-side
domain service.

### Workflow State Must Be Auditable

Use:

- Workflow status and current-desk fields
- `Decision` for formal workflow decisions
- `WorkItem` for attention/action/awareness
- `AuditEvent` for sensitive or administrative changes
- `Comment` for contextual communication

Do not silently update a workflow status without recording the responsible actor and reason where
the change represents a business decision.

### Business Records Are Soft-Deactivated

Institutional records should not normally be hard-deleted. Prefer:

- `isActive`
- lifecycle status
- `recordTier`
- `deactivatedAt`
- `revokedAt`
- audit events

## Domain Model Overview

### Workspace and Access

`Workspace`, `Organization`, `AreaOffice`, `User`, `Membership`, and `OrganizationInvitation`
represent the identity and access boundary.

### Employer Registration

`Company`, `RegistrationApplication`, and `RegistrationContributionAssessment` represent one-time
registration and contribution recommendation.

### Annual Compliance

`ComplianceYear` and `ComplianceCertificate` represent the yearly compliance cycle and certificate.

### Training

`TrainingPlanSubmission`, `TrainingPlanPersonnel`, `TrainingPlanLineItem`, `TrainingRequest`,
`TrainingParticipant`, `TrainingMonitoringRecord`, and `TrainingMonitoringEvaluation` represent the
training lifecycle. A `TrainingRequest` may link to an approved plan line or be marked `isAdHoc`
with a required justification. Delivery is classified as local physical or local online. Online
access details remain editable only while the request is at the employer desk.

Participant training areas are controlled by `getTrainingAreas()` in `lib/training-request.ts`.
Keep UI options and server-side validation sourced from the same list.

### Jurisdiction Changes

`JurisdictionChangeRequest` records employer requests to move a company between Area Offices.
Creation and review authority is implemented in `lib/jurisdiction-change.ts`.

- Employers may create one pending request per company.
- The current Area Manager receives a `JURISDICTION_CHANGE_REVIEW` work item.
- Approval changes `Company.areaOfficeId`; rejection leaves it unchanged.
- Decision resolves the work item.
- Migration backfills attention items for pending requests created before work-item support.

### Personal Preferences and Calendar Feeds

Personal settings are available at `/settings/preferences` to every authenticated user.
Administrative `/settings/*` routes remain separately gated.

`/api/calendar/[token]` exposes a private iCalendar subscription scoped by active employer or ITF
office memberships. Calendar tokens are credentials: never log them, include them in audit
metadata, or expose one user's token to another user.

### Claims

`ReimbursementClaim`, `ReimbursementClaimTraining`, and `ReimbursementClaimLine` currently
represent the claims foundation. `ReimbursementClaimTraining` is the claim-to-training join:
one claim can package multiple approved and monitored training requests, while the unique
`trainingRequestId` prevents the same training from being used by another claim. Expect this area
to expand after the final claims/payment SOP.

### Governance and Supporting Infrastructure

`Document`, `Decision`, `Comment`, `WorkItem`, `AuditEvent`, `ManagedRegistrationNumber`,
`CertificateTemplate`, `SignatureAsset`, and `EmailDeliveryAttempt`.

`User.isManagement` controls management-summary eligibility. Scope remains membership-derived:
Headquarters management receives national scope; Area Office management remains restricted to its
assigned office.

## Implementing a New Workflow

Follow this sequence:

1. Obtain an approved written workflow and identify unresolved policy questions.
2. Define actors, preconditions, states, desks, transitions, correction paths, rejection paths, and
   outputs.
3. Add or update Prisma models and enums.
4. Generate a migration and inspect its SQL before applying it.
5. Add a domain service in `lib/`; keep business rules out of page components.
6. Enforce role and membership scope in every service method.
7. Add decisions, work items, and audit events.
8. Add Server Actions with Zod validation and friendly redirect/message behavior.
9. Add role-aware pages and navigation.
10. Add automated tests for successful, forbidden, correction, duplicate, and cross-tenant cases.
11. Update the user guide, developer guide, roadmap, and implementation-slice log.

## Workflow Module Template

Use this template in code review and documentation:

```markdown
### Workflow Name

- Policy source:
- Owning module:
- Starting actor:
- Preconditions:
- States/desks:
- Allowed transitions:
- Correction/rejection paths:
- Work items:
- Decisions/audit events:
- Uploaded/generated documents:
- Notifications:
- Authorization rules:
- Tests:
- Open policy questions:
```

## Database and Migration Discipline

- Treat applied migration files as immutable.
- Ensure migration folder names sort in the exact order they must execute.
- Inspect migration SQL before applying.
- Never reset a shared or production database to repair migration history.
- Use `prisma migrate status` before and after migrations.
- Use a shadow database or CI replay to prove that migrations work from an empty database.
- Back up before any high-risk production migration.

The organization-invitation migration history was repaired by ordering table creation before its
index rename. This is a reminder that a development database can succeed while fresh shadow
replay fails if filenames do not reflect actual execution order.

## Authentication and Account Security

- Portal passwords use Argon2.
- Email verification and password-reset tokens are random, hashed, one-time, and expiring.
- Google OAuth identities must have verified emails.
- Production should use Workspace OIDC and centralized MFA.
- Authentication and public endpoints must remain rate limited.
- Account and membership deactivation must immediately remove authorization.

Relevant modules:

- `lib/auth.ts`
- `lib/employer-accounts.ts`
- `lib/password-recovery.ts`
- `lib/profile.ts`
- `lib/rate-limit.ts`
- `lib/audit.ts`

Creating another System Administrator is a two-step process: create the identity in the user
directory, then assign `SYSTEM_ADMIN` as a Headquarters membership. Do not grant administrator
authority implicitly during generic user creation.

## Email and Workflow Notifications

- Delivery adapter: `lib/email.ts`
- Work-item dispatcher: `lib/workflow-email.ts`
- Delivery audit UI: `/settings/email`
- Cron endpoint: `/api/cron/workflow-notifications`

Production requires:

```env
EMAIL_DELIVERY_MODE="resend"
RESEND_API_KEY="..."
EMAIL_FROM="..."
CRON_SECRET="..."
```

Never place private action tokens into email-delivery audit records or logs.

Jurisdiction changes use normal `WorkItem` attention. When adding a new workflow that requires a
badge, update all of:

1. `WorkItemKind`
2. creation and resolution logic
3. module mapping in `lib/attention.ts`
4. migration/backfill behavior for already-open records
5. support documentation and tests

## Documents and Upload Security

Documents are stored privately. Browser access must pass through authenticated routes with strict
response headers.

Relevant modules and documents:

- `lib/storage/`
- `docs/storage.md`
- `docs/upload-security.md`

When adding a document kind:

1. Confirm it is evidence rather than an electronic form.
2. Add the enum value and relation.
3. Define allowed workflow, uploader roles, MIME types, size, and required scan status.
4. Enforce organization/company ownership.
5. Add view, soft-delete, audit, and test coverage.

## Certificate and Numbering Changes

Certificates and managed numbers are policy-controlled assets.

- ITF employer number: one-time registration identity.
- Certificate number: annual compliance identity.
- Historical certificates must retain the design and generated PDF used at issuance.
- New design/signature changes must not rewrite previously generated certificates.

Relevant modules:

- `lib/certificates.ts`
- `lib/managed-numbers.ts`
- certificate and signature settings routes

## Caching and Performance

Cache only stable reference data or carefully scoped aggregates. Never cache tenant-sensitive data
without including all authorization scope in the cache key.

See `docs/caching-strategy.md`.

As volume grows:

- Keep common filters indexed.
- Paginate operational lists.
- Move expensive management aggregates to scheduled summaries or materialized views.
- Implement HOT/WARM/COLD archival only after retention rules are approved.

## Testing Strategy

Current unit tests cover foundational RBAC, management/settings policy, controlled training-area
options, active organization selection, workflow routing, evidence rules, authentication policy,
and email escaping.

Required layers:

1. Unit tests for pure policy and validation functions.
2. Integration tests against a dedicated test PostgreSQL database.
3. Authorization/tenant-isolation regression tests.
4. Browser tests for critical user journeys.
5. Migration replay tests from an empty database.
6. Performance, security, backup/restore, and disaster-recovery exercises.

Never run destructive integration-test cleanup against development or production databases.

## Production Operations

Before production:

- Provision separate development, staging, and production environments.
- Use managed PostgreSQL, private object storage, Redis, verified Resend domain, and production
  malware scanning.
- Add structured logs, traces, metrics, alerts, and error reporting.
- Configure backups and rehearse restores.
- Run penetration, privacy, accessibility, and performance reviews.
- Maintain an incident response and rollback runbook.

## Policy Change Procedure

When management changes a policy:

1. Record the approved policy source and effective date.
2. Identify affected data, workflow states, roles, certificates, reports, and historical records.
3. Decide whether the change applies only to new records or also to existing records.
4. Version policy-sensitive configuration where possible.
5. Create a migration and transition strategy.
6. Add regression tests for old and new behavior.
7. Update user/support documentation before rollout.
8. Use a feature flag or staged rollout for high-risk changes.

## Identity Provisioning Extension Point

`User.authenticationSource` separates `LOCAL`, `GOOGLE`, and future `WORKSPACE_SSO` identities.
Only local identities use `mustChangePassword`. Keep provider-managed password and MFA rules at
the identity provider.

- `lib/officer-provisioning.ts`: password generation, Argon2 hashing, development credentials.
- `lib/user-directory.ts`: atomic user creation/import and local-access reset.
- `lib/email.ts`: welcome delivery through the configured email adapter.
- `lib/authentication-policy.ts`: provider-aware password-change policy.
- `proxy.ts`: first-login protected-route enforcement.

Never persist plaintext passwords in Prisma records, audit metadata, logs, or production files.

## Evidence Immutability

`lib/evidence.ts` is the server-side authority for deletion. UI visibility is only a convenience.
When adding a new evidence-bearing workflow, update `lib/evidence-deletion.ts`, link the workflow
status in the deletion query, and add regression tests before exposing deletion controls.

## Documentation Maintenance

For every completed slice:

- Append the implementation result to `docs/implementation-slices.md`.
- Update the relevant workflow in `docs/user-support-guide.md`.
- Update architecture or extension rules in this guide.
- Update `docs/production-readiness-roadmap.md`.
- Add test instructions and known limitations.

Documentation is part of the definition of done. A workflow or permission change is incomplete
until its user steps, support diagnostics, authorization boundaries, data model, migration impact,
and known limitations are reflected in the relevant Markdown files.

Avoid rewriting whole documents. Edit only the affected module and its cross-references.
