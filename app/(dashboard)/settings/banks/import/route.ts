import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { importBankWorkbook } from "@/lib/bank-import";

export const maxDuration = 60;

function redirectWithMessage(message: string, error = false) {
  return new Response(null, { status: 303, headers: { Location: `/settings/banks?${error ? "error" : "message"}=${encodeURIComponent(message.slice(0, 250))}` } });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Authentication is required.", { status: 401 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Bank workbook is required.");
    const result = await importBankWorkbook({
      file,
      workspaceId: String(formData.get("workspaceId") ?? ""),
      requesterRole: session.user.role,
    });
    return redirectWithMessage(`${result.added} bank${result.added === 1 ? "" : "s"} added; ${result.updated} updated.`);
  } catch (error) {
    return redirectWithMessage(error instanceof Error ? error.message : "Bank import failed.", true);
  }
}
