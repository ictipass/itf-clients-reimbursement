"use client";

import { useFormStatus } from "react-dom";

/** Keeps server-action forms visibly responsive while their request is in flight. */
export function FormActionProgress() {
  const { pending } = useFormStatus();

  if (!pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg border border-[#800020]/20 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-lg"
    >
      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-[#800020] border-t-transparent" />
      Processing your request…
    </div>
  );
}
