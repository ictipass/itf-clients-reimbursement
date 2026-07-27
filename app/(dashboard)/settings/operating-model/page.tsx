import { getServerSession } from "next-auth";

import { updateContributionOperatingModelAction } from "@/app/(dashboard)/settings/operating-model/actions";
import { authOptions } from "@/lib/auth";
import { listClaimPolicyWorkspaces } from "@/lib/claim-policy";
import { canManageClaimPolicy } from "@/lib/rbac";
import {
  describeRevenueWorkflowMode,
  formatRevenueWorkflowMode,
  revenueWorkflowModes,
} from "@/lib/revenue-workflow";

export default async function ContributionOperatingModelPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "EMPLOYER_VIEWER";
  const canManageModel = canManageClaimPolicy(role);
  const workspaces = canManageModel
    ? await listClaimPolicyWorkspaces({ requesterRole: role })
    : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          System settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Contribution operating model
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          Choose whether contribution processing stays on the external platform or runs
          end-to-end in this application. The inactive capabilities remain intact for future
          policy changes.
        </p>

        {!canManageModel ? (
          <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            You do not have permission to manage the contribution operating model.
          </p>
        ) : workspaces.length === 0 ? (
          <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            No active workspace is available.
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            {workspaces.map((workspace) => (
              <form
                key={workspace.id}
                action={updateContributionOperatingModelAction}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
              >
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <h2 className="font-semibold text-zinc-950">{workspace.name}</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Current mode:{" "}
                  <span className="font-semibold text-zinc-950">
                    {formatRevenueWorkflowMode(workspace.revenueWorkflowMode)}
                  </span>
                </p>
                <fieldset className="mt-4 grid gap-3">
                  <legend className="sr-only">Contribution operating model</legend>
                  <div className="grid gap-3 md:grid-cols-2">
                    {revenueWorkflowModes.map((mode) => (
                      <label
                        key={mode}
                        className="grid cursor-pointer gap-2 rounded-md border border-zinc-200 bg-white p-4 text-sm"
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
                  Save operating model
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
