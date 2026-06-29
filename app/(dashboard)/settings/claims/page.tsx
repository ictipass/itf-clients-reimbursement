import { getServerSession } from "next-auth";

import { updateClaimSubmissionPolicyAction } from "@/app/(dashboard)/settings/claims/actions";
import { authOptions } from "@/lib/auth";
import {
  CLAIM_SUBMISSION_DEADLINE_NOTICE,
  listClaimPolicyWorkspaces,
} from "@/lib/claim-policy";
import { canManageClaimPolicy } from "@/lib/rbac";
import { formatReimbursementPolicyEdition } from "@/lib/reimbursement-policy";
import {
  describeRevenueWorkflowMode,
  formatRevenueWorkflowMode,
  revenueWorkflowModes,
} from "@/lib/revenue-workflow";

export default async function ClaimSettingsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "EMPLOYER_VIEWER";
  const canManagePolicy = canManageClaimPolicy(role);
  const workspaces = canManagePolicy
    ? await listClaimPolicyWorkspaces({ requesterRole: role })
    : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          Settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Claim settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          Configure submission controls for reimbursement claims. The deadline notice remains
          visible to employers whether late claims are blocked or temporarily allowed.
        </p>

        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold uppercase leading-6 tracking-wide text-red-900">
          {CLAIM_SUBMISSION_DEADLINE_NOTICE}
        </div>

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
              <form
                key={workspace.id}
                action={updateClaimSubmissionPolicyAction}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
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
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      Revenue workflow mode:{" "}
                      <span className="font-semibold text-zinc-950">
                        {formatRevenueWorkflowMode(workspace.revenueWorkflowMode)}
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
                  </div>
                </div>
                <fieldset className="mt-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4">
                  <legend className="px-1 text-sm font-semibold text-zinc-950">
                    Revenue workflow mode
                  </legend>
                  <p className="text-sm leading-6 text-zinc-600">
                    Choose whether this application owns registration revenue/payment processing
                    or only verifies contribution evidence for reimbursement.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {revenueWorkflowModes.map((mode) => (
                      <label
                        key={mode}
                        className="grid cursor-pointer gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm"
                      >
                        <span className="flex items-center gap-2 font-semibold text-zinc-950">
                          <input
                            name="revenueWorkflowMode"
                            type="radio"
                            value={mode}
                            defaultChecked={workspace.revenueWorkflowMode === mode}
                            className="size-4 accent-[#800020]"
                          />
                          {formatRevenueWorkflowMode(mode)}
                        </span>
                        <span className="leading-6 text-zinc-600">
                          {describeRevenueWorkflowMode(mode)}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="mt-4 min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                  Save claim policy
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
