"use client";

import { useState } from "react";

type EvidenceOption = {
  label: string;
  value: string;
};

export function EvidenceTypeField({
  options,
  defaultValue = "",
}: Readonly<{
  options: EvidenceOption[];
  defaultValue?: string;
}>) {
  const [kind, setKind] = useState(defaultValue);
  const requiresDocumentName = kind === "OTHER_SUPPORTING_EVIDENCE";

  return (
    <>
      <label className="grid gap-2 text-sm font-medium">
        Evidence type
        <select
          name="kind"
          required
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
        >
          <option value="">Select evidence type</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {requiresDocumentName ? (
        <label className="grid gap-2 text-sm font-medium">
          Document name
          <input
            name="documentName"
            type="text"
            required
            maxLength={120}
            placeholder="For example, Board resolution"
            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3"
          />
          <span className="text-xs font-normal leading-5 text-zinc-500">
            Describe this supporting document so reviewers can identify it easily.
          </span>
        </label>
      ) : null}
    </>
  );
}
