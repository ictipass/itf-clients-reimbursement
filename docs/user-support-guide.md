# User, Support, and Stakeholder Guide

Last reviewed: 22 June 2026

## Document Purpose

This guide helps:

- Employers use the ITF Integrated Contribution and Reimbursement Platform.
- ITF officers understand their workflow responsibilities.
- System supporters diagnose common user problems.
- Stakeholders understand the product's implemented capabilities.

This is a living document. Each workflow is a self-contained module that can be updated without
rewriting the entire guide.

## Product Overview

The ITF Integrated Contribution and Reimbursement Platform manages the employer lifecycle from registration through annual
compliance, Training Plan submission, training approval, monitoring, and reimbursement claims.

The application separates:

- **Identity**: the person signing in.
- **Organization access**: the employer or ITF office the person represents.
- **Role**: the actions the person is authorized to perform.
- **Workflow desk**: the officer or role currently expected to act.
- **Awareness item**: information visible to an office without granting approval authority.
- **Management designation**: an ITF staff flag that grants access to management summaries within
  the staff member's Headquarters or Area Office scope.

## Getting Access

### New Employer Portal Account

1. Open the landing page.
2. Select **Get started**.
3. Enter first name, last name, work email, password, and password confirmation.
4. Submit the form.
5. Open the email verification link.
6. Sign in after verification.
7. Create the first company record and begin registration.

### Invited Organization User

1. Open the organization invitation email.
2. If an account already exists, sign in with the invited email.
3. If no account exists, create an account from the invitation page.
4. Verify the email address.
5. Sign in and return to the invitation.
6. Accept the invitation.

### Google Sign-In

Google sign-in appears only when Workspace identity has been configured. The Google email must be
verified and authorized for the application.

### Recovering Access

- Use **Forgot password?** on the sign-in page for portal-password accounts.
- Use **Request a fresh verification link** when an account-verification link expires.
- Contact an Employer Administrator for organization-access changes.
- Contact ITF system support when an employer organization has no available administrator.

## Navigation and Attention

### Dashboard

The dashboard shows role-relevant summaries and work items.

- **Action required** means the signed-in user's desk or role must act.
- **Awareness** means the user should know about the item but cannot necessarily approve it.
- Notification badges show pending attention.

### Side Navigation

Only modules permitted by the signed-in user's role are displayed.

**My Settings** is available to every signed-in user. Administrative settings such as Users,
Offices, Roles, Certificates, and Signatures remain restricted to authorized administrators.

### Workspace Waffle

The nine-dot launcher shows Workspace applications available to the user. Notification badges can
show attention waiting inside the reimbursement application.

### Active Organization

Users with access to multiple employers must select the employer they are currently representing.
Changing the active organization changes the visible records, role, and available actions.

## Role Summary

| Role | Primary responsibility |
| --- | --- |
| Employer Administrator | Manage employer profile, organization users, and submissions |
| Employer Submitter | Prepare and submit employer workflow records |
| Employer Viewer | Read-only employer visibility |
| Area Manager | Area Office entry/exit point and final local routing |
| HORIC | Registration/contribution review and verification |
| Revenue Accountant | Registration assessment and legacy-employer validation |
| Head of Training | Training workflow review |
| Reimbursement Officer | Training and claims operational review |
| Director FSD | Headquarters routing and claims authority where configured |
| Head of Division | Headquarters reimbursement oversight, numbers, and approvals |
| HQ Revenue Accountant | Annual compliance review and certification |
| HQ Reimbursement Officer | Headquarters reimbursement/claims review |
| Director General | National executive oversight where assigned |
| Director, Revenue, Inspectorate & Compliance | National revenue, inspectorate, and compliance oversight |
| System/Workspace Administrator | Technical configuration and emergency administration |
| Auditor | Read-only audit visibility |

Exact actions remain controlled by the application's role and permission rules.

## Workflow 1: New Employer Registration

1. Employer Administrator creates the company and selects an Area Office.
2. Employer uploads required registration evidence.
3. Employer creates the current-year compliance filing before registration submission.
4. Employer submits registration.
5. Area Manager forwards the submission to HORIC.
6. HORIC examines and forwards it to the Revenue Accountant.
7. Revenue Accountant assesses the documents and recommends the training contribution.
8. HORIC verifies the recommendation.
9. Area Manager releases the recommendation to the employer dashboard, optionally with email.
10. Employer pays and uploads payment evidence.
11. Area Office reviews the receipt and notifies Headquarters.
12. Director FSD forwards the registration to Head of Division.
13. Head of Division completes registration using a managed ITF employer number.
14. The company becomes registered, while annual compliance remains the route to a certificate.

Minor corrections may be returned directly to the employer and then returned to the requesting
desk.

## Workflow 2: Legacy Employer Validation

1. Employer creates a company record.
2. Employer selects **Already registered with ITF**.
3. Employer enters the existing ITF employer number.
4. Employer submits the validation request.
5. Area Manager forwards to HORIC.
6. HORIC forwards to the Revenue Accountant.
7. Revenue Accountant validates the claim, requests correction, or rejects it.
8. Successful validation activates the company and opens annual compliance.

