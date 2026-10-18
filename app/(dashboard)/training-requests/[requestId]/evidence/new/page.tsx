import Link from "next/link";
import { HostedFileInput } from "@/components/hosted-file-input";
import { notFound } from "next/navigation";

import { uploadTrainingRequestEvidenceAction } from "@/app/(dashboard)/training-requests/[requestId]/actions";
import { getDb } from "@/lib/db";
import { getTrainingRequestEvidenceKinds } from "@/lib/training-request";
import { getVisibleTrainingRequestWhere } from "@/lib/training-request-access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function NewTrainingRequestEvidencePage({
  params,
}: Readonly<{
  params: Promise<{ requestId: string }>;
}>) {
  const { requestId } = await params;
  const session = await getServerSession(authOptions);
  const visibleWhere = await getVisibleTrainingRequestWhere({
    email: session?.user?.email,
    role: session?.user?.role ?? "SYSTEM_ADMIN",
  });
  const request = await getDb().trainingRequest.findFirst({
    where: {
      ...visibleWhere,
      id: requestId,
    },
    select: {
      id: true,
      title: true,
      company: {
        select: {
          legalName: true,
        },
      },
    },
  });

  if (!request) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <Link href={`/training-requests/${request.id}`} className="text-sm font-semibold text-[#800020]">
        Back to request
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Upload Training Approval evidence
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600">
        Attach evidence for {request.title} by {request.company.legalName}.
      </p>

      <form
        action={uploadTrainingRequestEvidenceAction.bind(null, request.id)}
        className="mt-6 grid gap-5 rounded-lg border border-zinc-200 bg-white p-6"
      >
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Evidence type
          <select
            name="kind"
            required
            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
          >
            {getTrainingRequestEvidenceKinds().map((kind) => (
              <option key={kind} value={kind}>
                {kind.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Evidence file
          <HostedFileInput hosted={process.env.STORAGE_PROVIDER !== "local" && Boolean(process.env.STORAGE_PROVIDER)}
            name="evidence"
            required
            accept="application/pdf,image/jpeg,image/png,text/csv"
            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 py-2"
          />
        </label>
        <button className="min-h-11 w-fit rounded-md bg-[#800020] px-5 text-sm font-semibold text-white">
          Upload evidence
        </button>
      </form>
    </div>
  );
}
