# ITF Clients' Reimbursement Enterprise Architecture

## Recommended Product Name

Recommended working name: **ITF Reimbursement Gateway**.

Rationale: the name sounds institutional, fits within a broader ITF Workspace app launcher, and communicates a controlled entry point for employer registration, training approval, claims packaging, and reimbursement governance. Management can still rename it later without changing the domain model.

## Architectural Positioning

ITF Reimbursement Gateway should be a domain application inside ITF Workspace.

ITF Workspace remains responsible for:

- Centralized identity provider
- Enterprise app launcher
- Access governance platform
- Organization registry
- Area office registry
- App registry
- Enterprise-wide audit and compliance visibility

This application remains responsible for:

- Employer ITF registration workflow
- Annual compliance cycle management
- Training contribution eligibility tracking
- L&D policy, training policy, and training plan evidence
- Form 4A pre-training approval workflow
- Reimbursement claim packaging and review
- Claim completeness validation
- Domain-level audit events
- Workflow state transitions and reimbursement decisions

n8n should integrate around the application. It should not own core business rules.

Use n8n later for:

- Notifications
- Scheduled reminders
- Webhook delivery
- External document routing
- Cross-system orchestration
- Background integration jobs

## Data Store Recommendation

PostgreSQL with Prisma is appropriate for the core transactional system because the workflow is relational, stateful, auditable, and permission-sensitive.

Recommended storage split:

- PostgreSQL: users, roles, companies, registrations, compliance years, training plans, approvals, claims, forms, document metadata, decisions, comments, audit events, workflow transitions.
- Object storage: uploaded document binaries, photos, certificates, receipts, and signed forms.
- PostgreSQL document metadata: object key, checksum, mime type, file size, owner organization, classification, retention policy, expiry date, uploadedBy, revokedAt, and isActive.
- Search index later, if needed: optional OpenSearch/Meilisearch/Typesense for cross-document discovery after MVP.

Do not store large binary files directly in PostgreSQL for production. It will make backups, restores, scanning, and retention operations unnecessarily heavy.

## Domain Modules

### Workspace Integration

- Workspace tenant and app registration mapping
- Organization profile reference
- User identity reference
- Role assignment synchronization
- App-level entitlement checks

### Employer Registry

- Company profile
- Area Office of choice
- CAC evidence
- Tax Clearance Certificate evidence
- Audited account evidence
- Form 7A registration
- ITF employer number
- Registration status
- Activation/deactivation history

### Area Office And Headquarters Routing

Each company selects one ITF Area Office during registration. The Area Office is the operational entry point for registration, training approval, Training Plan and L&D Submission, and reimbursement claim routing.

Employer registration follows this Area Office hierarchy:

```text
Company -> Area Manager -> HORIC -> Revenue Accountant -> HORIC -> Area Manager -> Company
```

The Revenue Accountant recommends the training contribution amount. HORIC reviews the recommendation, and the Area Manager communicates the recommendation to the company. After payment and receipt upload, the Area Office can notify Headquarters for compliance registration number/certificate processing.

Registration is modeled as a formal `RegistrationApplication` workflow, separate from annual compliance. The first submission moves the application from the company into the Area Manager desk at the selected Area Office.

Registration desk routing decisions are recorded against the registration application so AM/HORIC/RA movement is auditable before the contribution recommendation stage.

The Revenue Accountant records the registration contribution recommendation as a separate assessment linked to the registration application. HORIC review and Area Manager release to company are recorded on the assessment. After release, the company uploads the contribution receipt as a private `CONTRIBUTION_RECEIPT` document attached to the registration application and company.

Area Manager release supports a dashboard-only notification path and a dashboard-plus-email path. The later email delivery slice should use Resend as the preferred transactional email provider.

Remita integration remains a later workflow stage.

Operational attention is modeled separately from email delivery. When a workflow reaches a desk, the app can create a `WorkItem` for a role, user, Area Office, organization, company, or specific workflow record. These work items power dashboard counts now and can later power workspace app-card badges and waffle launcher badges across the broader ITF Workspace.

For registration contribution receipts, company upload returns the registration application to the Area Manager desk and opens an Area Manager attention item for the selected Area Office.

Area Manager receipt review can accept the payment evidence or request correction. Acceptance resolves the Area Manager attention item and leaves the registration in review for the next registration-completion stage. Correction returns the workflow to the company desk for a replacement upload.

