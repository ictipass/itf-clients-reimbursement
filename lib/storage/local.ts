import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { checksum } from "@/lib/storage/security";
import type {
  DownloadObjectInput,
  DownloadedObject,
  StoredObject,
  UploadObjectInput,
} from "@/lib/storage/types";

function getLocalStorageRoot() {
  const configuredRoot = process.env.LOCAL_STORAGE_ROOT;

  if (configuredRoot && path.isAbsolute(configuredRoot)) {
    return path.resolve(configuredRoot);
  }

  if (configuredRoot) {
    return path.join(/* turbopackIgnore: true */ process.cwd(), ...configuredRoot.split(/[\\/]+/));
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "uploads");
}

function getLocalObjectPath(objectKey: string) {
  if (path.isAbsolute(objectKey)) {
    throw new Error("Invalid local object key.");
  }

  const root = getLocalStorageRoot();
  const absolutePath = path.resolve(root, ...objectKey.split("/"));
  const relativePath = path.relative(root, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid local object key.");
  }

  return absolutePath;
}

export async function uploadLocalObject(input: UploadObjectInput): Promise<StoredObject> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const objectKey = path.posix.join(
    input.namespace ?? "company-evidence",
    input.companyId,
    String(now.getFullYear()),
    month,
    `${randomUUID()}${input.extension}`,
  );

  const absolutePath = getLocalObjectPath(objectKey);

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

export async function downloadLocalObject(
  input: DownloadObjectInput,
): Promise<DownloadedObject> {
  if (input.storageProvider !== "LOCAL") {
    throw new Error("Local storage can only read LOCAL documents.");
  }

  const absolutePath = getLocalObjectPath(input.objectKey);
  const buffer = await fs.readFile(absolutePath);

  return {
    buffer,
    fileSize: buffer.byteLength,
  };
}
