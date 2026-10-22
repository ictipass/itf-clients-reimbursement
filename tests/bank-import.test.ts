import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import { bankWorkbookTemplate, parseBankWorkbook } from "../lib/bank-import";

function workbookFile(buffer: Buffer) {
  return new File([new Uint8Array(buffer)], "banks.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

test("bank template imports text sort codes with leading zeroes", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await bankWorkbookTemplate() as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet("Banks");
  assert.ok(sheet);
  sheet.addRow(["Example Bank", "001234"]);
  const rows = await parseBankWorkbook(workbookFile(Buffer.from(await workbook.xlsx.writeBuffer())));
  assert.deepEqual(rows, [{ name: "Example Bank", nameKey: "example bank", sortCode: "001234" }]);
});

test("bank import rejects duplicate names and numeric sort codes", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Banks");
  sheet.addRow(["bank name", "sort code"]);
  sheet.addRow(["Example Bank", "001234"]);
  sheet.addRow([" example   bank ", "987654"]);
  await assert.rejects(parseBankWorkbook(workbookFile(Buffer.from(await workbook.xlsx.writeBuffer()))), /duplicate bank name/);
  sheet.spliceRows(3, 1);
  sheet.getRow(2).getCell(2).value = 1234;
  await assert.rejects(parseBankWorkbook(workbookFile(Buffer.from(await workbook.xlsx.writeBuffer()))), /must be text/);
});
