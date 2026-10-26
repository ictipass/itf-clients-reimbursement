import { FormActionProgress } from "@/components/form-action-progress";
import Link from "next/link";

import { resetPasswordAction } from "@/app/reset-password/actions";

export default async function ResetPasswordPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ token?: string; error?: string }> }>) {
  const query = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        {query.error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{query.error}</p> : null}
        {query.token ? (
          <form action={resetPasswordAction} className="mt-5 grid gap-4">
            <input type="hidden" name="token" value={query.token} />
            <label className="grid gap-2 text-sm font-medium">New password<input name="password" type="password" minLength={12} required className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
            <label className="grid gap-2 text-sm font-medium">Confirm password<input name="confirmPassword" type="password" minLength={12} required className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
            <button className="min-h-11 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Set new password</button>
            <FormActionProgress />
          </form>
        ) : <p className="mt-4 text-sm text-zinc-600">A password reset token is required.</p>}
        <Link href="/forgot-password" className="mt-5 block text-sm font-semibold text-[#800020]">Request another link</Link>
      </section>
    </main>
  );
}
