import Image from "next/image";
import Link from "next/link";

import { getConfiguredOAuthProviders } from "@/lib/auth";

export default function GetStartedPage() {
  const googleEnabled = getConfiguredOAuthProviders().some((provider) => provider.id === "google");
  const registrationCallback = encodeURIComponent("/registry/new");

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-3 text-sm font-semibold text-[#800020]">
          <Image src="/favicon.ico" alt="Industrial Training Fund logo" width={40} height={40} className="h-10 w-10 rounded-full bg-white p-1" />
          Back to home
        </Link>
        <section className="mt-8 border-b border-zinc-200 pb-6">
          <p className="text-sm font-semibold uppercase text-[#800020]">Employer onboarding</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Get started with employer registration</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            New employers and employers already registered with ITF begin here. After sign-in, select the appropriate registration type and complete the employer profile.
          </p>
        </section>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Use a portal account</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Continue with an employer portal account issued or approved for this workspace.</p>
            <Link href="/sign-in?callbackUrl=/registry/new" className="mt-5 inline-flex min-h-11 items-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Sign in and continue
            </Link>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Continue with Google</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Use a verified Google identity already authorized for the ITF workspace.</p>
            {googleEnabled ? (
              <Link href={`/api/auth/signin/google?callbackUrl=${registrationCallback}`} className="mt-5 inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900">
                Continue with Google
              </Link>
            ) : (
              <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">Google sign-in will become available when the Workspace identity provider is configured.</p>
            )}
          </section>
        </div>
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
