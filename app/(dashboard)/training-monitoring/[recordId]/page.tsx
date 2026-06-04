import Link from "next/link";
import { notFound } from "next/navigation";

import { getDb } from "@/lib/db";

function formatDate(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function formatTime(date: Date | null) {
  if (!date) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-NG", {
    timeStyle: "short",
  }).format(date);
}

export default async function TrainingMonitoringDetailPage({
  params,
}: Readonly<{
  params: Promise<{ recordId: string }>;
}>) {
  const { recordId } = await params;
  const record = await getDb().trainingMonitoringRecord.findFirst({
    where: {
      id: recordId,
      recordTier: "HOT",
    },
    select: {
      id: true,
      mode: true,
      monitoringDate: true,
      startsAt: true,
      endsAt: true,
      meetingId: true,
      passcode: true,
      virtualLink: true,
      monitoringOfficerName: true,
      monitoringOfficerTitle: true,
      headOfDivisionName: true,
      directorName: true,
      status: true,
      trainingRequest: {
        select: {
          id: true,
          title: true,
          provider: true,
          venue: true,
          participantCount: true,
          company: {
            select: {
              id: true,
              legalName: true,
              itfEmployerNumber: true,
              areaOffice: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!record) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      <div className="flex flex-wrap gap-3">
        <Link href="/training-monitoring" className="text-sm font-semibold text-[#800020]">
          Back to Monitoring
        </Link>
        <Link
          href={`/training-requests/${record.trainingRequest.id}`}
          className="text-sm font-semibold text-zinc-700"
        >
          Open Form 4A
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            {record.mode === "LOCAL_PHYSICAL" ? "Form 6A" : "Form 6B"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {record.trainingRequest.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Monitoring record for {record.trainingRequest.company.legalName}.
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
          {record.status.replaceAll("_", " ")}
        </span>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Company
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {record.trainingRequest.company.legalName}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Area Office
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {record.trainingRequest.company.areaOffice?.name ?? "No Area Office"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Date</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatDate(record.monitoringDate)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Time</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {formatTime(record.startsAt)} - {formatTime(record.endsAt)}
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Training details</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-600">
            <p>
              <span className="font-semibold text-zinc-900">Provider:</span>{" "}
              {record.trainingRequest.provider}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Venue:</span>{" "}
              {record.trainingRequest.venue ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Participants:</span>{" "}
              {record.trainingRequest.participantCount ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">ITF number:</span>{" "}
              {record.trainingRequest.company.itfEmployerNumber ?? "Pending"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold tracking-tight">Monitoring details</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-600">
            <p>
              <span className="font-semibold text-zinc-900">Meeting ID:</span>{" "}
              {record.meetingId ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Passcode:</span>{" "}
              {record.passcode ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Virtual link:</span>{" "}
              {record.virtualLink ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Monitoring officer:</span>{" "}
              {record.monitoringOfficerName ?? "Not assigned"}
              {record.monitoringOfficerTitle ? `, ${record.monitoringOfficerTitle}` : ""}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Head of Division:</span>{" "}
              {record.headOfDivisionName ?? "Not provided"}
            </p>
            <p>
              <span className="font-semibold text-zinc-900">Director:</span>{" "}
              {record.directorName ?? "Not provided"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
