import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { readUploadedFile } from "@/lib/storage/staged-upload";
import { getDb } from "@/lib/db";
import { assertEmailDeliveryReady, getAppBaseUrl, sendOfficerWelcomeEmail } from "@/lib/email";
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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Authentication is required.", { status: 401 });
  }

  try {
    assertEmailDeliveryReady();
    const formData = await request.formData();
    const result = await importDirectoryUsers({
      requesterRole: session.user.role,
      file: await readUploadedFile(formData, "file", session.user.id),
    });
    let delivered = 0;
    let failed = 0;
    for (const user of result.provisioned) {
      try {
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
          delivered += 1;
        }
      } catch (error) {
        failed += 1;
        console.error("Welcome email delivery failed after user import", {
          userId: user.id,
          error: error instanceof Error ? error.message : "Unknown delivery failure",
        });
      }
    }

    return redirectToUsers(
      failed > 0
        ? `${result.imported} users imported; ${delivered} welcome emails sent, ${failed} failed. Do not re-import. Fix email settings, then reset local access for affected users to send new credentials.`
        : `${result.imported} user${result.imported === 1 ? "" : "s"} imported and provisioned.${delivered ? ` ${delivered} welcome emails sent.` : ""}`,
    );
  } catch (error) {
    return redirectToUsers(
      error instanceof Error ? error.message : "User import failed.",
    );
  }
}
