import { FormActionProgress } from "@/components/form-action-progress";
import { getServerSession } from "next-auth";

import { activateReimbursementPolicyAction, updateClaimSubmissionPolicyAction } from "@/app/(dashboard)/settings/claims/actions";
import { authOptions } from "@/lib/auth";
import {
  CLAIM_SUBMISSION_DEADLINE_NOTICE,
  listClaimPolicyWorkspaces,
} from "@/lib/claim-policy";
import { canManageClaimPolicy } from "@/lib/rbac";
import { formatReimbursementPolicyEdition, reimbursementPolicyEditions } from "@/lib/reimbursement-policy";

export default async function ClaimSettingsPage({ searchParams }: Readonly<{
  searchParams: Promise<{ policySaved?: string; policyError?: string }>;
}>) {
  const query = await searchParams;
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "EMPLOYER_VIEWER";
  const canManagePolicy = canManageClaimPolicy(role);
  const workspaces = canManagePolicy && session?.user?.email
    ? await listClaimPolicyWorkspaces({ requesterRole: role, requesterEmail: session.user.email })
    : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          Settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Claim settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          Configure reimbursement policy information and claim-submission controls.
        </p>

        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold uppercase leading-6 tracking-wide text-red-900">
          {CLAIM_SUBMISSION_DEADLINE_NOTICE}
        </div>

        {query.policySaved ? <p role="status" className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">Policy approval recorded. New claims use the active edition; existing claims remain pinned to their original edition.</p> : null}
        {query.policyError ? <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-950">{query.policyError}</p> : null}

        {!canManagePolicy ? (
          <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            You do not have permission to manage claim submission settings.
          </p>
        ) : workspaces.length === 0 ? (
          <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            No active workspace is available for claim settings.
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <form
                action={updateClaimSubmissionPolicyAction}
              >
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-semibold text-zinc-950">{workspace.name}</h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      Late claim submissions are currently{" "}
                      <span className="font-semibold">
                        {workspace.allowLateClaimSubmissions ? "allowed" : "blocked"}
                      </span>
                      .
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      Active reimbursement edition:{" "}
                      <span className="font-semibold text-zinc-950">
                        {formatReimbursementPolicyEdition(workspace.activeReimbursementEdition)}
                      </span>
                      .
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <label className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200">
                      <input
                        name="allowLateClaimSubmissions"
                        type="checkbox"
                        defaultChecked={workspace.allowLateClaimSubmissions}
                        className="size-4 accent-[#800020]"
                      />
                      Allow submissions after 30 June
                    </label>
                    <p className="text-xs leading-5 text-zinc-600">
                      Applies only to training held in the immediately preceding year. Earlier years remain closed.
                    </p>
                  </div>
                </div>
                <button className="mt-4 min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                  Save claim settings
                </button>
                <FormActionProgress />
              </form>
              <div className="mt-6 border-t border-zinc-200 pt-5">
                <h3 className="text-base font-semibold text-zinc-950">Reimbursement policy approval</h3>
                {workspace.reimbursementPolicyActivations[0] ? (
                  <p className="mt-2 text-sm leading-6 text-zinc-700">
                    Latest activation: {formatReimbursementPolicyEdition(workspace.reimbursementPolicyActivations[0].edition)} on {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(workspace.reimbursementPolicyActivations[0].activatedAt)} by {workspace.reimbursementPolicyActivations[0].activatedBy.name}. Approval reference: <strong>{workspace.reimbursementPolicyActivations[0].approvalReference}</strong>.
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-amber-900">The 8th edition is active as a legacy baseline. No formal approval reference has been recorded in this app yet.</p>
                )}
                <p className="mt-2 text-xs leading-5 text-zinc-600">
                  An edition is available here only after its calculator and tests have been implemented. Activation changes future claims only; existing claims and calculation snapshots keep their edition.
                </p>
                {(session?.user?.role === "SYSTEM_ADMIN" || session?.user?.role === "WORKSPACE_APP_ADMIN") &&
                  (reimbursementPolicyEditions.some((edition) => edition !== workspace.activeReimbursementEdition) || workspace.reimbursementPolicyActivations.length === 0) ? (
                    <form action={activateReimbursementPolicyAction} className="mt-4 grid gap-3 rounded-md bg-white p-4 ring-1 ring-zinc-200">
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <label className="grid gap-1 text-sm font-medium text-zinc-800">
                        Edition to activate
                        <select name="edition" required defaultValue={workspace.reimbursementPolicyActivations.length === 0 ? workspace.activeReimbursementEdition : ""} className="min-h-10 rounded-md border border-zinc-300 px-3">
                          {workspace.reimbursementPolicyActivations.length > 0 ? <option value="">Select a new edition</option> : null}
                          {reimbursementPolicyEditions.filter((edition) => edition !== workspace.activeReimbursementEdition || workspace.reimbursementPolicyActivations.length === 0).map((edition) => <option key={edition} value={edition}>{formatReimbursementPolicyEdition(edition)}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm font-medium text-zinc-800">
                        Formal approval reference
                        <input name="approvalReference" required minLength={5} maxLength={200} placeholder="Approval memo or policy reference" className="min-h-10 rounded-md border border-zinc-300 px-3" />
                      </label>
                      <label className="flex items-start gap-2 text-sm text-zinc-700">
                        <input name="approvalConfirmed" type="checkbox" required className="mt-1 size-4 accent-[#800020]" />
                        I confirm that this exact edition has formal approval for use on new claims.
                      </label>
                      <button type="submit" className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">{workspace.reimbursementPolicyActivations.length === 0 ? "Record approval of current edition" : "Activate approved edition"}</button>
                      <FormActionProgress />
                    </form>
                  ) : null}
              </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
