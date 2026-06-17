# Authentication and Seed Setup

The app uses Auth.js/NextAuth credentials auth, but user passwords live in the
database. Environment variables are used only to create or reset the first system
administrator during `npm run db:seed`.

## Required Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

`DATABASE_URL` is required before migrations, seeding, or app routes can use the
database.

`NEXTAUTH_SECRET` signs session tokens:

```bash
openssl rand -base64 32
```

`NEXTAUTH_URL` should point to the app URL, for example:

```text
http://localhost:3000
```

## First System Administrator

Set these values before running the seed:

```text
SYSTEM_ADMIN_EMAIL="admin@itf.local"
SYSTEM_ADMIN_NAME="System Administrator"
SYSTEM_ADMIN_INITIAL_PASSWORD="replace-with-a-strong-temporary-password"
SYSTEM_ADMIN_RESET_PASSWORD="false"
```

`SYSTEM_ADMIN_INITIAL_PASSWORD` is a temporary plaintext password. The seed hashes
it with Argon2id and stores it in `User.passwordHash`. Runtime sign-in does not
read this environment variable.

Run the seed:

```bash
npm run db:seed
```

The seed creates only:

- the minimal active workspace
- one active `SYSTEM_ADMIN` user
- one active `SYSTEM_ADMIN` membership

It does not create role test users, demo employers, Area Offices, certificate
templates, or sample workflow data.

The system administrator is marked with `mustChangePassword = true`. On first
sign-in, the app redirects them to Profile and Security to set a permanent
password.

## Normal Sign-In Flow

Start the app:

```bash
npm run dev:webpack
```

Open:

```text
http://localhost:3000/sign-in
```

Sign in with the seeded admin email and the temporary password from
`SYSTEM_ADMIN_INITIAL_PASSWORD`. Then change the password immediately. After that,
the environment variable is no longer part of the login process.

Credential login succeeds only when all of these are true:

- `User.passwordHash` contains an Argon2id hash
- `User.emailVerifiedAt` is set
- `User.isActive = true`
- the user has at least one active `Membership`

## Existing Users Without Password Hashes

Users that were created before local password provisioning may have no
`User.passwordHash`. They cannot sign in with email and password until a system
administrator resets their local access.

Use:

```text
Settings -> Users -> Reset local access
```

That creates a temporary password, stores its Argon2id hash, marks the account as
verified and active, and sets `mustChangePassword = true`. The user signs in with
the temporary password and must change it before using the platform.

## Emergency Admin Reset

If the system administrator loses access, set:

```text
SYSTEM_ADMIN_RESET_PASSWORD="true"
SYSTEM_ADMIN_INITIAL_PASSWORD="new-strong-temporary-password"
```

Then rerun:

```bash
npm run db:seed
```

Sign in with the new temporary password, change it in Profile and Security, then
set `SYSTEM_ADMIN_RESET_PASSWORD` back to `false`.

## Future Workspace SSO Direction

The long-term production direction is still to integrate with ITF Workspace:

- ITF Workspace owns identity.
- This app keeps reimbursement-specific roles, memberships, and workflow scope.
- Every page, route handler, and mutation re-checks authorization server-side.
