import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { readUploadedFile } from "../lib/storage/staged-upload";

function reference(overrides: Record<string, unknown> = {}) {
  const ticket = {
    key: "temporary-uploads/user-1/unique-file.pdf",
    name: "file.pdf", type: "application/pdf", size: 10,
    userId: "user-1", provider: "s3", expires: Date.now() + 60_000,
    ...overrides,
  };
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  const signature = createHmac("sha256", "test-secret").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

test("staged upload references reject tampering and another session", async () => {
  const priorSecret = process.env.NEXTAUTH_SECRET;
  const priorProvider = process.env.STORAGE_PROVIDER;
  process.env.NEXTAUTH_SECRET = "test-secret";
  process.env.STORAGE_PROVIDER = "s3";
  try {
    const data = new FormData();
    data.set("fileUploadRef", `${reference()}x`);
    await assert.rejects(readUploadedFile(data, "file", "user-1"), /Invalid upload reference/);
    data.set("fileUploadRef", reference());
    await assert.rejects(readUploadedFile(data, "file", "user-2"), /does not belong/);
    data.set("fileUploadRef", reference({ expires: Date.now() - 1000 }));
    await assert.rejects(readUploadedFile(data, "file", "user-1"), /expired/);
    data.set("fileUploadRef", reference({ size: 11 * 1024 * 1024 }));
    await assert.rejects(readUploadedFile(data, "file", "user-1"), /expired/);
  } finally {
    if (priorSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = priorSecret;
    if (priorProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = priorProvider;
  }
});
