# ITF Integrated Contribution and Reimbursement Platform

An enterprise workflow application for Industrial Training Fund employer registration, annual
compliance, training governance, and reimbursement administration.

> **Project status:** active development toward a controlled production pilot. Core workflows have
> working foundations, while final claims/payment policy, external integrations, broader automated
> testing, and production operations remain in progress.

**Hosted application:** [itf-reimbursement.vercel.app](https://itf-reimbursement.vercel.app)

## Overview

The ITF Integrated Contribution and Reimbursement Platform provides a secure, auditable digital workspace for employers and ITF
officers involved in the reimbursement scheme. It is designed as a child application within the
broader ITF Workspace and enforces role, organization, Area Office, and workflow-desk boundaries.

The application replaces fragmented manual movement of submissions with structured electronic
forms, private supporting evidence, formal decisions, attention queues, certificates, and audit
history.

## Implemented Capabilities

### Employer and Identity Administration

- Employer portal account registration and email verification
- Google OAuth and portal-password sign-in
- Argon2 password hashing and account recovery
- Organization invitations and employer-user administration
- Multi-organization access with active organization switching
- ITF user directory, Headquarters, and Area Office officer management
- Additional System Administrator and Headquarters leadership assignments
- Management designation with national or Area Office reporting scope
- Role-aware navigation, feature gates, and server-side authorization
- Account and membership lifecycle history

### Employer Registration and Annual Compliance

- New and legacy employer registration paths
- Area Office selection and jurisdiction-based access
- Employer-requested Area Office jurisdiction changes with Area Manager decisions
- Registration routing through Area Manager, HORIC, and Revenue Accountant
- Training contribution assessment, verification, and release
- Payment-receipt evidence and Headquarters notification
- Managed ITF employer-number allocation
- Annual compliance filing and Headquarters-controlled certification
- Versioned certificate designs, signature assets, QR codes, and public verification

### Training Governance

- Annual Training Plan and L&D personnel submission
- Multiple L&D personnel records
- Downloadable Training Plan CSV template, preview, validation, and import
- Current-year compliance eligibility gate
- Form 4A training approval requests
- Planned and ad-hoc Form 4A requests
- Local physical and local online delivery details maintained by employers
- Training participant and evidence management
- Form 6A/6B training monitoring, evaluations, and review workflow
- Direct employer correction-return paths

### Reimbursement Claims Foundation

- Claims created from eligible approved training activities
- Employer Form 1 claim data
- Reviewer Form 1B recommendation data
- Form 2A/2B calculation rows
- Supporting evidence and decision history

Final claims approval, payment, settlement, appeal, and external finance integration remain subject
to the approved claims and payment Standard Operating Procedure.

### Governance and Operations

- Role-specific dashboards and work queues
- Action-required and awareness-only attention items
- Workspace waffle launcher and notification badges
- Private evidence storage through local, Vercel Blob, or S3 providers
- Upload validation, quarantine foundation, and malware-scanner abstraction
- Audit logs, email delivery records, rate limiting, and security headers
- Management statistics with national and Area Office scopes
- Personal calendar subscriptions for training and monitoring schedules
- HOT/WARM/COLD record-tier foundation

## Workflow Summary

```text
Employer Registration
Employer -> Area Manager -> HORIC -> Revenue Accountant
         -> HORIC -> Area Manager -> Employer -> Headquarters

Annual Compliance
Employer -> Headquarters Review -> Annual Compliance Certificate
         + Area Office awareness

Training Plan and L&D Submission
Employer -> Area Office Training Review -> Area Manager Approval

Training Approval Request
Employer -> Area Manager -> Head of Training -> Reimbursement Officer
         -> Head of Training -> Area Manager -> Employer

Training Monitoring
Approved Training Request -> Form 6A/6B Monitoring -> Review and Approval
```

See the [User, Support, and Stakeholder Guide](docs/user-support-guide.md) for detailed workflows.

## Technology

| Area | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| Database | PostgreSQL, Prisma 7 |
| Authentication | NextAuth, Google OAuth, portal credentials, Argon2 |
| Validation | Zod |
| Styling | Tailwind CSS |
| Object storage | Local private storage, Vercel Blob, or S3 |
| Email | Resend HTTPS API |
| Shared rate limiting | Upstash Redis, with development fallback |
| Certificates | `pdf-lib`, QR codes |
| Testing | Node test runner through `tsx` |
| Hosting target | Vercel |

## Architecture Principles

- **Identity and access are separate.** A user remains historically identifiable when an
  organization or office assignment changes.
- **Authorization is enforced server-side.** Hiding a button never replaces permission and scope
  checks.
- **Employer data is tenant-isolated.** Active organization membership controls access to employer
  records.
- **Area Office and Headquarters authority remain distinct.** Awareness does not imply approval
  authority.
- **Registration is one-time; compliance is annual.**
- **Business records are preserved.** Soft deactivation and audit history are preferred over
  destructive deletion.
- **Workflow decisions are auditable.** Formal decisions, work items, and sensitive changes retain
  actor, reason, and date information.

See the [Enterprise Architecture](docs/enterprise-architecture.md) for the detailed domain design.

## Repository Structure

```text
app/                  Next.js pages, layouts, Server Actions, and Route Handlers
lib/                  Domain services, authorization, integrations, and infrastructure
prisma/schema.prisma  Transactional domain schema
prisma/migrations/    Ordered and immutable database migration history
prisma/seed.ts        Foundation and development seed data
tests/                Automated tests
docs/                 Architecture, workflow, support, security, and operations guides
data/                 Reference data used by seed and administrative workflows
storage/              Private local development uploads
proxy.ts              Next.js 16 route-level authentication and feature guard
```

## Local Development

### Prerequisites

- Node.js 22 or a compatible current LTS release
- npm
- PostgreSQL
- A development database that may be safely migrated and seeded

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

3. Configure at minimum:

   ```env
   DATABASE_URL="postgresql://..."
   NEXTAUTH_SECRET="replace-with-a-secure-random-value"
   NEXTAUTH_URL="http://localhost:3000"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   STORAGE_PROVIDER="local"
   ```

4. Generate Prisma Client and apply migrations:

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

5. Seed foundation and development data:

   ```bash
   npm run db:seed
   ```

6. Start the development server:

   ```bash
   npm run dev:webpack
   ```

7. Open [http://localhost:3000](http://localhost:3000).

The default `npm run dev` command uses Turbopack. On the current development machine, Webpack has
been the more stable local development path.

## Environment Configuration

For Vercel Preview staging, daily cron scheduling, manual admin runs, and the production
go-live gates, see [Staging Scheduler and Production Checklist](docs/staging-scheduler-and-production-checklist.md).

The complete documented environment contract is available in [.env.example](.env.example).

Important groups include:

- PostgreSQL connection
- NextAuth secret and public application URLs
- Google OAuth credentials
- Resend email mode and sender credentials
- Cron endpoint secret
- Upstash Redis shared rate limiting
- Local, Vercel Blob, or S3 storage
- Upload malware-scanner mode
- Development-only bootstrap and seeded test-account settings

Never commit real secrets. Production must not use development-link email delivery or default
bootstrap credentials.

## Google OAuth

For the hosted application, configure Google OAuth with:

```text
Authorized JavaScript origin:
https://itf-reimbursement.vercel.app

Authorized redirect URI:
https://itf-reimbursement.vercel.app/api/auth/callback/google
```

For local development, also add:

```text
http://localhost:3000
http://localhost:3000/api/auth/callback/google
```

## Email and Workflow Notifications

Development can expose verification and invitation links without delivering email:

```env
EMAIL_DELIVERY_MODE="development_link"
```

To test Resend while retaining development links:

```env
EMAIL_DELIVERY_MODE="resend_and_development_link"
RESEND_API_KEY="re_..."
EMAIL_FROM="ITF Contribution and Reimbursement <onboarding@resend.dev>"
```

Production requires `EMAIL_DELIVERY_MODE="resend"` and a verified sender domain.

Workflow notification dispatch is protected by `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.example/api/cron/workflow-notifications
```

See [Transactional Email Delivery](docs/email-delivery.md).

## Storage and Upload Security

Select the upload provider through:

```env
STORAGE_PROVIDER="local"       # development
STORAGE_PROVIDER="vercel_blob"
STORAGE_PROVIDER="s3"
```

Uploaded files remain private and are served through authorized routes. Upload handling includes
file-type validation, active-content checks, rate limiting, secure response headers, soft deletion,
and quarantine/scanner foundations.

See:

- [Document Storage](docs/storage.md)
- [Upload Security](docs/upload-security.md)

## Database Migrations

Before creating or applying a migration:

```bash
npx prisma validate
npx prisma migrate status
npx prisma migrate dev --name meaningful_migration_name
```

Migration folders must sort in their required execution order. Applied migrations must not be
edited casually, and shared or production databases must never be reset to repair migration
history.

## Testing and Verification

Run unit tests:

```bash
npm test
```

Run the integrated verification pipeline:

```bash
npm run verify
```

The verification command performs Prisma schema validation, TypeScript checking, ESLint, and a
Next.js Webpack production build.

Current automated coverage is foundational. Dedicated database integration tests, authorization
regression tests, and browser end-to-end tests remain production-readiness priorities.

See [Testing](docs/testing.md).

## Available Commands

| Command | Purpose |
| --- | --- |
| `npm run dev:webpack` | Start the stable local development server |
| `npm run dev` | Start Next.js with its default development bundler |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run automated unit tests |
| `npm run verify` | Validate Prisma, TypeScript, ESLint, and production build |
| `npm run db:seed` | Seed foundation and development data |
| `npx prisma migrate status` | Inspect database migration state |

## Production Readiness

The application is not yet declared production complete. The major remaining work includes:

- Claims and payment SOP implementation
- Remita and finance-system integrations
- Dedicated integration and browser test coverage
- Production malware scanning and quarantine operations
- Workspace identity/OIDC and cross-app entitlement integration
- Accessibility, security, privacy, backup/restore, observability, and pilot sign-offs

See the [Production Readiness Roadmap](docs/production-readiness-roadmap.md) for the complete
remaining-slice register and rollout estimate.

## Documentation

### Product and Workflow

- [User, Support, and Stakeholder Guide](docs/user-support-guide.md)
- [Production Readiness Roadmap](docs/production-readiness-roadmap.md)
- [Implementation Slice Log](docs/implementation-slices.md)

### Architecture and Maintenance

- [Developer Maintenance and Extension Guide](docs/developer-maintenance-guide.md)
- [Enterprise Architecture](docs/enterprise-architecture.md)
- [Workspace Integration](docs/workspace-integration.md)
- [Authentication Setup](docs/auth.md)

### Security and Operations

- [Testing](docs/testing.md)
- [Transactional Email Delivery](docs/email-delivery.md)
- [Development Annual Eligibility API](docs/development-eligibility.md)
- [Document Storage](docs/storage.md)
- [Upload Security](docs/upload-security.md)
- [Rate Limiting](docs/rate-limiting.md)
- [Caching Strategy](docs/caching-strategy.md)
- [RBAC Enforcement Audit](docs/rbac-enforcement-audit.md)
- [OAuth Production Review](docs/oauth-production-review.md)

## Maintaining the Project

For every implemented slice:

1. Keep business rules inside domain services rather than page components.
2. Enforce both role permission and organization/office scope.
3. Add or update automated tests.
4. Validate migration ordering and replay.
5. Update the affected user workflow and developer documentation.
6. Update the implementation log and production-readiness roadmap.

The [Developer Maintenance and Extension Guide](docs/developer-maintenance-guide.md) contains the
full workflow-extension and policy-change procedure.

## License and Ownership

This repository is private and intended for the Industrial Training Fund reimbursement platform.
Licensing, source-code ownership, data-governance, and deployment authority should be confirmed by
the responsible ITF project and legal stakeholders before production distribution.
