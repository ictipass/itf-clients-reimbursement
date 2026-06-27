export const reimbursementStaffTrainingAreas = [
  "MANAGEMENT",
  "SUPERVISORY",
  "OCCUPATIONAL",
] as const;

export type ReimbursementStaffTrainingArea =
  (typeof reimbursementStaffTrainingAreas)[number];

export type ReimbursementStaffEntryInput = {
  employeeId: string;
  employeeName?: string;
  trainingArea: ReimbursementStaffTrainingArea;
};

export type ReimbursementStaffDuplicateGroup = {
  normalizedEmployeeId: string;
  entries: Array<ReimbursementStaffEntryInput & { normalizedEmployeeId: string }>;
};

export type PreparedReimbursementStaffEntry = ReimbursementStaffEntryInput & {
  normalizedEmployeeId: string;
  duplicateGroupKey?: string;
  duplicateDetectedAt?: Date;
};

export function normalizeClaimEmployeeId(employeeId: string) {
  const normalized = employeeId.trim().replace(/\s+/g, "").toUpperCase();

  if (!normalized) {
    throw new Error("Staff/Employee ID is required.");
  }

  return normalized;
}

export function parseClaimStaffEntryLines(
  value: string,
  trainingArea: ReimbursementStaffTrainingArea,
) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [employeeId, ...nameParts] = line.split(",");

      return {
        employeeId: employeeId.trim(),
        employeeName: nameParts.join(",").trim() || undefined,
        trainingArea,
      } satisfies ReimbursementStaffEntryInput;
    });
}

export function findDuplicateClaimStaffEntries(entries: ReimbursementStaffEntryInput[]) {
  const grouped = new Map<
    string,
    Array<ReimbursementStaffEntryInput & { normalizedEmployeeId: string }>
  >();

  for (const entry of entries) {
    if (!reimbursementStaffTrainingAreas.includes(entry.trainingArea)) {
      throw new Error("Unsupported reimbursement staff training area.");
    }

    const normalizedEmployeeId = normalizeClaimEmployeeId(entry.employeeId);
    const existing = grouped.get(normalizedEmployeeId) ?? [];
    existing.push({
      ...entry,
      normalizedEmployeeId,
    });
    grouped.set(normalizedEmployeeId, existing);
  }

  return [...grouped.entries()]
    .filter(([, groupEntries]) => groupEntries.length > 1)
    .map(
      ([normalizedEmployeeId, groupEntries]) =>
        ({
          normalizedEmployeeId,
          entries: groupEntries,
        }) satisfies ReimbursementStaffDuplicateGroup,
    );
}

export function prepareClaimStaffEntries(entries: ReimbursementStaffEntryInput[]) {
  const duplicateGroups = findDuplicateClaimStaffEntries(entries);
  const duplicateKeys = new Set(duplicateGroups.map((group) => group.normalizedEmployeeId));
  const duplicateDetectedAt = duplicateKeys.size > 0 ? new Date() : undefined;

  return entries.map((entry) => {
    const normalizedEmployeeId = normalizeClaimEmployeeId(entry.employeeId);
    const isDuplicate = duplicateKeys.has(normalizedEmployeeId);

    return {
      ...entry,
      normalizedEmployeeId,
      duplicateGroupKey: isDuplicate ? normalizedEmployeeId : undefined,
      duplicateDetectedAt: isDuplicate ? duplicateDetectedAt : undefined,
    } satisfies PreparedReimbursementStaffEntry;
  });
}
