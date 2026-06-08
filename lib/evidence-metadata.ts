const maxEvidenceDocumentNameLength = 120;

export function normalizeEvidenceDocumentName(kind: string, value?: string) {
  if (kind !== "OTHER_SUPPORTING_EVIDENCE") {
    return null;
  }

  const documentName = value?.trim();

  if (!documentName) {
    throw new Error("Document name is required for other supporting evidence.");
  }

  if (documentName.length > maxEvidenceDocumentNameLength) {
    throw new Error(
      `Document name must not exceed ${maxEvidenceDocumentNameLength} characters.`,
    );
  }

  return documentName;
}
