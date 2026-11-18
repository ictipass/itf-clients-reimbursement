import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import { claimStaffWorkbookTemplate, parseClaimStaffWorkbook } from "../lib/claim-staff-import";

function workbookFile(buffer: Buffer) {
  return new File([new Uint8Array(buffer)], "staff.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

test("claim staff template imports categories and preserves text staff numbers", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await claimStaffWorkbookTemplate() as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  workbook.getWorksheet("Staff List")!.addRow(["0012", "Ada Okafor", "Management"]);
  assert.deepEqual(await parseClaimStaffWorkbook(workbookFile(Buffer.from(await workbook.xlsx.writeBuffer()))), [
    { employeeId: "0012", employeeName: "Ada Okafor", trainingArea: "MANAGEMENT" },
  ]);
});

test("claim staff import rejects invalid categories and numeric staff numbers", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Staff List");
  sheet.addRow(["Staff Number", "Name of Staff", "Category"]);
  sheet.addRow(["0012", "Ada", "Other"]);
  await assert.rejects(parseClaimStaffWorkbook(workbookFile(Buffer.from(await workbook.xlsx.writeBuffer()))), /Category must be/);
  sheet.getRow(2).getCell(1).value = 12;
  await assert.rejects(parseClaimStaffWorkbook(workbookFile(Buffer.from(await workbook.xlsx.writeBuffer()))), /must be text/);
});
