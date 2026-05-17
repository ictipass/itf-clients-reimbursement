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

After sign-in, the app should redirect to:

```text
http://localhost:3000/dashboard
```

## Real-World Direction

The bootstrap credentials are a temporary bridge. The production direction is to integrate with ITF Workspace so that:

- ITF Workspace owns identity.
- This app receives user and organization claims.
- App roles are mapped from Workspace entitlements.
- Every mutation checks both role and organization scope.
- Audit events include the Workspace actor identity.
