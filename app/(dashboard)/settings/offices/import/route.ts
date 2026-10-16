import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { importAreaOfficesWorkbook } from "@/lib/office-import";

function redirectWithMessage(message: string, error = false) {
  return new Response(null, { status: 303, headers: { Location: `/settings/offices?${error ? "error" : "message"}=${encodeURIComponent(message.slice(0, 180))}` } });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Authentication is required.", { status: 401 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Area Office workbook is required.");
    const count = await importAreaOfficesWorkbook({ file, requesterRole: session.user.role });
    return redirectWithMessage(`${count} Area Office${count === 1 ? "" : "s"} imported.`);
  } catch (error) {
    return redirectWithMessage(error instanceof Error ? error.message : "Area Office import failed.", true);
  }
}
