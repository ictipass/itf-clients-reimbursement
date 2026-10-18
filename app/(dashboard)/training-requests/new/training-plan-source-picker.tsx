"use client";

import { useState } from "react";

type Company = { id: string; legalName: string; areaOffice: { name: string } | null };
type PlanRow = {
  id: string;
  trainingTitle: string;
  staffName: string;
  trainingPlanSubmission: { companyId: string; year: number };
};

export function TrainingPlanSourcePicker({ companies, planRows }: {
  companies: Company[];
  planRows: PlanRow[];
}) {
  const [companyId, setCompanyId] = useState("");
  const companyRows = planRows.filter((row) => row.trainingPlanSubmission.companyId === companyId);

  return <>
    <label className="grid gap-2 text-sm font-medium md:col-span-2">
      Company
      <select name="companyId" required value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="min-h-11 rounded-md border border-zinc-300 px-3">
        <option value="">Select company</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>{company.legalName} · {company.areaOffice?.name ?? "No Area Office"}</option>
        ))}
      </select>
    </label>
    <label className="grid gap-2 text-sm font-medium md:col-span-2">
      Approved Training Plan source (optional)
      <select key={companyId} name="trainingPlanLineItemId" disabled={!companyId} className="min-h-11 rounded-md border border-zinc-300 px-3">
        <option value="">Not linked to an approved Training Plan row</option>
        {companyRows.map((row) => (
          <option key={row.id} value={row.id}>{row.trainingPlanSubmission.year} · {row.trainingTitle} · {row.staffName}</option>
        ))}
      </select>
      <span className="text-xs font-normal text-zinc-600">Only approved rows for the selected company are shown.</span>
    </label>
  </>;
}
