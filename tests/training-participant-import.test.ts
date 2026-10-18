import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import { parseTrainingParticipantWorkbook, trainingParticipantWorkbookTemplate } from "../lib/training-participant-import";

const areas = ["Management", "Supervisory", "Occupational", "Health & Safety"];

test("participant template has instructions and imports valid rows", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await trainingParticipantWorkbookTemplate(areas) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Participants", "Instructions"]);
  workbook.getWorksheet("Participants")?.addRow(["Ada Okafor", "Manager", "Management", "BSc", "Nigerian", "Leadership", "ITF", "Lagos"]);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  const rows = await parseTrainingParticipantWorkbook(new File([bytes], "participants.xlsx"), areas);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Ada Okafor");
  assert.equal(rows[0].trainingArea, "Management");
});

test("participant import rejects an invalid training area without partial rows", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await trainingParticipantWorkbookTemplate(areas) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  workbook.getWorksheet("Participants")?.addRow(["Ada Okafor", "", "Management"]);
  workbook.getWorksheet("Participants")?.addRow(["Musa Bello", "", "Unknown"]);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(
    parseTrainingParticipantWorkbook(new File([bytes], "participants.xlsx"), areas),
    /Row 3: training area/,
  );
});
