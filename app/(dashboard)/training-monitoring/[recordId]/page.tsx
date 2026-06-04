import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import {
  addTrainingMonitoringEvaluationAction,
  routeTrainingMonitoringRecordAction,
  updateTrainingMonitoringRecordAction,
  uploadTrainingMonitoringEvidenceAction,
} from "@/app/(dashboard)/training-monitoring/[recordId]/actions";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { can } from "@/lib/rbac";
import { getTrainingMonitoringEvidenceKinds } from "@/lib/training-monitoring";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function formatTime(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    timeStyle: "short",
  }).format(date);
}

function formatDateTimeInput(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

const transitionLabels = {
  submit: "Submit monitoring record",
  start_review: "Start review",
  approve: "Approve monitoring",
  request_changes: "Request changes",
} as const;

function getMonitoringTransitions(status: string) {
  if (status === "DRAFT" || status === "CHANGES_REQUESTED") {
    return ["submit"] as const;
  }

  if (status === "SUBMITTED") {
    return ["start_review"] as const;
  }

  if (status === "IN_REVIEW") {
    return ["approve", "request_changes"] as const;
  }

  return [] as const;
}

export default async function TrainingMonitoringDetailPage({
  params,
}: Readonly<{
  params: Promise<{ recordId: string }>;
}>) {
  const { recordId } = await params;
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const canManageMonitoring = can(activeRole, "training:approve");
  const evidenceKinds = getTrainingMonitoringEvidenceKinds();
  const record = await getDb().trainingMonitoringRecord.findFirst({
    where: {
      id: recordId,
      recordTier: "HOT",
    },
    select: {
      id: true,
      mode: true,
      monitoringDate: true,
      startsAt: true,
      endsAt: true,
      meetingId: true,
      passcode: true,
      virtualLink: true,
      monitoringOfficerName: true,
      monitoringOfficerTitle: true,
      headOfDivisionName: true,
      directorName: true,
      status: true,
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
      evaluations: {
        select: {
          id: true,
          section: true,
          ratingArea: true,
          score: true,
          note: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      trainingRequest: {
        select: {
          id: true,
          title: true,
          provider: true,
          venue: true,
          participantCount: true,
          company: {
            select: {
              id: true,
              legalName: true,
              itfEmployerNumber: true,
              areaOffice: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!record) {
    notFound();
  }

  const availableTransitions = getMonitoringTransitions(record.status);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      <div className="flex flex-wrap gap-3">
        <Link href="/training-monitoring" className="text-sm font-semibold text-[#800020]">
          Back to Monitoring
        </Link>
        <Link
          href={`/training-requests/${record.trainingRequest.id}`}
          className="text-sm font-semibold text-zinc-700"
        >
          Open Form 4A
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            {record.mode === "LOCAL_PHYSICAL" ? "Form 6A" : "Form 6B"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {record.trainingRequest.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Monitoring record for {record.trainingRequest.company.legalName}.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
          {record.status.replaceAll("_", " ")}
        </span>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Company
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {record.trainingRequest.company.legalName}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Area Office
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {record.trainingRequest.company.areaOffice?.name ?? "No Area Office"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Date</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatDate(record.monitoringDate)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Time</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatTime(record.startsAt)} - {formatTime(record.endsAt)}
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Training details</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-600">
            <p>
              <span className="font-semibold text-zinc-900">Provider:</span>{" "}
              {record.trainingRequest.provider}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Venue:</span>{" "}
              {record.trainingRequest.venue ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Participants:</span>{" "}
              {record.trainingRequest.participantCount ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">ITF number:</span>{" "}
              {record.trainingRequest.company.itfEmployerNumber ?? "Pending"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Monitoring details</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-600">
            <p>
              <span className="font-semibold text-zinc-900">Meeting ID:</span>{" "}
              {record.meetingId ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Passcode:</span>{" "}
              {record.passcode ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Virtual link:</span>{" "}
              {record.virtualLink ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Monitoring officer:</span>{" "}
              {record.monitoringOfficerName ?? "Not assigned"}
              {record.monitoringOfficerTitle ? `, ${record.monitoringOfficerTitle}` : ""}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Head of Division:</span>{" "}
              {record.headOfDivisionName ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Director:</span>{" "}
              {record.directorName ?? "Not provided"}
            </p>
          </div>
        </div>
      </section>

      {canManageMonitoring && availableTransitions.length > 0 ? (
        <form
          action={routeTrainingMonitoringRecordAction.bind(null, record.id)}
          className="mt-8 rounded-lg border border-zinc-200 bg-white p-5"
        >
          <h2 className="text-xl font-semibold tracking-tight">Monitoring workflow</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Move this Form 6A/6B record through submission, review, and approval.
          </p>
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

      {canManageMonitoring ? (
        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Edit monitoring details</h2>
          <form
            action={updateTrainingMonitoringRecordAction.bind(null, record.id)}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Monitoring date
              <input
                name="monitoringDate"
                type="datetime-local"
                defaultValue={formatDateTimeInput(record.monitoringDate)}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Starting time
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(record.startsAt)}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Completing time
              <input
                name="endsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(record.endsAt)}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Meeting ID
              <input
                name="meetingId"
                defaultValue={record.meetingId ?? ""}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Passcode
              <input
                name="passcode"
                defaultValue={record.passcode ?? ""}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Virtual link
              <input
                name="virtualLink"
                defaultValue={record.virtualLink ?? ""}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Monitoring officer
              <input
                name="monitoringOfficerName"
                defaultValue={record.monitoringOfficerName ?? ""}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Officer designation
              <input
                name="monitoringOfficerTitle"
                defaultValue={record.monitoringOfficerTitle ?? ""}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Head of Division
              <input
                name="headOfDivisionName"
                defaultValue={record.headOfDivisionName ?? ""}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Director
              <input
                name="directorName"
                defaultValue={record.directorName ?? ""}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              />
            </label>
            <div className="md:col-span-2">
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Save monitoring details
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Monitoring evidence</h2>
          {record.documents.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No monitoring evidence has been uploaded yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {record.documents.map((document) => (
                <div key={document.id} className="rounded-md border border-zinc-100 p-3 text-sm">
                  <p className="font-semibold text-zinc-950">{document.fileName}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {document.kind.replaceAll("_", " ")} · {formatDate(document.createdAt)}
                  </p>
                  <Link
                    href={`/registry/${record.trainingRequest.company.id}/evidence/${document.id}?disposition=inline`}
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

          {canManageMonitoring ? (
            <form
              action={uploadTrainingMonitoringEvidenceAction.bind(null, record.id)}
              className="mt-5 grid gap-3 border-t border-zinc-100 pt-5"
            >
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Evidence kind
                <select
                  name="kind"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                >
                  {evidenceKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                File
                <input
                  name="evidence"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.csv"
                  required
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Upload monitoring evidence
              </button>
            </form>
          ) : null}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Evaluation ratings</h2>
          {record.evaluations.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No evaluation rating has been recorded yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              {record.evaluations.map((evaluation) => (
                <div key={evaluation.id} className="rounded-md bg-zinc-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-zinc-950">
                    {evaluation.section} · {evaluation.ratingArea}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    Score {evaluation.score}/5 · {formatDate(evaluation.createdAt)}
                    {evaluation.note ? ` · ${evaluation.note}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          {canManageMonitoring ? (
            <form
              action={addTrainingMonitoringEvaluationAction.bind(null, record.id)}
              className="mt-5 grid gap-3 border-t border-zinc-100 pt-5"
            >
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Section
                <select
                  name="section"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                >
                  <option value="Competence">Competence</option>
                  <option value="Learning Environment">Learning Environment</option>
                  <option value="Learning Support Technology">Learning Support Technology</option>
                  <option value="Programme">Programme</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Rating area
                <input
                  name="ratingArea"
                  required
                  placeholder="e.g. Communication Skills"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Score
                <select
                  name="score"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                >
                  <option value="5">5 - Highest</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1 - Lowest</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Note
                <input
                  name="note"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                />
              </label>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Add rating
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}
