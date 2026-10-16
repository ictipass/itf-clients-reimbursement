import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import { officeWorkbookTemplate, parseOfficeWorkbook } from "../lib/office-import";

function workbookFile(buffer: Buffer) {
  return new File([new Uint8Array(buffer)], "area-offices.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

test("Area Office Excel template parses only valid, unique offices", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await officeWorkbookTemplate() as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet("Area Offices");
  assert.ok(sheet);
  sheet.addRow(["Lagos Area Office", "LAG", ""]);
  sheet.addRow(["Abuja Area Office", "ABJ", "abuja"]);
  const rows = await parseOfficeWorkbook(workbookFile(Buffer.from(await workbook.xlsx.writeBuffer())));
  assert.deepEqual(rows.map((row) => row.slug), ["lagos-area-office", "abuja"]);
  sheet.addRow(["Duplicate", "DUP", "abuja"]);
  await assert.rejects(parseOfficeWorkbook(workbookFile(Buffer.from(await workbook.xlsx.writeBuffer()))), /duplicate office slug/);
});
