"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

type SignInFormProps = {
  callbackUrl: string;
  initialError?: string;
};

function safeCallbackUrl(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function SignInForm({ callbackUrl, initialError }: SignInFormProps) {
  const [error, setError] = useState<string | null>(
    initialError ? "Sign in could not be completed. Please try again." : null,
  );
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);

    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      callbackUrl: safeCallbackUrl(callbackUrl),
      redirect: false,
    });

    setIsPending(false);

    if (result?.ok && result.url) {
      window.location.href = result.url;
      return;
    }

    setError("The email or password was not accepted.");
  }

  return (
    <form action={handleSubmit} className="mt-6 grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          defaultValue="admin@itf.local"
          required
          disabled={isPending}
          className="min-h-11 rounded-md border border-zinc-300 px-3"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          placeholder="ChangeMe123!"
          required
          disabled={isPending}
          className="min-h-11 rounded-md border border-zinc-300 px-3"
        />
      </label>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <button
        disabled={isPending}
        className="min-h-11 rounded-md bg-[#800020] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}
