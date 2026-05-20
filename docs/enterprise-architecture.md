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

Headquarters Field Services Department routing follows this hierarchy:

```text
Director FSD -> Head of Division -> HQ Reimbursement Officer -> Head of Division -> Director FSD
```

Training Plan and L&D Submission is modeled separately from annual compliance. It covers Form 3A, the annual training plan, and L&D personnel CV evidence. The training plan is due on or before 31 March and may contribute to scoring.

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
