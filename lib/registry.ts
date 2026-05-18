import { getDb } from "@/lib/db";

export type CreateCompanyInput = {
  organizationId: string;
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

export async function createCompany(input: CreateCompanyInput) {
  const db = getDb();

  return db.company.create({
    data: {
      organizationId: input.organizationId,
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
