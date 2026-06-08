import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getAppBaseUrl, sendOfficerWelcomeEmail } from "@/lib/email";
import { writeDevelopmentOfficerCredentials } from "@/lib/officer-provisioning";
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
    for (const user of result.provisioned) {
      await writeDevelopmentOfficerCredentials({
        email: user.email,
        temporaryPassword: user.temporaryPassword,
        signInUrl: `${getAppBaseUrl()}/sign-in`,
      });
      const delivery = await sendOfficerWelcomeEmail({
        to: user.email,
        name: user.name,
        temporaryPassword: user.temporaryPassword,
      });
      if (delivery.delivered) {
        await getDb().user.update({
          where: { id: user.id },
          data: { welcomeEmailSentAt: new Date() },
        });
      }
    }

    return redirectToUsers(
      `${result.imported} user${result.imported === 1 ? "" : "s"} imported and provisioned.`,
    );
  } catch (error) {
    return redirectToUsers(
      error instanceof Error ? error.message : "User CSV import failed.",
    );
  }
}
