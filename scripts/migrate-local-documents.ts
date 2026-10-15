import "dotenv/config";

import path from "node:path";

import { getDb } from "../lib/db";
import { downloadObject, getStorageProvider, uploadObject } from "../lib/storage";
import { checksum } from "../lib/storage/security";

async function main() {
  const apply = process.argv.includes("--apply");
  const provider = getStorageProvider();
  if (provider === "local") throw new Error("Set STORAGE_PROVIDER=vercel_blob or s3 before migration.");

  const db = getDb();
  const documents = await db.document.findMany({
    where: { storageProvider: "LOCAL" },
    select: {
      id: true, organizationId: true, companyId: true, bucket: true,
      objectKey: true, checksum: true, mimeType: true, fileName: true,
    },
    orderBy: { id: "asc" },
  });
  console.log(`${apply ? "Migrating" : "Dry run:"} ${documents.length} local document(s) to ${provider}.`);
  if (!apply) {
    console.log("No files or database rows changed. Rerun with --apply on the machine holding the local files.");
    return;
  }

  let migrated = 0;
  let failed = 0;
  for (const document of documents) {
    try {
      const source = await downloadObject({
        storageProvider: "LOCAL", bucket: document.bucket, objectKey: document.objectKey,
      });
      if (checksum(source.buffer) !== document.checksum) throw new Error("Local checksum differs from the database record.");
      const stored = await uploadObject({
        buffer: source.buffer,
        companyId: document.companyId ?? document.organizationId,
        extension: path.extname(document.fileName).toLowerCase() || ".bin",
        mimeType: document.mimeType,
        namespace: "migrated-documents",
      });
      const copy = await downloadObject({
        storageProvider: stored.storageProvider, bucket: stored.bucket, objectKey: stored.objectKey,
      });
      if (checksum(copy.buffer) !== document.checksum) throw new Error("Hosted copy failed checksum verification; local record was preserved.");

      const updated = await db.document.updateMany({
        where: { id: document.id, storageProvider: "LOCAL", objectKey: document.objectKey },
        data: {
          storageProvider: stored.storageProvider,
          bucket: stored.bucket ?? null,
          objectKey: stored.objectKey,
          url: stored.url ?? null,
          etag: stored.etag ?? null,
          versionId: stored.versionId ?? null,
        },
      });
      if (updated.count !== 1) throw new Error("Document changed during migration; local record was preserved.");
      migrated += 1;
      console.log(`Migrated ${document.id}`);
    } catch (error) {
      failed += 1;
      console.error(`Failed ${document.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  console.log(`Migrated: ${migrated}; failed: ${failed}. Local files were not deleted.`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
