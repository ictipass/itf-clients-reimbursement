"use client";

import { useState } from "react";

type BankOption = { id: string; name: string; sortCode: string };

export function ClaimBankFields({ banks, currentBankName, currentSortCode, currentAccountNumber }: Readonly<{
  banks: BankOption[];
  currentBankName: string | null;
  currentSortCode: string | null;
  currentAccountNumber: string | null;
}>) {
  const matchingBank = banks.find((bank) => bank.name === currentBankName && bank.sortCode === currentSortCode);
  const [bankId, setBankId] = useState(matchingBank?.id ?? "");
  const selectedBank = banks.find((bank) => bank.id === bankId);

  return <>
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      Bank name
      <select name="bankId" value={bankId} onChange={(event) => setBankId(event.target.value)} className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm">
        <option value="">Select an accepted bank</option>
        {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
      </select>
      {banks.length === 0 ? <span className="text-xs text-amber-800">No accepted banks are configured. Ask the administrator to add one.</span> : null}
      {currentBankName && !matchingBank ? <span className="text-xs text-amber-800">Previously saved bank: {currentBankName}. Select an accepted bank to update it.</span> : null}
    </label>
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      Account number
      <input name="accountNumber" defaultValue={currentAccountNumber ?? ""} inputMode="numeric" autoComplete="off" placeholder="Account number" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
    </label>
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      Sort code (set by bank selection)
      <input value={selectedBank?.sortCode ?? ""} readOnly tabIndex={-1} className="min-h-10 rounded-md border border-zinc-200 bg-zinc-100 px-3 text-sm text-zinc-700" />
    </label>
  </>;
}
