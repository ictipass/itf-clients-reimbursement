import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { checksum } from "@/lib/storage/security";
import type { StoredObject, UploadObjectInput } from "@/lib/storage/types";

function getLocalStorageRoot() {
  return path.resolve(process.cwd(), process.env.LOCAL_STORAGE_ROOT ?? "storage/uploads");
}

export async function uploadLocalObject(input: UploadObjectInput): Promise<StoredObject> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const objectKey = path.posix.join(
    "company-evidence",
    input.companyId,
    String(now.getFullYear()),
    month,
    `${randomUUID()}${input.extension}`,
  );

  const absolutePath = path.join(getLocalStorageRoot(), ...objectKey.split("/"));

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.buffer, { mode: 0o600 });

  return {
    storageProvider: "LOCAL",
    bucket: "local",
    objectKey,
    checksum: checksum(input.buffer),
    mimeType: input.mimeType,
    fileSize: input.buffer.byteLength,
  };
}
