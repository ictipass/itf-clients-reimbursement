export function requireReceiptMetadata(issuer: string | undefined, number: string | undefined) {
  const receiptIssuer = issuer?.trim().replace(/\s+/g, " ") ?? "";
  const receiptNumber = number?.trim().replace(/\s+/g, " ") ?? "";
  if (!receiptIssuer || receiptIssuer.length > 160) throw new Error("Receipt issuer is required and must be at most 160 characters.");
  if (!receiptNumber || receiptNumber.length > 100) throw new Error("Receipt number is required and must be at most 100 characters.");
  return { receiptIssuer, receiptNumber };
}
