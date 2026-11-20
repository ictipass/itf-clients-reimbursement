import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";
import { HostedFileInput } from "@/components/hosted-file-input";
import { EmployerFeedbackViewed } from "@/components/employer-feedback-viewed";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import {
  addTrainingMonitoringEvaluationAction,
  assignVirtualMonitoringOfficerAction,
  routeTrainingMonitoringRecordAction,
  updateTrainingMonitoringRecordAction,
  uploadTrainingMonitoringEvidenceAction,
} from "@/app/(dashboard)/training-monitoring/[recordId]/actions";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canMonitorAtDesk, monitoringVisibilityWhere } from "@/lib/monitoring-routing";
import { getTrainingMonitoringEvidenceKinds, listAssignableVirtualMonitoringOfficers } from "@/lib/training-monitoring";

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
  ro_submit: "Submit monitoring report to HOT",
  hot_accept: "Accept training implementation",
  hot_reject: "Reject training implementation",
  hot_to_ro: "Return report to Reimbursement Officer",
  am_release: "Release decision to employer",
  am_to_hot: "Return decision to HOT",
  hq_ro_submit: "Submit monitoring report to Head of Reimbursement Division",
  hod_accept: "Accept training implementation",
  hod_reject: "Reject training implementation",
  hod_to_hq_ro: "Return report to HQ Reimbursement Officer",
  dfsd_release: "Release decision to employer",
  dfsd_to_hod: "Return decision to Head of Reimbursement Division",
} as const;

function getMonitoringTransitions(mode: string, status: string, desk: string) {
  if (mode === "LOCAL_VIRTUAL") {
    if (desk === "HQ_REIMBURSEMENT_OFFICER" && (status === "DRAFT" || status === "CHANGES_REQUESTED")) return ["hq_ro_submit"] as const;
    if (desk === "HEAD_OF_DIVISION" && status === "SUBMITTED") return ["hod_accept", "hod_reject", "hod_to_hq_ro"] as const;
    if (desk === "DIRECTOR_FSD" && status === "IN_REVIEW") return ["dfsd_release", "dfsd_to_hod"] as const;
    return [] as const;
  }
  if (
    desk === "REIMBURSEMENT_OFFICER" &&
    (status === "DRAFT" || status === "CHANGES_REQUESTED")
  ) {
    return ["ro_submit"] as const;
  }

  if (desk === "HEAD_OF_TRAINING" && status === "SUBMITTED") {
    return ["hot_accept", "hot_reject", "hot_to_ro"] as const;
  }

  if (desk === "AREA_MANAGER" && status === "IN_REVIEW") {
    return ["am_release", "am_to_hot"] as const;
  }

  return [] as const;
}

