import ExcelJS from "exceljs";

import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";

const headers = ["bank name", "sort code", "paystack bank code"];
const maxWorkbookBytes = 1024 * 1024;
const maxRows = 250;

function textCell(cell: ExcelJS.Cell, row: number, column: string) {
  if (cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value !== "string") {
    throw new Error(`Row ${row}: ${column} must be text, not a number or formula. Format sort codes as text to preserve leading zeroes.`);
  }
  return cell.value.trim();
}

export async function bankWorkbookTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Banks");
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [{ width: 42 }, { width: 22, style: { numFmt: "@" } }, { width: 24, style: { numFmt: "@" } }];
  const instructions = workbook.addWorksheet("Instructions");
  instructions.addRow(["Enter one accepted bank per row on the Banks sheet. Both columns are required."]);
  instructions.addRow(["Keep sort codes as text so leading zeroes are retained. Sort codes must contain 3 to 12 digits."]);
  instructions.addRow(["Paystack bank code is a separate value from the sort code. Obtain it from Paystack's List Banks API; it is required for employer account-name lookup."]);
  instructions.addRow(["Old two-column workbooks remain importable, but banks without a Paystack code cannot resolve account names."]);
  instructions.addRow(["Maximum 250 banks and 1 MB. Duplicate bank names or any invalid row reject the entire upload."]);
  instructions.addRow(["Existing banks with matching names are updated and reactivated. Other banks are left unchanged."]);
  instructions.addRow(["Previously saved claims retain their bank details; new claim selections use updated sort codes."]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function parseBankWorkbook(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size === 0 || file.size > maxWorkbookBytes) {
    throw new Error("Upload a non-empty .xlsx bank workbook no larger than 1 MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 2).toString() !== "PK") throw new Error("File content is not an Excel .xlsx workbook.");
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new Error("Excel workbook could not be opened."); }
  const sheet = workbook.getWorksheet("Banks");
  if (!sheet) throw new Error("Workbook must contain a Banks sheet.");
  const foundHeaders = headers.map((_, index) => textCell(sheet.getRow(1).getCell(index + 1), 1, "header").toLowerCase());
  if (foundHeaders[0] !== headers[0] || foundHeaders[1] !== headers[1] || (foundHeaders[2] && foundHeaders[2] !== headers[2])) throw new Error(`First row must be: ${headers.join(", ")} (last column optional for older workbooks).`);
  if (sheet.rowCount > maxRows + 1) throw new Error(`Workbook may contain at most ${maxRows} banks.`);
  const rows: { name: string; nameKey: string; sortCode: string; paystackCode: string | null }[] = [];
  const seen = new Set<string>();
  for (let number = 2; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const name = textCell(row.getCell(1), number, "bank name").replace(/\s+/g, " ");
    const sortCode = textCell(row.getCell(2), number, "sort code");
    const paystackCode = textCell(row.getCell(3), number, "paystack bank code") || null;
    if (!name && !sortCode && !paystackCode) continue;
    if (name.length < 2 || name.length > 100) throw new Error(`Row ${number}: bank name must contain 2 to 100 characters.`);
    if (!/^\d{3,12}$/.test(sortCode)) throw new Error(`Row ${number}: sort code must contain 3 to 12 digits.`);
    if (paystackCode && !/^\d{3,12}$/.test(paystackCode)) throw new Error(`Row ${number}: Paystack bank code must contain 3 to 12 digits.`);
    const nameKey = name.toLowerCase();
    if (seen.has(nameKey)) throw new Error(`Row ${number}: duplicate bank name ${name}.`);
    seen.add(nameKey);
    rows.push({ name, nameKey, sortCode, paystackCode });
  }
  if (rows.length === 0) throw new Error("Workbook contains no banks.");
  return rows;
}

export async function importBankWorkbook(input: { file: File; workspaceId: string; requesterRole: Role }) {
  if (!can(input.requesterRole, "workspace:manage")) throw new Error("You cannot import bank settings.");
  const rows = await parseBankWorkbook(input.file);
  const db = getDb();
  const workspace = await db.workspace.findFirst({ where: { id: input.workspaceId, isActive: true }, select: { id: true } });
  if (!workspace) throw new Error("Active workspace was not found.");
  return db.$transaction(async (tx) => {
    const existing = await tx.bankDirectoryEntry.findMany({
      where: { workspaceId: workspace.id, nameKey: { in: rows.map((row) => row.nameKey) } },
      select: { id: true, nameKey: true },
    });
    const existingByName = new Map(existing.map((bank) => [bank.nameKey, bank.id]));
    const newRows = rows.filter((row) => !existingByName.has(row.nameKey));
    if (newRows.length) await tx.bankDirectoryEntry.createMany({ data: newRows.map((row) => ({ workspaceId: workspace.id, ...row })) });
    for (const row of rows) {
      const id = existingByName.get(row.nameKey);
      if (id) await tx.bankDirectoryEntry.update({ where: { id }, data: { name: row.name, sortCode: row.sortCode, ...(row.paystackCode ? { paystackCode: row.paystackCode } : {}), isActive: true } });
    }
    return { added: newRows.length, updated: existing.length };
  }, { timeout: 60000 });
}
