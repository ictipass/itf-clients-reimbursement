import { getDb } from "@/lib/db";
import { isItfRole } from "@/lib/rbac";

function icsText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function icsDate(value: Date) {
  return value.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const user = await getDb().user.findFirst({
    where: { calendarFeedToken: token, calendarFeedEnabled: true, isActive: true },
    select: {
      id: true,
      memberships: {
        where: { isActive: true },
        select: { role: true, organizationId: true, areaOfficeId: true },
      },
    },
  });
  if (!user) return new Response("Calendar feed not found.", { status: 404 });

  const organizationIds = user.memberships.map((item) => item.organizationId).filter((value): value is string => Boolean(value));
  const areaOfficeIds = user.memberships.map((item) => item.areaOfficeId).filter((value): value is string => Boolean(value));
  const hasNationalScope = user.memberships.some((item) => isItfRole(item.role) && !item.areaOfficeId);
  const companyScope = hasNationalScope
    ? {}
    : organizationIds.length > 0
      ? { organizationId: { in: organizationIds } }
      : { areaOfficeId: { in: areaOfficeIds } };

  const [requests, monitoring] = await Promise.all([
    getDb().trainingRequest.findMany({
      where: { recordTier: "HOT", company: companyScope, startsAt: { gte: new Date(Date.now() - 31 * 86_400_000) } },
      select: { id: true, title: true, startsAt: true, endsAt: true, venue: true, onlineUrl: true, company: { select: { legalName: true } } },
      take: 500,
    }),
    getDb().trainingMonitoringRecord.findMany({
      where: { recordTier: "HOT", monitoringDate: { not: null }, trainingRequest: { company: companyScope } },
      select: { id: true, monitoringDate: true, startsAt: true, endsAt: true, trainingRequest: { select: { title: true, company: { select: { legalName: true } } } } },
      take: 500,
    }),
  ]);

  const events = [
    ...requests.map((item) => ({
      id: `training-${item.id}`,
      title: item.title,
      company: item.company.legalName,
      start: item.startsAt,
      end: item.endsAt,
      location: item.venue ?? item.onlineUrl ?? "",
    })),
    ...monitoring.flatMap((item) => item.monitoringDate ? [{
      id: `monitoring-${item.id}`,
      title: `Monitoring: ${item.trainingRequest.title}`,
      company: item.trainingRequest.company.legalName,
      start: item.startsAt ?? item.monitoringDate,
      end: item.endsAt ?? new Date((item.startsAt ?? item.monitoringDate).getTime() + 3_600_000),
      location: "",
    }] : []),
  ];
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ITF//Training Calendar//EN",
    "CALSCALE:GREGORIAN",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.id}@itf`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(event.start)}`,
      `DTEND:${icsDate(event.end)}`,
      `SUMMARY:${icsText(event.title)}`,
      `DESCRIPTION:${icsText(event.company)}`,
      `LOCATION:${icsText(event.location)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="itf-training-calendar.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
