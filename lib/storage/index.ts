import { uploadLocalObject } from "@/lib/storage/local";
import type { StorageProviderName, UploadObjectInput } from "@/lib/storage/types";

export function getStorageProvider(): StorageProviderName {
  const provider = process.env.STORAGE_PROVIDER ?? "local";

  if (provider === "local" || provider === "vercel_blob" || provider === "s3") {
    return provider;
  }

  throw new Error(`Unsupported STORAGE_PROVIDER value: ${provider}`);
}

export async function uploadObject(input: UploadObjectInput) {
  const provider = getStorageProvider();

  if (provider === "local") {
    return uploadLocalObject(input);
  }

  throw new Error(`${provider} uploads will be implemented in the storage adapter slice.`);
}
