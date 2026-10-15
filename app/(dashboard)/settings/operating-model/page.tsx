import { getServerSession } from "next-auth";

import { checkDevelopmentEligibilityAction, retryPendingDevelopmentEligibilityAction, saveDevelopmentEligibilityEndpointAction, saveDevelopmentEligibilityRecordAction, updateContributionOperatingModelAction, verifyDevelopmentCompanyAction } from "@/app/(dashboard)/settings/operating-model/actions";
import { authOptions } from "@/lib/auth";
import { listClaimPolicyWorkspaces } from "@/lib/claim-policy";
import { canManageClaimPolicy } from "@/lib/rbac";
import { getDb } from "@/lib/db";
import { isTestEligibilityConfigurationAllowed, usesPreviewEligibilityRecords } from "@/lib/eligibility-provider";
import {
  describeRevenueWorkflowMode,
  formatRevenueWorkflowMode,
  revenueWorkflowModes,
} from "@/lib/revenue-workflow";

export default async function ContributionOperatingModelPage({ searchParams }: { searchParams: Promise<{ eligibilityMessage?: string; eligibilityError?: string }> }) {
  const { eligibilityMessage, eligibilityError } = await searchParams;
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? "EMPLOYER_VIEWER";
  const canManageModel = canManageClaimPolicy(role);
  const workspaces = canManageModel
    ? await listClaimPolicyWorkspaces({ requesterRole: role })
    : [];
  const testRecordsEnabled = isTestEligibilityConfigurationAllowed();
  const previewTestRecords = usesPreviewEligibilityRecords();
  const developmentRecords = canManageModel && testRecordsEnabled
    ? await getDb().developmentEligibilityRecord.findMany({
        where: { workspaceId: { in: workspaces.map((workspace) => workspace.id) } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      })
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
          Choose Integrated for the full compliance and reimbursement journey, or Reimbursement
          when annual compliance is managed by the existing platform. Historical records remain
          available to authorized administrators when the mode changes.
        </p>
        {canManageModel ? <p className="mt-3 text-sm text-zinc-600">
          Eligibility provider: {previewTestRecords ? "Preview test records" : process.env.ELIGIBILITY_PROVIDER === "REAL_API" ? "Real API (integration not yet available; checks stay pending)" : process.env.ELIGIBILITY_PROVIDER === "TEST_RECORDS" ? "Test records disabled outside Preview; checks stay pending" : process.env.NODE_ENV === "development" ? "Local development API" : "Not configured; checks stay pending"}.
        </p> : null}
        {eligibilityMessage ? <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{eligibilityMessage}</p> : null}
        {eligibilityError ? <p role="alert" className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{eligibilityError}</p> : null}

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
              <div key={workspace.id} className="grid gap-4">
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
              {testRecordsEnabled ? (
                <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4">
                  <h3 className="font-semibold">{previewTestRecords ? "Preview test eligibility records" : "Development eligibility API"}</h3>
                  <p className="text-sm text-zinc-600">{previewTestRecords ? "Preview verification reads these test records directly. They are not a substitute for the real compliance API." : "Enter this application's local API URL and test data."} Eligibility requires settled payment, a positive amount, and an issued certificate for the training year.</p>
                  {!previewTestRecords ? <>
                  <form action={saveDevelopmentEligibilityEndpointAction} className="grid gap-3">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <label className="grid gap-1 text-sm">Endpoint URL<input name="endpointUrl" type="url" required defaultValue={workspace.eligibilityEndpointUrl ?? "http://127.0.0.1:3000/api/development/eligibility"} className="rounded-md border px-3 py-2" /></label>
                    <button className="w-fit rounded-md bg-[#800020] px-4 py-2 text-sm font-semibold text-white">Save endpoint</button>
                  </form>
                  <form action={checkDevelopmentEligibilityAction}>
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <button className="rounded-md border px-4 py-2 text-sm font-semibold">Check API availability</button>
                  </form>
                  </> : null}
                  <form action={retryPendingDevelopmentEligibilityAction}>
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <button className="rounded-md border px-4 py-2 text-sm font-semibold">Check pending companies now</button>
                  </form>
                  <form action={saveDevelopmentEligibilityRecordAction} className="grid gap-3 border-t pt-4">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <h4 className="font-semibold">Create or update a test company result</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm">ITF registration number<input name="itfEmployerNumber" required maxLength={80} className="rounded-md border px-3 py-2" /></label>
                      <label className="grid gap-1 text-sm">Training and compliance year<input name="year" type="number" min="2000" max={new Date().getFullYear() + 1} required className="rounded-md border px-3 py-2" /></label>
                      <label className="grid gap-1 text-sm">Contribution paid<input name="contributionPaid" type="number" min="0" step="0.01" required className="rounded-md border px-3 py-2" /></label>
                      <label className="grid gap-1 text-sm">Certificate number<input name="certificateNumber" className="rounded-md border px-3 py-2" /></label>
                    </div>
                    <label className="flex gap-2 text-sm"><input name="paymentSettled" type="checkbox" /> Payment settled</label>
                    <label className="flex gap-2 text-sm"><input name="certificateIssued" type="checkbox" /> Certificate issued</label>
                    <button className="w-fit rounded-md bg-[#800020] px-4 py-2 text-sm font-semibold text-white">Save test result</button>
                  </form>
                  <form action={verifyDevelopmentCompanyAction} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <div className="sm:col-span-2">
                      <h4 className="font-semibold">Verify an onboarded company now</h4>
                      <p className="mt-1 text-sm text-zinc-600">The company must already exist in this workspace with the same ITF registration number. A test API record alone does not create a company.</p>
                    </div>
                    <input name="itfEmployerNumber" required placeholder="ITF registration number" className="rounded-md border px-3 py-2" />
                    <input name="year" type="number" min="2000" max={new Date().getFullYear() + 1} required placeholder="Training year" className="rounded-md border px-3 py-2" />
                    <button className="w-fit rounded-md border px-4 py-2 text-sm font-semibold">Run verification</button>
                  </form>
                  {developmentRecords.filter((record) => record.workspaceId === workspace.id).map((record) => (
                    <p key={record.id} className="text-xs text-zinc-600">{record.itfEmployerNumber} · {record.year} · paid {record.contributionPaid.toString()} · payment {record.paymentSettled ? "settled" : "unsettled"} · certificate {record.certificateIssued ? "issued" : "not issued"}</p>
                  ))}
                </section>
              ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
