"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { generateRegistrationCertificatePdf } from "@/lib/certificates";

export async function generateRegistrationCertificatePdfAction(
  companyId: string,
  certificateId: string,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Authentication is required.");
  }

  await generateRegistrationCertificatePdf({
    certificateId,
    requesterEmail: session.user.email,
    requesterRole: session.user.role,
  });

  revalidatePath(`/registry/${companyId}`);
  redirect(`/registry/${companyId}`);
}