Area Office review desks can request minor employer correction without restarting the full routing chain. When the Revenue Accountant returns a registration directly to the company, the registration stores the RA desk as the correction return desk. The employer can resubmit from the company dashboard, and the package returns directly to the Revenue Accountant desk with a fresh attention item.

After receipt acceptance, the Area Manager can notify Headquarters. This moves the registration to the Director FSD desk and creates a `REGISTRATION_HQ_NOTIFICATION` attention item assigned to `DIRECTOR_FSD`.

Director FSD forwards the registration to the Head of Reimbursement Division. This resolves the Director FSD attention item and opens a Head of Division attention item for registration completion.

Head of Reimbursement Division completes the registration by recording the ITF employer number. Completion activates the company, approves the registration application, opens the current-year annual compliance filing as a draft when one does not already exist, records the completion in the decision trail, and resolves HQ registration attention items. Registration does not issue a standalone certificate; the downloadable certificate belongs to annual compliance.

Certificate templates are versioned by workspace. A template can be draft, active, or retired. New certificate records can point to the active template used at issue time so that future design changes do not rewrite historical certificate records.

The foundation seed creates a default active employer registration certificate template for local workflow testing. Workspace-management users can view certificate templates from the settings area and attach a PDF, PNG, or JPEG design file using the same private storage and upload validation used by evidence documents.

Workspace-management users can create draft certificate template versions, activate a version, or retire a version. Activating a template retires other active templates with the same workspace and template code, while already issued certificates continue to point to the template version used at issue time.

Uploaded certificate template designs can be opened inline by workspace-management users for verification. The viewer keeps the document private and sends restrictive response headers so browser rendering does not become an execution surface for uploaded content.

Certificate generation follows the template-as-background path. A certificate template can hold placement metadata for dynamic text such as company name, ITF employer number, certificate number, and issue date. Annual compliance certificates record when a downloadable certificate is generated and which generated document stores the PDF.

Workspace-management users can edit placement metadata from certificate template settings. Each required text field stores an `x`, `y`, and `fontSize` value. The PDF generator uses these values to draw text over the uploaded design with `pdf-lib`, stores the generated result as a private `CERTIFICATE` document, and serves it inline through an authenticated route.

Workspace-management users can also preview a certificate template with sample values before generating real employer certificates. Preview rendering uses the same `pdf-lib` path as real generation but does not create a `Document` record or write a generated certificate to storage.

Certificate signatures are managed as versioned workspace assets. Workspace-management users upload active PNG or JPEG signature images for the Director-General/CE and the Director, Revenue, Inspectorate & Compliance. Uploading a replacement retires the previous active signature for that office, while certificates already generated remain preserved as their own private PDF documents. Certificate template placement metadata controls where each signature image is rendered.

ITF employer numbers and annual compliance certificate numbers are managed through a formal number registry. Each number has a type, lifecycle status, policy code, batch code, notes, and metadata so future numbering policies can be adopted without redesigning the registration or compliance workflow. System administrators, workspace administrators, and the Head of Reimbursement Division can manage this registry. Head of Reimbursement Division completes employer registration by selecting an available ITF employer number; annual compliance certificates receive certificate numbers during compliance certificate issuance.

Employer registration is a one-time workflow. Once a company receives its ITF employer number and becomes active, subsequent yearly obligations should be handled through annual compliance, training plan submission, training approval, and claims workflows rather than submitting registration again.

Registered companies include both employers that completed registration in the portal and legacy employers that registered before the portal existed. In both cases, the operational rule is the same: once the company has an ITF employer number in the app, it should continue through annual compliance rather than repeating registration.

Legacy registered employers can be onboarded by authorized Headquarters or system administrators by recording the existing ITF employer number with an audit note. Area Office Revenue Accountants can also onboard legacy registered employers within their assigned Area Office jurisdiction. This activates the company in the portal and opens the current-year compliance filing as a draft, but it does not issue a registration certificate. The downloadable certificate remains an annual compliance certificate.

Employers can also submit their own registration package as either a new employer registration or a legacy employer validation request. Legacy employer submissions must include the claimed existing ITF registration number, stored separately from the confirmed company ITF employer number until ITF validates it.

The ITF employer number is the permanent registration number. Certificate numbers belong to annual compliance certificates, not the one-time registration event. Annual compliance certificates are tied to `ComplianceYear` records and can be issued only after compliance approval.

Training Plan and L&D submissions are gated by annual compliance. A company can create, upload evidence for, or submit a Training Plan package only for a year where its compliance return has been approved and an annual compliance certificate has been issued. The company detail page also disables the current-year Training Plan entry point until the current-year compliance certificate exists.

