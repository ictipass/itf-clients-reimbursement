import { SignInForm } from "@/app/sign-in/sign-in-form";
import { getConfiguredOAuthProviders } from "@/lib/auth";

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
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
          Bootstrap access
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Use the bootstrap admin credentials from environment variables until Workspace
          identity integration is connected.
        </p>
        <SignInForm callbackUrl={callbackUrl ?? "/dashboard"} initialError={error} oauthProviders={oauthProviders} />
      </section>
    </main>
  );
}
