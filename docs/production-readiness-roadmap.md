# Production Readiness Roadmap

Last reviewed: 7 June 2026

## Purpose

This roadmap describes what remains before the ITF Reimbursement Gateway can be treated as a
production-grade national workflow platform. It is an estimate, not a fixed promise. Claims,
payments, statutory forms, retention, and approval limits still require approved ITF policy and
Standard Operating Procedures.

## Current Position

The application already has functional foundations for:

- Employer portal registration, email verification, Google OAuth, sign-in, password recovery, and
  organization invitations
- Employer organization isolation, active organization switching, user management, and membership
  history
- New and legacy employer registration workflows
- Area Office routing through Area Manager, HORIC, and Revenue Accountant
- Headquarters registration completion and managed ITF employer numbers
- Annual compliance filing, HQ review, annual certificate numbering, downloadable certificates,
  signatures, QR codes, and public verification
- Training Plan and L&D submission, CSV import, approval routing, and correction returns
- Form 4A training approval requests, participant management, evidence, routing, and decisions
- Form 6A/6B training monitoring records, evidence, evaluations, routing, and work queues
- Reimbursement claim creation, Form 1 data, Form 1B recommendation, Form 2A/2B calculation rows,
  and evidence
- Role-aware dashboard, side navigation, workspace waffle, work queues, notification badges,
  management statistics, audit logs, secure uploads, storage adapters, rate limiting, and email
  notification foundations

## Estimate

| Target | Approximate remaining slices | Meaning |
| --- | ---: | --- |
| Controlled stakeholder demonstration | 8-12 | Stable demonstration data and polished primary journeys |
| Controlled MVP/pilot | 25-30 | Real users in selected offices with manual operational fallbacks |
| Production-grade national rollout | 55-70 | Financial integrations, complete testing, operations, security, and policy closure |

The current planning baseline is **60 remaining slices**. Several policy-heavy slices may split
into more slices after the claims and payment SOP is supplied.

## Priority Legend

- **P0**: required before any production pilot
- **P1**: required before broad production rollout
- **P2**: operational maturity or later optimization
- **Policy**: cannot be finalized without approved ITF rules or external-system details

## Remaining Slice Register

### Release Confidence and Test Coverage

1. **P0 - Dedicated test database and integration-test harness**  
   Provide isolated setup, migration, seed, cleanup, and transaction helpers.
2. **P0 - Authentication and account lifecycle integration tests**  
   Cover credentials, Google OAuth mapping, verification, recovery, deactivation, and session expiry.
3. **P0 - Employer tenant-isolation integration tests**  
   Prove one employer cannot read or mutate another employer's records.
4. **P0 - Registration workflow integration tests**  
   Cover new, legacy, correction-return, contribution, receipt, and HQ completion paths.
5. **P0 - Annual compliance and certificate integration tests**  
   Cover authority restrictions, annual reset, number issuance, PDF generation, and public verification.
6. **P0 - Training Plan and training approval integration tests**
7. **P0 - Training monitoring integration tests**
8. **P0 - Claims foundation integration tests**
9. **P1 - Browser end-to-end tests for critical employer and ITF officer journeys**
10. **P1 - Authorization regression matrix tests for every role and protected route**

### Claims and Reimbursement Completion

11. **P0 / Policy - Claims SOP and statutory-form field mapping**
12. **P0 / Policy - Final claims routing and desk-transition model**
13. **P0 / Policy - Complete Form 1 and Form 5A employer filing experience**
14. **P0 / Policy - Complete Forms 1B, 2A, and 2B reviewer calculation rules**
15. **P0 / Policy - HQ claim confirmation and adjustment workflow**
16. **P0 - Claims correction-return, resubmission, rejection, and appeal handling**
17. **P0 - Claim completeness and duplicate-claim validation**
18. **P0 - Claim approval document/package generation**
19. **P0 / Policy - Financial delegation and approval-limit enforcement**
20. **P0 / Policy - Payment workflow and settlement-status foundation**
21. **P0 / Policy - Payment authorization hierarchy**
22. **P1 - Payment advice, remittance evidence, and employer settlement notification**