Authorized ITF users can also onboard validated legacy employers directly within their permitted
scope.

## Workflow 3: Annual Compliance and Certificate

1. Registered employer creates or opens the relevant compliance year.
2. Employer uploads compliance and payment evidence.
3. Employer submits the compliance filing.
4. Area Manager, HORIC, and Revenue Accountant receive awareness for their jurisdiction.
5. Head of Division and HQ Revenue Accountant receive actionable review items.
6. Authorized HQ reviewer approves or requests correction.
7. HQ issues the annual compliance certificate number.
8. The system generates the downloadable certificate using the active design and signatures.
9. Employer downloads the certificate.
10. Approved compliance unlocks that year's Training Plan and L&D submission.

Registration is one-time. Compliance and certificates are annual.

## Workflow 4: Training Plan and L&D Submission

1. Employer confirms the company has an approved compliance certificate for the relevant year.
2. Employer creates the yearly Training Plan submission.
3. Employer adds one or more L&D personnel.
4. Employer downloads the CSV template.
5. Employer prepares and uploads the Training Plan CSV.
6. Employer uploads required CV or policy evidence.
7. Employer submits the package.
8. Area Office training roles review, route, approve, or request correction.
9. Area Manager performs final local approval.

The CSV columns include staff name, department, identified gap, training title, estimated cost,
date, location, and trainer.

## Workflow 5: Training Approval Request

An employer can start a request in either of two ways:

- Open an approved Training Plan line item and select **Create Form 4A**.
- Select **Request unplanned training** when an impromptu skills gap was not captured in the
  approved annual plan.

For an unplanned request, the employer must explain the gap or operational need.

1. Employer creates the Form 4A Training Approval Request.
2. Employer selects **Local physical** or **Local online**.
3. Employer completes training details and participant records.
4. For online training, the employer supplies and maintains the URL, meeting ID, password or
   passcode, time, and joining instructions. ITF can view these details but does not own them.
5. Employer selects each participant's training area from Management, Supervisory, Occupational,
   or Health & Safety.
6. Employer uploads supporting evidence.
7. The system validates completeness.
8. Employer submits the request.
9. The request routes through Area Manager, Head of Training, Reimbursement Officer, Head of
   Training, and Area Manager.
10. Reviewers approve or return directly to the employer for correction.

Local physical training should ordinarily be requested at least two weeks before implementation;
international training should ordinarily be requested at least three weeks before implementation.
Final enforcement remains subject to approved policy.

## Workflow 6: Training Monitoring

1. An approved Training Approval Request opens a monitoring record.
2. Form 6A is used for local physical training and Form 6B for virtual local training.
3. Monitoring officer records date, time, meeting details, evidence, and evaluation ratings.
4. Monitoring record is submitted and routed for review.
5. Reviewer approves or requests correction.

Area Office dashboards show monitoring entries under:

- **Happening Today**
- **Coming Up / Happening Next Week**

The Monitoring page also provides an Area Office calendar view.

## Workflow 7: Change of Area Office Jurisdiction

1. Employer opens **Jurisdiction Requests**.
2. Employer selects the company and requested destination Area Office.
3. Employer explains the reason for the change.
4. The current Area Manager receives an action-required attention badge and queue item.
5. The Area Manager grants or rejects the request and may record a review note.
6. On approval, the company's Area Office is changed to the requested office.
7. On rejection, the company remains under its current Area Office.

Only one pending jurisdiction request is allowed for a company at a time.

## Workflow 8: Reimbursement Claim

The implemented claim foundation currently supports:

1. Opening **Claims** and selecting one or more available approved trainings for the same company.
2. Using approved trainings with approved monitoring as the claim's training evidence.
3. Adding or removing available trainings while the claim remains a draft.
4. Capturing employer Form 1 claim and declaration data.
5. Uploading supporting evidence.
6. Recording reviewer Form 1B recommended amounts and remarks.
7. Recording Form 2A/2B calculation rows.

An approved training detail page shows whether the training is available for reimbursement or is
already attached to a claim. Claims are created from **Claims**, not from the individual training
detail page.

The final claims approval, payment, appeal, and settlement workflow remains subject to the approved
claims and payment SOP.

## Evidence and Document Handling

- Documents are private and opened inline for authorized review.
- Unsupported or suspicious files are rejected or quarantined.
- Mistaken uploads can be soft-deleted while preserving audit history.
- Accepted document types depend on the workflow.
- Uploaded statutory ITF forms are generally replaced by structured electronic forms; supporting
  evidence such as receipts, attendance sheets, reports, photographs, and certificates is uploaded.

## Certificates and Public Verification

- ITF employer numbers belong to one-time employer registration.
- Certificate numbers belong to annual compliance.
- Certificates are generated from an active template and signature assets.
- QR codes point to public certificate verification.
- Public verification reveals only safe authenticity information.

## Employer Organization User Management

Employer Administrators can:

1. Open **Organization users**.
2. Invite an administrator, submitter, or viewer.
3. Change a member's role.
4. Deactivate or reactivate access.
5. Review recent access history.

An organization must always retain at least one active Employer Administrator.

