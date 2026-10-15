import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { checksum } from "@/lib/storage/security";
import { createObjectKey } from "@/lib/storage/object-key";
import type { DownloadObjectInput, DownloadedObject, StoredObject, UploadObjectInput } from "@/lib/storage/types";

function getS3Config() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (!bucket || !region) throw new Error("S3_BUCKET and S3_REGION are required for S3 storage.");
  return { bucket, client: new S3Client({ region }) };
}

export async function uploadS3Object(input: UploadObjectInput): Promise<Omit<StoredObject, "scanStatus" | "scannedAt" | "scanReason">> {
  const { bucket, client } = getS3Config();
  const objectKey = createObjectKey(input);
  const response = await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: input.buffer,
    ContentType: input.mimeType,
    Metadata: { sha256: checksum(input.buffer) },
  }));
  return {
    storageProvider: "S3",
    bucket,
    objectKey,
    etag: response.ETag,
    versionId: response.VersionId,
    checksum: checksum(input.buffer),
    mimeType: input.mimeType,
    fileSize: input.buffer.byteLength,
  };
}

export async function openS3Object(input: DownloadObjectInput) {
  const { bucket, client } = getS3Config();
  if (input.bucket !== bucket) throw new Error("S3 document belongs to a different bucket.");
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: input.objectKey }));
  if (!response.Body) throw new Error("Stored document was not found in S3.");
  return {
    stream: response.Body.transformToWebStream() as ReadableStream<Uint8Array>,
    fileSize: response.ContentLength ?? 0,
  };
}

export async function downloadS3Object(input: DownloadObjectInput): Promise<DownloadedObject> {
  const opened = await openS3Object(input);
  const buffer = Buffer.from(await new Response(opened.stream).arrayBuffer());
  return { buffer, fileSize: buffer.byteLength };
}
