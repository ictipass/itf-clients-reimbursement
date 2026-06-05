# OAuth Production Review

This app currently supports bootstrap/development credential login for implementation testing. Before production, authentication should move behind the ITF Workspace identity provider.

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

## Current Development Login

Development test users are blocked in production by `NODE_ENV === "production"`.
The bootstrap admin login should be treated as an emergency/admin setup path and disabled or strongly protected after workspace SSO is live.
