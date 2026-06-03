# ITF Reimbursement Gateway Implementation Slices

This project is being built one reviewable slice at a time. After each slice, implementation pauses for review before the next slice begins.

Each slice should answer:

- What was implemented
- Files changed or created
- Real-world use case
- How to test it
- Brief commit message

## Local Development Note

Use the Webpack dev server locally:

```bash
npm run dev:webpack
```

The default Next.js 16 dev server uses Turbopack. On this machine, Turbopack hung during first route compilation and caused the system to become unresponsive. Webpack successfully served `http://localhost:3000`.

## Completed Slices

### Slice 1: Foundation Packages

Status: implemented, pending review/commit.

Added authentication and database packages:

- `next-auth`
- `@prisma/client`
- `@prisma/adapter-pg`
- `pg`
- `prisma`

Real-world use case: prepares the app for login/session management and PostgreSQL-backed workflow data.

Test:

```bash
npm install
npx prisma -v
```

Commit message:

```text
chore: add auth and prisma foundation packages
```

### Slice 2: Prisma Schema Foundation

Status: implemented, pending review/commit.

Added the first domain schema for:

- Workspace
- Organization
- User
- Membership
- Company
- ComplianceYear
- TrainingRequest
- ReimbursementClaim
- Document
- Decision
- Comment
- AuditEvent

Real-world use case: models employer registration, annual compliance, training approval, reimbursement claims, evidence documents, decisions, comments, and audit trails.

Test:

```bash
npx prisma validate
npx prisma generate
```

Commit message:

```text
feat: add initial ITF reimbursement prisma schema
```

### Slice 3: RBAC, Auth, DB, and Audit Helpers

Status: implemented, pending review/commit.

Added helper modules for:

- Role and permission definitions
- Domain constants
- Bootstrap Auth.js configuration
- Lazy Prisma database initialization
- Audit-event scaffolding
- NextAuth session typing

Real-world use case: establishes the permission model and backend support code needed before employer records and claims become interactive.

Test:

```bash
npm run lint
npm run build
```

Commit message:

```text
feat: add RBAC auth database and audit foundations
```

### Slice 4: Dashboard and Sign-In Skeleton

Status: implemented, pending review/commit.

Added the first app routes:

- Dashboard shell
- Overview page
- Employer registry page
- Annual compliance page
- Reimbursement claims page
- Sign-in page
- Auth.js route handler

Real-world use case: gives ITF users an early operational surface for the workflow areas that will later become fully data-backed.

Test:

```bash
npm run dev:webpack
```

Then visit:

```text
http://localhost:3000
http://localhost:3000/dashboard
http://localhost:3000/registry
http://localhost:3000/compliance
http://localhost:3000/claims
http://localhost:3000/sign-in
```

Commit message:

```text
feat: add dashboard and bootstrap sign-in shell
```

### Slice 5: Implementation Slice Roadmap

Status: implemented, pending review/commit.

Documents the slice-by-slice learning workflow and records the current implementation slices.

Real-world use case: creates a project learning ledger so each feature can be reviewed, understood, tested, and committed intentionally.

Test:

```bash
npm run lint
```

Commit message:

```text
docs: add implementation slice roadmap
```

## Upcoming Slices

### Slice 6: Environment Example and Bootstrap Auth Notes

Status: implemented, pending review/commit.

Added environment documentation for:

- `.env.example`
- `docs/auth.md`
- `.env.example` git tracking exception

Real-world use case: gives developers a safe local configuration template while keeping real secrets out of git.

Test:

```bash
npm run lint
```

Optional manual test after creating `.env.local`:

```bash
npm run dev:webpack
```

Then visit:

```text
http://localhost:3000/sign-in
```

Commit message:

```text
docs: add environment and bootstrap auth notes
```

### Slice 7: Prisma Migration Setup

Status: implemented, pending review/commit.

Created and applied the first foundation migration.

- `prisma/migrations/...`

Test:

```bash
npx prisma migrate status
```

Commit message:

```text
feat: add initial database migration
```

### Slice 8: Employer Registry Read Model

Goal: add a server-rendered registry list backed by seed/sample data or database records, depending on migration readiness.

Expected files:

- app route files
- registry data access helper

### Slice 8A: Foundation Seed Data

Status: implemented, pending review/commit.

Adds an idempotent seed script for the first workspace, ITF internal organization, bootstrap admin user, and admin membership.

Test:

```bash
npm run db:seed
```

Commit message:

```text
feat: seed foundation workspace and admin data
```

### Slice 9: Employer Registry Read Model

Goal: add a server-rendered registry list backed by seed/sample data or database records, depending on migration readiness.

Expected files:

- app route files
- registry data access helper

### Slice 10: Document Storage Provider Abstraction

Goal: implement upload/read/delete adapters for `STORAGE_PROVIDER="vercel_blob"` and `STORAGE_PROVIDER="s3"`.

Packages needed later:

