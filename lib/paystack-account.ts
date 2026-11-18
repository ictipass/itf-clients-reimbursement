export function validateNigerianAccountNumber(value: string) {
  if (!/^\d{10}$/.test(value)) throw new Error("Account number must contain exactly 10 digits.");
  return value;
}

export function hasVerifiedClaimBankAccount(value: {
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  accountVerifiedAt: Date | null;
}) {
  return Boolean(value.bankName && value.accountName && value.accountVerifiedAt && /^\d{10}$/.test(value.accountNumber ?? ""));
}

export async function resolvePaystackAccount(accountNumber: string, bankCode: string | null | undefined) {
  validateNigerianAccountNumber(accountNumber);
  if (!bankCode || !/^\d{3,12}$/.test(bankCode)) {
    throw new Error("This bank has no valid Paystack code. Ask an administrator to update the bank catalogue.");
  }
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Bank account verification is not configured. Please try again later.");
  const url = new URL("https://api.paystack.co/bank/resolve");
  url.searchParams.set("account_number", accountNumber);
  url.searchParams.set("bank_code", bankCode);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error("Bank account verification is temporarily unavailable. Please try again.");
  }
  if (!response.ok) {
    if (response.status === 400 || response.status === 404 || response.status === 422) {
      throw new Error("Bank and account number could not be resolved. Check both entries.");
    }
    throw new Error("Bank account verification is temporarily unavailable. Please try again.");
  }
  let result: unknown;
  try { result = await response.json(); }
  catch { throw new Error("Bank account verification returned an invalid response."); }
  if (!result || typeof result !== "object" || !("status" in result) || result.status !== true ||
      !("data" in result) || !result.data || typeof result.data !== "object") {
    throw new Error("Bank and account number could not be resolved. Check both entries.");
  }
  const data = result.data as Record<string, unknown>;
  if (data.account_number !== accountNumber || typeof data.account_name !== "string" || !data.account_name.trim()) {
    throw new Error("Bank account verification returned mismatched details. Please try again.");
  }
  return data.account_name.trim().slice(0, 200);
}
