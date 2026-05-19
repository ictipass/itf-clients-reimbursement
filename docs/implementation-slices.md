# ITF Reimbursement Gateway Implementation Slices

This project is being built one reviewable slice at a time. After each slice, implementation pauses for review before the next slice begins.

Each slice should answer:

- What was implemented
- Files changed or created
- Real-world use case
- How to test it
- Brief commit message

## Local Development Note

Use the Webpack dev server locally:

```bash
npm run dev:webpack
```

The default Next.js 16 dev server uses Turbopack. On this machine, Turbopack hung during first route compilation and caused the system to become unresponsive. Webpack successfully served `http://localhost:3000`.

## Completed Slices

### Slice 1: Foundation Packages

Status: implemented, pending review/commit.

Added authentication and database packages:

- `next-auth`
- `@prisma/client`
- `@prisma/adapter-pg`
- `pg`
- `prisma`

Real-world use case: prepares the app for login/session management and PostgreSQL-backed workflow data.

Test:

```bash
npm install
npx prisma -v
```

Commit message:

```text
chore: add auth and prisma foundation packages
```

### Slice 2: Prisma Schema Foundation

Status: implemented, pending review/commit.

Added the first domain schema for:

- Workspace
- Organization
- User
- Membership
- Company
- ComplianceYear
- TrainingRequest
- ReimbursementClaim
- Document
- Decision
- Comment
- AuditEvent

Real-world use case: models employer registration, annual compliance, training approval, reimbursement claims, evidence documents, decisions, comments, and audit trails.

Test:

```bash
npx prisma validate
npx prisma generate
```

Commit message:

```text
feat: add initial ITF reimbursement prisma schema
```

### Slice 3: RBAC, Auth, DB, and Audit Helpers

Status: implemented, pending review/commit.

Added helper modules for:

- Role and permission definitions
- Domain constants
- Bootstrap Auth.js configuration
- Lazy Prisma database initialization
- Audit-event scaffolding
- NextAuth session typing

Real-world use case: establishes the permission model and backend support code needed before employer records and claims become interactive.

Test:

```bash
npm run lint
npm run build
```

Commit message:

```text
feat: add RBAC auth database and audit foundations
```

### Slice 4: Dashboard and Sign-In Skeleton

Status: implemented, pending review/commit.

Added the first app routes:

- Dashboard shell
- Overview page
- Employer registry page
- Annual compliance page
- Reimbursement claims page
- Sign-in page
- Auth.js route handler

Real-world use case: gives ITF users an early operational surface for the workflow areas that will later become fully data-backed.

Test:

```bash
npm run dev:webpack
```

Then visit:

```text
http://localhost:3000
http://localhost:3000/dashboard
http://localhost:3000/registry
http://localhost:3000/compliance
http://localhost:3000/claims
http://localhost:3000/sign-in
```

Commit message:

```text
feat: add dashboard and bootstrap sign-in shell
```

### Slice 5: Implementation Slice Roadmap

Status: implemented, pending review/commit.

Documents the slice-by-slice learning workflow and records the current implementation slices.

Real-world use case: creates a project learning ledger so each feature can be reviewed, understood, tested, and committed intentionally.

Test:

```bash
npm run lint
```

Commit message:

```text
docs: add implementation slice roadmap
```

## Upcoming Slices

### Slice 6: Environment Example and Bootstrap Auth Notes

Status: implemented, pending review/commit.

Added environment documentation for:

- `.env.example`
- `docs/auth.md`
- `.env.example` git tracking exception

Real-world use case: gives developers a safe local configuration template while keeping real secrets out of git.

Test:

```bash
npm run lint
```

Optional manual test after creating `.env.local`:

```bash
npm run dev:webpack
```

Then visit:

```text
http://localhost:3000/sign-in
```

Commit message:

```text
docs: add environment and bootstrap auth notes
```

### Slice 7: Prisma Migration Setup

Status: implemented, pending review/commit.

Created and applied the first foundation migration.

- `prisma/migrations/...`

Test:

```bash
npx prisma migrate status
```

Commit message:

```text
feat: add initial database migration
```

### Slice 8: Employer Registry Read Model

Goal: add a server-rendered registry list backed by seed/sample data or database records, depending on migration readiness.

Expected files:

- app route files
- registry data access helper

### Slice 8A: Foundation Seed Data

Status: implemented, pending review/commit.

Adds an idempotent seed script for the first workspace, ITF internal organization, bootstrap admin user, and admin membership.

Test:

```bash
npm run db:seed
```

Commit message:

```text
feat: seed foundation workspace and admin data
```

### Slice 9: Employer Registry Read Model

Goal: add a server-rendered registry list backed by seed/sample data or database records, depending on migration readiness.

Expected files:

- app route files
- registry data access helper

### Slice 10: Document Storage Provider Abstraction

Goal: implement upload/read/delete adapters for `STORAGE_PROVIDER="vercel_blob"` and `STORAGE_PROVIDER="s3"`.

Packages needed later:

```bash
npm install @vercel/blob
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected files:

- `lib/storage/*`
- upload route/server action files

### Slice 11: Workspace App Launcher Waffle

Goal: add a Google-style app launcher where users can open workspace applications they are authorized to access.

Expected design:

- Workspace application registry
- User/app entitlement checks
- Waffle launcher in the dashboard shell
- Links to ITF Reimbursement Gateway and future workspace apps

Expected files:

- Prisma schema additions or seed data for workspace apps
- dashboard layout/app launcher component
- RBAC or entitlement helper updates

### Slice 12: Company Evidence Download Flow

Goal: add a protected route for viewing/downloading uploaded company evidence without exposing storage paths publicly.

Expected design:

- Authenticated download route
- Company/document ownership check
- Organization access check
- Safe download headers for uploaded files

Expected files:

- `app/(dashboard)/registry/[companyId]/evidence/[documentId]/route.ts`
- `lib/evidence.ts`
- `lib/storage/*`

### Slice 13: Compliance Year Creation

Goal: let an authorized user create an annual compliance return for a company.

Expected design:

- Company detail action to create a compliance year
- Server-rendered compliance form
- Server action with authentication, permission, and organization access checks
- Created compliance years visible on the company detail page

Expected files:

- `app/(dashboard)/registry/[companyId]/compliance/new/page.tsx`
- `app/(dashboard)/registry/[companyId]/compliance/actions.ts`
- `lib/compliance.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`

### Slice 14: Compliance Evidence Upload

Goal: let an authorized user upload evidence documents against a specific compliance year.

Expected design:

- Compliance-year upload action from the company detail page
- Evidence type selector for contribution receipts, policies, annual plans, declarations, and stamped copies
- Reuse the private document storage and upload validation layer
- Show compliance evidence count/list under each compliance year

Expected files:

- `app/(dashboard)/registry/[companyId]/compliance/[complianceYearId]/evidence/new/page.tsx`
- `app/(dashboard)/registry/[companyId]/compliance/[complianceYearId]/evidence/actions.ts`
- `lib/compliance.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`

### Slice 15: Evidence Inline Viewer Mode

Goal: let reviewers open protected evidence documents in a new tab instead of forcing every file to download.

Expected design:

- Protected evidence route supports `disposition=inline`
- Inline previews limited to PDF, JPEG, and PNG
- Evidence links open in a new tab with safe browser attributes
- Existing route still falls back to attachment download

Expected files:

- `app/(dashboard)/registry/[companyId]/evidence/[documentId]/route.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- `docs/storage.md`
