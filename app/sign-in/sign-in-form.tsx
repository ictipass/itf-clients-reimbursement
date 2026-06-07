"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

type SignInFormProps = {
  callbackUrl: string;
  initialError?: string;
  oauthProviders: { id: string; name: string }[];
};

function safeCallbackUrl(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function SignInForm({ callbackUrl, initialError, oauthProviders }: SignInFormProps) {
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

    setError(
      result?.error?.toLowerCase().includes("too many requests")
        ? "Too many sign-in attempts. Please wait a few minutes before trying again."
        : "The email or password was not accepted.",
    );
  }

  return (
    <div className="mt-6 grid gap-4">
      {oauthProviders.length > 0 ? (
        <div className="grid gap-2">
          {oauthProviders.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => signIn(provider.id, { callbackUrl: safeCallbackUrl(callbackUrl) })}
              className="min-h-11 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800"
            >
              Continue with {provider.name}
            </button>
          ))}
          <p className="text-center text-xs text-zinc-500">or use development credentials</p>
        </div>
      ) : null}
      <form action={handleSubmit} className="grid gap-4">
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
    </div>
  );
}
