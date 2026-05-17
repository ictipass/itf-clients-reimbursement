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

Goal: add `.env.example` and document the bootstrap admin variables without committing secrets.

Expected files:

- `.env.example`
- `docs/auth.md`

### Slice 7: Prisma Migration Setup

Goal: create the first migration for the foundation schema after database connection details are confirmed.

Expected files:

- `prisma/migrations/...`

### Slice 8: Employer Registry Read Model

Goal: add a server-rendered registry list backed by seed/sample data or database records, depending on migration readiness.

Expected files:

- app route files
- registry data access helper