### Payment and External Integrations

23. **P0 / Policy - Remita payment initiation integration**
24. **P0 - Remita webhook verification, idempotency, and reconciliation**
25. **P0 - Payment exception and manual reconciliation workflow**
26. **P1 - Finance/ERP reimbursement-payment integration contract**
27. **P1 - External correspondence and document-export integration**
28. **P1 - Workspace identity/OIDC production integration**
29. **P1 - Workspace app entitlement and global sign-out integration**
30. **P1 - Workspace cross-app notification-count API**

### Workflow and Policy Administration

31. **P0 - Production-grade configurable workflow deadlines and reminder rules**
32. **P1 - Configurable roles and permission-definition model**
33. **P1 - Configurable workflow routing/policy versions**
34. **P1 - Delegation, acting appointments, leave cover, and reassignment**
35. **P1 - Escalation, overdue-item, and supervisor intervention workflow**
36. **P1 - Bulk employer onboarding and validated legacy-data import**
37. **P1 - Employer profile amendment review and effective-date history**
38. **P2 - Formal complaint, appeal, and dispute workflow**

### Documents, Forms, and Records Governance

39. **P0 / Policy - Approved evidence checklist per workflow and employer type**
40. **P0 - Production malware-scanning service integration**
41. **P0 - Quarantine reviewer workflow and release/reject controls**
42. **P1 - Document replacement/version history and supersession UI**
43. **P1 / Policy - Records retention, legal hold, archive, and disposal rules**
44. **P1 - HOT/WARM/COLD archival jobs and retrieval UI**
45. **P1 - Generated e-form/PDF packages for approved statutory forms**
46. **P2 - OCR/document metadata extraction and assisted validation**

### Production UX and Accessibility

47. **P0 - Full role-by-role usability review and page-section cleanup**
48. **P0 - Mobile/responsive verification of every primary workflow**
49. **P0 - Accessibility audit and WCAG remediation**
50. **P0 - Consistent toast, validation, empty, loading, and error states**
51. **P1 - Guided onboarding and contextual help centre**
52. **P1 - Printable/exportable workflow summaries and decision trails**
53. **P1 - Advanced search, saved filters, and bulk operational actions**

### Operations, Security, and Deployment

54. **P0 - Production environment, secrets, domains, storage, and database provisioning**
55. **P0 - CI pipeline for lint, tests, migration checks, build, and deployment**
56. **P0 - Backup, restore, disaster-recovery, and migration rollback rehearsal**
57. **P0 - Observability: structured logs, traces, metrics, alerts, and error reporting**
58. **P0 - Security penetration test and remediation**
59. **P0 - Data-protection, privacy, consent, and access-review sign-off**
60. **P0 - Production runbook, support escalation, training, pilot, and go-live checklist**

## Recommended Execution Order

1. Obtain and approve the claims/payment SOP.
2. Build the dedicated integration-test harness and critical workflow tests.
3. Complete claims approval and payment workflows.
4. Integrate Remita and production malware scanning.
5. Complete production UX, accessibility, and role-authority reviews.
6. Provision production infrastructure and CI/CD.
7. Run security, backup/restore, performance, and pilot exercises.
8. Roll out office-by-office with measured support and rollback procedures.

## Definition of Production Grade

The product should not be considered production grade until:

- Every critical action is authorized server-side and covered by tests.
- Tenant isolation and Area Office/HQ boundaries have been independently verified.
- Claims and payment policies are approved and implemented.
- Production email, storage, malware scanning, payment, identity, and monitoring services are live.
- Backups have been restored successfully in a rehearsal.
- Security, privacy, accessibility, and operational support sign-offs are complete.
- A controlled pilot has completed with documented issues and resolutions.

## Maintaining This Roadmap

Add new slices under the relevant capability group. For every completed slice:

1. Mark it completed in the implementation-slice log.
2. Update the relevant workflow module in the user guide.
3. Update the affected architecture or extension point in the developer guide.
4. Add or update automated tests.
5. Recalculate the remaining-slice estimate quarterly or after a major policy decision.
