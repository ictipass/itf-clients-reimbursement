"use client";

import { FormActionProgress } from "@/components/form-action-progress";
export function EvidenceDeleteButton({
  action,
}: Readonly<{
  action: () => Promise<void>;
}>) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this evidence? This action removes it from the active evidence list.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <button className="inline-flex min-h-8 items-center rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700">
        Delete
      </button>
      <FormActionProgress />
    </form>
  );
}
