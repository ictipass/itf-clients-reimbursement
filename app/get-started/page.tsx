import Image from "next/image";
import Link from "next/link";

import { getConfiguredOAuthProviders } from "@/lib/auth";

export default function GetStartedPage() {
  const googleEnabled = getConfiguredOAuthProviders().some((provider) => provider.id === "google");
  const registrationCallback = encodeURIComponent("/registry/new");

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/favicon.ico" alt="Industrial Training Fund logo" width={44} height={44} className="h-11 w-11 rounded-full bg-white p-1" />
            <div>
              <p className="text-xs font-semibold uppercase text-[#800020]">Industrial Training Fund</p>
              <p className="text-sm font-semibold">Reimbursement Platform</p>
            </div>
          </div>
          <Link href="/" className="text-sm font-semibold text-[#800020]">Back to home</Link>
        </header>
        <section className="mt-8 border-b border-zinc-200 pb-6">
          <p className="text-sm font-semibold uppercase text-[#800020]">Employer onboarding</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Get started with employer registration</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            New employers and employers already registered with ITF begin here. After sign-in, select the appropriate registration type and complete the employer profile.
          </p>
        </section>
        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Register on the new Reimbursement Platform</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Choose how you want to establish your portal identity, then continue to the employer registration form.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="font-semibold">Register with a portal account</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Continue using your authorized work email and portal credentials.
              </p>
              <Link href="/sign-in?callbackUrl=/registry/new" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                Continue with portal account
              </Link>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="font-semibold">Register with Google</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Continue with a verified Google identity authorized for the ITF workspace.
              </p>
              {googleEnabled ? (
                <Link href={`/api/auth/signin/google?callbackUrl=${registrationCallback}`} className="mt-4 inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900">
                  Continue with Google
                </Link>
              ) : (
                <p className="mt-4 rounded-md bg-white px-3 py-2 text-sm text-zinc-600">Google registration will be available when Workspace identity is configured.</p>
              )}
            </div>
          </div>
          <p className="mt-5 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
            Already registered on this reimbursement platform?{" "}
            <Link href="/sign-in" className="font-semibold text-[#800020]">Continue to sign in</Link>.
          </p>
        </section>
        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Already registered with ITF?</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Continue through the same onboarding path and select <strong>Already registered with ITF</strong>. Your existing ITF registration number will be required for validation.
          </p>
        </section>
      </div>
    </main>
  );
}
