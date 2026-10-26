import { FormActionProgress } from "@/components/form-action-progress";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { acceptOrganizationInvitationAction } from "@/app/invitations/accept/actions";
import { authOptions } from "@/lib/auth";
import { getOrganizationInvitation } from "@/lib/employer-members";

export default async function AcceptInvitationPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ token?: string; error?: string }> }>) {
  const { token, error } = await searchParams;
  const session = await getServerSession(authOptions);
  const invitation = token ? await getOrganizationInvitation(token) : null;
  const usable = invitation && !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > new Date();
  const callbackUrl = encodeURIComponent(`/invitations/accept?token=${token ?? ""}`);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-10">
      <section className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#800020]">Organization invitation</p>
        <h1 className="mt-3 text-2xl font-semibold">
          {usable ? `Join ${invitation.organization.name}` : "Invitation unavailable"}
        </h1>
        {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        {usable ? (
          <>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              This invitation grants {invitation.role.replaceAll("_", " ")} access to {invitation.email}.
            </p>
            {session?.user?.email ? (
              <form action={acceptOrganizationInvitationAction} className="mt-5">
                <input type="hidden" name="token" value={token} />
                <button className="min-h-11 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                  Accept invitation
                </button>
                <FormActionProgress />
              </form>
            ) : (
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/sign-in?callbackUrl=${callbackUrl}`} className="inline-flex min-h-11 items-center rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
                  Sign in to accept
                </Link>
                <Link href={`/get-started?invitationToken=${encodeURIComponent(token ?? "")}`} className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 px-4 text-sm font-semibold">
                  Create portal account
                </Link>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-zinc-600">This invitation is invalid, expired, already accepted, or revoked.</p>
        )}
        <Link href="/" className="mt-6 block text-sm font-semibold text-[#800020]">Back to home</Link>
      </section>
    </main>
  );
}
