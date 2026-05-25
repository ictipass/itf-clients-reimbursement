import type { getDb } from "@/lib/db";

type CertificateTemplateReader = Pick<ReturnType<typeof getDb>, "certificateTemplate">;

export async function findActiveCertificateTemplate(
  db: CertificateTemplateReader,
  workspaceId: string,
  issuedAt = new Date(),
) {
  const datedTemplate = await db.certificateTemplate.findFirst({
    where: {
      workspaceId,
      status: "ACTIVE",
      recordTier: "HOT",
      effectiveFrom: {
        lte: issuedAt,
      },
    },
    select: {
      id: true,
      name: true,
      version: true,
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  if (datedTemplate) {
    return datedTemplate;
  }

  return db.certificateTemplate.findFirst({
    where: {
      workspaceId,
      status: "ACTIVE",
      recordTier: "HOT",
      effectiveFrom: null,
    },
    select: {
      id: true,
      name: true,
      version: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
