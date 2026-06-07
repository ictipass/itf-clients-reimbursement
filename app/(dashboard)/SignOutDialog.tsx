"use client";

import { signOut } from "next-auth/react";
import { useRef, useState } from "react";

export function SignOutDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function confirmSignOut() {
    setIsSigningOut(true);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="mt-2 inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800"
      >
        Sign out
      </button>

      <dialog
        ref={dialogRef}
        className="w-[min(420px,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/40"
      >
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">Sign out?</h2>
        </div>
        <div className="p-5">
          <p className="text-sm leading-6 text-zinc-600">
            You will need to sign in again before accessing your organization and workflow tasks.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={isSigningOut}
              onClick={() => dialogRef.current?.close()}
              className="min-h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSigningOut}
              onClick={confirmSignOut}
              className="min-h-10 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
