"use client";

import { useFormStatus } from "react-dom";

export function CreateForm4AButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Opening Form 4A…" : "Create Form 4A"}
    </button>
  );
}
