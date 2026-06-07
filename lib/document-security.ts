export type DocumentScanState = {
  scanStatus: "PENDING_SCAN" | "SAFE" | "QUARANTINED" | "REJECTED";
  scanReason?: string | null;
};

export function assertDocumentSafe(document: DocumentScanState) {
  if (document.scanStatus === "SAFE") return;

  if (document.scanStatus === "QUARANTINED" || document.scanStatus === "REJECTED") {
    throw new Error(document.scanReason ?? "This document is unavailable following security review.");
  }

  throw new Error("This document is awaiting security scanning and cannot be opened yet.");
}
