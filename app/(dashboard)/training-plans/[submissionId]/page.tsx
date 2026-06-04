import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import {
  routeTrainingPlanSubmissionAction,
  submitTrainingPlanSubmissionAction,
} from "@/app/(dashboard)/registry/[companyId]/training-plans/actions";
import { importTrainingPlanCsvAction } from "@/app/(dashboard)/training-plans/[submissionId]/actions";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { type Role } from "@/lib/rbac";

const trainingPlanTransitionLabels = {
  am_to_hot: "Forward to HOT",
  hot_to_ro: "Forward to Reimbursement Officer",
  ro_to_hot: "Return to HOT",
  hot_to_am: "Return to AM",
  am_to_company: "Request employer correction",
  hot_to_company: "Request employer correction",
  ro_to_company: "Request employer correction",
  am_approve: "Approve package",
} as const;

function formatDate(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function formatPercent(value: { toString(): string } | null) {
  if (!value) {
    return "Not scored";
  }

  return `${Number(value.toString()).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}%`;
}

function isAdminRole(role: Role) {
  return role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN";
}

function isEmployerRole(role: Role) {
  return role === "EMPLOYER_ADMIN" || role === "EMPLOYER_SUBMITTER";
}

function formatDesk(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Company";
}

function canActAsTrainingPlanDesk(role: Role, desk: string | null | undefined) {
  if (isAdminRole(role)) {
    return true;
  }

  if (desk === "COMPANY") {
    return isEmployerRole(role);
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

function getAvailableTrainingPlanTransitions(currentDesk: string, status: string) {
  if (status !== "SUBMITTED" && status !== "IN_REVIEW") {
    return [] as const;
  }

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

export default async function TrainingPlanDetailPage({
  params,
}: Readonly<{
  params: Promise<{ submissionId: string }>;
}>) {
  const { submissionId } = await params;
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const adminOverride = isAdminRole(activeRole);
  const submission = await getDb().trainingPlanSubmission.findFirst({
    where: {
      id: submissionId,
      recordTier: "HOT",
    },
    select: {
      id: true,
      year: true,
      status: true,
      currentDesk: true,
      dueDate: true,
      submittedAt: true,
      trainingPlanSummary: true,
      promptSubmissionScore: true,
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
      personnel: {
        select: {
          id: true,
          name: true,
          position: true,
          email: true,
          phone: true,
        },
        orderBy: {
          createdAt: "asc",
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
      lineItems: {
        select: {
          id: true,
          staffName: true,
          department: true,
          gapIdentified: true,
          trainingTitle: true,
          estimatedCost: true,
          plannedDate: true,
          location: true,
          trainer: true,
          rowNumber: true,
        },
        orderBy: {
          rowNumber: "asc",
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

  if (!submission) {
    notFound();
  }

  const submittedDocumentKinds = new Set(submission.documents.map((document) => document.kind));
  const missingRequiredEvidence = [
    submittedDocumentKinds.has("TRAINING_PLAN_DOCUMENT") ? undefined : "training plan document",
    submittedDocumentKinds.has("LD_PERSONNEL_CV") ? undefined : "L&D personnel CV",
  ].filter(Boolean);
  const availableTrainingPlanTransitions = getAvailableTrainingPlanTransitions(
    submission.currentDesk,
    submission.status,
  );
  const canRouteTrainingPlan =
    availableTrainingPlanTransitions.length > 0 &&
    canActAsTrainingPlanDesk(activeRole, submission.currentDesk);
  const canSubmitTrainingPlan =
    (submission.status === "DRAFT" || submission.status === "CHANGES_REQUESTED") &&
    missingRequiredEvidence.length === 0 &&
    (isEmployerRole(activeRole) || adminOverride);
  const canImportLineItems =
    (submission.status === "DRAFT" || submission.status === "CHANGES_REQUESTED") &&
    (isEmployerRole(activeRole) || adminOverride);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      <div className="flex flex-wrap gap-3">
        <Link href="/training-plans" className="text-sm font-semibold text-[#800020]">
          Back to Training Plans
        </Link>
        <Link
          href={`/registry/${submission.company.id}`}
          className="text-sm font-semibold text-zinc-700"
        >
          Open company
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Training Plan detail
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {submission.company.legalName} · {submission.year}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Focused view for Form 3A personnel, annual training plan evidence, and desk routing.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
          {submission.status.replaceAll("_", " ")}
        </span>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Desk</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatDesk(submission.currentDesk)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Due</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatDate(submission.dueDate)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Prompt score
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatPercent(submission.promptSubmissionScore)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Area Office
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {submission.company.areaOffice?.name ?? "Not selected"}
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="grid gap-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-semibold tracking-tight">L&amp;D personnel</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {submission.personnel.map((person) => (
                <div key={person.id} className="rounded-md border border-zinc-100 p-3 text-sm">
                  <p className="font-semibold text-zinc-950">{person.name}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    {person.position ?? "No position"} · {person.email ?? "No email"} ·{" "}
                    {person.phone ?? "No phone"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-semibold tracking-tight">Evidence</h2>
            {canImportLineItems ? (
              <form
                action={importTrainingPlanCsvAction.bind(
                  null,
                  submission.company.id,
                  submission.id,
                )}
                className="mt-4 grid gap-3 rounded-md border border-zinc-100 bg-zinc-50 p-3"
              >
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  Import structured training plan CSV
                  <input
                    name="trainingPlanCsv"
                    type="file"
                    accept=".csv,text/csv"
                    required
                    className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 py-2"
                  />
                </label>
                <button className="min-h-10 w-fit rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                  Import CSV rows
                </button>
              </form>
            ) : null}
            {missingRequiredEvidence.length > 0 ? (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Required before submission: {missingRequiredEvidence.join(", ")}.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/registry/${submission.company.id}/training-plans/${submission.id}/evidence/new`}
                className="inline-flex min-h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-800"
              >
                Upload evidence
              </Link>
            </div>
            {submission.documents.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                No Training Plan evidence has been uploaded.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {submission.documents.map((document) => (
                  <div key={document.id} className="rounded-md border border-zinc-100 p-3 text-sm">
                    <p className="font-semibold text-zinc-950">{document.fileName}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {document.kind.replaceAll("_", " ")} · {formatDate(document.createdAt)}
                    </p>
                    <Link
                      href={`/registry/${submission.company.id}/evidence/${document.id}?disposition=inline`}
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
            <h2 className="text-xl font-semibold tracking-tight">Structured training plan rows</h2>
            {submission.lineItems.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                No structured CSV rows have been imported yet.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-100 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Staff</th>
                      <th className="px-3 py-2">Training</th>
                      <th className="px-3 py-2">Cost</th>
                      <th className="px-3 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {submission.lineItems.slice(0, 10).map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-zinc-950">{item.staffName}</p>
                          <p className="mt-1 text-xs text-zinc-500">{item.department}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p>{item.trainingTitle}</p>
                          <p className="mt-1 text-xs text-zinc-500">{item.gapIdentified}</p>
                        </td>
                        <td className="px-3 py-3">
                          NGN {Number(item.estimatedCost.toString()).toLocaleString("en-NG")}
                        </td>
                        <td className="px-3 py-3">{formatDate(item.plannedDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-semibold tracking-tight">Summary</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {submission.trainingPlanSummary ?? "No summary provided."}
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Submitted: {formatDate(submission.submittedAt)}
            </p>
          </div>

          {canSubmitTrainingPlan ? (
            <form
              action={submitTrainingPlanSubmissionAction.bind(
                null,
                submission.company.id,
                submission.id,
              )}
              className="rounded-lg border border-zinc-200 bg-white p-5"
            >
              <h2 className="text-xl font-semibold tracking-tight">Submit package</h2>
              <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-700">
                Submission note
                <input
                  name="note"
                  className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                />
              </label>
              <button className="mt-4 min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Submit Training Plan package
              </button>
            </form>
          ) : null}

          {canRouteTrainingPlan ? (
            <form
              action={routeTrainingPlanSubmissionAction.bind(
                null,
                submission.company.id,
                submission.id,
              )}
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
                {availableTrainingPlanTransitions.map((transition) => (
                  <button
                    key={transition}
                    name="transition"
                    value={transition}
                    className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900"
                  >
                    {trainingPlanTransitionLabels[transition]}
                  </button>
                ))}
              </div>
            </form>
          ) : null}

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-semibold tracking-tight">Decision trail</h2>
            {submission.decisions.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">No decision recorded yet.</p>
            ) : (
              <div className="mt-4 grid gap-2">
                {submission.decisions.map((decision) => (
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
