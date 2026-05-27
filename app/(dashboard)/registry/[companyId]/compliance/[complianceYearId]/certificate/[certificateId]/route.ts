import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { downloadComplianceCertificate } from "@/lib/certificates";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string) {
  const fallbackName = fileName.replace(/[^A-Za-z0-9._-]/g, "_") || "compliance-certificate.pdf";
  const encodedName = encodeURIComponent(fileName);

  return `inline; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

export async function GET(
  _request: Request,
  context: RouteContext<
    "/registry/[companyId]/compliance/[complianceYearId]/certificate/[certificateId]"
  >,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Authentication is required.", { status: 401 });
  }

  const { companyId, complianceYearId, certificateId } = await context.params;

  try {
    const certificate = await downloadComplianceCertificate({
      companyId,
      complianceYearId,
      certificateId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
    });

    if (!certificate) {
      return new Response("Compliance certificate was not found.", { status: 404 });
    }

    return new Response(new Uint8Array(certificate.buffer), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(certificate.fileName),
        "Content-Length": String(certificate.fileSize),
        "Content-Security-Policy": "sandbox",
        "Content-Type": certificate.mimeType,
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compliance certificate view failed.";

    return new Response(message, { status: 403 });
  }
}
