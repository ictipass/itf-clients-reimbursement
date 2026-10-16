import ExcelJS from "exceljs";

import { getDb } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";

const columns = ["office name", "code", "slug"];
const maxWorkbookBytes = 1024 * 1024;
const maxRows = 250;

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function textCell(cell: ExcelJS.Cell, row: number, column: string) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Row ${row}: ${column} must be plain text, not a formula or formatted object.`);
  }
  return String(value).trim();
}

export async function officeWorkbookTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Area Offices");
  sheet.addRow(columns);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [{ width: 40 }, { width: 18 }, { width: 40 }];
  const instructions = workbook.addWorksheet("Instructions");
  instructions.addRow(["Enter one Area Office per row. Only the Area Offices sheet is imported."]);
  instructions.addRow(["Office name is required. Code and slug are optional; blank slug is generated from office name."]);
  instructions.addRow(["Maximum 250 offices. Existing slugs and duplicate rows are rejected; the entire import is atomic."]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function parseOfficeWorkbook(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size === 0 || file.size > maxWorkbookBytes) {
    throw new Error("Upload a non-empty .xlsx Area Office workbook no larger than 1 MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 2).toString() !== "PK") throw new Error("File content is not an Excel .xlsx workbook.");
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new Error("Excel workbook could not be opened."); }
  const sheet = workbook.getWorksheet("Area Offices");
  if (!sheet) throw new Error("Workbook must contain an Area Offices sheet.");
  const headers = columns.map((_, index) => textCell(sheet.getRow(1).getCell(index + 1), 1, "header").toLowerCase());
  if (headers.some((header, index) => header !== columns[index])) throw new Error(`First row must be: ${columns.join(", ")}.`);
  if (sheet.rowCount > maxRows + 1) throw new Error(`Workbook may contain at most ${maxRows} offices.`);
  const rows: { name: string; code: string | null; slug: string }[] = [];
  const seen = new Set<string>();
  for (let number = 2; number <= sheet.rowCount; number += 1) {
    const row = sheet.getRow(number);
    const name = textCell(row.getCell(1), number, "office name").replace(/\s+/g, " ");
    const code = textCell(row.getCell(2), number, "code");
    const requestedSlug = textCell(row.getCell(3), number, "slug");
    if (!name && !code && !requestedSlug) continue;
    const slug = slugify(requestedSlug || name);
    if (name.length < 2 || name.length > 120 || code.length > 30 || !slug || slug.length > 120) {
      throw new Error(`Row ${number}: enter an office name (2–120 characters), code (up to 30), and valid slug.`);
    }
    if (seen.has(slug)) throw new Error(`Row ${number}: duplicate office slug ${slug}.`);
    seen.add(slug);
    rows.push({ name, code: code || null, slug });
  }
  if (rows.length === 0) throw new Error("Workbook contains no Area Offices.");
  return rows;
}

export async function importAreaOfficesWorkbook(input: { file: File; requesterRole: Role }) {
  if (!can(input.requesterRole, "workspace:manage")) throw new Error("You do not have permission to import Area Offices.");
  const rows = await parseOfficeWorkbook(input.file);
  const db = getDb();
  const workspace = await db.workspace.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!workspace) throw new Error("No active workspace was found.");
  return db.$transaction(async (tx) => {
    const existing = await tx.areaOffice.findMany({
      where: { workspaceId: workspace.id, slug: { in: rows.map((row) => row.slug) } },
      select: { slug: true },
    });
    if (existing.length) throw new Error(`Area Office already exists: ${existing.map((row) => row.slug).join(", ")}. No offices were imported.`);
    await tx.areaOffice.createMany({ data: rows.map((row) => ({ ...row, workspaceId: workspace.id })) });
    return rows.length;
  });
}
