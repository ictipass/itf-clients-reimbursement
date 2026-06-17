import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import {
  addTrainingParticipantAction,
  createClaimFromTrainingRequestAction,
  deleteTrainingParticipantAction,
  routeTrainingRequestAction,
  submitTrainingRequestAction,
  updateTrainingParticipantAction,
} from "@/app/(dashboard)/training-requests/[requestId]/actions";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { type Role } from "@/lib/rbac";

const transitionLabels = {
  am_to_hot: "Forward to HOT",
  hot_to_ro: "Forward to Reimbursement Officer",
  ro_approve: "Approve and return to HOT",
  ro_reject: "Reject and return to HOT",
  hot_to_am: "Forward decision to AM",
  am_release: "Release decision to employer",
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
  }>;
}>) {
  const { requestId } = await params;
  const query = await searchParams;
  const participantSearch = readFilter(query.participantQ);
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
      claims: {
        where: {
          recordTier: "HOT",
        },
        select: {
          id: true,
          reference: true,
          status: true,
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
      participantQ: participantSearch,
      participantPage: participantPage > 1 ? participantPage : undefined,
      ...overrides,
    });
  const canSubmit =
    request.currentDesk === "COMPANY" &&
    (request.status === "DRAFT" || request.status === "CHANGES_REQUESTED") &&
    (isEmployerRole(activeRole) || adminOverride);
  const missingRequirements = getMissingRequirements(request);
  const availableTransitions = getAvailableTransitions(
    request.currentDesk,
    request.status,
    request.decisionOutcome,
  );
  const canRoute =
    availableTransitions.length > 0 && canActAsDesk(activeRole, request.currentDesk);
  const hasApprovedMonitoring = request.monitoringRecords.some(
    (record) => record.status === "APPROVED" && record.decisionOutcome === "ACCEPTED",
  );
  const canCreateClaim =
    request.status === "APPROVED" &&
    hasApprovedMonitoring &&
    (isEmployerRole(activeRole) || adminOverride);

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

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p className="font-semibold">Training approval request deadline</p>
        <p className="mt-1">
          Local training requests should be submitted not later than two (2) weeks before the
          training starts. International training requests should be submitted not later than three
          (3) weeks before the training starts.
        </p>
      </section>

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
        <div className="grid gap-6 lg:contents">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
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
                ["Type", request.trainingType ?? "Not provided"],
                ["Venue", request.venue ?? "Not provided"],
                ["Participants", request.participantCount ?? "Not provided"],
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
            </dl>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-span-2">
            <h2 className="text-xl font-semibold tracking-tight">Participants</h2>
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
                                    <input
                                      name="trainingArea"
                                      defaultValue={participant.trainingArea ?? ""}
                                      placeholder="Training area"
                                      className="min-h-9 rounded-md border border-zinc-200 px-3 text-sm"
                                    />
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
                <input
                  name="trainingArea"
                  placeholder="Training area"
                  className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm"
                />
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
              </form>
            ) : null}
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

        <div className="grid gap-6 lg:col-start-2 lg:row-start-1">
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

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
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

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
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

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-semibold tracking-tight">Claims</h2>
            {request.claims.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                No reimbursement claim has been opened from this Form 4A yet.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {request.claims.map((claim) => (
                  <Link
                    key={claim.id}
                    href={`/claims/${claim.id}`}
                    className="rounded-md border border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-800"
                  >
                    {claim.reference} · {claim.status.replaceAll("_", " ")}
                  </Link>
                ))}
              </div>
            )}
            {canCreateClaim && request.claims.length === 0 ? (
              <form action={createClaimFromTrainingRequestAction.bind(null, request.id)}>
                <button className="mt-4 min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                  Create reimbursement claim
                </button>
              </form>
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
              className="rounded-lg border border-zinc-200 bg-white p-5"
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
            </form>
          ) : null}

          {canRoute ? (
            <form
              action={routeTrainingRequestAction.bind(null, request.id)}
              className="rounded-lg border border-zinc-200 bg-white p-5"
            >
              <h2 className="text-xl font-semibold tracking-tight">Workflow action</h2>
              <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-700">
                Decision/review reason
                <input
                  name="note"
                  required={request.currentDesk === "REIMBURSEMENT_OFFICER"}
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
