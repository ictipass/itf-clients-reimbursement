# ITF Workspace Integration

The reimbursement app is designed as a child application inside a larger ITF Workspace. Authentication identity should eventually come from the Workspace, while reimbursement-specific roles, office assignments, permissions, work queues, and audit events remain owned by this app.

## Identity Contract

The Workspace should provide a stable external user ID, verified email, display name, and active/inactive status. The reimbursement app maps that identity to its local `User` and `Membership` records before granting access.

Users authenticated by Google are not automatically authorized. Their verified email must already match an active reimbursement directory user with at least one membership.

## Child-App Responsibilities

- Maintain reimbursement roles and permissions.
- Maintain Area Office and employer organization assignments.
- Enforce organization and Area Office data isolation.
- Maintain reimbursement work queues, notifications, and audit records.
- Expose app-level attention counts to the Workspace waffle.

## Workspace Responsibilities

- Central sign-in, sign-out, MFA, and account recovery.
- Global user lifecycle and identity verification.
- Workspace-wide app entitlement.
- Waffle/app launcher and cross-app notification badges.
- Central session termination.

## Existing Production App Onboarding Runbook

1. Inventory the production app's authentication, users, roles, permissions, sessions, and audit logs.
2. Define the stable Workspace identity mapping and app entitlement.
3. Add Workspace OAuth/OIDC login without removing the existing login immediately.
4. Map existing production users to Workspace identities and resolve duplicates.
5. Move app-specific permissions behind server-side authorization checks.
6. Add the app to the Workspace launcher and publish its attention-count contract.
7. Test session expiry, sign-out, revoked users, role changes, and cross-app navigation.
8. Run a staged pilot with both login paths.
9. Make Workspace identity the primary login.
10. Retire the legacy login only after rollback and support procedures are approved.
