# OAuth Production Review

This app currently supports database-backed local credential login for the seeded system
administrator and locally provisioned users. Before production, authentication should move behind
the ITF Workspace identity provider.

## Provider Checklist

- Use only approved ITF Workspace OAuth/OIDC providers.
- Register exact production callback URLs.
- Register exact staging callback URLs separately.
- Disable wildcard callback URLs in production.
- Store client ID and client secret only in environment variables.
- Rotate provider secrets during deployment handover.
- Confirm account linking policy before enabling multiple providers.

## Redirect Rules

- Keep post-login redirects inside the application origin.
- Preserve `callbackUrl` only when it points to an internal route.
- Redirect unauthorized users to `/dashboard` or `/sign-in`, never to arbitrary URLs.

## Required Environment Variables

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- Provider-specific client ID
- Provider-specific client secret

## Current Local Login

The seed creates only the first `SYSTEM_ADMIN` account and stores the initial password as an
Argon2id database hash. The administrator must change that temporary password on first login.
Locally provisioned users also receive temporary passwords and must change them before continuing.
