"use client";

import { useFormStatus } from "react-dom";

export function RemoveDraftButton({ title }: { title: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title="Remove unsubmitted draft"
      aria-label={`Remove unsubmitted draft: ${title}`}
      onClick={(event) => {
        if (!window.confirm(`Remove the unsubmitted draft “${title}”? This will hide it from the request list.`)) {
          event.preventDefault();
        }
      }}
      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 4h4m-8 3 1 13h10l1-13M10 11v6m4-6v6" />
      </svg>
    </button>
  );
}
