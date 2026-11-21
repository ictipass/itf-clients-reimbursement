import "../scripts/assert-integration-db";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { activateReimbursementPolicy, listClaimPolicyWorkspaces, updateClaimSubmissionPolicy } from "../lib/claim-policy";
import {
  calculateAreaOfficeClaim,
  createClaim,
  forwardClaimToAreaReimbursementOfficer,
  forwardClaimToHeadOfTraining,
  submitClaimToAreaManager,
  updateEmployerClaimCalculation,
} from "../lib/claims";
import { getDb } from "../lib/db";

test("approved training becomes a policy-pinned claim and moves through Area Office intake", async () => {
  const db = getDb();
  const suffix = randomUUID().replaceAll("-", "");
  const workspace = await db.workspace.create({
    data: { name: `CI Workspace ${suffix}`, slug: `ci-${suffix}` },
  });
  const otherWorkspace = await db.workspace.create({
    data: { name: `Other CI Workspace ${suffix}`, slug: `ci-other-${suffix}` },
  });
  const office = await db.areaOffice.create({
    data: { workspaceId: workspace.id, name: "CI Area Office", slug: `area-${suffix}` },
  });
  const otherOffice = await db.areaOffice.create({
    data: { workspaceId: workspace.id, name: "Other CI Area Office", slug: `other-area-${suffix}` },
  });
  const organization = await db.organization.create({
    data: { workspaceId: workspace.id, name: "CI Employer", slug: `employer-${suffix}` },
  });
  const company = await db.company.create({
    data: {
      organizationId: organization.id,
      areaOfficeId: office.id,
      legalName: "CI Employer Ltd",
      itfEmployerNumber: `CI-${suffix}`,
      status: "ACTIVE",
    },
  });

  const createUser = async (name: string, role: "WORKSPACE_APP_ADMIN" | "EMPLOYER_SUBMITTER" | "AREA_MANAGER" | "HEAD_OF_TRAINING" | "REIMBURSEMENT_OFFICER", areaOfficeId?: string) => {
    const user = await db.user.create({
      data: { name, email: `${name.toLowerCase().replaceAll(" ", ".")}.${suffix}@example.test` },
    });
    await db.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        organizationId: role === "EMPLOYER_SUBMITTER" ? organization.id : null,
        areaOfficeId: areaOfficeId ?? null,
        role,
      },
    });
    return user;
  };

  const admin = await createUser("Policy Admin", "WORKSPACE_APP_ADMIN");
  const employer = await createUser("Claim Employer", "EMPLOYER_SUBMITTER");
  const areaManager = await createUser("Area Manager", "AREA_MANAGER", office.id);
  const wrongAreaManager = await createUser("Wrong Area Manager", "AREA_MANAGER", otherOffice.id);
  const headOfTraining = await createUser("Head Training", "HEAD_OF_TRAINING", office.id);
  const reimbursementOfficer = await createUser("Area Reimbursement Officer", "REIMBURSEMENT_OFFICER", office.id);

  const training = await db.trainingRequest.create({
    data: {
      companyId: company.id,
      title: "CI Approved Training",
      provider: "CI Provider",
      startsAt: new Date("2026-04-10T09:00:00Z"),
      endsAt: new Date("2026-04-10T17:00:00Z"),
      estimatedCost: 200_000,
      status: "APPROVED",
      decisionOutcome: "ACCEPTED",
      monitoringRecords: {
        create: { mode: "LOCAL_PHYSICAL", status: "APPROVED", decisionOutcome: "ACCEPTED" },
      },
    },
  });
  const eligibility = await db.developmentEligibilityRecord.create({
    data: {
      workspaceId: workspace.id,
      itfEmployerNumber: company.itfEmployerNumber!,
      year: 2026,
      paymentSettled: true,
      contributionPaid: 1_000_000,
      certificateIssued: true,
      certificateNumber: `CI-CERT-${suffix}`,
    },
  });

  const visibleWorkspaces = await listClaimPolicyWorkspaces({
    requesterRole: "WORKSPACE_APP_ADMIN",
    requesterEmail: admin.email,
  });
  assert.deepEqual(visibleWorkspaces.map((item) => item.id), [workspace.id]);
  await assert.rejects(updateClaimSubmissionPolicy({
    requesterRole: "WORKSPACE_APP_ADMIN",
    requesterEmail: admin.email,
    workspaceId: otherWorkspace.id,
    allowLateClaimSubmissions: true,
  }), /Workspace was not found/);

  const claim = await createClaim({
    trainingRequestIds: [training.id],
    requesterEmail: employer.email,
    requesterRole: "EMPLOYER_SUBMITTER",
  });
  assert.equal((await db.reimbursementClaim.findUniqueOrThrow({ where: { id: claim.id } })).policyEdition, "EIGHTH_REVISED");

  await updateEmployerClaimCalculation({
    claimId: claim.id,
    requesterEmail: employer.email,
    requesterRole: "EMPLOYER_SUBMITTER",
    calculation: {
      employerScale: "SMALL",
      smallScaleTraining: { totalStaff: 10, totalTrained: 5 },
      siwesStudentsAccepted: 0,
      trainingPlanSubmittedPromptly: true,
    },
  });
  const employerSnapshot = await db.reimbursementCalculationSnapshot.findFirstOrThrow({
    where: { reimbursementClaimId: claim.id, stage: "EMPLOYER" },
  });
  assert.equal(employerSnapshot.policyEdition, "EIGHTH_REVISED");
  assert.equal(Number(employerSnapshot.totalAmountAwarded), 490_000);

  await activateReimbursementPolicy({
    requesterEmail: admin.email,
    requesterRole: "WORKSPACE_APP_ADMIN",
    workspaceId: workspace.id,
    edition: "EIGHTH_REVISED",
    approvalReference: "CI-TEST-APPROVAL-ONLY",
    approvalConfirmed: true,
  });
  await assert.rejects(activateReimbursementPolicy({
    requesterEmail: admin.email,
    requesterRole: "WORKSPACE_APP_ADMIN",
    workspaceId: workspace.id,
    edition: "EIGHTH_REVISED",
    approvalReference: "CI-TEST-APPROVAL-ONLY",
    approvalConfirmed: true,
  }), /already active/);
  await assert.rejects(activateReimbursementPolicy({
    requesterEmail: admin.email,
    requesterRole: "WORKSPACE_APP_ADMIN",
    workspaceId: otherWorkspace.id,
    edition: "EIGHTH_REVISED",
    approvalReference: "CI-TEST-APPROVAL-ONLY",
    approvalConfirmed: true,
  }), /active administrator assignment/);
  const storedClaim = await db.reimbursementClaim.findUniqueOrThrow({ where: { id: claim.id } });
  assert.equal(storedClaim.policyEdition, employerSnapshot.policyEdition);
  assert.equal((await db.reimbursementPolicyActivation.count({ where: { workspaceId: workspace.id } })), 1);
  assert.equal((await db.auditEvent.count({ where: { workspaceId: workspace.id, entityType: "REIMBURSEMENT_POLICY" } })), 1);

  await db.reimbursementClaim.update({
    where: { id: claim.id },
    data: {
      bankName: "CI Test Bank",
      accountNumber: "0123456789",
      accountName: "CI Employer Ltd",
      accountVerifiedAt: new Date(),
    },
  });
  await db.developmentEligibilityRecord.update({
    where: { id: eligibility.id },
    data: { paymentSettled: false },
  });
  await assert.rejects(submitClaimToAreaManager({
    claimId: claim.id,
    requesterEmail: employer.email,
    requesterRole: "EMPLOYER_SUBMITTER",
  }), /Annual payment must be confirmed/);
  assert.equal((await db.reimbursementClaim.findUniqueOrThrow({ where: { id: claim.id } })).status, "DRAFT");

  await db.developmentEligibilityRecord.update({
    where: { id: eligibility.id },
    data: { paymentSettled: true },
  });
  await submitClaimToAreaManager({
    claimId: claim.id,
    requesterEmail: employer.email,
    requesterRole: "EMPLOYER_SUBMITTER",
  });
  assert.deepEqual(await db.reimbursementClaim.findUniqueOrThrow({
    where: { id: claim.id }, select: { status: true, currentDesk: true, policyEdition: true },
  }), { status: "SUBMITTED", currentDesk: "AREA_MANAGER", policyEdition: "EIGHTH_REVISED" });

  await assert.rejects(forwardClaimToHeadOfTraining({
    claimId: claim.id,
    requesterEmail: wrongAreaManager.email,
    requesterRole: "AREA_MANAGER",
  }), /Area Office access/);
  await forwardClaimToHeadOfTraining({
    claimId: claim.id,
    requesterEmail: areaManager.email,
    requesterRole: "AREA_MANAGER",
  });
  await forwardClaimToAreaReimbursementOfficer({
    claimId: claim.id,
    requesterEmail: headOfTraining.email,
    requesterRole: "HEAD_OF_TRAINING",
    assigneeUserId: reimbursementOfficer.id,
  });
  const routedClaim = await db.reimbursementClaim.findUniqueOrThrow({
    where: { id: claim.id },
    select: { currentDesk: true, policyEdition: true },
  });
  assert.deepEqual(routedClaim, { currentDesk: "REIMBURSEMENT_OFFICER", policyEdition: "EIGHTH_REVISED" });
  const openItem = await db.workItem.findFirstOrThrow({
    where: { reimbursementClaimId: claim.id, status: "OPEN" },
    select: { assignedRole: true, assignedUserId: true },
  });
  assert.deepEqual(openItem, { assignedRole: "REIMBURSEMENT_OFFICER", assignedUserId: reimbursementOfficer.id });

  const review = {
    claimId: claim.id,
    requesterEmail: reimbursementOfficer.email,
    requesterRole: "REIMBURSEMENT_OFFICER" as const,
    reviewerRemarks: "CI evidence and counts checked.",
    reviewedForm1A: true,
    reviewedForm2A: true,
    reviewedEvidence: true,
  };
  await assert.rejects(calculateAreaOfficeClaim({
    ...review,
    verified: { smallTrained: 11, siwesStudentsAccepted: 0, trainingPlanSubmittedPromptly: true },
  }), /Verified small-scale trainees/);
  assert.equal(await db.reimbursementCalculationSnapshot.count({
    where: { reimbursementClaimId: claim.id, stage: "AREA_OFFICE" },
  }), 0);

  await calculateAreaOfficeClaim({
    ...review,
    verified: { smallTrained: 2, siwesStudentsAccepted: 0, trainingPlanSubmittedPromptly: true },
  });
  const areaSnapshot = await db.reimbursementCalculationSnapshot.findFirstOrThrow({
    where: { reimbursementClaimId: claim.id, stage: "AREA_OFFICE" },
  });
  assert.equal(areaSnapshot.policyEdition, "EIGHTH_REVISED");
  assert.ok(Number(areaSnapshot.totalAmountAwarded) > 0);
  assert.ok(Number(areaSnapshot.totalAmountAwarded) < Number(employerSnapshot.totalAmountAwarded));
  assert.equal(Number((await db.reimbursementClaim.findUniqueOrThrow({
    where: { id: claim.id }, select: { claimRecommendedAmount: true },
  })).claimRecommendedAmount), Number(areaSnapshot.totalAmountAwarded));
});
