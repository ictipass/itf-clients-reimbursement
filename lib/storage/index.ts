import { downloadLocalObject, uploadLocalObject } from "@/lib/storage/local";
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

  throw new Error(`${provider} uploads will be implemented in the storage adapter slice.`);
}

export async function downloadObject(input: DownloadObjectInput) {
  if (input.storageProvider === "LOCAL") {
    return downloadLocalObject(input);
  }

  throw new Error(`${input.storageProvider} downloads will be implemented in the storage adapter slice.`);
}
