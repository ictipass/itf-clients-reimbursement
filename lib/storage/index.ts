import { downloadLocalObject, uploadLocalObject } from "@/lib/storage/local";
import { downloadS3Object, openS3Object, uploadS3Object } from "@/lib/storage/s3";
import { downloadVercelBlobObject, openVercelBlobObject, uploadVercelBlobObject } from "@/lib/storage/vercel-blob";
import { getMalwareScanner } from "@/lib/malware-scanner";
import type { DownloadObjectInput, StorageProviderName, UploadObjectInput } from "@/lib/storage/types";

export function getStorageProvider(): StorageProviderName {
  const provider = process.env.STORAGE_PROVIDER ?? "local";

  if (provider === "local" || provider === "vercel_blob" || provider === "s3") {
    return provider;
  }

  throw new Error(`Unsupported STORAGE_PROVIDER value: ${provider}`);
}

export async function uploadObject(input: UploadObjectInput) {
  const provider = getStorageProvider();
  const scan = await getMalwareScanner().scan(input);

  if (provider === "local") {
    return { ...(await uploadLocalObject(input)), scanStatus: scan.status, scannedAt: scan.scannedAt, scanReason: scan.reason };
  }
  const stored = provider === "vercel_blob"
    ? await uploadVercelBlobObject(input)
    : await uploadS3Object(input);
  return { ...stored, scanStatus: scan.status, scannedAt: scan.scannedAt, scanReason: scan.reason };
}

export async function downloadObject(input: DownloadObjectInput) {
  if (input.storageProvider === "LOCAL") {
    return downloadLocalObject(input);
  }
  if (input.storageProvider === "VERCEL_BLOB") return downloadVercelBlobObject(input);
  return downloadS3Object(input);
}

export async function openObject(input: DownloadObjectInput) {
  if (input.storageProvider === "VERCEL_BLOB") return openVercelBlobObject(input);
  if (input.storageProvider === "S3") return openS3Object(input);
  const downloaded = await downloadLocalObject(input);
  return { stream: new Blob([new Uint8Array(downloaded.buffer)]).stream(), fileSize: downloaded.fileSize };
}
