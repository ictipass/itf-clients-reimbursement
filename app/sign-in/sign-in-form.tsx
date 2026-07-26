"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    const result = await signIn("credentials", {
      email: typeof email === "string" ? email : "",
      password: typeof password === "string" ? password : "",
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
              className="inline-flex min-h-11 items-center justify-center gap-3 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800"
            >
              {provider.id === "google" ? (
                <Image src="/google-g.svg" alt="" width={18} height={18} aria-hidden="true" />
              ) : null}
              Sign in with {provider.name}
            </button>
          ))}
          <p className="text-center text-xs text-zinc-500">or sign in with portal credentials</p>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
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
