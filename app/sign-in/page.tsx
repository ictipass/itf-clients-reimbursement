import { SignInForm } from "@/app/sign-in/sign-in-form";
import { getConfiguredOAuthProviders } from "@/lib/auth";
import Link from "next/link";

export default async function SignInPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
}>) {
  const params = await searchParams;
  const callbackUrl = Array.isArray(params.callbackUrl) ? params.callbackUrl[0] : params.callbackUrl;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const oauthProviders = getConfiguredOAuthProviders();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-12 text-zinc-950">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-[#800020]">Back to home</Link>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          Secure portal access
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Sign in with your authorized portal account or configured Workspace identity.
        </p>
        <SignInForm callbackUrl={callbackUrl ?? "/dashboard"} initialError={error} oauthProviders={oauthProviders} />
        <Link href="/get-started" className="mt-5 inline-flex text-sm font-semibold text-[#800020]">Begin employer registration</Link>
      </section>
    </main>
  );
}
