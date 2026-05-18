import { getDb } from "@/lib/db";

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
