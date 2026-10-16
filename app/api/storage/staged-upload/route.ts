import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createStagedUpload } from "@/lib/storage/staged-upload";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const limit = await checkRateLimit({ key: `staged-upload:${session.user.id}`, limit: 30, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return Response.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
  try {
    const body = await request.json();
    const result = await createStagedUpload({ userId: session.user.id, name: body.name, type: body.type, size: body.size });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload could not start." }, { status: 400 });
  }
}
