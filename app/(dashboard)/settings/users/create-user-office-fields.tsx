"use client";

import { useState } from "react";

type Office = { id: string; name: string; code: string | null };

export function CreateUserOfficeFields({
  headquartersAvailable,
  areaOffices,
  headquartersRoles,
  areaOfficeRoles,
}: Readonly<{
  headquartersAvailable: boolean;
  areaOffices: Office[];
  headquartersRoles: readonly string[];
  areaOfficeRoles: readonly string[];
}>) {
  const [office, setOffice] = useState("");
  const isHeadquarters = office === "HEADQUARTERS";
  const roles = office ? (isHeadquarters ? headquartersRoles : areaOfficeRoles) : [];

  return <>
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      Office
      <select name="office" required value={office} onChange={(event) => setOffice(event.target.value)} className="min-h-10 rounded-md border border-zinc-200 bg-white px-3">
        <option value="">Select office</option>
        {headquartersAvailable ? <option value="HEADQUARTERS">Headquarters</option> : null}
        {areaOffices.map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}</option>)}
      </select>
    </label>
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      Workflow role
      <select key={office} name="role" required disabled={!office} defaultValue="" className="min-h-10 rounded-md border border-zinc-200 bg-white px-3">
        <option value="">Select role</option>
        {roles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  </>;
}
