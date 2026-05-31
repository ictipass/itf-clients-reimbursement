import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { importDirectoryUsers } from "@/lib/user-directory";

export const dynamic = "force-dynamic";

function redirectToUsers(message: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/settings/users?message=${encodeURIComponent(message.slice(0, 180))}`,
    },
  });
}

function readRequiredFile(formData: FormData) {
  const value = formData.get("file");

  if (!(value instanceof File)) {
    throw new Error("User CSV file is required.");
  }

  return value;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Authentication is required.", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const result = await importDirectoryUsers({
      requesterRole: session.user.role,
      file: readRequiredFile(formData),
    });

    return redirectToUsers(`${result.imported} user${result.imported === 1 ? "" : "s"} imported.`);
  } catch (error) {
    return redirectToUsers(
      error instanceof Error ? error.message : "User CSV import failed.",
    );
  }
}
