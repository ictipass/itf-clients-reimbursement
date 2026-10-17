import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import { getUserCsvTemplate, getUserWorkbookTemplate, parseUserWorkbookFile } from "../lib/user-directory";

test("user import template includes office and workflow role before staff classification", () => {
  assert.equal(
    getUserCsvTemplate().trim(),
    "full name,staff number,email address,phone number,office,role,department,job title",
  );
});

test("user Excel template has importable Users and separate Instructions sheets", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await getUserWorkbookTemplate() as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Users", "Instructions"]);
  assert.equal(workbook.getWorksheet("Users")?.getRow(1).getCell(5).value, "office");
  assert.match(String(workbook.getWorksheet("Instructions")?.getRow(4).getCell(1).value), /workflow role/);

  workbook.getWorksheet("Users")?.addRow(["Ada Okafor", "ITF-001", "ada@example.com", "", "Headquarters", "SYSTEM_ADMIN", "", ""]);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const rows = await parseUserWorkbookFile(new File([bytes], "users.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "ada@example.com");
  assert.equal(rows[0].office, "Headquarters");
});