When an annual compliance certificate number is issued, the app attempts to generate the downloadable compliance certificate PDF immediately using the active certificate template, configured placement metadata, active signature assets, and QR-code verification URL. The generated PDF is stored as a private `CERTIFICATE` document linked to the `ComplianceCertificate`. A manual generate/regenerate action remains available to authorized ITF users as a fallback if certificate assets or storage configuration need correction.

Public certificate verification exposes only safe certificate authenticity information: company name, ITF employer number, certificate number, status, issue date, and expiry date. Certificate QR codes point to this public verification surface.

Management statistics are exposed through a read-only management dashboard for authorized ITF roles. The dashboard aggregates live operational data for registered companies, complied companies, revenue generated, reimbursement paid, open work items, pending registrations, and Area Office workload. Aggregation logic is isolated so the system can later move expensive calculations to materialized views or scheduled summary tables.

Management dashboard scope is derived from the logged-in user's role and memberships. HQ/workspace management users can see national totals and compare Area Offices, while Area Office management users are restricted to their assigned Area Office statistics. A custom management assignment model can be added later if management needs users whose reporting scope differs from their operational membership.

Office administration is handled from a general Offices settings surface rather than an Area-Office-only screen. Workspace administrators can place officers either at Headquarters or at a specific Area Office. Headquarters assignments use ITF internal memberships with no `areaOfficeId`; Area Office assignments use the same membership model with `areaOfficeId` populated so existing workflow access checks continue to work.

The reimbursement app currently stores staff directory records locally so development can proceed without a parent Workspace identity service. In the production workspace architecture, users should be inherited from the parent ITF Workspace identity layer, while this child app should keep reimbursement-specific memberships, office placement, workflow roles, work items, and audit events. That boundary avoids duplicate identities while preserving local authorization and workflow history.

Roles are currently system-managed through the Prisma `Role` enum and the application permission map. The Roles settings surface exposes these roles by operational scope so administrators can understand current access boundaries. Fully configurable roles should be introduced later with an explicit role-definition model, permission catalog, and migration plan for workflow code that currently relies on fixed role constants.

Headquarters Field Services Department routing follows this hierarchy:

```text
Director FSD -> Head of Division -> HQ Reimbursement Officer -> Head of Division -> Director FSD
```

Training Plan and L&D Submission is modeled separately from annual compliance. It covers Form 3A, the annual training plan, and L&D personnel CV evidence. The training plan is due on or before 31 March and may contribute to scoring.

The first Training Plan and L&D slice stores this process as a yearly `TrainingPlanSubmission` record. Employers can create a draft, capture as many L&D personnel records as their organization requires, upload the annual training plan as a CSV document, upload L&D personnel CV evidence, and submit the package. The downloadable CSV template requires these columns: name of staff, department, gap identified, training title, estimated cost, date, location, and trainer. Submission on or before 31 March earns the prompt submission score. The full Area Office, Head of Training, Reimbursement Officer, and Headquarters routing remains a later workflow slice.

Training approval request routing:

```text
Company -> Area Manager -> Head of Training -> Reimbursement Officer -> Head of Training -> Area Manager -> Company
```

Training Plan/L&D Submission and claims routing:

```text
Company -> Area Manager -> Head of Training -> Reimbursement Officer -> Head of Training -> Area Manager -> Director FSD -> Head of Division -> HQ Reimbursement Officer -> Head of Division -> Director FSD
```

### Annual Compliance

- Compliance year
- Training contribution payment
- L&D policy
- Training policy
- Annual training plan
- Deadline controls
- Eligibility gate

### Training Approval

- Form 4A request
- Training provider
- Venue
- Training dates
- Participant list
- Estimated cost
- ITF reviewer decision
- Approved original and duplicate references

### Reimbursement Claim

- Claim cover letter
- Forms 1A, 1B, 2A, 2B, 3A, 4A, and 5A where applicable
- Attendance sheets
- Payment receipts
- Training reports
- Photographs
- Certificates
- Claimed amount
- Eligible amount
- Review decision
- Settlement status

### Audit and Governance

- Immutable audit events
- Workflow transition log
- Reviewer comments
- Document version history
- Soft deactivation fields
- Revocation timestamps
- Segregation of duties

## Initial RBAC Model

Start conservative and expand only when actual ITF operating roles are confirmed.

