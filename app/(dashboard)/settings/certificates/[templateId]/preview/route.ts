import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { previewCertificateTemplate } from "@/lib/certificates";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string) {
  const fallbackName = fileName.replace(/[^A-Za-z0-9._-]/g, "_") || "certificate-preview.pdf";
  const encodedName = encodeURIComponent(fileName);

  return `inline; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/settings/certificates/[templateId]/preview">,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Authentication is required.", { status: 401 });
  }

  const { templateId } = await context.params;

  try {
    const preview = await previewCertificateTemplate({
      templateId,
      requesterRole: session.user.role,
    });

    if (!preview) {
      return new Response("Certificate template preview was not found.", { status: 404 });
    }

    return new Response(new Uint8Array(preview.buffer), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(preview.fileName),
        "Content-Length": String(preview.fileSize),
        "Content-Security-Policy": "sandbox",
        "Content-Type": preview.mimeType,
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Certificate template preview failed.";

    if (message.includes("will be implemented")) {
      return new Response(message, { status: 501 });
    }

    return new Response(message, { status: 403 });
  }
}
