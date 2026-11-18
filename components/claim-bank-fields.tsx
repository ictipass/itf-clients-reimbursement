"use client";

import { useRef, useState } from "react";

type BankOption = { id: string; name: string; sortCode: string; paystackCode: string | null };

export function ClaimBankFields({ banks, claimId, currentBankName, currentSortCode, currentAccountNumber, currentAccountName }: Readonly<{
  banks: BankOption[];
  claimId: string;
  currentBankName: string | null;
  currentSortCode: string | null;
  currentAccountNumber: string | null;
  currentAccountName: string | null;
}>) {
  const matchingBank = banks.find((bank) => bank.name === currentBankName && bank.sortCode === currentSortCode);
  const [bankId, setBankId] = useState(matchingBank?.id ?? "");
  const [accountNumber, setAccountNumber] = useState(currentAccountNumber ?? "");
  const [accountName, setAccountName] = useState(currentAccountName ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const verificationVersion = useRef(0);
  const selectedBank = banks.find((bank) => bank.id === bankId);

  async function verifyAccount() {
    if (!/^\d{10}$/.test(accountNumber)) { setError("Account number must contain exactly 10 digits."); return; }
    if (!selectedBank?.paystackCode) { setError("Select a bank with a configured Paystack code."); return; }
    setPending(true);
    setError("");
    setAccountName("");
    const version = ++verificationVersion.current;
    try {
      const response = await fetch(`/claims/${claimId}/resolve-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankId, accountNumber }),
      });
      const result = await response.json() as { accountName?: string; error?: string };
      if (!response.ok || !result.accountName) throw new Error(result.error ?? "Account could not be verified.");
      if (version === verificationVersion.current) setAccountName(result.accountName);
    } catch (failure) {
      if (version === verificationVersion.current) setError(failure instanceof Error ? failure.message : "Account could not be verified.");
    } finally { if (version === verificationVersion.current) setPending(false); }
  }

  return <>
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      Bank name
      <select name="bankId" required value={bankId} onChange={(event) => { verificationVersion.current += 1; setPending(false); setBankId(event.target.value); setAccountName(""); setError(""); }} className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm">
        <option value="">Select an accepted bank</option>
        {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
      </select>
      {banks.length === 0 ? <span className="text-xs text-amber-800">No accepted banks are configured. Ask the administrator to add one.</span> : null}
      {currentBankName && !matchingBank ? <span className="text-xs text-amber-800">Previously saved bank: {currentBankName}. Select an accepted bank to update it.</span> : null}
    </label>
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      Account number
      <input name="accountNumber" required value={accountNumber} onChange={(event) => { verificationVersion.current += 1; setPending(false); setAccountNumber(event.target.value); setAccountName(""); setError(""); }} inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} autoComplete="off" placeholder="10-digit account number" className="min-h-10 rounded-md border border-zinc-200 px-3 text-sm" />
    </label>
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      Sort code (set by bank selection)
      <input value={selectedBank?.sortCode ?? ""} readOnly tabIndex={-1} className="min-h-10 rounded-md border border-zinc-200 bg-zinc-100 px-3 text-sm text-zinc-700" />
    </label>
    <div className="grid gap-2 text-sm font-medium text-zinc-700">
      <span>Account name (from Paystack)</span>
      <div className="flex flex-wrap items-center gap-2"><span className="min-h-10 flex-1 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm">{accountName || "Not verified yet"}</span><button type="button" disabled={pending || !selectedBank?.paystackCode} onClick={verifyAccount} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm font-semibold disabled:opacity-50">{pending ? "Verifying…" : "Verify account"}</button></div>
      {selectedBank && !selectedBank.paystackCode ? <span className="text-xs text-amber-800">This bank needs a Paystack code from the administrator before account verification is available.</span> : null}
      {error ? <span role="alert" className="text-xs text-red-800">{error}</span> : null}
    </div>
  </>;
}
