# Rate Limiting Strategy

Rate limiting should protect expensive or sensitive entry points without frustrating legitimate employers and ITF officers.

## Priority Targets

1. Sign-in and auth-sensitive routes
2. Document upload actions
3. Public verification endpoints
4. Claim and compliance submission actions
5. Certificate generation and download endpoints

## Recommended Provider

Use a shared external store in production, preferably Redis. For Vercel deployment, Upstash Redis with `@upstash/ratelimit` is a good fit.

## Development Fallback

Until Redis is configured, the app can use a conservative in-memory limiter for development only. This is not sufficient for multi-instance production.

## Default Limits

- Auth: 5 attempts per 5 minutes per IP/email pair
- Uploads: 20 uploads per 10 minutes per user
- Public verification: 30 requests per minute per IP
- Workflow submissions: 30 submissions per 10 minutes per user

## Response Behavior

- Return a friendly retry message.
- Do not leak whether an email/account exists.
- Log rate-limit denials as security audit events once audit logging is wired.
