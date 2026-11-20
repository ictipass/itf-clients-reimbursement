"use client";

import { useFormStatus } from "react-dom";

export function CreateCompanySubmitButton() {
  const { pending } = useFormStatus();

  return <button
    type="submit"
    disabled={pending}
    aria-disabled={pending}
    className="min-h-11 rounded-md bg-[#800020] px-5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
  >
    {pending ? "Creating company…" : "Create company"}
  </button>;
}
