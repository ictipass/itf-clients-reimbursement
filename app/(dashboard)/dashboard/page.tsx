import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getAttentionSummary } from "@/lib/attention";
import { listEmployerDashboardActions } from "@/lib/dashboard-work-queue";
import { getDb } from "@/lib/db";
import { dashboardMetrics, workflowStages } from "@/lib/domain";
import {
  DEFAULT_REIMBURSEMENT_POLICY_EDITION,
  formatReimbursementPolicyEdition,
  type ReimbursementPolicyEdition,
} from "@/lib/reimbursement-policy";
import { roles } from "@/lib/rbac";

function formatRole(value: string | null) {
  return value ? value.replaceAll("_", " ") : "Unassigned";
}

function formatKind(value: string) {
  return value.replaceAll("_", " ");
}

function getQueueBadgeClass(category: string) {
  if (category === "AWARENESS") {
    return "border-[#0f766e]/20 bg-[#0f766e]/10 text-[#115e59]";
  }

  return "border-[#800020]/20 bg-[#800020]/10 text-[#65001a]";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isEmployerRole(role: string) {
  return role === "EMPLOYER_ADMIN" || role === "EMPLOYER_SUBMITTER" || role === "EMPLOYER_VIEWER";
}

function isAreaOfficeOfficerRole(role: string) {
  return (
    role === "AREA_MANAGER" ||
    role === "HORIC" ||
    role === "REVENUE_ACCOUNTANT" ||
    role === "HEAD_OF_TRAINING" ||
    role === "REIMBURSEMENT_OFFICER"
  );
}

function isHeadquartersReviewerRole(role: string) {
  return (
    role === "DIRECTOR_FSD" ||
    role === "HEAD_OF_DIVISION" ||
    role === "HQ_REIMBURSEMENT_OFFICER" ||
    role === "HQ_REVENUE_ACCOUNTANT" ||
    role === "DIRECTOR_GENERAL" ||
    role === "DIRECTOR_AUDIT" ||
    role === "HEAD_REIMBURSEMENT_AUDIT" ||
    role === "REIMBURSEMENT_SCHEDULE_AUDITOR" ||
    role === "HEAD_BUDGET" ||
    role === "BUDGET_OFFICER" ||
    role === "PRE_AUDIT_OFFICER" ||
    role === "DIRECTOR_FINANCE" ||
    role === "HEAD_REIMBURSEMENT_FINANCE" ||
    role === "REIMBURSEMENT_ACCOUNTANT" ||
    role === "DIRECTOR_REVENUE_INSPECTORATE_COMPLIANCE" ||
    role === "HEAD_INSPECTORATE_COMPLIANCE"
  );
}

function isSystemAdminRole(role: string) {
  return role === "SYSTEM_ADMIN" || role === "WORKSPACE_APP_ADMIN";
}

function ReimbursementEditionBanner({
  edition,
}: Readonly<{
  edition: ReimbursementPolicyEdition;
}>) {
  return (
    <section className="rounded-lg border border-[#800020]/20 bg-[#800020]/5 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">
        Current reimbursement policy
      </p>
      <p className="mt-1 text-lg font-semibold text-zinc-950">
        {formatReimbursementPolicyEdition(edition)}
      </p>
      <p className="mt-1 text-sm leading-6 text-zinc-600">
        New claims are calculated and processed under this active policy edition. Existing claims
        remain locked to the edition saved on the claim.
      </p>
    </section>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const activeRole = session?.user?.role ?? "SYSTEM_ADMIN";
  const activeWorkspace = await getDb().workspace.findFirst({
    where: {
      isActive: true,
    },
    select: {
      activeReimbursementEdition: true,
    },
    orderBy: {
      name: "asc",
    },
  });
  const activeReimbursementEdition =
    activeWorkspace?.activeReimbursementEdition ?? DEFAULT_REIMBURSEMENT_POLICY_EDITION;
  const attentionSummary = await getAttentionSummary({
    requesterEmail: session?.user?.email,
    requesterRole: activeRole,
    take: 8,
  });
  const employerActions = await listEmployerDashboardActions({
    requesterEmail: session?.user?.email,
    requesterRole: activeRole,
    take: 5,
  });
  const hasWorkQueue =
    attentionSummary.items.length > 0 ||
    attentionSummary.awarenessItems.length > 0 ||
    employerActions.length > 0;
  const actionCount = attentionSummary.actionTotal + employerActions.length;
  const awarenessCount = attentionSummary.awarenessTotal;

  if (isEmployerRole(activeRole)) {
    const memberships = session?.user?.email
      ? await getDb().membership.findMany({
          where: {
            user: {
              email: session.user.email,
            },
            organizationId: {
              not: null,
            },
            isActive: true,
          },
          select: {
            organizationId: true,
          },
        })
      : [];
    const organizationIds = memberships
      .map((membership) => membership.organizationId)
      .filter((value): value is string => Boolean(value));
    const companies = await getDb().company.findMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
        recordTier: "HOT",
      },
      select: {
        id: true,
        legalName: true,
        status: true,
        itfEmployerNumber: true,
        complianceYears: {
          select: {
            year: true,
            status: true,
          },
          orderBy: {
            year: "desc",
          },
          take: 1,
        },
        trainingPlanSubmissions: {
          select: {
            year: true,
            status: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        reimbursementClaims: {
          select: {
            reference: true,
            status: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 8,
    });

    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
              Employer workspace
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
              Your reimbursement readiness
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
              Track company registration, annual compliance, Training Plan submissions, Training
              Approval Requests, monitoring, and claims from one employer-focused desk.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-sm font-semibold text-zinc-500">Pending employer actions</p>
            <p className="mt-2 text-4xl font-semibold text-[#800020]">{employerActions.length}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Items here need action from your organization before ITF can continue the workflow.
            </p>
          </div>
        </section>

        <ReimbursementEditionBanner edition={activeReimbursementEdition} />

        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Company status</h2>
          {companies.length === 0 ? (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
              No company is linked to your account yet. {activeRole === "EMPLOYER_ADMIN" ? (
                <Link href="/registry/new" className="font-semibold text-[#800020] underline underline-offset-2 hover:text-[#65001a]">
                  Click here to add a company to your profile.
                </Link>
              ) : (
                "Ask your employer administrator to add a company to your organization."
              )}
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {companies.map((company) => (
                <Link
                  key={company.id}
                  href={`/registry/${company.id}`}
                  className="grid gap-3 rounded-md border border-zinc-100 p-4 transition hover:border-[#800020]/40 md:grid-cols-4"
                >
                  <div>
                    <p className="font-semibold text-zinc-950">{company.legalName}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {company.itfEmployerNumber ?? "ITF number pending"}
                    </p>
                  </div>
                  <p className="text-sm text-zinc-700">Registration: {company.status}</p>
                  <p className="text-sm text-zinc-700">
                    Compliance:{" "}
                    {company.complianceYears[0]
                      ? `${company.complianceYears[0].year} · ${company.complianceYears[0].status}`
                      : "Not filed"}
                  </p>
                  <p className="text-sm text-zinc-700">
                    Claim:{" "}
                    {company.reimbursementClaims[0]
                      ? `${company.reimbursementClaims[0].reference} · ${company.reimbursementClaims[0].status}`
                      : "None"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-2xl font-semibold tracking-tight">My actions</h2>
          {employerActions.length === 0 ? (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
              No pending employer-side action.
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {employerActions.map((item) => (
                <Link
                  key={item.id}
                  href={item.targetHref}
                  className="grid gap-2 rounded-md border border-zinc-100 p-4 transition hover:border-[#800020]/40"
                >
                  <p className="font-semibold text-zinc-950">{item.title}</p>
                  <p className="text-sm leading-6 text-zinc-600">{item.summary}</p>
                  <p className="text-xs leading-5 text-zinc-500">
                    {item.companyName} · {formatDate(item.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  if (isSystemAdminRole(activeRole)) {
    const hasIntegratedWorkspace = await getDb().workspace.count({ where: { isActive: true, revenueWorkflowMode: "IN_APP_REVENUE" } }) > 0;
    const acceptedBanks = await getDb().bankDirectoryEntry.count({ where: { isActive: true } });
    const [
      usersCount,
      officesCount,
      organizationsCount,
      availableNumbers,
      certificateTemplates,
      signatures,
      auditEvents,
    ] = await getDb().$transaction([
      getDb().user.count(),
      getDb().areaOffice.count({
        where: {
          isActive: true,
        },
      }),
      getDb().organization.count({
        where: {
          isActive: true,
        },
      }),
      getDb().managedRegistrationNumber.count({
        where: {
          status: "AVAILABLE",
          recordTier: "HOT",
        },
      }),
      getDb().certificateTemplate.count({
        where: {
          recordTier: "HOT",
        },
      }),
      getDb().signatureAsset.count({
        where: {
          recordTier: "HOT",
        },
      }),
      getDb().auditEvent.count({
        where: {
          recordTier: "HOT",
        },
      }),
    ]);

    const adminLinks = [
      { href: "/settings/users", label: "Manage users", value: usersCount },
      { href: "/settings/offices", label: "Manage offices", value: officesCount },
      { href: "/settings/roles", label: "Review roles", value: roles.length },
      { href: "/settings/banks", label: "Accepted banks", value: acceptedBanks },
      ...(hasIntegratedWorkspace ? [
        { href: "/settings/numbers", label: "Managed numbers", value: availableNumbers },
        { href: "/settings/certificates", label: "Certificate templates", value: certificateTemplates },
        { href: "/settings/signatures", label: "Signature assets", value: signatures },
      ] : []),
    ];

    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:px-8">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            System administration
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
            Workspace control center
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
            Configure users, offices, roles, accepted banks, and audit readiness for the reimbursement application.
          </p>
        </section>

        <ReimbursementEditionBanner edition={activeReimbursementEdition} />

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{usersCount}</p>
            <p className="mt-2 text-sm font-semibold">Users</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{officesCount}</p>
            <p className="mt-2 text-sm font-semibold">Active offices</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{organizationsCount}</p>
            <p className="mt-2 text-sm font-semibold">Organizations</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{auditEvents}</p>
            <p className="mt-2 text-sm font-semibold">Audit events</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {adminLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-[#800020]/40"
            >
              <p className="text-2xl font-semibold text-[#800020]">{item.value}</p>
              <p className="mt-2 text-sm font-semibold text-zinc-950">{item.label}</p>
            </Link>
          ))}
        </section>
      </div>
    );
  }

  if (isAreaOfficeOfficerRole(activeRole)) {
    const memberships = session?.user?.email
      ? await getDb().membership.findMany({
          where: {
            user: {
              email: session.user.email,
            },
            areaOfficeId: {
              not: null,
            },
            isActive: true,
          },
          select: {
            areaOfficeId: true,
          },
        })
      : [];
    const areaOfficeIds = Array.from(
      new Set(
        memberships
          .map((membership) => membership.areaOfficeId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const areaOffices = await getDb().areaOffice.findMany({
      where: {
        id: {
          in: areaOfficeIds,
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    const [companiesCount, openRegistrations, openTrainingPlans, openMonitoring] =
      await getDb().$transaction([
        getDb().company.count({
          where: {
            areaOfficeId: {
              in: areaOfficeIds,
            },
            recordTier: "HOT",
          },
        }),
        getDb().registrationApplication.count({
          where: {
            areaOfficeId: {
              in: areaOfficeIds,
            },
            status: {
              in: ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"],
            },
            recordTier: "HOT",
          },
        }),
        getDb().trainingPlanSubmission.count({
          where: {
            company: {
              areaOfficeId: {
                in: areaOfficeIds,
              },
            },
            status: {
              in: ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"],
            },
            recordTier: "HOT",
          },
        }),
        getDb().trainingMonitoringRecord.count({
          where: {
            trainingRequest: {
              company: {
                areaOfficeId: {
                  in: areaOfficeIds,
                },
              },
            },
            status: {
              in: ["DRAFT", "SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"],
            },
            recordTier: "HOT",
          },
        }),
      ]);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const nextWeekEnd = new Date(tomorrowStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    const scheduledMonitoring = await getDb().trainingMonitoringRecord.findMany({
      where: {
        recordTier: "HOT",
        monitoringDate: { gte: todayStart, lt: nextWeekEnd },
        trainingRequest: {
          company: { areaOfficeId: { in: areaOfficeIds } },
        },
      },
      select: {
        id: true,
        monitoringDate: true,
        startsAt: true,
        mode: true,
        trainingRequest: {
          select: {
            title: true,
            company: { select: { legalName: true } },
          },
        },
      },
      orderBy: { monitoringDate: "asc" },
      take: 30,
    });
    const happeningToday = scheduledMonitoring.filter(
      (record) => record.monitoringDate && record.monitoringDate >= todayStart && record.monitoringDate < tomorrowStart,
    );
    const comingNextWeek = scheduledMonitoring.filter(
      (record) => record.monitoringDate && record.monitoringDate >= tomorrowStart && record.monitoringDate < nextWeekEnd,
    );

    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:px-8">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Area Office desk
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
            {formatRole(activeRole)} work queue
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
            Review tasks routed to your Area Office desk, including registration, training,
            monitoring, compliance awareness, and reimbursement work.
          </p>
        </section>

        <ReimbursementEditionBanner edition={activeReimbursementEdition} />

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{attentionSummary.actionTotal}</p>
            <p className="mt-2 text-sm font-semibold">Action queue</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{companiesCount}</p>
            <p className="mt-2 text-sm font-semibold">Companies in scope</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{openRegistrations}</p>
            <p className="mt-2 text-sm font-semibold">Open registrations</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">
              {openTrainingPlans + openMonitoring}
            </p>
            <p className="mt-2 text-sm font-semibold">Open training items</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-2xl font-semibold tracking-tight">Desk queue</h2>
            {attentionSummary.items.length === 0 ? (
              <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                No pending attention items for your Area Office desk.
              </p>
            ) : (
              <div className="mt-5 grid gap-3">
                {attentionSummary.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.targetHref}
                    className="grid gap-2 rounded-md border border-zinc-100 p-4 transition hover:border-[#800020]/40"
                  >
                    <p className="font-semibold text-zinc-950">{item.title}</p>
                    <p className="text-sm leading-6 text-zinc-600">
                      {item.summary ?? item.company?.legalName ?? "Open workflow item"}
                    </p>
                    <p className="text-xs leading-5 text-zinc-500">
                      {formatKind(item.kind)} · {item.areaOffice?.name ?? "Area Office"} ·{" "}
                      {formatDate(item.createdAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
            {attentionSummary.awarenessItems.length > 0 ? (
              <details className="group mt-5 rounded-md border border-teal-200 bg-teal-50/40 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="font-semibold text-teal-950">Compliance awareness</span>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-teal-800">
                    {attentionSummary.awarenessTotal} filing
                    {attentionSummary.awarenessTotal === 1 ? "" : "s"}
                  </span>
                </summary>
                <div className="mt-4 grid gap-2 border-t border-teal-100 pt-4">
                  {attentionSummary.awarenessItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.targetHref}
                      className="rounded-md border border-teal-100 bg-white p-3 transition hover:border-teal-300"
                    >
                      <p className="text-sm font-semibold text-zinc-950">
                        {item.company?.legalName ?? item.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-600">
                        {item.summary ?? "Annual compliance filed for awareness."}
                      </p>
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-2xl font-semibold tracking-tight">Office scope</h2>
            {areaOffices.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-zinc-600">
                No Area Office assignment is linked to this account.
              </p>
            ) : (
              <div className="mt-5 grid gap-2">
                {areaOffices.map((office) => (
                  <div key={office.id} className="rounded-md bg-zinc-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-zinc-950">{office.name}</p>
                    <p className="text-xs text-zinc-500">
                      {office.code ?? "No code"} · {office.slug}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {[
            { title: "Happening Today", rows: happeningToday },
            { title: "Coming Up / Happening Next Week", rows: comingNextWeek },
          ].map((section) => (
            <div key={section.title} className="rounded-lg border border-zinc-200 bg-white p-6">
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              {section.rows.length === 0 ? (
                <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  No training monitoring entry in this period.
                </p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {section.rows.map((record) => (
                    <Link key={record.id} href={`/training-monitoring/${record.id}`} className="rounded-md border border-zinc-100 p-4 transition hover:border-[#800020]/40">
                      <p className="font-semibold text-zinc-950">{record.trainingRequest.title}</p>
                      <p className="mt-1 text-sm text-zinc-600">{record.trainingRequest.company.legalName}</p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Monitoring · {record.mode.replaceAll("_", " ")} · {record.monitoringDate ? formatDate(record.monitoringDate) : "Date pending"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (isHeadquartersReviewerRole(activeRole)) {
    const [pendingCompliance, pendingClaims, activeCertificates, openHqWorkItems] =
      await getDb().$transaction([
        getDb().complianceYear.count({
          where: {
            status: {
              in: ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"],
            },
            recordTier: "HOT",
          },
        }),
        getDb().reimbursementClaim.count({
          where: {
            status: {
              in: ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"],
            },
            recordTier: "HOT",
          },
        }),
        getDb().complianceCertificate.count({
          where: {
            recordTier: "HOT",
          },
        }),
        getDb().workItem.count({
          where: {
            status: "OPEN",
            recordTier: "HOT",
            assignedRole: activeRole,
          },
        }),
      ]);

    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:px-8">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">
            Headquarters desk
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
            {formatRole(activeRole)} review center
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
            Track headquarters-level compliance, certificate, and reimbursement review work across
            Area Offices.
          </p>
        </section>

        <ReimbursementEditionBanner edition={activeReimbursementEdition} />

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{openHqWorkItems}</p>
            <p className="mt-2 text-sm font-semibold">HQ work items</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{pendingCompliance}</p>
            <p className="mt-2 text-sm font-semibold">Compliance in review</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{pendingClaims}</p>
            <p className="mt-2 text-sm font-semibold">Claims in review</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-3xl font-semibold text-[#800020]">{activeCertificates}</p>
            <p className="mt-2 text-sm font-semibold">Compliance certificates</p>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-2xl font-semibold tracking-tight">HQ queue</h2>
          {attentionSummary.items.length === 0 ? (
            <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
              No pending headquarters attention item for your desk.
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {attentionSummary.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.targetHref}
                  className="grid gap-2 rounded-md border border-zinc-100 p-4 transition hover:border-[#800020]/40"
                >
                  <p className="font-semibold text-zinc-950">{item.title}</p>
                  <p className="text-sm leading-6 text-zinc-600">
                    {item.summary ?? item.company?.legalName ?? "Open workflow item"}
                  </p>
                  <p className="text-xs leading-5 text-zinc-500">
                    {formatKind(item.kind)} · {formatDate(item.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">Desk</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
            Your reimbursement work queue
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
            Signed in as <span className="font-semibold text-zinc-950">{formatRole(activeRole)}</span>.
            Action items need your desk decision. Awareness items keep you informed about filings in
            your office or workspace scope. Shared desk items may be visible to other officers with
            the same role and office assignment.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={attentionSummary.items[0]?.targetHref ?? employerActions[0]?.targetHref ?? "/registry"}
              className="rounded-full bg-[#800020] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Continue next item
            </Link>
            <Link
              href="/registry"
              className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold"
            >
              Open registry
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {dashboardMetrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-zinc-200 bg-white p-5">
              <p className="text-3xl font-semibold text-[#800020]">{metric.value}</p>
              <p className="mt-2 text-sm font-semibold">{metric.label}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">{metric.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <ReimbursementEditionBanner edition={activeReimbursementEdition} />

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">My work queue</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Open workflow tasks and employer-side actions that need attention.
            </p>
          </div>
          <span className="inline-flex min-h-9 items-center rounded-full bg-[#800020]/10 px-3 text-sm font-semibold text-[#65001a]">
            {actionCount} action · {awarenessCount} awareness
          </span>
        </div>
        {!hasWorkQueue ? (
          <p className="mt-5 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            No pending attention items for your desk.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {attentionSummary.items.map((item) => (
              <Link
                key={item.id}
                href={item.targetHref}
                className="grid gap-2 rounded-md border border-zinc-100 p-4 transition hover:border-[#800020]/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-zinc-950">{item.title}</p>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${getQueueBadgeClass(item.queueCategory)}`}
                    >
                      {item.queueLabel}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">
                      {item.priority}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-6 text-zinc-600">
                  {item.summary ?? item.company?.legalName ?? "Open workflow item"}
                </p>
                <p className="text-xs leading-5 text-zinc-500">
                  {formatKind(item.kind)} · {formatRole(item.assignedRole)} ·{" "}
                  {item.areaOffice?.name ?? item.organization?.name ?? "Workspace"} ·{" "}
                  {formatDate(item.createdAt)}
                </p>
                <p className="text-xs font-semibold text-zinc-600">{item.ownershipLabel}</p>
              </Link>
            ))}
            {employerActions.map((item) => (
              <Link
                key={item.id}
                href={item.targetHref}
                className="grid gap-2 rounded-md border border-zinc-100 p-4 transition hover:border-[#800020]/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-zinc-950">{item.title}</p>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">
                    {item.priority}
                  </span>
                </div>
                <p className="text-sm leading-6 text-zinc-600">{item.summary}</p>
                <p className="text-xs leading-5 text-zinc-500">
                  Employer action · {item.companyName} · {formatDate(item.createdAt)}
                </p>
              </Link>
            ))}
            {attentionSummary.awarenessItems.length > 0 ? (
              <details className="group rounded-md border border-teal-200 bg-teal-50/40 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="font-semibold text-teal-950">Compliance awareness</span>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-teal-800">
                    {attentionSummary.awarenessTotal} filing
                    {attentionSummary.awarenessTotal === 1 ? "" : "s"}
                  </span>
                </summary>
                <p className="mt-2 text-xs leading-5 text-teal-900">
                  Informational filings are grouped here so they do not displace actionable work.
                </p>
                <div className="mt-4 grid gap-2 border-t border-teal-100 pt-4">
                  {attentionSummary.awarenessItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.targetHref}
                      className="rounded-md border border-teal-100 bg-white p-3 transition hover:border-teal-300"
                    >
                      <p className="text-sm font-semibold text-zinc-950">
                        {item.company?.legalName ?? item.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-600">
                        {item.summary ?? "Annual compliance filed for awareness."}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">{formatDate(item.createdAt)}</p>
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
            {attentionSummary.actionTotal > attentionSummary.items.length ? (
              <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                Showing {attentionSummary.items.length} of {attentionSummary.actionTotal} actionable
                work items.
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Workflow modules</h2>
          <p className="mt-1 text-sm text-zinc-600">
            These modules map directly to the Prisma models and RBAC permissions.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {workflowStages.map((stage) => (
            <article key={stage.key} className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{stage.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#800020]/10 px-3 py-1 text-xs font-semibold text-[#65001a]">
                  {stage.status}
                </span>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {stage.owner}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stage.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

    </div>
  );
}
