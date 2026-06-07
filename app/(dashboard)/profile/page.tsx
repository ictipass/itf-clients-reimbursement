import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { changePasswordAction, updateProfileAction } from "@/app/(dashboard)/profile/actions";
import { authOptions } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";

export default async function ProfilePage({ searchParams }: Readonly<{ searchParams: Promise<{ message?: string }> }>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/sign-in");
  const [profile, query] = await Promise.all([getUserProfile(session.user.email), searchParams]);
  if (!profile) redirect("/sign-in");
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:px-8">
      <section><p className="text-sm font-semibold uppercase text-[#800020]">Account</p><h1 className="mt-2 text-3xl font-semibold">Profile and security</h1></section>
      {query.message ? <p className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm">{query.message}</p> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <form action={updateProfileAction} className="grid content-start gap-4 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold">Profile</h2>
          <label className="grid gap-2 text-sm font-medium">Full name<input name="name" defaultValue={profile.name} required className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
          <label className="grid gap-2 text-sm font-medium">Email<input value={profile.email} readOnly className="min-h-11 rounded-md border border-zinc-300 bg-zinc-100 px-3" /></label>
          <label className="grid gap-2 text-sm font-medium">Phone number<input name="phoneNumber" defaultValue={profile.phoneNumber ?? ""} className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
          <label className="flex items-center gap-3 text-sm font-medium"><input name="workflowEmailNotifications" type="checkbox" defaultChecked={profile.workflowEmailNotifications} /> Email me when workflow items reach my desk</label>
          <button className="min-h-11 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Update profile</button>
        </form>
        <form action={changePasswordAction} className="grid content-start gap-4 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-xl font-semibold">Change password</h2>
          {profile.passwordHash ? <>
            <label className="grid gap-2 text-sm font-medium">Current password<input name="currentPassword" type="password" required className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
            <label className="grid gap-2 text-sm font-medium">New password<input name="newPassword" type="password" minLength={12} required className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
            <label className="grid gap-2 text-sm font-medium">Confirm new password<input name="confirmPassword" type="password" minLength={12} required className="min-h-11 rounded-md border border-zinc-300 px-3" /></label>
            <button className="min-h-11 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">Change password</button>
          </> : <p className="text-sm text-zinc-600">This account uses Workspace identity. Password changes are managed by the identity provider.</p>}
        </form>
      </div>
    </div>
  );
}