## Personal Settings and Calendar Notifications

Every signed-in user can open **My Settings** or `/settings`.

To connect the platform calendar:

1. Open **My Settings**.
2. Enable the private calendar feed.
3. Copy the subscription URL.
4. In Google Calendar, select **Other calendars > From URL**.
5. In Apple Calendar, Outlook, or another mobile calendar, add a subscribed calendar.

The feed includes training and monitoring events within the user's organization or office scope.
Treat the subscription URL like a password. Use **Reset private link** if it is exposed.

## ITF Administration

Authorized administrators can manage:

- Users and account status
- Headquarters and Area Office assignments
- Employer emergency-access replacement
- Role reference information
- Managed ITF employer and certificate numbers
- Certificate designs and placement metadata
- Signature assets
- Email delivery attempts
- Audit logs
- Management statistics

### Creating Another System Administrator

Creating a system administrator is intentionally a two-step operation:

1. Create the person's user account under **Settings > Users**.
2. Open **Settings > Offices**, expand **Headquarters**, and assign the `SYSTEM_ADMIN` role.

This separates identity creation from authority assignment and preserves assignment history.

### Management Staff Designation

System administrators can mark an ITF staff user as management from **Settings > Users**.

- Headquarters management staff receive national management-summary scope.
- Area Office management staff receive summaries only for their assigned Area Office.
- The user must have an ITF Headquarters or Area Office assignment before management access is
  enabled.

## Support Playbook

### User Cannot Sign In

1. Confirm the email address.
2. Confirm email verification is complete.
3. Confirm the user account is active.
4. Confirm at least one active membership exists.
5. For portal accounts, use password recovery.
6. For Google/Workspace accounts, verify identity-provider configuration and entitlement.

### User Cannot See an Employer

1. Confirm an active membership exists for the employer organization.
2. Confirm the correct active organization is selected.
3. Confirm the user's role permits the requested module.
4. Never solve the issue by granting broad system-administrator access.

### Officer Has No Dashboard Work Item

1. Confirm the workflow's current desk.
2. Confirm the officer has an active role assignment.
3. Confirm the Area Office or Headquarters scope matches the workflow.
4. Distinguish an action item from an awareness item.
5. Review the audit log and work-item record.

For a jurisdiction request, confirm that:

- The request status is `PENDING`.
- The company had a current Area Office when the request was submitted.
- The reviewing user has the active `AREA_MANAGER` role for that Area Office.
- A `JURISDICTION_CHANGE_REVIEW` work item exists and is still open.

### Settings Opens the Dashboard

1. Confirm the user is signed in and is not blocked by a temporary-password change.
2. Confirm the intended personal route is `/settings` or `/settings/preferences`.
3. Personal settings should be available to every signed-in user.
4. Administrative settings still redirect unauthorized users because they require workspace
   administration, audit, or number-management permissions.

### Upload Fails

1. Confirm file type and size.
2. Confirm the file is not password-protected or active-content-bearing.
3. Confirm storage configuration.
4. Review quarantine or upload-security logs.
5. Ask the user to retry with a clean supported file.

### Certificate Does Not Generate

1. Confirm compliance approval and certificate number issuance.
2. Confirm an active certificate template exists.
3. Confirm both active signature assets exist.
4. Confirm storage configuration.
5. Use authorized manual generate/regenerate only after correcting assets.

### Email Is Not Received

1. Confirm `EMAIL_DELIVERY_MODE`.
2. Review **Settings > Email delivery**.
3. Confirm the recipient email and Resend sender/domain configuration.
4. In development-link modes, use the displayed development link.

## Known Product Boundaries

- Final claims and payment workflow is not complete.
- Remita and reimbursement-payment integrations are not complete.
- Configurable roles and workflow policies remain future work.
- Production Workspace identity integration remains future work.
- The current automated-test suite is foundational, not comprehensive.

## Officer Account Provisioning

System Administrators create ITF officers from **Settings > Users**, individually or by CSV
import. Successful creation generates a temporary password, sends a welcome email, and requires
the officer to change that password at first sign-in.

The Users table scrolls horizontally on narrower screens so management, reset-access, edit, and
account-status actions remain reachable.

During development, temporary credentials are also written to:

```text
storage/development-officer-credentials/<officer-email>.txt
```

This directory is git-ignored and is never written in production. **Reset local access** creates
fresh credentials when an officer loses local access. Google and future Workspace SSO users manage
passwords through their identity provider instead.

## Employer Evidence Policy

- Employers can delete evidence only while its workflow is `DRAFT` or `CHANGES_REQUESTED`.
- Submitted evidence is permanently locked.
- ITF officers cannot delete employer-uploaded evidence.
- Employers cannot delete evidence uploaded by ITF officers.
- **Other Supporting Evidence** requires a descriptive document name.

## Adding a New Workflow Module to This Guide

Copy this structure:

```markdown
## Workflow N: Name

### Purpose
### Who Can Start It
### Preconditions
### Step-by-Step Flow
### Correction and Rejection Paths
### Outputs
### Support Checks
### Known Boundaries
```

Update the role summary and support playbook only when the new workflow changes them.
