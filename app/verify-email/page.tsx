import Link from "next/link";

export default async function VerifyEmailPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ error?: string; verified?: string }> }>) {
  const { error, verified } = await searchParams;
  const isVerified = verified === "true" && !error;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">{isVerified ? "Email verified" : "Verification unsuccessful"}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {isVerified
            ? "Your employer account is active. Sign in to begin the company registration process."
            : error ?? "The verification link is invalid or incomplete."}
        </p>
        <Link href={isVerified ? "/sign-in?callbackUrl=/dashboard" : "/get-started"} className="mt-5 inline-flex min-h-11 items-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
          {isVerified ? "Sign in and continue" : "Return to registration"}
        </Link>
      </section>
    </main>
  );
}
