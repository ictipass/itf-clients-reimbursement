"use client";

import { useState } from "react";

type RegistrationKind = "NEW_EMPLOYER" | "LEGACY_EMPLOYER";

export function RegistrationSubmissionFields({
  initialRegistrationKind,
  initialClaimedItfEmployerNumber,
}: Readonly<{
  initialRegistrationKind: RegistrationKind;
  initialClaimedItfEmployerNumber: string;
}>) {
  const [registrationKind, setRegistrationKind] =
    useState<RegistrationKind>(initialRegistrationKind);
  const isLegacyEmployer = registrationKind === "LEGACY_EMPLOYER";

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-2 text-sm font-medium text-zinc-700">
        Registration type
        <select
          name="registrationKind"
          value={registrationKind}
          required
          onChange={(event) => setRegistrationKind(event.target.value as RegistrationKind)}
          className="min-h-10 rounded-md border border-zinc-200 bg-white px-3"
        >
          <option value="NEW_EMPLOYER">New employer registration</option>
          <option value="LEGACY_EMPLOYER">Already registered with ITF</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-zinc-700">
        Existing ITF registration number
        <input
          name="claimedItfEmployerNumber"
          defaultValue={initialClaimedItfEmployerNumber}
          disabled={!isLegacyEmployer}
          required={isLegacyEmployer}
          aria-disabled={!isLegacyEmployer}
          className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
        />
      </label>
    </div>
  );
}
