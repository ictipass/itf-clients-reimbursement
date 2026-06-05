import { getVerificationUrl, renderQrSvg } from "@/lib/qr";
import { assertPublicVerificationRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const number = url.searchParams.get("number")?.trim();
  const clientIdentity =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "public-verification-qr";

  if (!number) {
    return new Response("number is required.", { status: 400 });
  }

  try {
    assertPublicVerificationRateLimit(`qr:${clientIdentity}`);

    const svg = await renderQrSvg(getVerificationUrl(number));

    return new Response(svg, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "image/svg+xml; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QR code generation failed.";

    return new Response(message, { status: 501 });
  }
}
