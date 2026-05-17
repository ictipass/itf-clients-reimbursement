import { SignInForm } from "@/app/sign-in/sign-in-form";

export default function SignInPage() {
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
        <SignInForm />
      </section>
    </main>
  );
}
