# Authentication and Environment Setup

This project currently uses a temporary bootstrap administrator login while the final ITF Workspace identity integration is still undefined.

## Current Auth Flow

Auth is configured in `lib/auth.ts` using Auth.js/NextAuth credentials auth.

The bootstrap login reads these environment variables:

- `BOOTSTRAP_ADMIN_ID`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_ROLE`

If a value is missing, the app falls back to local development defaults:

- Email: `admin@itf.local`
- Password: `ChangeMe123!`
- Role: `SYSTEM_ADMIN`

These defaults are only for local development. Shared, staging, and production environments must set explicit values.

## Required Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

`DATABASE_URL` is required before any database-backed route or server action calls `getDb()`.

`NEXTAUTH_SECRET` should be a random secret:

```bash
openssl rand -base64 32
```

`NEXTAUTH_URL` should point to the local app URL:

```text
http://localhost:3000
```

## Local Sign-In Test

Start the stable local dev server:

```bash
npm run dev:webpack
```

Open:

```text
http://localhost:3000/sign-in
```

Use the bootstrap credentials from `.env.local`.

For role-specific workflow testing, run the foundation seed and set a strong local-only
`DEV_TEST_USER_PASSWORD` in your environment. The application intentionally does not accept
the old `password123` default.

```text
DEV_TEST_USER_PASSWORD="replace-with-a-strong-local-secret"
```

Seeded test accounts:

| Email | Implemented app role |
| --- | --- |
| `am@itf.local` | `AREA_MANAGER` |
| `horic@itf.local` | `HORIC` |
| `ra@itf.local` | `REVENUE_ACCOUNTANT` |
| `ro@itf.local` | `REIMBURSEMENT_OFFICER` |
| `hqro@itf.local` | `HQ_REIMBURSEMENT_OFFICER` |
| `hqra@itf.local` | `HQ_REVENUE_ACCOUNTANT` |
| `hqhod@itf.local` | `HEAD_OF_DIVISION` |
| `dfsd@itf.local` | `DIRECTOR_FSD` |
| `employer@itf.local` | `EMPLOYER_ADMIN` |

The requested labels `REVENUE_OFFICER`, `HQ_REVENUE_OFFICER`, and
`HEAD_REIMBURSEMENT_DIVISION` are mapped to the closest currently implemented app roles above.
We can formalize those exact role names later if the workflow needs them as separate permissions.

Seeded Area Office test accounts follow their assigned Area Office memberships in the
registry. Use an HQ role or bootstrap administrator when a test needs all companies.

After sign-in, the app should redirect to:

```text
http://localhost:3000/dashboard
```

## Foundation Seed Data

After the first migration, seed the local development database:

```bash
npm run db:seed
```

The seed creates:

- `ITF Workspace`
- `Industrial Training Fund` internal organization
- Bootstrap admin user from the `BOOTSTRAP_ADMIN_*` environment variables, including an
  Argon2id `User.passwordHash` for `BOOTSTRAP_ADMIN_PASSWORD`
- `SYSTEM_ADMIN` membership for the bootstrap admin
- Local role test users only when `DEV_TEST_USER_PASSWORD` is explicitly configured to a
  non-default value

The script is idempotent, so it can be run more than once.

If manually setting a local password in the database, paste the Argon2 value into
`User.passwordHash` only. Database-backed credential login also requires `User.emailVerifiedAt`,
`User.isActive = true`, and at least one active `Membership`. The bootstrap administrator can
also sign in through the direct `BOOTSTRAP_ADMIN_PASSWORD` environment check.

## Real-World Direction

The bootstrap credentials are a temporary bridge. The production direction is to integrate with ITF Workspace so that:

- ITF Workspace owns identity.
- This app receives user and organization claims.
- App roles are mapped from Workspace entitlements.
- Every mutation checks both role and organization scope.
- Audit events include the Workspace actor identity.
