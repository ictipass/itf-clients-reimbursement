import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db";
import { getActiveEmployerOrganization } from "@/lib/organization-context";
import { listCachedActiveAreaOffices } from "@/lib/reference-data";
import { isItfRole, type Role } from "@/lib/rbac";
import { isCompanyDetailCorrectionOpen } from "@/lib/employer-correction";

export type CreateCompanyInput = {
  requesterEmail: string;
  requesterRole: Role;
  areaOfficeId: string;
  legalName: string;
  itfEmployerNumber?: string;
  rcNumber?: string;
  taxId?: string;
  businessAddress?: string;
  postalAddress?: string;
  email?: string;
  telephone?: string;
  natureOfBusiness?: string;
  establishedAt?: Date;
};

type CompanyCreationMembership = {
  id: string;
  workspaceId: string;
  organizationId: string | null;
  workspace: { revenueWorkflowMode: "EXTERNAL_VERIFICATION" | "IN_APP_REVENUE" };
};

export function resolveCompanyCreationMembership(
  activeOrganization: { active: { id: string } | null; requiresSelection: boolean },
  memberships: CompanyCreationMembership[],
) {
  if (activeOrganization.requiresSelection) {
    throw new Error("Select an active organization before creating another company.");
  }
  const membership = activeOrganization.active
    ? memberships.find((item) => item.organizationId === activeOrganization.active?.id)
    : memberships.find((item) => item.organizationId === null);
  if (!membership) {
    throw new Error("Your employer account is not ready to create a company in the selected organization.");
  }
  return membership;
}

export type CorrectCompanyDetailsInput = {
  companyId: string;
  requesterEmail: string;
  requesterRole: Role;
  legalName: string;
  claimedItfEmployerNumber?: string;
  rcNumber?: string;
  taxId?: string;
  businessAddress?: string;
  postalAddress?: string;
  email?: string;
  telephone?: string;
  natureOfBusiness?: string;
  establishedAt?: Date;
};

type RegistryRequester = {
  requesterEmail: string;
  requesterRole: Role;
};

type RegistryCompanyScope =
  | { type: "ITF_GLOBAL" }
  | { type: "ITF_AREA_OFFICE"; areaOfficeIds: string[] }
  | { type: "EMPLOYER"; organizationIds: string[] };

const registryAdminRoles: Role[] = ["SYSTEM_ADMIN", "WORKSPACE_APP_ADMIN"];

