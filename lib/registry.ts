import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db";
import { getActiveEmployerOrganization } from "@/lib/organization-context";
import { listCachedActiveAreaOffices } from "@/lib/reference-data";
import { isItfRole, type Role } from "@/lib/rbac";

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
    },
  });
}

export async function listAreaOffices() {
  return listCachedActiveAreaOffices();
}

export async function createCompany(input: CreateCompanyInput) {
  const db = getDb();

  if (input.requesterRole !== "EMPLOYER_ADMIN") {
    throw new Error("Only an employer administrator can create a company.");
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: input.requesterEmail.toLowerCase() },
      select: {
        id: true,
        memberships: {
          where: { role: "EMPLOYER_ADMIN", isActive: true },
          select: { id: true, workspaceId: true, organizationId: true },
        },
      },
    });

    if (!user?.memberships[0]) {
      throw new Error("Your employer account is not ready for company registration.");
    }

    const workspace = await tx.workspace.findUnique({
      where: { id: user.memberships[0].workspaceId },
      select: { revenueWorkflowMode: true },
    });
    const reimbursementOnly = workspace?.revenueWorkflowMode === "EXTERNAL_VERIFICATION";
    const itfEmployerNumber = input.itfEmployerNumber?.trim();
    if (reimbursementOnly && !itfEmployerNumber) {
      throw new Error("An existing ITF registration number is required in Reimbursement mode.");
    }
    if (!reimbursementOnly && itfEmployerNumber) {
      throw new Error("ITF registration numbers are issued by the registration workflow in Integrated mode.");
    }

    const activeOrganization = await getActiveEmployerOrganization(input.requesterEmail);
    if (activeOrganization.requiresSelection) {
      throw new Error("Select an active organization before creating another company.");
    }

    let organizationId = activeOrganization.active?.id;

    if (!organizationId) {
      const workspaceId = user.memberships[0].workspaceId;
      const baseSlug = slugify(input.legalName) || "employer";
      const organization = await tx.organization.create({
        data: {
          workspaceId,
          name: input.legalName,
          slug: `${baseSlug}-${randomUUID().slice(0, 8)}`,
          organizationType: "EMPLOYER",
        },
        select: { id: true },
      });
      organizationId = organization.id;

      await tx.membership.update({
        where: { id: user.memberships[0].id },
        data: { organizationId },
      });
    }

    return tx.company.create({
      data: {
        organizationId,
        areaOfficeId: input.areaOfficeId,
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
        status: reimbursementOnly ? "ACTIVE" : "DRAFT",
      },
      select: {
        id: true,
      },
    });
  });
}