- SYSTEM_ADMIN: platform bootstrap and emergency administration.
- WORKSPACE_APP_ADMIN: manages app-level configuration and role mappings.
- ITF_REGISTRATION_OFFICER: reviews employer registration evidence.
- ITF_COMPLIANCE_OFFICER: reviews annual compliance and contribution evidence.
- ITF_TRAINING_APPROVER: reviews Form 4A approval requests.
- ITF_CLAIMS_REVIEWER: reviews reimbursement packages.
- ITF_CLAIMS_APPROVER: approves or rejects reimbursement recommendations.
- ITF_AUDITOR: read-only audit and compliance visibility.
- EMPLOYER_ADMIN: manages a company's profile, users, and submissions.
- EMPLOYER_SUBMITTER: prepares and submits evidence for a company.
- EMPLOYER_VIEWER: read-only company-side visibility.

Every mutating operation should check both role and organization scope.

## Soft Deactivation Policy

Institutional records must not be hard-deleted.

Use patterns such as:

- status enum
- isActive boolean
- deactivatedAt
- revokedAt
- archivedAt
- supersededById
- audit event with actor, reason, timestamp, and previous values where appropriate

Hard deletion should be reserved only for non-business temporary records, and only when explicitly approved.

## Workflow Checklist

### Phase 0: Confirmation and Governance

- Confirm final product name with management.
- Confirm Workspace identity integration contract.
- Confirm employer lifecycle ownership.
- Confirm ITF branch, department, and reviewer hierarchy.
- Confirm required statutory forms and exact field layouts.
- Confirm document retention rules.
- Confirm claim amount calculation policy.
- Confirm reimbursement approval levels and financial delegation limits.
- Confirm whether employers access the app directly or through Workspace invitation.

### Phase 1: Foundation

- Install and configure shadcn/ui.
- Add Auth.js session auth.
- Add Prisma 7 and PostgreSQL.
- Add lazy database client initialization.
- Define RBAC permissions and organization scoping.
- Add audit event writer.
- Add base dashboard shell.
- Add app configuration seed data.
- Add SYSTEM_ADMIN seed.

### Phase 2: Employer Registry MVP

- Company profile CRUD with soft deactivation.
- CAC document metadata upload flow.
- TCC document metadata upload flow.
- Audited account metadata upload flow.
- Form 7A registration data capture.
- Registration review queue.
- Approve, reject, request changes.
- Immutable decision trail.

### Phase 3: Annual Compliance MVP

- Compliance year setup.
- Training contribution payment evidence.
- L&D policy evidence.
- Training policy evidence.
- Annual training plan capture.
- Deadline warnings for 31 March.
- Eligibility status calculation.
- Compliance review queue.

### Phase 4: Training Approval MVP

- Form 4A request creation.
- Training details and participant capture.
- Estimated cost capture.
- Approval workflow before training date.
- Duplicate/original approved-copy references.
- Review decision and audit trail.

### Phase 5: Reimbursement Claim MVP

- Claim package creation.
- Required document checklist engine.
- Forms 1A, 1B, 2A, 2B, 3A, 4A, and 5A metadata.
- Attendance, receipts, reports, photographs, and certificates evidence.
- May submission target warnings.
- Claimed amount and recommended eligible amount.
- Review queue and approval workflow.

### Phase 6: Operations and Management

- Management dashboard.
- Employer dashboard.
- Reviewer workload dashboard.
- SLA and deadline reporting.
- Audit export.
- Claim status reporting.
- Exception reports.

### Phase 7: n8n Integration

- Webhook events for status transitions.
- Reminder schedules for missing documents and deadlines.
- Notification routing.
- External system integration jobs.
- Integration failure replay strategy.

### Phase 8: Production Hardening

- End-to-end tests for critical workflows.
- Role and permission tests.
- Audit trail tests.
- Database migration review process.
- Backup and restore drill.
- Object storage malware scanning.
- Rate limiting and abuse protection.
- Structured logging.
- Error monitoring.
- Performance budgets.
- Deployment rollback plan.
- Data retention and archival automation.

## Open Questions Before Schema Finalization

- What are the exact ITF form field layouts for Forms 1A, 1B, 2A, 2B, 3A, 4A, 5A, and 7A?
- Should companies self-register, or should ITF officers create employer records?
- Can one company have multiple branches or payroll entities?
- Are claims reviewed by area office, national headquarters, or both?
- What exact formula determines statutory contribution and reimbursable amount?
- Are partial approvals allowed on a claim package?
- Should the app integrate with a payment provider, government treasury system, or accounting system?
- What document retention period applies to each evidence type?
- What Workspace identity claims will be available to this app?
