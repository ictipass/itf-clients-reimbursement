import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

import { verifyPublicCertificateNumber } from "@/lib/public-verification";
import { assertPublicVerificationRateLimit } from "@/lib/rate-limit";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

export default async function VerifyCertificatePage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<{ number?: string }>;
}>) {
  const params = await searchParams;
  const query = params?.number?.trim() ?? "";
  const headersList = await headers();
  const clientIdentity =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "public-verification";
  const verification = query
    ? await (async () => {
        try {
          assertPublicVerificationRateLimit(clientIdentity);

          return {
            result: await verifyPublicCertificateNumber(query),
            rateLimitError: null,
          };
        } catch (error) {
          return {
            result: null,
            rateLimitError: error instanceof Error
              ? error.message
              : "Too many verification attempts. Please wait and try again.",
          };
        }
      })()
    : {
        result: null,
        rateLimitError: null,
      };
  const { result, rateLimitError } = verification;

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-5 lg:px-8">
          <Link href="/" className="flex w-fit items-center gap-3">
            <Image
              src="/favicon.ico"
              alt="Industrial Training Fund logo"
              width={48}
              height={48}
              className="h-12 w-12 rounded-full bg-white p-1"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">
                Industrial Training Fund
              </p>
              <p className="text-lg font-semibold tracking-tight">Certificate verification</p>
            </div>
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 py-10 lg:px-8">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-3xl font-semibold tracking-tight">Verify certificate authenticity</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Enter an ITF employer number or annual compliance certificate number to confirm whether the
            record is active in the ITF reimbursement portal.
          </p>

          <form className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]" action="/verify">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              ITF employer number or certificate number
              <input
                name="number"
                required
                defaultValue={query}
                className="min-h-11 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <button className="min-h-11 self-end rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Verify
            </button>
          </form>
        </div>

        {result?.found ? (
          <section className="rounded-lg border border-emerald-200 bg-white p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Verified active record
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {result.companyName}
                </h2>
              </div>
              <Image
                src={`/verify/qr?number=${encodeURIComponent(result.certificateNumber)}`}
                alt="Certificate verification QR code"
                width={128}
                height={128}
                className="h-32 w-32 rounded-md border border-zinc-200 bg-white p-2"
              />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-md bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  ITF employer number
                </p>
                <p className="mt-2 font-semibold">{result.itfEmployerNumber}</p>
              </div>
              <div className="rounded-md bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Certificate number
                </p>
                <p className="mt-2 font-semibold">{result.certificateNumber}</p>
              </div>
              <div className="rounded-md bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Issued date
                </p>
                <p className="mt-2 font-semibold">{formatDate(result.issuedAt)}</p>
              </div>
              <div className="rounded-md bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Expiry date
                </p>
                <p className="mt-2 font-semibold">{formatDate(result.expiresAt)}</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-zinc-500">
              Verification checked on {formatDate(result.verifiedAt)}. This page only confirms
              public-safe certificate status and does not expose internal ITF workflow records.
            </p>
          </section>
        ) : null}

        {rateLimitError ? (
          <section className="rounded-lg border border-amber-200 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
              Verification temporarily limited
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{rateLimitError}</p>
          </section>
        ) : null}

        {result && !result.found ? (
          <section className="rounded-lg border border-amber-200 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
              No active record found
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No active ITF employer or annual compliance certificate record was found for{" "}
              <span className="font-semibold text-zinc-950">{result.query}</span>.
            </p>
          </section>
        ) : null}
      </section>
    </main>
  );
}
