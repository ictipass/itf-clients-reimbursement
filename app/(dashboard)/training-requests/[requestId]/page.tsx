import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { HostedFileInput } from "@/components/hosted-file-input";
import { EmployerFeedbackViewed } from "@/components/employer-feedback-viewed";

import {
  addTrainingParticipantAction,
  deleteTrainingParticipantAction,
  routeTrainingRequestAction,
  submitTrainingRequestAction,
  updateTrainingRequestDetailsAction,
  updateTrainingRequestSourceAction,
  updateTrainingParticipantAction,
} from "@/app/(dashboard)/training-requests/[requestId]/actions";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { can, isItfRole, type Role } from "@/lib/rbac";
import { getTrainingAreas, listApprovedTrainingPlanRows } from "@/lib/training-request";
import { getVisibleTrainingRequestWhere } from "@/lib/training-request-access";

const transitionLabels = {
  am_to_hot: "Forward to HOT",
  hot_to_ro: "Forward to Reimbursement Officer",
  ro_approve: "Approve and return to HOT",
  ro_reject: "Reject and return to HOT",
  hot_to_am: "Forward decision to AM",
  am_release: "Release decision to employer",
} as const;
const trainingAreas = getTrainingAreas();

function formatDate(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function formatMoney(value: { toString(): string } | null) {
  if (!value) {
    return "Not provided";
  }

  return `NGN ${Number(value.toString()).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function readFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const trimmed = rawValue?.trim();

  return trimmed ? trimmed : undefined;
}

function readPositiveInteger(value: string | string[] | undefined, fallback = 1) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function buildTrainingRequestHref(
  requestId: string,
  searchParams: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();

  return queryString ? `/training-requests/${requestId}?${queryString}` : `/training-requests/${requestId}`;
}

function isAdminRole(role: Role) {
  return role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN";
}

function isEmployerRole(role: Role) {
  return role === "EMPLOYER_ADMIN" || role === "EMPLOYER_SUBMITTER";
}

function getAvailableTransitions(currentDesk: string, status: string, decisionOutcome: string | null) {
  if (currentDesk === "AREA_MANAGER") {
    if (status === "IN_REVIEW") {
      return ["am_release", "am_to_hot"] as const;
    }

    return ["am_to_hot"] as const;
  }

  if (currentDesk === "HEAD_OF_TRAINING") {
    return decisionOutcome ? (["hot_to_am", "hot_to_ro"] as const) : (["hot_to_ro"] as const);
  }

  if (currentDesk === "REIMBURSEMENT_OFFICER") {
    return ["ro_approve", "ro_reject"] as const;
  }

  return [] as const;
}

function canActAsDesk(role: Role, desk: string) {
  if (isAdminRole(role)) {
    return true;
  }

  if (desk === "AREA_MANAGER") {
    return role === "AREA_MANAGER";
  }

  if (desk === "HEAD_OF_TRAINING") {
    return role === "HEAD_OF_TRAINING";
  }

  if (desk === "REIMBURSEMENT_OFFICER") {
    return role === "REIMBURSEMENT_OFFICER";
  }

  return false;
}

function getMissingRequirements(request: {
  title: string;
  provider: string;
  startsAt: Date;
  endsAt: Date;
  estimatedCost: { toString(): string } | null;
  isAdHoc: boolean;
  adHocJustification: string | null;
  deliveryMode: string;
  onlineUrl: string | null;
  documents: unknown[];
  participants: unknown[];
}) {
  const missing: string[] = [];

  if (!request.title) {
    missing.push("training title");
  }

  if (!request.provider) {
    missing.push("provider");
  }

  if (!request.startsAt || !request.endsAt) {
    missing.push("training dates");
  }

  if (!request.estimatedCost || Number(request.estimatedCost.toString()) <= 0) {
    missing.push("estimated cost");
  }

  if (request.deliveryMode === "LOCAL_ONLINE" && !request.onlineUrl) {
    missing.push("online training URL");
  }

  if (request.participants.length === 0) {
    missing.push("at least one participant");
  }

  if (request.documents.length === 0) {
    missing.push("at least one evidence document; the programme's synopsis is preferred");
  }

  return missing;
}

export default async function TrainingRequestDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{
    participantPage?: string | string[];
    participantQ?: string | string[];
    message?: string | string[];
    error?: string | string[];
    workflowError?: string | string[];
    claimId?: string | string[];
  }>;
}>) {
  const { requestId } = await params;
  const query = await searchParams;
  const participantSearch = readFilter(query.participantQ);
  const importMessage = readFilter(query.message);
  const importError = readFilter(query.error);
  const workflowError = readFilter(query.workflowError);
  const claimId = readFilter(query.claimId);
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const adminOverride = isAdminRole(activeRole);
  const visibleWhere = await getVisibleTrainingRequestWhere({
    email: session?.user?.email,
    role: activeRole,
  });
  let claimLinkedStaffAccess = false;
  if (
    claimId && session?.user?.email && isItfRole(activeRole) &&
    (can(activeRole, "claims:review") || can(activeRole, "claims:approve"))
  ) {
    const linkedClaim = await getDb().reimbursementClaim.findFirst({
      where: {
        id: claimId,
        recordTier: "HOT",
        submittedAt: { not: null },
        trainingRequests: { some: { trainingRequestId: requestId } },
      },
      select: { company: { select: { areaOfficeId: true } } },
    });
    if (linkedClaim) {
      const areaDeskRole = activeRole === "AREA_MANAGER" || activeRole === "HEAD_OF_TRAINING" || activeRole === "REIMBURSEMENT_OFFICER";
      claimLinkedStaffAccess = !areaDeskRole || Boolean(
        linkedClaim.company.areaOfficeId && await getDb().membership.findFirst({
          where: {
            user: { email: session.user.email, isActive: true },
            isActive: true,
            role: activeRole,
            areaOfficeId: linkedClaim.company.areaOfficeId,
          },
          select: { id: true },
        }),
      );
    }
  }
  const request = await getDb().trainingRequest.findFirst({
    where: claimLinkedStaffAccess ? {
      id: requestId,
      OR: [
        visibleWhere,
        { recordTier: "HOT", status: "APPROVED", decisionOutcome: "ACCEPTED", submittedAt: { not: null } },
      ],
    } : { ...visibleWhere, id: requestId },
    select: {
      id: true,
      title: true,
      description: true,
      trainingType: true,
      isAdHoc: true,
      adHocJustification: true,
      deliveryMode: true,
      provider: true,
      venue: true,
      onlineUrl: true,
      onlinePassword: true,
      onlineMeetingId: true,
      onlineInstructions: true,
      startsAt: true,
      endsAt: true,
      estimatedCost: true,
      expectedOutcome: true,
      approvalReference: true,
      status: true,
      currentDesk: true,
      decisionOutcome: true,
      decisionReason: true,
      feedbackReleasedAt: true,
      company: {
        select: {
          id: true,
          legalName: true,
          areaOffice: {
            select: {
              name: true,
            },
          },
        },
      },
      trainingPlanLineItem: {
        select: {
          id: true,
          staffName: true,
          department: true,
          gapIdentified: true,
          trainingTitle: true,
        },
      },
      documents: {
        where: {
          isActive: true,
          recordTier: "HOT",
        },
        select: {
          id: true,
          kind: true,
          fileName: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      participants: {
        select: {
          id: true,
          name: true,
          jobTitle: true,
          trainingArea: true,
          educationalQualification: true,
          nationality: true,
          courseTitle: true,
          courseOrganiser: true,
          venue: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      monitoringRecords: {
        where: {
          recordTier: "HOT",
        },
        select: {
          id: true,
          mode: true,
          status: true,
          decisionOutcome: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      claimAttachments: {
        select: {
          reimbursementClaim: {
            select: {
              id: true,
              reference: true,
              status: true,
              recordTier: true,
            },
          },
        },
        orderBy: {
          attachedAt: "desc",
        },
      },
      decisions: {
        where: {
          recordTier: "HOT",
        },
        select: {
          id: true,
          action: true,
          reason: true,
          createdAt: true,
          actor: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!request) {
    notFound();
  }

  const filteredParticipants = request.participants.filter((participant) => {
    if (!participantSearch) {
      return true;
    }

    const normalizedSearch = participantSearch.toLowerCase();

    return [
      participant.name,
      participant.jobTitle,
      participant.trainingArea,
      participant.educationalQualification,
      participant.nationality,
      participant.courseTitle,
      participant.courseOrganiser,
      participant.venue,
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
  const participantsPerPage = 6;
  const participantTotalPages = Math.ceil(filteredParticipants.length / participantsPerPage);
  const participantPage = clampPage(
    readPositiveInteger(query.participantPage),
    participantTotalPages,
  );
  const visibleParticipants = filteredParticipants.slice(
    (participantPage - 1) * participantsPerPage,
    participantPage * participantsPerPage,
  );
  const participantHref = (overrides: Record<string, string | number | undefined>) =>
    buildTrainingRequestHref(request.id, {
      claimId: claimLinkedStaffAccess ? claimId : undefined,
      participantQ: participantSearch,
      participantPage: participantPage > 1 ? participantPage : undefined,
      ...overrides,
    });
  const canSubmit =
    request.currentDesk === "COMPANY" &&
    (request.status === "DRAFT" || request.status === "CHANGES_REQUESTED") &&
    (isEmployerRole(activeRole) || adminOverride);
  const approvedPlanRows = canSubmit && session?.user?.email
    ? await listApprovedTrainingPlanRows({
        companyIds: [request.company.id],
        requesterEmail: session.user.email,
        requesterRole: activeRole,
      })
    : [];
  const missingRequirements = getMissingRequirements(request);
  const availableTransitions = getAvailableTransitions(
    request.currentDesk,
    request.status,
    request.decisionOutcome,
  );
  const canRoute =
    !claimLinkedStaffAccess && availableTransitions.length > 0 && canActAsDesk(activeRole, request.currentDesk);
  const hasApprovedMonitoring = request.monitoringRecords.some(
    (record) => record.status === "APPROVED" && record.decisionOutcome === "ACCEPTED",
  );
  const isAvailableForClaim =
    request.status === "APPROVED" &&
    hasApprovedMonitoring &&
    request.claimAttachments.length === 0;
  const activeClaimAttachment = request.claimAttachments.find(
    ({ reimbursementClaim }) => reimbursementClaim.recordTier === "HOT",
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      {request.feedbackReleasedAt && isEmployerRole(activeRole) ? (
        <EmployerFeedbackViewed target="request" targetId={request.id} />
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Link href={claimLinkedStaffAccess ? `/claims/${claimId}` : "/training-requests"} className="text-sm font-semibold text-[#800020]">
          {claimLinkedStaffAccess ? "Back to Claim" : "Back to Training Requests"}
        </Link>
        <Link href={`/registry/${request.company.id}`} className="text-sm font-semibold text-zinc-700">
          Open company
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Form 4A detail
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{request.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Training approval request evidence, desk state, and decision trail for{" "}
            {request.company.legalName}.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
          {request.status.replaceAll("_", " ")}
        </span>
      </div>

      {workflowError ? (
        <p role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {workflowError}
        </p>
      ) : null}

      {request.status === "REJECTED" && isEmployerRole(activeRole) ? (
        <section className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950" role="status">
          <p className="font-semibold">Training request rejected — reason</p>
          <p className="mt-1 whitespace-pre-wrap">
            {request.decisionReason?.trim() || "No rejection reason was recorded. Please contact your Area Office for clarification."}
          </p>
        </section>
      ) : request.status !== "APPROVED" && request.status !== "REJECTED" ? (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-semibold">Training approval request deadline</p>
          <p className="mt-1">
            Local training requests should be submitted not later than two (2) weeks before the
            training starts. International training requests should be submitted not later than three
            (3) weeks before the training starts.
          </p>
        </section>
      ) : null}

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Desk</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {request.currentDesk.replaceAll("_", " ")}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Provider
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">{request.provider}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Dates</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatDate(request.startsAt)} - {formatDate(request.endsAt)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Cost</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatMoney(request.estimatedCost)}
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:row-span-2 lg:row-start-1">
            <h2 className="text-xl font-semibold tracking-tight">Request details</h2>
            <dl className="mt-4 grid gap-3 text-sm leading-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Description
                </dt>
                <dd className="mt-1 text-zinc-700">
                  {request.description ?? "No description provided."}
                </dd>
              </div>
              {[
                ["Training type", request.trainingType ?? "Not provided"],
                ["Delivery", request.deliveryMode.replaceAll("_", " ")],
                ["Venue", request.venue ?? "Not provided"],
                ["Participants", request.participants.length],
                ["Expected outcome", request.expectedOutcome ?? "Not provided"],
                ["Approval reference", request.approvalReference ?? "Pending"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-zinc-50 px-3 py-2">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    {label}
                  </dt>
                  <dd className="mt-1 font-medium text-zinc-900">{value}</dd>
                </div>
              ))}
              {request.adHocJustification ? (
                <div className="rounded-md bg-amber-50 px-3 py-2 md:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                    Additional context
                  </dt>
                  <dd className="mt-1 font-medium text-amber-950">
                    {request.adHocJustification ?? "Not provided"}
                  </dd>
                </div>
              ) : null}
              {request.deliveryMode === "LOCAL_ONLINE" ? (
                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-3 md:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                    Employer-provided online access
                  </dt>
                  <dd className="mt-2 grid gap-1 text-blue-950">
                    <span>URL: {request.onlineUrl ?? "Not provided"}</span>
                    <span>Meeting ID: {request.onlineMeetingId ?? "Not provided"}</span>
                    <span>Password: {request.onlinePassword ?? "Not provided"}</span>
                    <span>Instructions: {request.onlineInstructions ?? "Not provided"}</span>
                  </dd>
                </div>
              ) : null}
            </dl>
            {canSubmit ? (
              <details className="mt-5 border-t border-zinc-100 pt-5">
                <summary className="cursor-pointer text-sm font-semibold text-[#800020]">
                  Edit training and access details
                </summary>
                <form
                  action={updateTrainingRequestDetailsAction.bind(null, request.id)}
                  className="mt-4 grid gap-3 md:grid-cols-2"
                >
                  <input name="title" defaultValue={request.title} required placeholder="Training title" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="provider" defaultValue={request.provider} required placeholder="Provider" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <select name="deliveryMode" defaultValue={request.deliveryMode} className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm">
                    <option value="LOCAL_PHYSICAL">Local physical</option>
                    <option value="LOCAL_ONLINE">Local online</option>
                  </select>
                  <input name="venue" defaultValue={request.venue ?? ""} placeholder="Physical venue" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="startsAt" type="datetime-local" defaultValue={formatDateTimeInput(request.startsAt)} required className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="endsAt" type="datetime-local" defaultValue={formatDateTimeInput(request.endsAt)} required className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="estimatedCost" type="number" min="0.01" step="0.01" defaultValue={request.estimatedCost.toString()} required className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="trainingType" defaultValue={request.trainingType ?? ""} placeholder="Training type (entered here, not from participant upload)" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="onlineUrl" type="url" defaultValue={request.onlineUrl ?? ""} placeholder="Online training URL" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="onlineMeetingId" defaultValue={request.onlineMeetingId ?? ""} placeholder="Meeting ID" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="onlinePassword" defaultValue={request.onlinePassword ?? ""} placeholder="Password / passcode" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <input name="onlineInstructions" defaultValue={request.onlineInstructions ?? ""} placeholder="Joining instructions" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
                  <textarea name="description" defaultValue={request.description ?? ""} placeholder="Description" rows={3} className="rounded-md border border-zinc-200 px-3 py-2 text-sm md:col-span-2" />
                  <textarea name="expectedOutcome" defaultValue={request.expectedOutcome ?? ""} placeholder="Expected outcome" rows={3} className="rounded-md border border-zinc-200 px-3 py-2 text-sm md:col-span-2" />
                  {request.isAdHoc ? (
                    <textarea name="adHocJustification" defaultValue={request.adHocJustification ?? ""} placeholder="Additional context (optional)" rows={3} className="rounded-md border border-zinc-200 px-3 py-2 text-sm md:col-span-2" />
                  ) : null}
                  <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white md:col-span-2">
                    Save details
                  </button>
                  <FormActionProgress />
                </form>
              </details>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-span-2 lg:row-start-3">
            <h2 className="text-xl font-semibold tracking-tight">Decision trail</h2>
            {request.decisions.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">No decision recorded yet.</p>
            ) : (
              <div className="mt-4 grid gap-2">
                {request.decisions.map((decision) => (
                  <div key={decision.id} className="rounded-md bg-zinc-50 px-3 py-2 text-xs">
                    <p className="font-semibold text-zinc-900">
                      {decision.action.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 leading-5 text-zinc-600">
                      {decision.actor.name} · {formatDate(decision.createdAt)}
                      {decision.reason ? ` · ${decision.reason}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <details className="group rounded-lg border border-zinc-200 bg-white p-5 lg:col-span-2 lg:row-start-4" open>
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-xl font-semibold tracking-tight marker:hidden">
              <span>Participants ({request.participants.length})</span>
              <span className="text-xs font-semibold text-[#800020] group-open:hidden">Expand</span>
              <span className="hidden text-xs font-semibold text-[#800020] group-open:inline">Collapse</span>
            </summary>
            {importMessage ? <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{importMessage}</p> : null}
            {importError ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">{importError}</p> : null}
            <form className="mt-4 flex flex-col gap-3 rounded-md bg-zinc-50 p-3 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-1 text-xs font-medium text-zinc-700">
                Search participants
                <input
                  name="participantQ"
                  defaultValue={participantSearch}
                  className="min-h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                />
              </label>
              <button className="min-h-9 rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
                Filter
              </button>
              <FormActionProgress />
            </form>
            {filteredParticipants.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {request.participants.length === 0
                  ? "No participant has been added to this Form 4A yet."
                  : "No participant matches the selected filter."}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-100 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Participant</th>
                      <th className="px-3 py-2">Training</th>
                      <th className="px-3 py-2">Course</th>
                      <th className="px-3 py-2">Venue</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {visibleParticipants.map((participant) => (
                      <tr key={participant.id}>
                        <td className="px-3 py-3 align-top">
                          <p className="font-semibold text-zinc-950">{participant.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {participant.jobTitle ?? "Job title not provided"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {participant.nationality ?? "Nationality not provided"}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="font-medium text-zinc-900">
                            {participant.trainingArea ?? "Not provided"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {participant.educationalQualification ??
                              "Qualification not provided"}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="font-medium text-zinc-900">
                            {participant.courseTitle ?? "Not provided"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {participant.courseOrganiser ?? "Organiser not provided"}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          {participant.venue ?? "Not provided"}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {canSubmit ? (
                            <div className="flex flex-wrap gap-2">
                              <details className="group">
                                <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800">
                                  Edit
                                </summary>
                                <div className="mt-2 w-72 rounded-md border border-zinc-200 bg-white p-3 shadow-sm md:w-96">
                                  <form
                                    action={updateTrainingParticipantAction.bind(
                                      null,
                                      request.id,
                                      participant.id,
                                    )}
                                    className="grid gap-2"
                                  >
                                    <input
                                      name="name"
                                      defaultValue={participant.name}
                                      className="min-h-9 rounded-md border border-zinc-200 px-3 text-sm"
                                    />
                                    <input
                                      name="jobTitle"
                                      defaultValue={participant.jobTitle ?? ""}
                                      placeholder="Job title"
                                      className="min-h-9 rounded-md border border-zinc-200 px-3 text-sm"
                                    />
                                    <select
                                      name="trainingArea"
                                      defaultValue={participant.trainingArea ?? ""}
                                      className="min-h-9 rounded-md border border-zinc-200 px-3 text-sm"
                                    >
                                      <option value="">Select training area</option>
                                      {participant.trainingArea &&
                                      !trainingAreas.includes(
                                        participant.trainingArea as (typeof trainingAreas)[number],
                                      ) ? (
                                        <option value={participant.trainingArea}>
                                          {participant.trainingArea}
                                        </option>
                                      ) : null}
                                      {trainingAreas.map((area) => (
                                        <option key={area} value={area}>
                                          {area}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      name="educationalQualification"
                                      defaultValue={participant.educationalQualification ?? ""}
                                      placeholder="Educational qualification"
                                      className="min-h-9 rounded-md border border-zinc-200 px-3 text-sm"
                                    />
                                    <input
                                      name="nationality"
                                      defaultValue={participant.nationality ?? ""}
                                      placeholder="Nationality"
                                      className="min-h-9 rounded-md border border-zinc-200 px-3 text-sm"
                                    />
                                    <input
                                      name="courseTitle"
                                      defaultValue={participant.courseTitle ?? ""}
                                      placeholder="Course title"
                                      className="min-h-9 rounded-md border border-zinc-200 px-3 text-sm"
                                    />
                                    <input
                                      name="courseOrganiser"
                                      defaultValue={participant.courseOrganiser ?? ""}
                                      placeholder="Course organiser"
                                      className="min-h-9 rounded-md border border-zinc-200 px-3 text-sm"
                                    />
                                    <input
                                      name="venue"
                                      defaultValue={participant.venue ?? ""}
                                      placeholder="Venue"
                                      className="min-h-9 rounded-md border border-zinc-200 px-3 text-sm"
                                    />
                                    <button className="min-h-9 rounded-md bg-[#800020] px-3 text-xs font-semibold text-white">
                                      Save
                                    </button>
                                    <FormActionProgress />
                                  </form>
                                </div>
                              </details>
                              <form
                                action={deleteTrainingParticipantAction.bind(
                                  null,
                                  request.id,
                                  participant.id,
                                )}
                              >
                                <button
                                  className="min-h-8 rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700"
                                  title="Remove participant"
                                >
                                  Remove
                                </button>
                                <FormActionProgress />
                              </form>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500">Locked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {participantTotalPages > 1 ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    <p>
                      Page {participantPage} of {participantTotalPages} · Showing{" "}
                      {visibleParticipants.length} of {filteredParticipants.length} participant
                      {filteredParticipants.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {participantPage > 1 ? (
                        <Link
                          href={participantHref({ participantPage: participantPage - 1 })}
                          className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 font-semibold text-zinc-800"
                        >
                          Previous
                        </Link>
                      ) : null}
                      {participantPage < participantTotalPages ? (
                        <Link
                          href={participantHref({ participantPage: participantPage + 1 })}
                          className="inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 font-semibold text-zinc-800"
                        >
                          Next
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {canSubmit ? (
              <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="font-semibold">Bulk upload participants</h3>
                <p className="mt-1 text-xs text-zinc-600">Download the Excel template, fill its Participants sheet, then upload it. Rows are added to existing participants.</p>
                <Link href="/training-requests/participants/template" className="mt-3 inline-flex min-h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800">Download Excel template</Link>
                <form action={`/training-requests/${request.id}/participants/import`} method="post" encType="multipart/form-data" className="mt-3 grid gap-3">
                  <label className="grid gap-2 text-sm font-medium">
                    Participant workbook
                    <HostedFileInput hosted={process.env.STORAGE_PROVIDER !== "local" && Boolean(process.env.STORAGE_PROVIDER)} name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 py-2" />
                  </label>
                  <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Import participants</button>
                  <FormActionProgress />
                </form>
              </div>
            ) : null}

            {canSubmit ? (
              <form
                action={addTrainingParticipantAction.bind(null, request.id)}
                className="mt-5 grid gap-3 border-t border-zinc-100 pt-5 md:grid-cols-2"
              >
                <input
                  name="name"
                  required
                  placeholder="Participant name"
                  className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                />
                <input
                  name="jobTitle"
                  placeholder="Job title"
                  className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                />
                <select
                  name="trainingArea"
                  className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                >
                  <option value="">Select training area</option>
                  {trainingAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                <input
                  name="educationalQualification"
                  placeholder="Educational qualification"
                  className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                />
                <input
                  name="nationality"
                  placeholder="Nationality"
                  className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                />
                <input
                  name="courseTitle"
                  placeholder="Course title"
                  className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                />
                <input
                  name="courseOrganiser"
                  placeholder="Course organiser"
                  className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                />
                <input
                  name="venue"
                  placeholder="Venue"
                  className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                />
                <div className="md:col-span-2">
                  <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                    Add participant
                  </button>
                </div>
                <FormActionProgress />
              </form>
            ) : null}
          </details>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-start-1 lg:row-span-2 lg:row-start-5">
            <h2 className="text-xl font-semibold tracking-tight">Evidence</h2>
            {!claimLinkedStaffAccess ? (
              <Link
                href={`/training-requests/${request.id}/evidence/new`}
                className="mt-4 inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
              >
                Upload evidence
              </Link>
            ) : null}
            {request.documents.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                No Training Approval evidence has been uploaded yet.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {request.documents.map((document) => (
                  <div key={document.id} className="rounded-md border border-zinc-100 p-3 text-sm">
                    <p className="font-semibold text-zinc-950">{document.fileName}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {document.kind.replaceAll("_", " ")} · {formatDate(document.createdAt)}
                    </p>
                    <Link
                      href={`/registry/${request.company.id}/evidence/${document.id}?disposition=inline`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex min-h-8 items-center rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800"
                    >
                      View evidence
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-start-2 lg:row-start-1">
            <h2 className="text-xl font-semibold tracking-tight">Training Plan source</h2>
            {request.trainingPlanLineItem ? (
              <div className="mt-3 text-sm leading-6 text-zinc-600">
                <p className="font-semibold text-zinc-950">
                  {request.trainingPlanLineItem.trainingTitle}
                </p>
                <p>{request.trainingPlanLineItem.staffName}</p>
                <p>{request.trainingPlanLineItem.department}</p>
                <p>{request.trainingPlanLineItem.gapIdentified}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                This request is not linked to an approved Training Plan row. Form 4A approval is still required.
              </p>
            )}
            {canSubmit ? (
              <form action={updateTrainingRequestSourceAction.bind(null, request.id)} className="mt-4 grid gap-2 border-t border-zinc-100 pt-4 text-sm">
                <label htmlFor="trainingPlanLineItemId" className="font-medium">Link to approved plan row (optional)</label>
                <select id="trainingPlanLineItemId" name="trainingPlanLineItemId" defaultValue={request.trainingPlanLineItem?.id ?? ""} className="min-h-10 rounded-md border border-zinc-200 bg-white px-3">
                  <option value="">Not linked to a plan row</option>
                  {approvedPlanRows.map((row) => (
                    <option key={row.id} value={row.id}>{row.trainingPlanSubmission.year} · {row.trainingTitle} · {row.staffName}</option>
                  ))}
                </select>
                <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 font-semibold text-white">Save source</button>
                <FormActionProgress />
              </form>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-start-2 lg:row-start-2">
            <h2 className="text-xl font-semibold tracking-tight">Monitoring records</h2>
            {request.monitoringRecords.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                A monitoring calendar entry will be created automatically when an approval is
                released to the employer.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {request.monitoringRecords.map((record) => (
                  <Link
                    key={record.id}
                    href={`/training-monitoring/${record.id}`}
                    className="rounded-md border border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-800"
                  >
                    {record.mode.replaceAll("_", " ")} · {record.status.replaceAll("_", " ")} ·{" "}
                    {formatDate(record.createdAt)}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-start-2 lg:row-start-5">
            <h2 className="text-xl font-semibold tracking-tight">Approval feedback</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Decision: {request.decisionOutcome?.replaceAll("_", " ") ?? "Pending"}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Reason: {request.decisionReason ?? "No decision reason recorded yet."}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Released: {formatDate(request.feedbackReleasedAt)}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-start-2 lg:row-start-6">
            <h2 className="text-xl font-semibold tracking-tight">Claims</h2>
            {activeClaimAttachment ? (
              <Link
                href={`/claims/${activeClaimAttachment.reimbursementClaim.id}`}
                className="mt-4 inline-flex min-h-9 items-center rounded-full bg-blue-50 px-3 text-xs font-semibold text-blue-700"
              >
                Attached to claim {activeClaimAttachment.reimbursementClaim.reference}
              </Link>
            ) : isAvailableForClaim ? (
              <span className="mt-4 inline-flex min-h-9 items-center rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
                Available for reimbursement claim
              </span>
            ) : (
              <span className="mt-4 inline-flex min-h-9 items-center rounded-full bg-zinc-100 px-3 text-xs font-semibold text-zinc-600">
                Not available for reimbursement claim
              </span>
            )}
            {isAvailableForClaim && (isEmployerRole(activeRole) || adminOverride) ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Open{" "}
                <Link href="/claims" className="font-semibold text-[#800020]">
                  Claims
                </Link>{" "}
                to include this training in a new or draft reimbursement claim.
              </p>
            ) : null}
            {request.status === "APPROVED" && !hasApprovedMonitoring ? (
              <p className="mt-3 text-sm leading-6 text-amber-700">
                Claims can be opened after at least one monitoring record is approved.
              </p>
            ) : null}
          </div>

          {canSubmit ? (
            <form
              action={submitTrainingRequestAction.bind(null, request.id)}
              className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-span-2 lg:row-start-7"
            >
              <h2 className="text-xl font-semibold tracking-tight">Submit request</h2>
              {missingRequirements.length === 0 ? (
                <p className="mt-2 text-sm leading-6 text-emerald-700">
                  This Form 4A has the minimum information required for submission.
                </p>
              ) : (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Complete these items before submission:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {missingRequirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-700">
                Submission note
                <input
                  name="note"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                />
              </label>
              <button
                disabled={missingRequirements.length > 0}
                className="mt-4 min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Submit Form 4A
              </button>
              <FormActionProgress />
            </form>
          ) : null}

          {canRoute ? (
            <form
              action={routeTrainingRequestAction.bind(null, request.id)}
              className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-span-2"
            >
              <h2 className="text-xl font-semibold tracking-tight">Workflow action</h2>
              <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-700">
                Decision/review reason
                <textarea
                  name="note"
                  required={request.currentDesk === "REIMBURSEMENT_OFFICER"}
                  rows={3}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
                {request.currentDesk === "REIMBURSEMENT_OFFICER" ? (
                  <span className="text-xs font-normal text-zinc-500">
                    For a rejection, explain the specific reason and what the employer should address (at least 20 characters).
                  </span>
                ) : null}
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                {availableTransitions.map((transition) => (
                  <button
                    key={transition}
                    name="transition"
                    value={transition}
                    className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
                  >
                    {transitionLabels[transition]}
                  </button>
                ))}
              </div>
              <FormActionProgress />
            </form>
          ) : null}

      </section>
    </div>
  );
}
