import { verifyEmployerEmail } from "@/lib/employer-accounts";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const requestedNext = new URL(request.url).searchParams.get("next");
  const next = requestedNext?.startsWith("/") ? requestedNext : "/dashboard";

  try {
    if (!token) throw new Error("Verification token is required.");
    await verifyEmployerEmail(token);
    return new Response(null, {
      status: 303,
      headers: { Location: `/verify-email?verified=true&next=${encodeURIComponent(next)}` },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email verification failed.";
    return new Response(null, {
      status: 303,
      headers: { Location: `/verify-email?error=${encodeURIComponent(message)}` },
    });
  }
}
