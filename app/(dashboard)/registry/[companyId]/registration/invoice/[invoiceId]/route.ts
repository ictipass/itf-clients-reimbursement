import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { downloadContributionInvoice } from "@/lib/contribution-invoices";
import { assertCompanyUsesInAppRevenueWorkflow } from "@/lib/revenue-workflow";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string) {
  const fallbackName = fileName.replace(/[^A-Za-z0-9._-]/g, "_") || "contribution-invoice.pdf";
  const encodedName = encodeURIComponent(fileName);

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string; invoiceId: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Authentication is required.", { status: 401 });
  }

  const { companyId, invoiceId } = await context.params;

  try {
    await assertCompanyUsesInAppRevenueWorkflow(companyId);

    const invoice = await downloadContributionInvoice({
      companyId,
      invoiceId,
      requesterEmail: session.user.email,
      requesterRole: session.user.role,
    });

    if (!invoice) {
      return new Response("Contribution invoice was not found.", { status: 404 });
    }

    return new Response(new Uint8Array(invoice.buffer), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(invoice.fileName),
        "Content-Length": String(invoice.fileSize),
        "Content-Security-Policy": "sandbox",
        "Content-Type": invoice.mimeType,
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Contribution invoice download failed.";

    return new Response(message, { status: 403 });
  }
}
