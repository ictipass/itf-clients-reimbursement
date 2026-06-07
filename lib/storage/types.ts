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
  scanStatus: "SAFE" | "QUARANTINED" | "REJECTED";
  scannedAt: Date;
  scanReason?: string;
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
