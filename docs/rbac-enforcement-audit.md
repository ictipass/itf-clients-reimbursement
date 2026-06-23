# RBAC Enforcement Audit

Role-based visibility is a convenience. Authorization must also be enforced at the route, server-action, and domain-service layers.

## Enforcement Layers

1. Navigation hides modules the active role cannot use.
2. `proxy.ts` blocks protected route prefixes before page rendering.
3. Page components check permissions before loading sensitive data.
4. Server actions resolve the authenticated session and pass the role to domain services.
5. Domain services enforce permissions and organization/Area Office access before database writes.

## Settings Boundaries

- `/settings` and `/settings/preferences`: every authenticated user
- `/settings/audit`: `audit:read`
- `/settings/numbers`: `numbers:manage`
- All other administrative `/settings/*` routes: `workspace:manage`

This prevents number-registry managers from receiving access to users, offices, roles, certificates, or signatures.

## Data Scope Rules

- Employer users must be restricted to their organization.
- Area Office users must be restricted to their assigned Area Office where the workflow requires jurisdiction.
- Headquarters roles can see cross-office records only where their workflow permission requires it.
- Hidden buttons never replace server-side permission checks.

## Remaining Audit Habit

Every new route must receive a feature gate. Every mutation must authenticate the session and call a domain service that performs the final permission and scope check.
