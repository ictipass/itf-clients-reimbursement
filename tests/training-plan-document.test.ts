import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import { getTrainingPlanCsvTemplate, parseTrainingPlanDocument } from "../lib/training-plan";

test("training plan CSV remains importable", async () => {
  const result = await parseTrainingPlanDocument(
    Buffer.from(getTrainingPlanCsvTemplate()),
    "training-plan.csv",
    "text/csv",
  );

  assert.equal(result.validated.extension, ".csv");
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].trainingTitle, "Financial modelling");
});

test("Excel training plan imports rows and native date cells", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Training Plan");
  sheet.addRow(["Name of Staff", "Department", "Gap Identified", "Training Title", "Estimated Cost", "Date", "Location", "Trainer"]);
  sheet.addRow(["Ada Okafor", "Finance", "Analysis", "Financial modelling", 250000, new Date(Date.UTC(2026, 7, 15)), "Lagos", "Example Training Ltd"]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const result = await parseTrainingPlanDocument(
    buffer,
    "training-plan.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  assert.equal(result.validated.extension, ".xlsx");
  assert.equal(result.rows[0].staffName, "Ada Okafor");
  assert.equal(result.rows[0].estimatedCost, 250000);
  assert.equal(result.rows[0].plannedDate?.toISOString().slice(0, 10), "2026-08-15");
});

test("legacy Excel files are rejected with conversion guidance", async () => {
  await assert.rejects(
    parseTrainingPlanDocument(Buffer.from("not excel"), "training-plan.xls", "application/vnd.ms-excel"),
    /Save older \.xls files as \.xlsx/,
  );
});