export default async function TrainingMonitoringDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ uploadError?: string | string[]; assignmentError?: string | string[]; workflowError?: string | string[] }>;
}>) {
  const { recordId } = await params;
  const query = await searchParams;
  const uploadError = Array.isArray(query.uploadError) ? query.uploadError[0] : query.uploadError;
  const assignmentError = Array.isArray(query.assignmentError) ? query.assignmentError[0] : query.assignmentError;
  const workflowError = Array.isArray(query.workflowError) ? query.workflowError[0] : query.workflowError;
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "EMPLOYER_VIEWER";
  const evidenceKinds = getTrainingMonitoringEvidenceKinds();
  const requester = session?.user?.email
    ? await getDb().user.findUnique({
        where: { email: session.user.email },
        select: { id: true, memberships: { where: { isActive: true }, select: { role: true, workspaceId: true, areaOfficeId: true, organizationId: true } } },
      })
    : null;
  const record = await getDb().trainingMonitoringRecord.findFirst({
    where: {
      id: recordId,
      recordTier: "HOT",
      ...monitoringVisibilityWhere(activeRole, requester?.memberships ?? [], requester?.id),
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
      currentDesk: true,
      decisionOutcome: true,
      decisionReason: true,
      feedbackReleasedAt: true,
      workItems: {
        where: { app: "REIMBURSEMENT", recordTier: "HOT", status: "OPEN", kind: "TRAINING_MONITORING_REVIEW" },
        select: { id: true, assignedRole: true, assignedUserId: true, assignedUser: { select: { name: true, email: true } } },
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
      trainingRequest: {
        select: {
          id: true,
          title: true,
          provider: true,
          venue: true,
          _count: { select: { participants: true } },
          company: {
            select: {
              id: true,
              legalName: true,
              itfEmployerNumber: true,
              organization: { select: { workspaceId: true } },
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

  const currentWorkItem = record.workItems.find((item) =>
    item.assignedRole === "HQ_REIMBURSEMENT_OFFICER" || item.assignedRole === "HEAD_OF_DIVISION");
  const canAssignVirtualMonitoring = record.mode === "LOCAL_VIRTUAL" &&
    record.currentDesk === "HQ_REIMBURSEMENT_OFFICER" &&
    (record.status === "DRAFT" || record.status === "CHANGES_REQUESTED") &&
    (activeRole === "HEAD_OF_DIVISION" || activeRole === "SYSTEM_ADMIN" || activeRole === "WORKSPACE_APP_ADMIN");
  const hqOfficers = (canAssignVirtualMonitoring || (record.mode === "LOCAL_VIRTUAL" && activeRole === "HEAD_OF_DIVISION" && record.currentDesk === "HEAD_OF_DIVISION"))
    ? await listAssignableVirtualMonitoringOfficers(record.trainingRequest.company.organization.workspaceId)
    : [];
  const assignedHQOfficer = record.mode !== "LOCAL_VIRTUAL" || record.currentDesk !== "HQ_REIMBURSEMENT_OFFICER" ||
    activeRole !== "HQ_REIMBURSEMENT_OFFICER" || currentWorkItem?.assignedUserId === requester?.id;
  const availableTransitions = getMonitoringTransitions(record.mode, record.status, record.currentDesk);
  const canRouteMonitoring =
    availableTransitions.length > 0 && canMonitorAtDesk(activeRole, record.mode, record.currentDesk) && assignedHQOfficer;
  const canEditMonitoring =
    canMonitorAtDesk(activeRole, record.mode, record.currentDesk) && assignedHQOfficer &&
    (record.currentDesk === "REIMBURSEMENT_OFFICER" || record.currentDesk === "HQ_REIMBURSEMENT_OFFICER") &&
    (record.status === "DRAFT" || record.status === "CHANGES_REQUESTED");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      {record.feedbackReleasedAt &&
      (activeRole === "EMPLOYER_ADMIN" || activeRole === "EMPLOYER_SUBMITTER") ? (
        <EmployerFeedbackViewed target="monitoring" targetId={record.id} />
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Link href="/training-monitoring" className="text-sm font-semibold text-[#800020]">
          Back to Monitoring
        </Link>
        <Link
          href={`/training-requests/${record.trainingRequest.id}${record.mode === "LOCAL_VIRTUAL" && !activeRole.startsWith("EMPLOYER_") ? `?monitoringId=${record.id}` : ""}`}
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
              {record.trainingRequest._count.participants}
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

      <div className="flex flex-col">
      <section className="order-1 mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Current desk
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {record.currentDesk.replaceAll("_", " ")}
          </p>
          {record.mode === "LOCAL_VIRTUAL" && record.currentDesk === "HQ_REIMBURSEMENT_OFFICER" ? (
            <p className="mt-1 text-xs text-zinc-600">{currentWorkItem?.assignedUser?.name ?? "Awaiting named HQ RO assignment"}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Implementation decision
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {record.decisionOutcome?.replaceAll("_", " ") ?? "Pending"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Feedback released
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatDate(record.feedbackReleasedAt)}
          </p>
        </div>
      </section>

      <section className="order-2 mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-xl font-semibold tracking-tight">Decision trail</h2>
        {record.decisions.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-zinc-600">No monitoring decision recorded yet.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {record.decisions.map((decision) => (
              <div key={decision.id} className="rounded-md bg-zinc-50 px-3 py-2 text-xs">
                <p className="font-semibold text-zinc-900">{decision.action.replaceAll("_", " ")}</p>
                <p className="mt-1 leading-5 text-zinc-600">
                  {decision.actor.name} · {formatDate(decision.createdAt)}
                  {decision.reason ? ` · ${decision.reason}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {canAssignVirtualMonitoring ? (
        <section id="hq-monitoring-assignment" className="order-3 mt-8 rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-xl font-semibold tracking-tight text-blue-950">HQ monitoring officer assignment</h2>
          {assignmentError ? <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{assignmentError}</p> : null}
          <p className="mt-2 text-sm text-blue-900">
            {currentWorkItem?.assignedUser
              ? `Currently assigned to ${currentWorkItem.assignedUser.name} (${currentWorkItem.assignedUser.email}). Reassignment takes effect immediately.`
              : "Select the HQ Reimbursement Officer who will monitor this virtual training. The record cannot be edited or submitted until assigned."}
          </p>
          <form action={assignVirtualMonitoringOfficerAction.bind(null, record.id)} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="grid gap-1 text-sm font-medium text-blue-950">HQ Reimbursement Officer
              <select name="assigneeUserId" required defaultValue="" className="min-h-10 rounded-md border border-blue-200 bg-white px-3">
                <option value="" disabled>Select an officer</option>
                {hqOfficers.filter((officer) => officer.id !== currentWorkItem?.assignedUserId).map((officer) => (
                  <option key={officer.id} value={officer.id}>{officer.name} ({officer.email})</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-blue-950 md:col-span-2">{currentWorkItem?.assignedUserId ? "Reason for reassignment" : "Assignment note (optional)"}
              <input name="reason" required={Boolean(currentWorkItem?.assignedUserId)} className="min-h-10 rounded-md border border-blue-200 bg-white px-3" />
            </label>
            <button disabled={hqOfficers.filter((officer) => officer.id !== currentWorkItem?.assignedUserId).length === 0} className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white disabled:opacity-50">
              {currentWorkItem?.assignedUserId ? "Reassign officer" : "Assign officer"}
            </button>
            <FormActionProgress />
          </form>
        </section>
      ) : null}

      {canRouteMonitoring ? (
        <form
          id="monitoring-workflow"
          action={routeTrainingMonitoringRecordAction.bind(null, record.id)}
          className="order-4 mt-8 rounded-lg border border-zinc-200 bg-white p-5"
        >
          <h2 className="text-xl font-semibold tracking-tight">Monitoring workflow</h2>
          {workflowError ? <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{workflowError}</p> : null}
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {record.mode === "LOCAL_VIRTUAL"
              ? "Route this virtual monitoring report through HQ Reimbursement Officer, Head of Reimbursement Division, DFSD, and employer feedback."
              : "Route this physical monitoring report through Reimbursement Officer, Head of Training, Area Manager, and employer feedback."}
          </p>
          <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-700">
            Decision/review reason
            <input
              name="note"
              required={record.currentDesk === "HEAD_OF_TRAINING" || record.currentDesk === "HEAD_OF_DIVISION"}
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            />
          </label>
          {record.mode === "LOCAL_VIRTUAL" && record.currentDesk === "HEAD_OF_DIVISION" ? (
            <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-700">HQ RO for a returned report
              <select name="assigneeUserId" defaultValue="" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm">
                <option value="">{hqOfficers.length === 1 ? "Only available officer (automatic)" : "Select officer when returning to HQ RO"}</option>
                {hqOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name} ({officer.email})</option>)}
              </select>
              <span className="text-xs font-normal text-zinc-500">Required when more than one HQ RO is available; ignored for other decisions.</span>
            </label>
          ) : null}
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

      {canEditMonitoring ? (
        <section className="order-5 mt-8 rounded-lg border border-zinc-200 bg-white p-5">
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
            {record.mode === "LOCAL_VIRTUAL" ? (
              <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-950 md:col-span-2">
                Monitoring officer: {record.monitoringOfficerName ?? "Not assigned"}. The Head of Division controls the named HQ assignment.
              </p>
            ) : (
              <>
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  Monitoring officer
                  <input name="monitoringOfficerName" defaultValue={record.monitoringOfficerName ?? ""} className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  Officer designation
                  <input name="monitoringOfficerTitle" defaultValue={record.monitoringOfficerTitle ?? ""} className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm" />
                </label>
              </>
            )}
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
            <FormActionProgress />
          </form>
        </section>
      ) : null}

      <section className="order-3 mt-8 grid gap-6 lg:grid-cols-2">
        <div id="monitoring-evidence" className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Monitoring evidence</h2>
          {uploadError ? (
            <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {uploadError === "unsupported-type"
                ? "Only PDF, JPEG, and PNG files can be uploaded as monitoring evidence. Please choose another file."
                : "Monitoring evidence could not be uploaded. Check the file and try again."}
            </p>
          ) : null}
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

          {canEditMonitoring ? (
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
                <HostedFileInput hosted={process.env.STORAGE_PROVIDER !== "local" && Boolean(process.env.STORAGE_PROVIDER)}
                  name="evidence"
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Upload monitoring evidence
              </button>
              <FormActionProgress />
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

          {canEditMonitoring ? (
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
              <FormActionProgress />
            </form>
          ) : null}
        </div>
      </section>

      <section className="order-6 mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="text-xl font-semibold tracking-tight">Employer feedback</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {record.decisionReason ?? "No final monitoring reason has been recorded yet."}
        </p>
      </section>
      </div>
    </div>
  );
}
