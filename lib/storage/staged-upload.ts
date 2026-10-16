import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { del, get } from "@vercel/blob";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getStorageProvider } from "@/lib/storage";
import { maxUploadBytes, sanitizeFileName } from "@/lib/storage/security";

const prefix = "temporary-uploads/";
const ttlMs = 15 * 60 * 1000;
const mimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"]);

type Ticket = { key: string; name: string; type: string; size: number; userId: string; provider: "s3" | "vercel_blob"; expires: number };

function secret() {
  if (!process.env.NEXTAUTH_SECRET) throw new Error("NEXTAUTH_SECRET is required for staged uploads.");
  return process.env.NEXTAUTH_SECRET;
}

function sign(ticket: Ticket) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verify(reference: string, userId: string): Ticket {
  const [payload, signature, extra] = reference.split(".");
  if (!payload || !signature || extra || reference.length > 2048) throw new Error("Invalid upload reference.");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid upload reference.");
  const ticket = JSON.parse(Buffer.from(payload, "base64url").toString()) as Ticket;
  if (ticket.userId !== userId || ticket.expires < Date.now() || ticket.expires > Date.now() + ttlMs ||
      !ticket.key.startsWith(`${prefix}${userId}/`) || !Number.isInteger(ticket.size) ||
      ticket.size < 1 || ticket.size > maxUploadBytes || !mimeTypes.has(ticket.type) ||
      !["s3", "vercel_blob"].includes(ticket.provider) || ticket.provider !== getStorageProvider()) {
    throw new Error("Upload reference is expired or does not belong to this session.");
  }
  return ticket;
}

function s3() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (!bucket || !region) throw new Error("S3_BUCKET and S3_REGION are required.");
  return { bucket, client: new S3Client({ region }) };
}

export async function createStagedUpload(input: { userId: string; name: string; type: string; size: number }) {
  const provider = getStorageProvider();
  if (provider === "local") throw new Error("Direct uploads require hosted storage.");
  if (!mimeTypes.has(input.type) || !Number.isInteger(input.size) || input.size < 1 || input.size > maxUploadBytes ||
      !input.name || input.name.length > 255) throw new Error("Unsupported file type or file exceeds 10 MB.");
  const name = sanitizeFileName(input.name);
  const key = `${prefix}${input.userId}/${randomUUID()}-${name}`;
  const ticket: Ticket = { key, name, type: input.type, size: input.size, userId: input.userId, provider, expires: Date.now() + ttlMs };
  if (provider === "s3") {
    const { bucket, client } = s3();
    const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.type, ContentLength: input.size }), { expiresIn: 300 });
    return { provider, key, url, reference: sign(ticket) };
  }
  const { generateClientTokenFromReadWriteToken } = await import("@vercel/blob/client");
  const token = await generateClientTokenFromReadWriteToken({
    pathname: key, token: process.env.BLOB_READ_WRITE_TOKEN,
    allowedContentTypes: [input.type], maximumSizeInBytes: input.size,
    validUntil: Date.now() + 5 * 60 * 1000, addRandomSuffix: false, allowOverwrite: false,
  });
  return { provider, key, token, reference: sign(ticket) };
}

export async function readUploadedFile(formData: FormData, name: string, userId: string): Promise<File> {
  const value = formData.get(name);
  if (value instanceof File && value.size > 0) return value;
  const reference = formData.get(`${name}UploadRef`);
  if (typeof reference !== "string") throw new Error(`${name} file is required.`);
  const ticket = verify(reference, userId);
  let bytes: Uint8Array;
  if (ticket.provider === "s3") {
    const { bucket, client } = s3();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: ticket.key }));
    if (!result.Body || result.ContentLength !== ticket.size) throw new Error("Uploaded file size does not match the selected file.");
    bytes = await result.Body.transformToByteArray();
    if (bytes.byteLength !== ticket.size) throw new Error("Uploaded file size does not match the selected file.");
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: ticket.key }));
  } else {
    const result = await get(ticket.key, { access: "private" });
    if (!result || result.statusCode !== 200 || result.blob.size !== ticket.size) throw new Error("Uploaded file size does not match the selected file.");
    bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
    if (bytes.byteLength !== ticket.size) throw new Error("Uploaded file size does not match the selected file.");
    await del(ticket.key);
  }
  return new File([new Uint8Array(bytes)], ticket.name, { type: ticket.type });
}
