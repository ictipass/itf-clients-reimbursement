import { getDb } from "@/lib/db";

export type CreateCompanyInput = {
  organizationId: string;
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

export async function listEmployerCompanies() {
  const db = getDb();

  return db.company.findMany({
    where: {
      recordTier: "HOT",
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
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
  });
}

export async function getEmployerCompany(companyId: string) {
  const db = getDb();

  return db.company.findFirst({
    where: {
      id: companyId,
      recordTier: "HOT",
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
            },
          },
        },
      },
      registrationCertificates: {
        where: {
          recordTier: "HOT",
        },
        select: {
          id: true,
          certificateNumber: true,
          itfEmployerNumber: true,
          status: true,
          issuedAt: true,
          expiresAt: true,
          generatedDocumentId: true,
          generatedAt: true,
          template: {
            select: {
              name: true,
              version: true,
              status: true,
              designDocumentId: true,
              placementMetadata: true,
            },
          },
          issuedBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          issuedAt: "desc",
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
          amountPaid: true,
          contributionPaidAt: true,
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
              isActive: true,
              recordTier: "HOT",
            },
            select: {
              id: true,
              kind: true,
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
    },
  });
}

export async function listEmployerOrganizations() {
  const db = getDb();

  return db.organization.findMany({
    where: {
      organizationType: "EMPLOYER",
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

export async function listAreaOffices() {
  const db = getDb();

  return db.areaOffice.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

export async function createCompany(input: CreateCompanyInput) {
  const db = getDb();

  return db.company.create({
    data: {
      organizationId: input.organizationId,
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
}
