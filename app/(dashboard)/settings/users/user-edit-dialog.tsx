"use client";

import { FormActionProgress } from "@/components/form-action-progress";
import { useRef } from "react";

import { updateDirectoryUserAction } from "@/app/(dashboard)/settings/users/actions";

type EditableUser = {
  id: string;
  name: string;
  staffNumber: string | null;
  email: string;
  phoneNumber: string | null;
  department: string | null;
  jobTitle: string | null;
};

export function UserEditDialog({ user, departments, jobTitles }: Readonly<{ user: EditableUser; departments: string[]; jobTitles: string[] }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label={`Edit ${user.name}`}
        title="Edit user"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition hover:border-[#800020]/40 hover:text-[#800020]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        className="w-[min(720px,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/40"
      >
        <div className="border-b border-zinc-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020]">
                User directory
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Edit user</h2>
            </div>
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                x
              </span>
            </button>
          </div>
        </div>

        <form action={updateDirectoryUserAction} className="grid gap-4 p-5">
          <input type="hidden" name="userId" value={user.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Full name
              <input
                name="name"
                required
                defaultValue={user.name}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Staff number
              <input
                name="staffNumber"
                defaultValue={user.staffNumber ?? ""}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Email address
              <input
                name="email"
                type="email"
                required
                defaultValue={user.email}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Phone number
              <input
                name="phoneNumber"
                defaultValue={user.phoneNumber ?? ""}
                className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Department
              <select name="department" defaultValue={user.department ?? ""} className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"><option value="">Not set</option>{user.department && !departments.includes(user.department) && <option value={user.department}>{user.department} (inactive)</option>}{departments.map((name) => <option key={name} value={name}>{name}</option>)}</select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Job title
              <select name="jobTitle" defaultValue={user.jobTitle ?? ""} className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"><option value="">Not set</option>{user.jobTitle && !jobTitles.includes(user.jobTitle) && <option value={user.jobTitle}>{user.jobTitle} (inactive)</option>}{jobTitles.map((name) => <option key={name} value={name}>{name}</option>)}</select>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="min-h-10 rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800"
            >
              Cancel
            </button>
            <button className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white">
              Save changes
            </button>
          </div>
          <FormActionProgress />
        </form>
      </dialog>
    </>
  );
}
