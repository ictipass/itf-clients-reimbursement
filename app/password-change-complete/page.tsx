"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef } from "react";

export default function PasswordChangeCompletePage() {
  const isSigningOut = useRef(false);

  useEffect(() => {
    if (isSigningOut.current) {
      return;
    }

    isSigningOut.current = true;
    void signOut({
      callbackUrl:
        "/sign-in?message=Password%20changed.%20Sign%20in%20again%20with%20your%20new%20password.",
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 text-zinc-950">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Password changed</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Securing your updated account and returning you to sign in.
        </p>
      </section>
    </main>
  );
}
