import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";

import { resendVerificationAction } from "@/app/verify-email/resend/actions";

export default async function ResendVerificationPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ requested?: string; token?: string }> }>) {
  const query = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">Resend verification email</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Enter the email used during portal registration. The response is intentionally the same for every address.</p>
        {query.requested ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">If an unverified account exists, a fresh verification link has been prepared.</p> : null}
        {query.token ? <Link href={`/verify-email/confirm?token=${encodeURIComponent(query.token)}`} className="mt-3 block text-sm font-semibold text-[#800020] underline">Development only: verify account</Link> : null}
        <form action={resendVerificationAction} className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">Email address<input name="email" type="email" required className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
          <button className="min-h-11 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Request fresh verification link</button>
          <FormActionProgress />
        </form>
        <Link href="/sign-in" className="mt-5 block text-sm font-semibold text-[#800020]">Return to sign in</Link>
      </section>
    </main>
  );
}
