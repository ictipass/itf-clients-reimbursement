import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { downloadSignatureAsset } from "@/lib/signatures";

export const dynamic = "force-dynamic";

function contentDisposition(fileName: string) {
  const fallbackName = fileName.replace(/[^A-Za-z0-9._-]/g, "_") || "signature";
  const encodedName = encodeURIComponent(fileName);

  return `inline; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/settings/signatures/[signatureAssetId]/image">,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Authentication is required.", { status: 401 });
  }

  const { signatureAssetId } = await context.params;

  try {
    const signatureAsset = await downloadSignatureAsset({
      signatureAssetId,
      requesterRole: session.user.role,
    });

    if (!signatureAsset) {
      return new Response("Signature asset was not found.", { status: 404 });
    }

    return new Response(new Uint8Array(signatureAsset.buffer), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(signatureAsset.fileName),
        "Content-Length": String(signatureAsset.fileSize),
        "Content-Security-Policy": "sandbox",
        "Content-Type": signatureAsset.mimeType,
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signature image view failed.";

    if (message.includes("will be implemented")) {
      return new Response(message, { status: 501 });
    }

    return new Response(message, { status: 403 });
  }
}
