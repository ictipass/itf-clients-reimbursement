import { get, put } from "@vercel/blob";

import { checksum } from "@/lib/storage/security";
import { createObjectKey } from "@/lib/storage/object-key";
import type { DownloadObjectInput, DownloadedObject, StoredObject, UploadObjectInput } from "@/lib/storage/types";

export async function uploadVercelBlobObject(input: UploadObjectInput): Promise<Omit<StoredObject, "scanStatus" | "scannedAt" | "scanReason">> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is required for private Blob storage.");
  const blob = await put(createObjectKey(input), input.buffer, {
    access: "private",
    contentType: input.mimeType,
    addRandomSuffix: false,
  });
  return {
    storageProvider: "VERCEL_BLOB",
    objectKey: blob.pathname,
    url: blob.url,
    etag: blob.etag,
    checksum: checksum(input.buffer),
    mimeType: input.mimeType,
    fileSize: input.buffer.byteLength,
  };
}

export async function openVercelBlobObject(input: DownloadObjectInput) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is required for private Blob storage.");
  const blob = await get(input.objectKey, { access: "private" });
  if (!blob || blob.statusCode !== 200) throw new Error("Stored document was not found in private Blob storage.");
  return { stream: blob.stream, fileSize: blob.blob.size };
}

export async function downloadVercelBlobObject(input: DownloadObjectInput): Promise<DownloadedObject> {
  const opened = await openVercelBlobObject(input);
  const buffer = Buffer.from(await new Response(opened.stream).arrayBuffer());
  return { buffer, fileSize: buffer.byteLength };
}
