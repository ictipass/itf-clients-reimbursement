import assert from "node:assert/strict";
import test from "node:test";

import { requireReceiptMetadata } from "../lib/receipt-metadata";
import { hasVerifiedClaimBankAccount, resolvePaystackAccount, validateNigerianAccountNumber } from "../lib/paystack-account";

test("receipt issuer and number are required", () => {
  assert.deepEqual(requireReceiptMetadata("  ITF  office  ", "  RC-10 "), { receiptIssuer: "ITF office", receiptNumber: "RC-10" });
  assert.throws(() => requireReceiptMetadata("", "RC-10"), /Receipt issuer/);
  assert.throws(() => requireReceiptMetadata("ITF", ""), /Receipt number/);
});

test("Nigerian account number is exactly ten digits", () => {
  assert.equal(validateNigerianAccountNumber("0012345678"), "0012345678");
  assert.throws(() => validateNigerianAccountNumber("123456789"), /exactly 10 digits/);
  assert.throws(() => validateNigerianAccountNumber("12345A7890"), /exactly 10 digits/);
});

test("claim submission requires a saved verified account", () => {
  const valid = { bankName: "Example Bank", accountNumber: "0012345678", accountName: "ADA OKAFOR", accountVerifiedAt: new Date() };
  assert.equal(hasVerifiedClaimBankAccount(valid), true);
  assert.equal(hasVerifiedClaimBankAccount({ ...valid, accountVerifiedAt: null }), false);
  assert.equal(hasVerifiedClaimBankAccount({ ...valid, accountNumber: "123" }), false);
  assert.equal(hasVerifiedClaimBankAccount({ ...valid, accountName: null }), false);
});

test("Paystack response must match the requested account", async () => {
  const oldSecret = process.env.PAYSTACK_SECRET_KEY;
  const oldFetch = global.fetch;
  process.env.PAYSTACK_SECRET_KEY = "test_secret";
  global.fetch = async () => Response.json({ status: true, data: { account_number: "0012345678", account_name: "ADA OKAFOR" } });
  try {
    assert.equal(await resolvePaystackAccount("0012345678", "001"), "ADA OKAFOR");
    await assert.rejects(resolvePaystackAccount("1234567890", "001"), /mismatched/);
  } finally {
    global.fetch = oldFetch;
    if (oldSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = oldSecret;
  }
});
