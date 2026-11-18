import ExcelJS from "exceljs";

import { reimbursementStaffTrainingAreas, type ReimbursementStaffEntryInput } from "@/lib/reimbursement-staff";

const headers = ["Staff Number", "Name of Staff", "Category"];
const maxWorkbookBytes = 2 * 1024 * 1024;
const maxRows = 5000;

export async function claimStaffWorkbookTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Staff List");
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [{ width: 25, style: { numFmt: "@" } }, { width: 38 }, { width: 22 }];
  const instructions = workbook.addWorksheet("Instructions");
  instructions.addRow(["Use the Staff List sheet. Do not change or reorder its three column headings."]);
  instructions.addRow(["Enter one person per row. Staff Number and Category are required; Name of Staff is strongly recommended."]);
  instructions.addRow(["Category must be Management, Supervisory, or Occupational. Staff numbers should be formatted as text to preserve leading zeroes."]);
  instructions.addRow(["Uploading replaces the claim's current staff list. Download or retain a copy before replacing it."]);
  instructions.addRow(["Maximum 5,000 rows and 2 MB. Invalid rows reject the entire upload."]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function cellText(cell: ExcelJS.Cell, row: number, heading: string) {
  if (cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value !== "string") throw new Error(`Row ${row}: ${heading} must be text, not a number or formula.`);
  return cell.value.trim();
}

export async function parseClaimStaffWorkbook(file: File): Promise<ReimbursementStaffEntryInput[]> {
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size === 0 || file.size > maxWorkbookBytes) {
    throw new Error("Upload a non-empty .xlsx staff workbook no larger than 2 MB.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 2).toString() !== "PK") throw new Error("Staff list is not a valid .xlsx workbook.");
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new Error("Staff workbook could not be opened."); }
  const sheet = workbook.getWorksheet("Staff List");
  if (!sheet) throw new Error("Workbook must contain a Staff List sheet.");
  for (let column = 1; column <= headers.length; column += 1) {
    if (cellText(sheet.getRow(1).getCell(column), 1, "heading").toLowerCase() !== headers[column - 1].toLowerCase()) {
      throw new Error(`First row must be: ${headers.join(", ")}.`);
    }
  }
  if (sheet.rowCount > maxRows + 1) throw new Error(`Workbook may contain at most ${maxRows} staff entries.`);
  const entries: ReimbursementStaffEntryInput[] = [];
  for (let number = 2; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const employeeId = cellText(row.getCell(1), number, "Staff Number");
    const employeeName = cellText(row.getCell(2), number, "Name of Staff");
    const rawCategory = cellText(row.getCell(3), number, "Category");
    if (!employeeId && !employeeName && !rawCategory) continue;
    if (!employeeId || employeeId.length > 80) throw new Error(`Row ${number}: Staff Number is required and must be at most 80 characters.`);
    if (employeeName.length > 200) throw new Error(`Row ${number}: Name of Staff must be at most 200 characters.`);
    const trainingArea = rawCategory.toUpperCase();
    if (!reimbursementStaffTrainingAreas.includes(trainingArea as typeof reimbursementStaffTrainingAreas[number])) {
      throw new Error(`Row ${number}: Category must be Management, Supervisory, or Occupational.`);
    }
    entries.push({ employeeId, employeeName: employeeName || undefined, trainingArea: trainingArea as ReimbursementStaffEntryInput["trainingArea"] });
  }
  if (!entries.length) throw new Error("Staff workbook contains no entries.");
  return entries;
}
