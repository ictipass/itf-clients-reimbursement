import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import {
  createTrainingMonitoringRecordAction,
  routeTrainingRequestAction,
  submitTrainingRequestAction,
} from "@/app/(dashboard)/training-requests/[requestId]/actions";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { type Role } from "@/lib/rbac";

const transitionLabels = {
  am_to_hot: "Forward to HOT",
  am_to_company: "Request employer correction",
  hot_to_ro: "Forward to Reimbursement Officer",
  hot_to_company: "Request employer correction",
  ro_to_hot: "Return to HOT",
  ro_to_company: "Request employer correction",
  hot_to_am: "Return to AM",
  am_approve: "Approve request",
} as const;

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

function isAdminRole(role: Role) {
  return role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN";
}

function isEmployerRole(role: Role) {
  return role === "EMPLOYER_ADMIN" || role === "EMPLOYER_SUBMITTER";
}

function getAvailableTransitions(currentDesk: string, status: string) {
  if (currentDesk === "AREA_MANAGER") {
    if (status === "IN_REVIEW") {
      return ["am_approve", "am_to_company"] as const;
    }

    return ["am_to_hot", "am_to_company"] as const;
  }

  if (currentDesk === "HEAD_OF_TRAINING") {
    return ["hot_to_ro", "hot_to_am", "hot_to_company"] as const;
  }

  if (currentDesk === "REIMBURSEMENT_OFFICER") {
    return ["ro_to_hot", "ro_to_company"] as const;
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

export default async function TrainingRequestDetailPage({
  params,
}: Readonly<{
  params: Promise<{ requestId: string }>;
}>) {
  const { requestId } = await params;
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const adminOverride = isAdminRole(activeRole);
  const request = await getDb().trainingRequest.findFirst({
    where: {
      id: requestId,
      recordTier: "HOT",
    },
    select: {
      id: true,
      title: true,
      description: true,
      trainingType: true,
      provider: true,
      venue: true,
      startsAt: true,
      endsAt: true,
      participantCount: true,
      estimatedCost: true,
      expectedOutcome: true,
      approvalReference: true,
      status: true,
      currentDesk: true,
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
      monitoringRecords: {
        where: {
          recordTier: "HOT",
        },
        select: {
          id: true,
          mode: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
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

  const canSubmit =
    request.currentDesk === "COMPANY" &&
    (request.status === "DRAFT" || request.status === "CHANGES_REQUESTED") &&
    (isEmployerRole(activeRole) || adminOverride);
  const availableTransitions = getAvailableTransitions(request.currentDesk, request.status);
  const canRoute =
    availableTransitions.length > 0 && canActAsDesk(activeRole, request.currentDesk);
  const canCreateMonitoring =
    request.status === "APPROVED" &&
    (adminOverride ||
      activeRole === "AREA_MANAGER" ||
      activeRole === "HEAD_OF_TRAINING" ||
      activeRole === "REIMBURSEMENT_OFFICER" ||
      activeRole === "ITF_TRAINING_APPROVER");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      <div className="flex flex-wrap gap-3">
        <Link href="/training-requests" className="text-sm font-semibold text-[#800020]">
          Back to Training Requests
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
        <div className="grid gap-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-semibold tracking-tight">Request details</h2>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-600">
              <p>{request.description ?? "No description provided."}</p>
              <p>
                <span className="font-semibold text-zinc-900">Type:</span>{" "}
                {request.trainingType ?? "Not provided"}
              </p>
              <p>
                <span className="font-semibold text-zinc-900">Venue:</span>{" "}
                {request.venue ?? "Not provided"}
              </p>
              <p>
                <span className="font-semibold text-zinc-900">Participants:</span>{" "}
                {request.participantCount ?? "Not provided"}
              </p>
              <p>
                <span className="font-semibold text-zinc-900">Expected outcome:</span>{" "}
                {request.expectedOutcome ?? "Not provided"}
              </p>
              <p>
                <span className="font-semibold text-zinc-900">Approval reference:</span>{" "}
                {request.approvalReference ?? "Pending"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-semibold tracking-tight">Evidence</h2>
            <Link
              href={`/training-requests/${request.id}/evidence/new`}
              className="mt-4 inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
            >
              Upload evidence
            </Link>
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
        </div>

        <div className="grid gap-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
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
                This request is not linked to a structured Training Plan row.
              </p>
            )}
          </div>

          {canCreateMonitoring ? (
            <form
              action={createTrainingMonitoringRecordAction.bind(null, request.id)}
              className="rounded-lg border border-zinc-200 bg-white p-5"
            >
              <h2 className="text-xl font-semibold tracking-tight">Create monitoring record</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Open Form 6A or 6B monitoring for this approved Training Approval Request.
              </p>
              <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-700">
                Monitoring form
                <select
                  name="mode"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                >
                  <option value="LOCAL_PHYSICAL">Form 6A - local physical</option>
                  <option value="LOCAL_VIRTUAL">Form 6B - local virtual</option>
                </select>
              </label>
              <button className="mt-4 min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Create monitoring record
              </button>
            </form>
          ) : null}

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-semibold tracking-tight">Monitoring records</h2>
            {request.monitoringRecords.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                No Form 6A or 6B monitoring record has been created for this request.
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

          {canSubmit ? (
            <form
              action={submitTrainingRequestAction.bind(null, request.id)}
              className="rounded-lg border border-zinc-200 bg-white p-5"
            >
              <h2 className="text-xl font-semibold tracking-tight">Submit request</h2>
              <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-700">
                Submission note
                <input
                  name="note"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                />
              </label>
              <button className="mt-4 min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Submit Form 4A
              </button>
            </form>
          ) : null}

          {canRoute ? (
            <form
              action={routeTrainingRequestAction.bind(null, request.id)}
              className="rounded-lg border border-zinc-200 bg-white p-5"
            >
              <h2 className="text-xl font-semibold tracking-tight">Workflow action</h2>
              <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-700">
                Routing note
                <input
                  name="note"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                />
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
            </form>
          ) : null}

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
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
        </div>
      </section>
    </div>
  );
}
