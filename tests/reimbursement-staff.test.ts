import assert from "node:assert/strict";
import test from "node:test";

import {
  findDuplicateClaimStaffEntries,
  normalizeClaimEmployeeId,
  parseClaimStaffEntryLines,
  prepareClaimStaffEntries,
} from "../lib/reimbursement-staff";

test("normalizes staff IDs for duplicate detection", () => {
  assert.equal(normalizeClaimEmployeeId(" emp 001 "), "EMP001");
  assert.throws(() => normalizeClaimEmployeeId("   "), /Staff\/Employee ID is required/);
});

test("flags duplicate staff IDs across reimbursement training areas", () => {
  const duplicates = findDuplicateClaimStaffEntries([
    {
      employeeId: "EMP-001",
      employeeName: "Ada",
      trainingArea: "MANAGEMENT",
    },
    {
      employeeId: " emp-001 ",
      employeeName: "Ada Lovelace",
      trainingArea: "OCCUPATIONAL",
    },
    {
      employeeId: "EMP-002",
      employeeName: "Grace",
      trainingArea: "SUPERVISORY",
    },
  ]);

  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].normalizedEmployeeId, "EMP-001");
  assert.deepEqual(
    duplicates[0].entries.map((entry) => entry.trainingArea),
    ["MANAGEMENT", "OCCUPATIONAL"],
  );
});

test("does not flag unique staff IDs", () => {
  assert.deepEqual(
    findDuplicateClaimStaffEntries([
      {
        employeeId: "EMP-001",
        trainingArea: "MANAGEMENT",
      },
      {
        employeeId: "EMP-002",
        trainingArea: "SUPERVISORY",
      },
    ]),
    [],
  );
});

test("parses pasted staff lines with optional names", () => {
  assert.deepEqual(
    parseClaimStaffEntryLines("EMP-001, Ada Lovelace\nEMP-002", "MANAGEMENT"),
    [
      {
        employeeId: "EMP-001",
        employeeName: "Ada Lovelace",
        trainingArea: "MANAGEMENT",
      },
      {
        employeeId: "EMP-002",
        employeeName: undefined,
        trainingArea: "MANAGEMENT",
      },
    ],
  );
});

test("prepares duplicate metadata for persistence", () => {
  const prepared = prepareClaimStaffEntries([
    {
      employeeId: "EMP-001",
      trainingArea: "MANAGEMENT",
    },
    {
      employeeId: " emp-001 ",
      trainingArea: "SUPERVISORY",
    },
    {
      employeeId: "EMP-002",
      trainingArea: "OCCUPATIONAL",
    },
  ]);

  assert.equal(prepared[0].normalizedEmployeeId, "EMP-001");
  assert.equal(prepared[0].duplicateGroupKey, "EMP-001");
  assert.equal(prepared[1].duplicateGroupKey, "EMP-001");
  assert.equal(prepared[2].duplicateGroupKey, undefined);
  assert.ok(prepared[0].duplicateDetectedAt instanceof Date);
});