export type EmployerRegistryFilters = {
  query?: string;
  status?: string;
  areaOffice?: string;
  page?: number;
  pageSize?: number;
  attentionCompanyIds?: string[];
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getEmployerOrganizationIds(requesterEmail: string) {
  const context = await getActiveEmployerOrganization(requesterEmail);
  return context.active ? [context.active.id] : [];
}

async function getRegistryCompanyScope(input: RegistryRequester): Promise<RegistryCompanyScope> {
  if (!isItfRole(input.requesterRole)) {
    return {
      type: "EMPLOYER",
      organizationIds: await getEmployerOrganizationIds(input.requesterEmail),
    };
  }

  if (registryAdminRoles.includes(input.requesterRole)) {
    return { type: "ITF_GLOBAL" };
  }

  const requester = await getDb().user.findUnique({
    where: {
      email: input.requesterEmail.toLowerCase(),
    },
    select: {
      memberships: {
        where: {
          isActive: true,
          role: input.requesterRole,
        },
        select: {
          areaOfficeId: true,
        },
      },
    },
  });

  const memberships = requester?.memberships ?? [];
  if (memberships.some((membership) => !membership.areaOfficeId)) {
    return { type: "ITF_GLOBAL" };
  }

  const areaOfficeIds = Array.from(
    new Set(
      memberships
        .map((membership) => membership.areaOfficeId)
        .filter((areaOfficeId): areaOfficeId is string => Boolean(areaOfficeId)),
    ),
  );

  return { type: "ITF_AREA_OFFICE", areaOfficeIds };
}

function companyScopeWhere(scope: RegistryCompanyScope) {
  if (scope.type === "ITF_GLOBAL") {
    return {};
  }

  if (scope.type === "ITF_AREA_OFFICE") {
    return {
      areaOfficeId: {
        in: scope.areaOfficeIds,
      },
    };
  }

  return {
    organizationId: {
      in: scope.organizationIds,
    },
  };
}

export async function listEmployerCompanies(input: RegistryRequester & EmployerRegistryFilters) {
  const db = getDb();
  const scope = await getRegistryCompanyScope(input);
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const where = {
    recordTier: "HOT" as const,
    ...companyScopeWhere(scope),
    ...(input.attentionCompanyIds ? { id: { in: input.attentionCompanyIds } } : {}),
    ...(input.status ? { status: input.status as never } : {}),
    ...(input.areaOffice
      ? { areaOffice: { name: { contains: input.areaOffice, mode: "insensitive" as const } } }
      : {}),
    ...(input.query
      ? {
          OR: [
            { legalName: { contains: input.query, mode: "insensitive" as const } },
            { rcNumber: { contains: input.query, mode: "insensitive" as const } },
            { itfEmployerNumber: { contains: input.query, mode: "insensitive" as const } },
            { email: { contains: input.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, companies] = await db.$transaction([
    db.company.count({ where }),
    db.company.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        legalName: true,
        areaOffice: {
          select: {
            name: true,
          },
        },
        rcNumber: true,
        itfEmployerNumber: true,
        email: true,
        telephone: true,
        natureOfBusiness: true,
        status: true,
        updatedAt: true,
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  return { companies, page, pageSize, total, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
}

export async function getEmployerCompany(companyId: string, input: RegistryRequester) {
  const db = getDb();
  const scope = await getRegistryCompanyScope(input);

  return db.company.findFirst({
    where: {
      id: companyId,
      recordTier: "HOT",
      ...companyScopeWhere(scope),
    },
    select: {
      id: true,
      legalName: true,
      areaOfficeId: true,
      rcNumber: true,
      taxId: true,
      itfEmployerNumber: true,
      businessAddress: true,
      postalAddress: true,
      email: true,
      telephone: true,
      natureOfBusiness: true,
      establishedAt: true,
      payrollBasis: true,
      status: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      decisions: {
        where: { recordTier: "HOT", action: "REOPEN", reason: { startsWith: "Employer corrected organizational details:" } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, reason: true, createdAt: true, actor: { select: { name: true } } },
      },
      organization: {
        select: {
          workspaceId: true,
          name: true,
          slug: true,
          organizationType: true,
          workspace: {
            select: {
              revenueWorkflowMode: true,
            },
          },
        },
      },
      areaOffice: {
        select: {
          name: true,
          slug: true,
        },
      },
      registrationApplication: {
        select: {
          id: true,
          status: true,
          registrationKind: true,
          claimedItfEmployerNumber: true,
          currentDesk: true,
          submittedAt: true,
          completedAt: true,
          decisions: {
            where: {
              recordTier: "HOT",
            },
            select: {
              id: true,
              action: true,
              reason: true,
              createdAt: true,
              actor: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          submittedBy: {
            select: {
              name: true,
            },
          },
          documents: {
            where: {
              kind: "CONTRIBUTION_RECEIPT",
              isActive: true,
              recordTier: "HOT",
            },
            select: {
              id: true,
              kind: true,
              documentName: true,
              fileName: true,
              receiptIssuer: true,
              receiptNumber: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          contributionAssessment: {
            select: {
              id: true,
              payrollBasis: true,
              turnoverBasis: true,
              recommendedAmount: true,
              assessmentNote: true,
              assessedAt: true,
              horicReviewNote: true,
              horicReviewedAt: true,
              amReleaseNote: true,
              releaseChannel: true,
              amReleasedAt: true,
              assessedBy: {
                select: {
                  name: true,
                },
              },
              horicReviewedBy: {
                select: {
                  name: true,
                },
              },
              amReleasedBy: {
                select: {
                  name: true,
                },
              },
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  amount: true,
                  status: true,
                  issuedAt: true,
                  generatedDocumentId: true,
                  generatedAt: true,
                  payments: {
                    where: {
                      provider: "REMITA",
                      recordTier: "HOT",
                    },
                    select: {
                      id: true,
                      providerReference: true,
                      status: true,
                      statusMessage: true,
                      paymentUrl: true,
                      lastCheckedAt: true,
                      confirmedAt: true,
                    },
                    orderBy: {
                      createdAt: "desc",
                    },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
      documents: {
        where: {
          kind: {
            notIn: ["CERTIFICATE", "CONTRIBUTION_INVOICE"],
          },
          isActive: true,
          recordTier: "HOT",
        },
        select: {
          id: true,
          kind: true,
          documentName: true,
          fileName: true,
          receiptIssuer: true,
          receiptNumber: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      complianceYears: {
        select: {
          id: true,
          year: true,
          status: true,
          contributionAmount: true,
          amountPaid: true,
          contributionPaidAt: true,
          certificate: {
            select: {
              id: true,
              certificateNumber: true,
              status: true,
              issuedAt: true,
              generatedDocumentId: true,
              generatedAt: true,
            },
          },
          decisions: {
            where: {
              recordTier: "HOT",
            },
            select: {
              id: true,
              action: true,
              reason: true,
              createdAt: true,
              actor: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          documents: {
            where: {
              kind: {
                not: "CERTIFICATE",
              },
              isActive: true,
              recordTier: "HOT",
            },
            select: {
              id: true,
              kind: true,
              documentName: true,
              fileName: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          year: "desc",
        },
      },
      trainingPlanSubmissions: {
        where: {
          recordTier: "HOT",
        },
        select: {
          id: true,
          year: true,
          status: true,
          currentDesk: true,
          dueDate: true,
          submittedAt: true,
          promptSubmissionScore: true,
          workItems: {
            where: { status: "OPEN", assignedRole: "REIMBURSEMENT_OFFICER", recordTier: "HOT" },
            select: { assignedUserId: true },
            take: 1,
          },
          personnel: {
            select: {
              id: true,
              name: true,
              position: true,
              email: true,
              phone: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          documents: {
            where: {
              isActive: true,
              recordTier: "HOT",
            },
            select: {
              id: true,
              kind: true,
              documentName: true,
              fileName: true,
              receiptIssuer: true,
              receiptNumber: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          decisions: {
            where: {
              recordTier: "HOT",
            },
            select: {
              id: true,
              action: true,
              reason: true,
              createdAt: true,
              actor: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          year: "desc",
        },
      },
      trainingRequests: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
      reimbursementClaims: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
    },
  });
}

export async function listAreaOffices() {
  return listCachedActiveAreaOffices();
}

export async function correctCompanyDetails(input: CorrectCompanyDetailsInput) {
  if (input.requesterRole !== "EMPLOYER_ADMIN") {
    throw new Error("Only an employer administrator can correct company details.");
  }
  const legalName = input.legalName.trim();
  if (legalName.length < 2 || legalName.length > 200) throw new Error("Company name must be 2 to 200 characters.");
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("Enter a valid company email address.");
  if (input.establishedAt && (Number.isNaN(input.establishedAt.getTime()) || input.establishedAt > new Date())) {
    throw new Error("Enter a valid establishment date.");
  }
  const fields = ["rcNumber", "taxId", "businessAddress", "postalAddress", "email", "telephone", "natureOfBusiness"] as const;
  for (const field of fields) {
    if (input[field] && input[field].length > 500) throw new Error(`${field} is too long.`);
  }

  const db = getDb();
  const [actor, company] = await Promise.all([
    db.user.findUnique({
      where: { email: input.requesterEmail.toLowerCase() },
      select: { id: true, memberships: { where: { isActive: true, role: "EMPLOYER_ADMIN" }, select: { organizationId: true } } },
    }),
    db.company.findFirst({
      where: { id: input.companyId, recordTier: "HOT", isActive: true },
      select: {
        organizationId: true, legalName: true, rcNumber: true, taxId: true, businessAddress: true,
        postalAddress: true, email: true, telephone: true, natureOfBusiness: true, establishedAt: true,
        registrationApplication: { select: { id: true, status: true, currentDesk: true, registrationKind: true, claimedItfEmployerNumber: true } },
        trainingPlanSubmissions: { where: { recordTier: "HOT", status: "CHANGES_REQUESTED", currentDesk: "COMPANY" }, select: { status: true, currentDesk: true } },
        complianceYears: { where: { recordTier: "HOT", status: "CHANGES_REQUESTED" }, select: { status: true } },
      },
    }),
  ]);
  if (!actor?.memberships.some((membership) => membership.organizationId === company?.organizationId)) {
    throw new Error("You do not have access to correct this company.");
  }
  if (!company || !isCompanyDetailCorrectionOpen({
    registration: company.registrationApplication,
    trainingPlans: company.trainingPlanSubmissions,
    complianceYears: company.complianceYears,
  })) throw new Error("There is no open company-details correction request.");

  const next = {
    legalName,
    rcNumber: input.rcNumber?.trim() || null,
    taxId: input.taxId?.trim() || null,
    businessAddress: input.businessAddress?.trim() || null,
    postalAddress: input.postalAddress?.trim() || null,
    email: input.email?.trim() || null,
    telephone: input.telephone?.trim() || null,
    natureOfBusiness: input.natureOfBusiness?.trim() || null,
    establishedAt: input.establishedAt ?? null,
  };
  const changed: string[] = (Object.keys(next) as Array<keyof typeof next>).filter((field) =>
    field === "establishedAt"
      ? next.establishedAt?.getTime() !== company.establishedAt?.getTime()
      : next[field] !== company[field]);
  const correctedItfNumber = input.claimedItfEmployerNumber?.trim() || null;
  if (correctedItfNumber && correctedItfNumber.length > 100) throw new Error("ITF registration number is too long.");
  const itfNumberChanged = company.registrationApplication?.registrationKind === "LEGACY_EMPLOYER" &&
    company.registrationApplication.status === "CHANGES_REQUESTED" &&
    correctedItfNumber !== company.registrationApplication.claimedItfEmployerNumber;
  if (itfNumberChanged && !correctedItfNumber) throw new Error("Enter the corrected ITF registration number.");
  if (itfNumberChanged && await db.company.findFirst({
    where: { id: { not: input.companyId }, itfEmployerNumber: correctedItfNumber },
    select: { id: true },
  })) throw new Error("This ITF registration number is already recorded for another company.");
  if (itfNumberChanged) changed.push("claimedItfEmployerNumber");
  if (changed.length === 0) throw new Error("Change at least one company detail before saving.");
  const describe = (value: string | Date | null | undefined) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : value ?? "(empty)";
  const changes = changed.map((field) => field === "claimedItfEmployerNumber"
    ? `${field}: ${describe(company.registrationApplication?.claimedItfEmployerNumber)} → ${describe(correctedItfNumber)}`
    : `${field}: ${describe(company[field as keyof typeof next])} → ${describe(next[field as keyof typeof next])}`);

  await db.$transaction([
    db.company.update({ where: { id: input.companyId }, data: next }),
    ...(itfNumberChanged && company.registrationApplication ? [db.registrationApplication.update({
      where: { id: company.registrationApplication.id }, data: { claimedItfEmployerNumber: correctedItfNumber },
    })] : []),
    db.decision.create({ data: {
      actorId: actor.id, companyId: input.companyId, action: "REOPEN",
      reason: `Employer corrected organizational details: ${changes.join("; ")}. Submitted forms and evidence were not changed.`,
    } }),
  ]);
}

export async function createCompany(input: CreateCompanyInput) {
  const db = getDb();
  if (input.requesterRole !== "EMPLOYER_ADMIN") {
    throw new Error("Only an employer administrator can create a company.");
  }
  const startedAt = performance.now();
  const activeOrganization = await getActiveEmployerOrganization(input.requesterEmail);
  const user = await db.user.findUnique({
    where: { email: input.requesterEmail.toLowerCase() },
    select: {
      isActive: true,
      memberships: {
        where: { role: "EMPLOYER_ADMIN", isActive: true },
        select: {
          id: true,
          workspaceId: true,
          organizationId: true,
          workspace: { select: { revenueWorkflowMode: true } },
        },
      },
    },
  });
  if (!user?.isActive) throw new Error("Your employer account is not ready for company registration.");
  const membership = resolveCompanyCreationMembership(activeOrganization, user.memberships);
  const reimbursementOnly = membership.workspace.revenueWorkflowMode === "EXTERNAL_VERIFICATION";
  const itfEmployerNumber = input.itfEmployerNumber?.trim();
  if (reimbursementOnly && !itfEmployerNumber) {
    throw new Error("An existing ITF registration number is required in Reimbursement mode.");
  }
  if (!reimbursementOnly && itfEmployerNumber) {
    throw new Error("ITF registration numbers are issued by the registration workflow in Integrated mode.");
  }

  const writeStartedAt = performance.now();
  const companyDetails = {
    areaOffice: { connect: { id: input.areaOfficeId } },
    legalName: input.legalName,
    itfEmployerNumber: reimbursementOnly ? itfEmployerNumber : undefined,
    rcNumber: input.rcNumber,
    taxId: input.taxId,
    businessAddress: input.businessAddress,
    postalAddress: input.postalAddress,
    email: input.email,
    telephone: input.telephone,
    natureOfBusiness: input.natureOfBusiness,
    establishedAt: input.establishedAt,
    status: reimbursementOnly ? "ACTIVE" as const : "DRAFT" as const,
  };

  let created: { id: string };
  if (activeOrganization.active) {
    created = await db.company.create({
      data: { ...companyDetails, organization: { connect: { id: activeOrganization.active.id } } },
      select: { id: true },
    });
  } else {
    // One nested write atomically creates the first company and links the
    // employer's existing membership, without holding an interactive
    // transaction open across multiple network round trips.
    const organization = await db.organization.create({
      data: {
        workspaceId: membership.workspaceId,
        name: input.legalName,
        slug: `${slugify(input.legalName) || "employer"}-${randomUUID().slice(0, 8)}`,
        organizationType: "EMPLOYER",
        memberships: { connect: { id: membership.id } },
        companies: { create: companyDetails },
      },
      select: { companies: { select: { id: true }, take: 1 } },
    });
    created = organization.companies[0];
  }
  console.info("registry.company_creation_timing", {
    contextMs: Math.round(writeStartedAt - startedAt),
    writeMs: Math.round(performance.now() - writeStartedAt),
    totalMs: Math.round(performance.now() - startedAt),
    firstCompany: !activeOrganization.active,
  });
  return created;
}
