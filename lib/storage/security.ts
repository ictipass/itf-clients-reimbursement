import { createHash } from "node:crypto";
import path from "node:path";

const allowedTypes = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
} as const;

export const maxUploadBytes = 10 * 1024 * 1024;

export type AllowedMimeType = keyof typeof allowedTypes;

export function sanitizeFileName(fileName: string) {
  const parsed = path.parse(fileName);
  const baseName = parsed.name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const extension = parsed.ext.toLowerCase();

  return `${baseName || "document"}${extension}`;
}

export function checksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function validateUpload(buffer: Buffer, fileName: string, mimeType: string) {
  if (buffer.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }

  if (buffer.byteLength > maxUploadBytes) {
    throw new Error("Uploaded file exceeds the 10 MB limit.");
  }

  if (!isAllowedMimeType(mimeType)) {
    throw new Error("Only PDF, JPEG, and PNG files are allowed for this upload flow.");
  }

  const expectedExtension = allowedTypes[mimeType];
  const actualExtension = path.extname(fileName).toLowerCase();

  if (!extensionMatches(actualExtension, expectedExtension)) {
    throw new Error(`File extension must match the uploaded ${mimeType} document type.`);
  }

  if (!signatureMatches(buffer, mimeType)) {
    throw new Error("File content does not match the declared document type.");
  }

  return {
    extension: expectedExtension,
    mimeType,
  };
}

function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return Object.hasOwn(allowedTypes, mimeType);
}

function extensionMatches(actualExtension: string, expectedExtension: string) {
  if (expectedExtension === ".jpg") {
    return actualExtension === ".jpg" || actualExtension === ".jpeg";
  }

  return actualExtension === expectedExtension;
}

function signatureMatches(buffer: Buffer, mimeType: AllowedMimeType) {
  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  return (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}