```bash
npm install @vercel/blob
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected files:

- `lib/storage/*`
- upload route/server action files

### Slice 11: Workspace App Launcher Waffle

Goal: add a Google-style app launcher where users can open workspace applications they are authorized to access.

Expected design:

- Workspace application registry
- User/app entitlement checks
- Waffle launcher in the dashboard shell
- Links to ITF Reimbursement Gateway and future workspace apps

Expected files:

- Prisma schema additions or seed data for workspace apps
- dashboard layout/app launcher component
- RBAC or entitlement helper updates

### Slice 12: Company Evidence Download Flow

Goal: add a protected route for viewing/downloading uploaded company evidence without exposing storage paths publicly.

Expected design:

- Authenticated download route
- Company/document ownership check
- Organization access check
- Safe download headers for uploaded files

Expected files:

- `app/(dashboard)/registry/[companyId]/evidence/[documentId]/route.ts`
- `lib/evidence.ts`
- `lib/storage/*`

### Slice 13: Compliance Year Creation

Goal: let an authorized user create an annual compliance return for a company.

Expected design:

- Company detail action to create a compliance year
- Server-rendered compliance form
- Server action with authentication, permission, and organization access checks
- Created compliance years visible on the company detail page

Expected files:

- `app/(dashboard)/registry/[companyId]/compliance/new/page.tsx`
- `app/(dashboard)/registry/[companyId]/compliance/actions.ts`
- `lib/compliance.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`

### Slice 14: Compliance Evidence Upload

Goal: let an authorized user upload evidence documents against a specific compliance year.

Expected design:

- Compliance-year upload action from the company detail page
- Evidence type selector for contribution receipts, policies, annual plans, declarations, and stamped copies
- Reuse the private document storage and upload validation layer
- Show compliance evidence count/list under each compliance year

Expected files:

- `app/(dashboard)/registry/[companyId]/compliance/[complianceYearId]/evidence/new/page.tsx`
- `app/(dashboard)/registry/[companyId]/compliance/[complianceYearId]/evidence/actions.ts`
- `lib/compliance.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`

### Slice 15: Evidence Inline Viewer Mode

Goal: let reviewers open protected evidence documents in a new tab instead of forcing every file to download.

Expected design:

- Protected evidence route supports `disposition=inline`
- Inline previews limited to PDF, JPEG, and PNG
- Evidence links open in a new tab with safe browser attributes
- Existing route still falls back to attachment download

Expected files:

- `app/(dashboard)/registry/[companyId]/evidence/[documentId]/route.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- `docs/storage.md`

### Slice 16: Compliance Evidence Review Status

Goal: let authorized users move a compliance year through a simple review workflow and keep a decision trail.

Expected design:

- Submit, mark in review, approve, request correction, and reject actions
- Permission checks for submitter and reviewer paths
- Status update on `ComplianceYear`
- Decision record for each transition
- Latest decision shown on the company detail page

Expected files:

- `lib/compliance.ts`
- `app/(dashboard)/registry/[companyId]/compliance/actions.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`

### Slice 17: Area Office And Workflow Foundation

Goal: add Area Offices, area-office-aware company registration, and ITF operational roles before training request creation.

Expected design:

- Dedicated `AreaOffice` model
- Company chooses one Area Office
- Area Office data seeded from `data/ao.txt`
- Operational roles for AM, HORIC, RA, HOT, R_O, Director FSD, Head of Division, and HQ-R_O
- Architecture documentation for registration, mid-submission, training approval, and claim routing

Expected files:

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `data/ao.txt`
- `lib/rbac.ts`
- `lib/domain.ts`
- `lib/registry.ts`
- registry page/form files
- architecture/workflow docs

### Slice 18: Registration Application Workflow Foundation

Goal: formalize employer registration as its own Area Office workflow before contribution assessment and payment.

Expected design:

- Dedicated `RegistrationApplication` model
- Link registration application to company and selected Area Office
- Submit registration action moves the application to the Area Manager desk
- Company detail page shows registration status, current desk, submitted date, and submitted by
- RA contribution assessment remains a separate later slice

Expected files:

- `prisma/schema.prisma`
- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- architecture/workflow docs

### Slice 19: Registration Desk Routing

Goal: route a submitted registration application through Area Office desks before contribution assessment.

Expected design:

- AM can forward to HORIC or send back to company
- HORIC can forward to RA or return to AM
- RA can return to HORIC
- Current registration desk updates on the application
- Each routing move creates a decision record attached to the registration application
- Latest routing decision appears on the company detail page

Expected files:

- `prisma/schema.prisma`
- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`

### Slice 20: Registration Contribution Assessment

Goal: let the Revenue Accountant recommend the employer's registration training contribution before HORIC review.

Expected design:

- Dedicated contribution assessment model linked to registration application
- RA captures payroll basis, turnover basis, recommended contribution amount, and notes
- Assessment action updates or creates the current recommendation
- Registration returns from RA desk to HORIC after recommendation
- Recommendation appears on the company detail page

Expected files:

- `prisma/schema.prisma`
- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`

### Slice 21: Registration Recommendation Release Channel

Goal: let Area Manager choose how to release the confirmed contribution recommendation to the company.

Expected design:

- AM release action captures dashboard-only or dashboard-and-email channel
- Current implementation records the selected delivery channel
- Later email delivery slice should use Resend

Expected files:

- `prisma/schema.prisma`
- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`

### Slice 22: Registration Payment Receipt Upload

Goal: let the company upload its payment receipt after the Area Manager releases the confirmed contribution recommendation.

Expected design:

- Receipt upload is only available after AM release returns the registration application to the company desk
- Receipt uses the existing secure document pipeline and `CONTRIBUTION_RECEIPT` document kind
- Uploaded receipt is attached to the registration application and company
- Registration workflow panel shows receipt status and inline view links
- Remita payment integration remains a later slice

Expected files:

- `prisma/schema.prisma`
- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- architecture/workflow docs

### Slice 23: Attention Queue Foundation

Goal: create a durable work queue that can power dashboard, workspace app card, and waffle notification badges.

Expected design:

- Dedicated `WorkItem` model for open operational attention items
- Work items can target a workspace app, role, user, Area Office, organization, company, and workflow record
- Contribution receipt upload moves registration back to the Area Manager desk
- Receipt upload creates or reopens an Area Manager attention item for that Area Office
- Dashboard shell and overview page show open attention counts for the signed-in user's scope
- Workspace waffle/card badges remain a later UI slice using the same work-item count helper

Expected files:

- `prisma/schema.prisma`
- `lib/attention.ts`
- `lib/registration.ts`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- architecture/workflow docs

### Slice 24: Registration Receipt Review Action

Goal: let the Area Manager act on a contribution receipt attention item.

Expected design:

- AM can accept a submitted contribution receipt
- AM can request correction on the receipt
- Accepting the receipt resolves the AM attention item
- Requesting correction returns the registration application to the company desk and resolves the AM attention item
- Every review action creates a decision trail entry

Expected files:

- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 25: Registration HQ Notification Foundation

Goal: hand payment-verified employer registration from Area Office to Headquarters.

Expected design:

- Add `DIRECTOR_FSD` as a registration workflow desk
- Add `REGISTRATION_HQ_NOTIFICATION` as an attention item kind
- AM can notify Headquarters after accepting the contribution receipt
- Registration moves to the Director FSD desk
- Director FSD receives an open attention item
- Company detail page shows that HQ notification is pending

Expected files:

- `prisma/schema.prisma`
- `lib/registration.ts`
- `lib/attention.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 26: HQ Registration Number And Certificate Recording

Goal: let Headquarters complete employer registration after Area Office verification.

Expected design:

- Director FSD forwards the registration to Head of Reimbursement Division
- Head of Reimbursement Division records the ITF employer number
- Optional certificate reference and HQ note are captured in the decision trail
- Company moves to `ACTIVE`
- Registration application moves to `APPROVED` and gets a completion timestamp
- HQ attention items are resolved
- ITF employer number is unique at database level

Expected files:

- `prisma/schema.prisma`
- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 27: Role Test Accounts Seed

Goal: make local workflow testing easier with predictable role-specific accounts.

Expected design:

- Seed ITF and employer test users with short email addresses
- Use one local-only shared test password
- Allow seeded users to sign in through the credentials provider outside production
- Keep bootstrap admin login unchanged
- Document exact accounts and any role-label mappings

Expected files:

- `prisma/seed.ts`
- `lib/auth.ts`
- `.env.example`
- `docs/auth.md`
- implementation checklist

### Slice 28: Registration Certificate Record Foundation

Goal: make issued employer registration certificates first-class records.

Expected design:

- Add `RegistrationCertificate` and certificate status values
- Link each certificate to a company, registration application, and issuing user
- Create the certificate record when Head of Reimbursement Division completes registration
- Store certificate number, ITF employer number, issue date, and future template/document hooks
- Show the latest certificate record on the company registry detail page
- Leave template upload and downloadable PDF generation for later slices

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/registration.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 29: Certificate Template Foundation

Goal: prepare registration certificates for future downloadable designs without generating PDFs yet.

Expected design:

- Add `CertificateTemplate` and template status values
- Version templates by workspace using code and version
- Store template lifecycle fields such as draft, active, retired, effective date, and optional design document reference
- Link `RegistrationCertificate` to the template used at issue time
- Attach the latest active template when Head of Reimbursement Division completes a registration
- Show the attached template name/version on the registry detail page

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/certificates.ts`
- `lib/registration.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 30: Certificate Template Seed And Admin Visibility

Goal: make the active certificate template visible before upload and PDF generation are added.

Expected design:

- Seed one active employer registration certificate template for local workflow testing
- Add a read-only certificate template settings page
- Restrict the page to workspace-management roles
- Show template name, code, version, status, effective date, design attachment state, and issued certificate count
- Link settings from the dashboard navigation

Expected files:

- `prisma/seed.ts`
- `lib/certificates.ts`
- `app/(dashboard)/settings/certificates/page.tsx`
- `app/(dashboard)/layout.tsx`
- workflow docs

### Slice 31: Certificate Template Design Upload

Goal: let workspace admins attach the current official certificate design to a template.

Expected design:

- Add certificate template design as a document kind
- Link template design documents to `CertificateTemplate`
- Reuse storage provider upload flow and file security validation
- Allow PDF, PNG, and JPEG only
- Store uploaded designs as private official documents
- Add an upload/replace form on the certificate templates settings page

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/certificates.ts`
- `lib/storage/types.ts`
- `lib/storage/local.ts`
- `app/(dashboard)/settings/certificates/actions.ts`
- `app/(dashboard)/settings/certificates/page.tsx`
- workflow docs

### Slice 32: Certificate Template Metadata Management

Goal: let workspace admins control template versions before certificate PDF generation.

Expected design:

- Create new certificate template versions as drafts
- Activate a draft or retired template
- Retire active or draft templates
- Activating a template retires other active templates with the same workspace and code
- Keep already issued certificates tied to their original template version

Expected files:

- `lib/certificates.ts`
- `app/(dashboard)/settings/certificates/actions.ts`
- `app/(dashboard)/settings/certificates/page.tsx`
- workflow docs

### Slice 33: Certificate Design Inline Viewer

Goal: let workspace admins verify uploaded certificate template designs in the browser.

Expected design:

- Add a private route for viewing a template design document inline
- Reuse storage download flow
- Restrict access to workspace-management roles
- Return no-store, nosniff, same-origin, and sandbox headers
- Add a `View design` link beside attached template designs

Expected files:

- `lib/certificates.ts`
- `app/(dashboard)/settings/certificates/[templateId]/design/route.ts`
- `app/(dashboard)/settings/certificates/page.tsx`
- workflow docs

### Slice 34: Certificate Generation Metadata Foundation

Goal: prepare downloadable certificate generation using the uploaded design as a background.

Expected design:

- Add template placement metadata for dynamic text positions
- Add generated timestamp to registration certificates
- Keep generated document linkage on registration certificates
- Add a readiness check for certificate generation prerequisites
- Show generation readiness on the registry certificate section
- Show placement metadata status on the certificate template settings page
- Defer actual PDF rendering and `pdf-lib` dependency to a later slice

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/certificates.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- `app/(dashboard)/settings/certificates/page.tsx`
- workflow docs

### Slice 35: Certificate Placement Metadata Editor

Goal: let workspace admins configure where generated certificate text should appear.

Expected design:

- Add placement editor fields for company name, ITF employer number, certificate number, and issue date
- Capture `x`, `y`, and `fontSize` for each field
- Validate all placement values as non-negative numbers
- Store the result in `CertificateTemplate.placementMetadata`
- Update certificate generation readiness once required placement metadata exists

Expected files:

- `lib/certificates.ts`
- `app/(dashboard)/settings/certificates/actions.ts`
- `app/(dashboard)/settings/certificates/page.tsx`
- workflow docs

### Slice 36: Certificate PDF Generation Engine

Goal: generate downloadable employer registration certificates from the active template design.

Expected design:

- Use the uploaded certificate template design as a PDF, PNG, or JPEG background
- Draw company name, ITF employer number, certificate number, and issue date using placement metadata
- Store the generated PDF as a private `CERTIFICATE` document
- Link the generated document back to the registration certificate
- Allow authorized reviewers to generate or regenerate the PDF from the company registry detail page
- Allow authorized users to open the generated certificate inline in a new tab
- Keep generated certificates behind the existing storage provider abstraction

Expected files:

- `lib/certificates.ts`
- `app/(dashboard)/registry/[companyId]/certificate/actions.ts`
- `app/(dashboard)/registry/[companyId]/certificate/[certificateId]/route.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 37: Certificate Layout Preview

Goal: let workspace admins test template placement metadata before generating real certificates.

Expected design:

- Render a sample certificate from a template design and placement metadata
- Use fixed sample values for company name, ITF employer number, certificate number, and issue date
- Serve the preview PDF inline without creating database documents
- Restrict preview access to workspace-management users
- Add a `Preview PDF` link beside configured certificate template designs

Expected files:

- `lib/certificates.ts`
- `app/(dashboard)/settings/certificates/[templateId]/preview/route.ts`
- `app/(dashboard)/settings/certificates/page.tsx`
- workflow docs

### Slice 38: Certificate Signature Assets

Goal: manage official certificate signatures from system settings and render them on generated certificates.

Expected design:

- Add signature asset records for Director-General/CE and Director, Revenue, Inspectorate & Compliance
- Upload signature images from settings as PNG or JPEG files
- Make a newly uploaded signature active and retire the previous active signature of the same kind
- Store signature images as private documents
- Add signature placement metadata to certificate templates
- Render active signature images on generated certificates and previews
- Require both active signatures before official certificate generation

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/signatures.ts`
- `lib/certificates.ts`
- `app/(dashboard)/settings/signatures/page.tsx`
- `app/(dashboard)/settings/signatures/actions.ts`
- `app/(dashboard)/settings/signatures/[signatureAssetId]/image/route.ts`
- `app/(dashboard)/settings/certificates/page.tsx`
- workflow docs

### Slice 39: Managed Registration Number Registry

Goal: control ITF employer numbers and registration certificate numbers from a managed register.

Expected design:

- Add a flexible managed number model for ITF employer numbers and certificate numbers
- Support available, reserved, assigned, and voided lifecycle states
- Store policy code, batch code, notes, and JSON metadata for future numbering policy changes
- Let workspace admins create or import numbers from settings
- Show who created and issued each number, when it was issued, and which company received it
- Replace manual HOD number entry with selected available managed numbers
- Assign both selected numbers atomically during employer registration completion

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/managed-numbers.ts`
- `lib/registration.ts`
- `lib/registry.ts`
- `app/(dashboard)/settings/numbers/page.tsx`
- `app/(dashboard)/settings/numbers/actions.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 40: Public Certificate Verification

Goal: let the public verify the authenticity of ITF employer numbers and certificate numbers.

Expected design:

- Add a public verification page outside the authenticated dashboard
- Allow lookup by ITF employer number or certificate number
- Return limited public-safe information only
- Show company name, status, certificate issue date, and certificate validity state
- Avoid exposing internal workflow notes, evidence documents, or private metadata
- Generate QR codes that point to the public verification URL
- Render the QR code on generated certificates using certificate placement metadata
- Add abuse controls such as rate limiting or captcha in a later hardening slice if needed

Expected files:

- `app/verify/page.tsx`
- `app/verify/qr/route.ts`
- `lib/qr.ts`
- `lib/public-verification.ts`
- `lib/certificates.ts`
- `app/(dashboard)/settings/certificates/page.tsx`
- `app/(dashboard)/settings/certificates/actions.ts`
- workflow docs

### Slice 41: Management Statistics Dashboard

Goal: provide management with real-time operational and financial statistics.

Expected design:

- Show complied companies count
- Show registration revenue received
- Show reimbursement claims paid
- Show pending desk/workflow counts
- Add filters by year, area office, company status, and record tier
- Keep aggregation logic separate from dashboard UI so it can later move to materialized views
- Add an Area Office workload breakdown

Expected files:

- `app/(dashboard)/management/page.tsx`
- `app/(dashboard)/layout.tsx`
- `lib/management-dashboard.ts`
- workflow docs

### Slice 42: Management Scope and Breakdown

Goal: scope management analytics by user role and Area Office responsibility.

Expected design:

- Derive HQ or Area Office scope from the logged-in user's role and memberships
- Let HQ/workspace users see all Area Offices or filter to one Area Office
- Restrict Area Office management users to their assigned Area Office
- Add explicit HQ summary cards
- Add Area Office performance breakdown for complied companies, revenue, and claims paid
- Keep the scope logic schema-free until custom management assignments are required

Expected files:

- `lib/management-dashboard.ts`
- `app/(dashboard)/management/page.tsx`
- workflow docs

### Slice 43: Registration One-Time Guard

Goal: enforce the rule that ITF employer registration happens once per company.

Expected design:

- Prevent submission of a new registration workflow when a company already has an ITF employer number
- Prevent Headquarters completion when the company is already active/registered
- Hide registration action buttons for already registered companies
- Show guidance that subsequent yearly obligations belong to annual compliance and related workflows
- Preserve annual compliance, training plan, training approval, and claims flows as recurring records

Expected files:

- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 44: Annual Compliance Certificate Number Refactor

Goal: move certificate numbering from employer registration to annual compliance.

Expected design:

- Treat the ITF employer number as the permanent registration number issued once at registration
- Treat certificate numbers as annual compliance certificate numbers
- Add a compliance certificate model tied to `ComplianceYear`
- Move active certificate number allocation from registration completion to annual compliance/certificate issuance
- Update public verification to verify ITF employer numbers and annual compliance certificate numbers
- Keep generated PDFs historically stable after issue
- Keep the older registration certificate number field as a legacy compatibility field until a data cleanup migration removes it

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/compliance.ts`
- `lib/public-verification.ts`
- `lib/managed-numbers.ts`
- `lib/registration.ts`
- registry/compliance UI
- workflow docs

### Slice 45: Automatic Compliance Certificate PDF Generation

Goal: generate the employer's annual compliance certificate document as soon as ITF issues the annual certificate number.

Expected design:

- Reuse the certificate template, placement metadata, signature assets, and QR-code renderer
- Generate a private PDF document immediately after annual compliance certificate issuance
- Link the generated PDF back to `ComplianceCertificate`
- Let employers and ITF users open the certificate inline from the compliance year card
- Keep a manual generate/regenerate action for fallback when storage, signatures, or QR-code setup needs retry
- Keep generated annual compliance certificates behind authenticated routes

Expected files:

- `lib/certificates.ts`
- `lib/compliance.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/compliance/actions.ts`
- `app/(dashboard)/registry/[companyId]/compliance/[complianceYearId]/certificate/[certificateId]/route.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 46: Training Plan and L&D Submission Foundation

Goal: model the yearly mid-submission that happens before training approval requests.

Expected design:

- Add a `TrainingPlanSubmission` model tied to company and year
- Capture Form 3A-style L&D personnel details as repeatable structured child records
- Track the yearly due date as 31 March
- Track prompt submission score as 1% when submitted on or before the due date
- Add required evidence uploads for annual training plan CSV document and L&D personnel CV
- Provide a downloadable CSV template with required training plan columns
- Allow employers to create a draft, upload required evidence, and submit the package
- Show submissions on the company registry detail page
- Keep full Area Office/HOT/RO/HQ routing for a later workflow slice

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/training-plan.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/training-plans/actions.ts`
- `app/(dashboard)/registry/[companyId]/training-plans/new/page.tsx`
- `app/(dashboard)/registry/[companyId]/training-plans/new/personnel-fields.tsx`
- `app/(dashboard)/registry/[companyId]/training-plans/template/route.ts`
- `app/(dashboard)/registry/[companyId]/training-plans/[submissionId]/evidence/actions.ts`
- `app/(dashboard)/registry/[companyId]/training-plans/[submissionId]/evidence/new/page.tsx`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 47: Training Plan Upload Error UX

Goal: keep failed Training Plan evidence uploads inside a usable product screen.

Expected design:

- Redirect failed uploads back to the evidence upload page
- Show a styled error alert instead of a plain text route response
- Preserve the selected evidence type where possible
- Provide a retry button that returns focus to the upload form
- Keep successful uploads redirecting back to the company registry detail page

Expected files:

- `app/(dashboard)/registry/[companyId]/training-plans/[submissionId]/evidence/upload/route.ts`
- `app/(dashboard)/registry/[companyId]/training-plans/[submissionId]/evidence/new/page.tsx`
- workflow docs

### Slice 48: Office Officer Management

Goal: let workspace admins manage office placement and officer assignments without reseeding.

Expected design:

- Treat Headquarters and Area Offices as selectable office placement scopes
- List Headquarters first, then all Area Offices seeded from the Area Office register
- Show active/inactive status for each Area Office
- Activate or deactivate an Area Office
- Assign existing users to Area Office roles or Headquarters roles
- Support Area Office roles: `AREA_MANAGER`, `HORIC`, `REVENUE_ACCOUNTANT`, `HEAD_OF_TRAINING`, and `REIMBURSEMENT_OFFICER`
- Support Headquarters roles: `DIRECTOR_FSD`, `HEAD_OF_DIVISION`, `HQ_REIMBURSEMENT_OFFICER`, and specialist ITF workflow roles
- Show currently assigned officers per office placement
- Remove an officer assignment
- Continue using `Membership.areaOfficeId` so existing workflow access checks respond immediately

Expected files:

- `lib/area-office-management.ts`
- `app/(dashboard)/settings/offices/actions.ts`
- `app/(dashboard)/settings/offices/page.tsx`
- `app/(dashboard)/settings/area-offices/page.tsx`
- `app/(dashboard)/layout.tsx`
- workflow docs

### Slice 49: User Directory Management

Goal: let workspace admins create real staff users before assigning them to Area Office or HQ workflow roles.

Expected design:

- Add staff metadata to users: staff number, phone number, department, and job title
- Create individual users from a settings page
- Edit staff user records after creation
- Import users in bulk from CSV
- Provide a downloadable user CSV template
- Show user assignments and active status in the directory
- Use created users in Area Office officer assignment dropdowns
- Keep password/auth integration as a later Workspace identity slice; local development users continue using the shared dev password after assignment
- Keep the user directory compatible with a future parent Workspace identity source; this child app owns reimbursement-specific office and workflow assignments

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/user-directory.ts`
- `app/(dashboard)/settings/users/actions.ts`
- `app/(dashboard)/settings/users/page.tsx`
- `app/(dashboard)/settings/users/template/route.ts`
- `app/(dashboard)/settings/users/import/route.ts`
- `lib/area-office-management.ts`
- `app/(dashboard)/settings/offices/page.tsx`
- `app/(dashboard)/layout.tsx`
- workflow docs

### Slice 50: Role Management Foundation

Goal: give workspace admins visibility into the current reimbursement roles before making roles configurable.

Expected design:

- Add a Roles settings page
- Group roles by `SYSTEM`, `HEADQUARTERS`, `AREA_OFFICE`, and `EMPLOYER`
- Show the current system-managed roles backed by the Prisma `Role` enum
- Show role descriptions and current permissions
- Mark roles as locked/system-managed for now
- Keep custom role creation as a later authorization-model slice

Expected files:

- `lib/role-management.ts`
- `app/(dashboard)/settings/roles/page.tsx`
- `app/(dashboard)/layout.tsx`
- architecture docs
- workflow docs

### Slice 51: Role-Aware Registry Actions

Goal: make the registration workflow page show actions according to the logged-in user's role and current desk.

Expected design:

- Compute available registration actions from current desk, status, and role
- Show employer submission/payment actions only to employer roles or admin override
- Show Area Office actions only to the matching Area Office desk role or admin override
- Show Headquarters actions only to the matching HQ desk role or admin override
- Label admin-visible workflow controls as admin/testing override
- Show a clear note when the registration is on another user's desk
- Keep server actions as the source of truth for authorization

Expected files:

- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 52: Role-Aware Dashboard Navigation

Goal: reduce dashboard clutter by showing navigation links according to the logged-in user's permissions.

Expected design:

- Always show Overview
- Show Registry to users with company read, registry review, or registry submit access
- Show Compliance to compliance reviewers or submitters
- Show Claims to claims reviewers, approvers, or submitters
- Show Management to ITF roles with workspace management or audit-read access
- Show Users, Offices, Roles, Numbers, Certificates, and Signatures only to workspace managers
- Keep page-level authorization checks as the source of truth

Expected files:

- `app/(dashboard)/layout.tsx`
- workflow docs

### Slice 53: Role-Aware Dashboard Work Queue

Goal: make the dashboard landing page prioritize the logged-in user's active work.

Expected design:

- Replace scaffold-style dashboard hero copy with a desk/work-queue summary
- Show open WorkItems routed to the user's role, Area Office, company, or workspace scope
- Include assigned role, work item kind, scope, priority, and continue link
- Add employer-side registration prompts where no WorkItem exists yet
- Keep workflow module overview secondary
- Keep attention scoping centralized in the existing attention helper

Expected files:

- `app/(dashboard)/dashboard/page.tsx`
- `lib/attention.ts`
- `lib/dashboard-work-queue.ts`
- workflow docs

### Slice 54: Training Plan Workflow Routing Foundation

Goal: start the Training Plan and L&D Submission workflow with Area Office routing and dashboard work items.

Expected design:

- Add `TrainingPlanDesk` to persist the current desk for each submission
- Route employer-submitted Training Plan packages to Area Manager
- Support Area Office routing: AM -> HOT -> Reimbursement Officer -> HOT -> AM
- Allow AM to request employer correction
- Create and resolve WorkItems as the submission moves between desks
- Show role-aware Training Plan workflow buttons on company registry detail
- Add employer correction prompts to the dashboard work queue
- Keep Headquarters continuation as a later slice

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/training-plan.ts`
- `lib/registry.ts`
- `lib/dashboard-work-queue.ts`
- `app/(dashboard)/registry/[companyId]/training-plans/actions.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 55: Compliance-Driven Registration Policy

Goal: align registration completion with the rule that registration is one-time, while certificates are issued from annual compliance.

Expected design:

- Complete employer registration by assigning only the managed ITF employer number
- Stop creating a standalone registration certificate during registration completion
- Automatically create the current-year compliance filing as a draft after registration completion
- Require completed registration before an annual compliance filing can be created
- Remove the registration-certificate card from the company detail page
- Keep annual compliance certificates as the certificate-generation path
- Keep older registration-certificate data structures available for legacy cleanup in a later slice

Expected files:

- `lib/registration.ts`
- `lib/compliance.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- architecture and workflow docs

### Slice 56: Head of Division Number Registry Access

Goal: let Head of Reimbursement Division manage the number register needed to complete registrations and issue compliance certificates.

Expected design:

- Add a focused `numbers:manage` permission
- Grant `numbers:manage` to System Admin, Workspace App Admin, and Head of Reimbursement Division
- Use `numbers:manage` for `/settings/numbers` page access and server-side number creation/listing
- Show the Numbers navigation link to roles with `numbers:manage`
- Keep wider workspace settings restricted to workspace managers

Expected files:

- `lib/rbac.ts`
- `lib/managed-numbers.ts`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/settings/numbers/page.tsx`
- architecture and workflow docs

### Slice 57: Registration Submit Placement

Goal: make employer registration submission happen after the employer has reviewed evidence and compliance context.

Expected design:

- Remove the employer submit/resubmit action from the Registration Workflow card
- Add a focused Registration Submission card below Evidence Summary and Compliance Years
- Keep the existing submit/resubmit authorization and server action
- Preserve the selected Area Office requirement before registration can be submitted
- Keep reviewer workflow actions inside the Registration Workflow card

Expected files:

- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 58: Training Plan Compliance Gate

Goal: ensure only compliant companies can create, upload evidence for, or submit Training Plan and L&D packages.

Expected design:

- Treat a company as compliant for a training year only when that year's compliance return is approved and certified
- Hide the current-year Training Plan create link until current-year compliance is approved and certified
- Show a clear compliance-required notice on the company detail page
- Prevent Training Plan evidence upload when the submission year is not certified
- Prevent Training Plan package submission when the submission year is not certified
- Keep routing of already submitted Training Plan packages unchanged

Expected files:

- `lib/training-plan.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- architecture and workflow docs

### Slice 59: Registration RA Direct Correction Return

Goal: allow the Revenue Accountant to return a registration directly to the company for minor corrections, then receive the corrected package back at the RA desk.

Expected design:

- Add a nullable correction return desk to registration applications
- Add `ra_to_company` as a registration desk transition
- Let RA request employer correction without routing back through HORIC or AM
- When the employer resubmits, return the workflow to the stored RA desk
- Reopen the appropriate RA work item after employer resubmission
- Keep existing AM correction and receipt-review correction behavior intact

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- architecture and workflow docs

### Slice 60: Evidence Soft Delete

Goal: let users remove mistakenly uploaded evidence without destroying audit history.

Expected design:

- Add a delete action beside uploaded evidence documents on the company detail page
- Soft-delete evidence by setting `isActive = false` and `revokedAt`
- Keep inactive evidence hidden from existing document lists
- Record an internal comment for audit context
- Prevent deletion of generated certificates, certificate templates, and signature images through this evidence action
- Keep the stored object intact for audit/recovery until a later retention policy decides physical deletion

Expected files:

- `lib/evidence.ts`
- `app/(dashboard)/registry/[companyId]/evidence/actions.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- workflow docs

### Slice 61: Registration-to-Compliance UX Guide

Goal: make the new-company order of operations clear and replace pre-registration compliance errors with friendly UI feedback.

Expected design:

- Show a compact new-employer registration path on the company detail page
- Indicate profile, Area Office, evidence, registration, and compliance-year steps
- Disable the Compliance Years create link until the ITF employer number exists
- Show a registration-required notice beside the disabled compliance action
- Catch compliance creation errors and redirect back to the form with a friendly message
- Show a dedicated registration-required state on the compliance creation page

Expected files:

- `app/(dashboard)/registry/[companyId]/page.tsx`
- `app/(dashboard)/registry/[companyId]/compliance/new/page.tsx`
- `app/(dashboard)/registry/[companyId]/compliance/actions.ts`
- workflow docs

### Slice 63: Registered Company Compliance Continuation Path

Goal: clarify that companies with ITF employer numbers do not repeat registration and should continue through annual compliance.

Expected design:

- Treat registered companies as companies with an ITF employer number
- Cover both legacy registered employers and employers registered through the portal in previous years
- Show a registered-company annual compliance path on the company detail page
- Keep the new-company registration path only for companies without ITF employer numbers
- Explain that annual compliance, evidence, and certificate issuance are the next recurring steps
- Avoid changing the registration workflow or legacy-number onboarding in this slice

Expected files:

- `app/(dashboard)/registry/[companyId]/page.tsx`
- architecture and workflow docs

### Slice 64: Legacy Registered Employer Onboarding Action

Goal: let authorized ITF users record employers that registered with ITF before the portal existed.

Expected design:

- Add a legacy registration action for System Admin, Workspace App Admin, Director FSD, and Head of Reimbursement Division
- Require an existing ITF employer number and onboarding note
- Prevent duplicate ITF employer numbers
- Activate the company after the legacy number is recorded
- Automatically open the current-year compliance filing as a draft
- Record the action in the decision trail for audit visibility
- Do not create a standalone registration certificate

Expected files:

- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- architecture and workflow docs

### Slice 65: Area Office Scoped Legacy Employer Onboarding

Goal: allow Area Office Revenue Accountants to help onboard legacy registered employers within their own jurisdiction.

Expected design:

- Add Revenue Accountant to the legacy onboarding action
- Require the company to have an Area Office before RA legacy onboarding
- Allow RA onboarding only when the user's membership is assigned to the company's Area Office
- Keep Headquarters and system administrator override access unchanged
- Preserve duplicate ITF employer number prevention
- Preserve current-year compliance draft creation
- Preserve the audit decision trail

Expected files:

- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- architecture and workflow docs

### Slice 66: Employer Onboarding Type Selection

Goal: let employers choose whether they are registering as new employers or submitting an already registered ITF number for validation.

Expected design:

- Add registration application type: new employer or legacy employer
- Store the legacy employer's claimed ITF registration number separately from the confirmed company ITF employer number
- Require a claimed ITF registration number when the employer selects the legacy path
- Disable the claimed ITF registration number field when the employer selects the new-registration path
- Keep new employer registration behavior unchanged
- Show registration type and claimed ITF number on the company detail workflow card
- Route submitted legacy packages into the existing Area Office registration review queue
- Avoid activating legacy companies until a later validation slice approves the claim

Expected files:

- `prisma/schema.prisma`
- Prisma migration
- `lib/registration.ts`
- `lib/registry.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- architecture and workflow docs

### Slice 67: Legacy Employer Validation Workflow

Goal: let ITF validate employer-submitted legacy registration claims before activating the company.

Expected design:

- Show a dedicated legacy validation action at the Revenue Accountant desk
- Allow Revenue Accountant, authorized Headquarters roles, and system administrators to validate, request correction, or reject a legacy claim
- Keep Revenue Accountant access scoped to the company's Area Office
- Copy the claimed ITF number to the company only when validation succeeds
- Activate the company and approve the registration application on validation
- Open the current-year compliance filing as a draft on validation
- Return correction requests directly to the company and back to the RA desk on resubmission
- Reject invalid claims without activating the company
- Keep registration certificates out of the legacy validation path

Expected files:

- `lib/registration.ts`
- `app/(dashboard)/registry/[companyId]/registration/actions.ts`
- `app/(dashboard)/registry/[companyId]/page.tsx`
- architecture and workflow docs
