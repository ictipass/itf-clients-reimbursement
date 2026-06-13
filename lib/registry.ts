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

export async function listEmployerCompanies(input: RegistryRequester & EmployerRegistryFilters) {
  const db = getDb();
  const organizationIds = isItfRole(input.requesterRole)
    ? null
    : await getEmployerOrganizationIds(input.requesterEmail);
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const where = {
    recordTier: "HOT" as const,
    ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
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
  const organizationIds = isItfRole(input.requesterRole)
    ? null
    : await getEmployerOrganizationIds(input.requesterEmail);

  return db.company.findFirst({
    where: {
      id: companyId,
      recordTier: "HOT",
      ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
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
        rcNumber: input.rcNumber,
        taxId: input.taxId,
        businessAddress: input.businessAddress,
        postalAddress: input.postalAddress,
        email: input.email,
        telephone: input.telephone,
        natureOfBusiness: input.natureOfBusiness,
        establishedAt: input.establishedAt,
        status: "DRAFT",
      },
      select: {
        id: true,
      },
    });
  });
}
