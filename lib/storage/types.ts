export type StorageProviderName = "local" | "vercel_blob" | "s3";

export type StoredObject = {
  storageProvider: "LOCAL" | "VERCEL_BLOB" | "S3";
  bucket?: string;
  objectKey: string;
  url?: string;
  etag?: string;
  versionId?: string;
  checksum: string;
  mimeType: string;
  fileSize: number;
};

export type UploadObjectInput = {
  buffer: Buffer;
  companyId: string;
  extension: string;
  mimeType: string;
  namespace?: string;
};

export type DownloadObjectInput = {
  storageProvider: "LOCAL" | "VERCEL_BLOB" | "S3";
  bucket?: string | null;
  objectKey: string;
};

export type DownloadedObject = {
  buffer: Buffer;
  fileSize: number;
};
