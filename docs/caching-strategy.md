# Caching Strategy

The reimbursement app handles workflow records, payments, certificates, and private evidence. Caching must improve speed without showing stale decisions or leaking one organization's records to another.

## Cache Freely

These records are stable enough to cache for short periods:

- Area office lists
- Office metadata
- Role definitions
- Workspace app registry entries
- Public certificate QR SVGs
- Static templates and download templates

## Cache Carefully

These records can be cached only with role, organization, office, or user scope:

- Dashboard counts
- Work queue summaries
- Notification badges
- Registry lists
- Compliance summary cards
- Management statistics

Cache keys must include the current user's role and access boundary.

## Do Not Cache By Default

These records should remain live unless a very short scoped cache is deliberately added:

- Workflow transition availability
- Payment receipt review state
- Certificate issuance state
- Evidence upload/delete state
- Authentication/session data
- Permission checks

## Invalidations

The following events should invalidate related cached summaries:

- Company registration submission or workflow transition
- Compliance year creation, evidence upload, review, or certificate issuance
- Training plan submission workflow transition
- Training request workflow transition
- Claim submission or review action
- Office or officer assignment changes
- Role or permission changes

## Production Direction

Use request-safe React cache helpers for low-risk reference data first. For cross-request caching, prefer a shared provider that supports scoped keys, tags, and explicit invalidation. Never cache private evidence binaries in a public cache.
