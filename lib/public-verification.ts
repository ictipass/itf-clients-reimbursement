import { getDb } from "@/lib/db";

export type PublicVerificationResult =
  | {
      found: true;
      companyName: string;
      itfEmployerNumber: string;
      certificateNumber: string;
      certificateStatus: string;
      issuedAt: Date;
      expiresAt: Date | null;
      verifiedAt: Date;
    }
  | {
      found: false;
      query: string;
      verifiedAt: Date;
    };

export async function verifyPublicCertificateNumber(query: string): Promise<PublicVerificationResult> {
  const number = query.trim();
  const verifiedAt = new Date();

  if (!number) {
    return {
      found: false,
      query: number,
      verifiedAt,
    };
  }

  const db = getDb();
  const certificate = await db.complianceCertificate.findFirst({
    where: {
      recordTier: "HOT",
      status: "ACTIVE",
      revokedAt: null,
      OR: [
        {
          certificateNumber: number,
        },
        {
          itfEmployerNumber: number,
        },
      ],
      company: {
        recordTier: "HOT",
        isActive: true,
        status: "ACTIVE",
      },
    },
    select: {
      certificateNumber: true,
      itfEmployerNumber: true,
      status: true,
      issuedAt: true,
      expiresAt: true,
      company: {
        select: {
          legalName: true,
        },
      },
    },
    orderBy: {
      issuedAt: "desc",
    },
  });

  if (!certificate) {
    return {
      found: false,
      query: number,
      verifiedAt,
    };
  }

  return {
    found: true,
    companyName: certificate.company.legalName,
    itfEmployerNumber: certificate.itfEmployerNumber,
    certificateNumber: certificate.certificateNumber,
    certificateStatus: certificate.status,
    issuedAt: certificate.issuedAt,
    expiresAt: certificate.expiresAt,
    verifiedAt,
  };
}
