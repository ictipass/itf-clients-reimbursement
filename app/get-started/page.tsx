import Image from "next/image";
import Link from "next/link";

import { registerEmployerAccountAction } from "@/app/get-started/actions";
import { getConfiguredOAuthProviders } from "@/lib/auth";
import { appName } from "@/lib/domain";
import { getOrganizationInvitation } from "@/lib/employer-members";
import { getActiveRevenueWorkflowMode, usesInAppRevenueWorkflow } from "@/lib/revenue-workflow";

export default async function GetStartedPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ error?: string; registered?: string; token?: string; invitationToken?: string }> }>) {
  const params = await searchParams;
  const invitation = params.invitationToken
    ? await getOrganizationInvitation(params.invitationToken)
    : null;
  const googleEnabled = getConfiguredOAuthProviders().some((provider) => provider.id === "google");
  const registrationCallback = encodeURIComponent("/dashboard");
  const integrated = usesInAppRevenueWorkflow(await getActiveRevenueWorkflowMode());

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/favicon.ico" alt="Industrial Training Fund logo" width={44} height={44} className="h-11 w-11 rounded-full bg-white p-1" />
            <div>
              <p className="text-xs font-semibold uppercase text-[#800020]">Industrial Training Fund</p>
              <p className="text-sm font-semibold">{appName}</p>
            </div>
          </div>
          <Link href="/" className="text-sm font-semibold text-[#800020]">Back to home</Link>
        </header>
        <section className="mt-8 border-b border-zinc-200 pb-6">
          <p className="text-sm font-semibold uppercase text-[#800020]">Employer onboarding</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{integrated ? "Get started with employer registration" : "Get started with reimbursement"}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            {integrated
              ? "New employers and employers already registered with ITF begin here. After sign-in, select the appropriate registration type and complete the employer profile."
              : "Create a portal account, then add your company using its existing ITF registration number. Annual compliance is handled by the existing platform."}
          </p>
        </section>
        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-semibold">
            {integrated ? "Register on the Integrated Contribution and Reimbursement Platform" : "Create a reimbursement portal account"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            {integrated
              ? "Create an employer portal account, then verify your email before beginning company registration."
              : "Create a portal account and verify your email. You will supply the company's existing ITF registration number after sign-in."}
          </p>
          {params.error ? <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{params.error}</p> : null}
          {params.registered ? (
            <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Account created. Check your email to verify your account.
              {params.token ? <Link href={`/verify-email/confirm?token=${encodeURIComponent(params.token)}${params.invitationToken ? `&next=${encodeURIComponent(`/invitations/accept?token=${params.invitationToken}`)}` : ""}`} className="mt-2 block font-semibold underline">Development only: verify this account</Link> : null}
            </div>
          ) : null}
          <form action={registerEmployerAccountAction} className="mt-6 grid gap-4">
            {params.invitationToken ? <input type="hidden" name="invitationToken" value={params.invitationToken} /> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">First name<input name="firstName" required autoComplete="given-name" className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
              <label className="grid gap-2 text-sm font-medium">Last name<input name="lastName" required autoComplete="family-name" className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
            </div>
            <label className="grid gap-2 text-sm font-medium">Work email<input name="email" type="email" required readOnly={Boolean(invitation)} defaultValue={invitation?.email} autoComplete="email" className="min-h-11 rounded-md border border-zinc-300 px-3 read-only:bg-zinc-100" /></label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">Password<input name="password" type="password" required minLength={12} autoComplete="new-password" className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
              <label className="grid gap-2 text-sm font-medium">Confirm password<input name="confirmPassword" type="password" required minLength={12} autoComplete="new-password" className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
            </div>
            <button className="min-h-11 w-fit rounded-md bg-[#800020] px-5 text-sm font-semibold text-white">Create portal account</button>
          </form>
          <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-zinc-200" /><span className="text-xs font-semibold uppercase text-zinc-500">or</span><span className="h-px flex-1 bg-zinc-200" /></div>
          {googleEnabled ? (
            <Link href={`/api/auth/signin/google?callbackUrl=${registrationCallback}`} className="inline-flex min-h-11 items-center gap-3 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900">
              <Image src="/google-g.svg" alt="" width={18} height={18} aria-hidden="true" />
              Continue with Google
            </Link>
          ) : (
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">Google registration will be available when Workspace identity is configured.</p>
          )}
          <p className="mt-5 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
            Already registered on this platform?{" "}
            <Link href="/sign-in" className="font-semibold text-[#800020]">Continue to sign in</Link>.
          </p>
        </section>
        {integrated ? <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Already registered with ITF?</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Continue through the same onboarding path and select <strong>Already registered with ITF</strong>. Your existing ITF registration number will be required for validation.
          </p>
        </section> : null}
      </div>
    </main>
  );
}
