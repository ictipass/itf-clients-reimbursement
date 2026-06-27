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

export function normalizeClaimEmployeeId(employeeId: string) {
  const normalized = employeeId.trim().replace(/\s+/g, "").toUpperCase();

  if (!normalized) {
    throw new Error("Staff/Employee ID is required.");
  }

  return normalized;
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
