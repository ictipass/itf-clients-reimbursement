import { randomUUID } from "node:crypto";
import path from "node:path";

import type { UploadObjectInput } from "@/lib/storage/types";

export function createObjectKey(input: UploadObjectInput) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return path.posix.join(
    input.namespace ?? "company-evidence",
    input.companyId,
    String(now.getFullYear()),
    month,
    `${randomUUID()}${input.extension}`,
  );
}
