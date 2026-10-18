import ExcelJS from "exceljs";

const columns = [
  "participant name",
  "job title",
  "training area",
  "educational qualification",
  "nationality",
  "course title",
  "course organiser",
  "venue",
] as const;
const maxRows = 500;
const maxWorkbookBytes = 2 * 1024 * 1024;

export async function trainingParticipantWorkbookTemplate(trainingAreas: readonly string[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Participants");
  sheet.addRow([...columns]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = columns.map(() => ({ width: 28 }));
  const instructions = workbook.addWorksheet("Instructions");
  instructions.addRow(["Enter one participant per row on the Participants sheet. Only that sheet is imported."]);
  instructions.addRow(["Participant name is required. All other columns are optional."]);
  instructions.addRow([`Training area, if provided, must be one of: ${trainingAreas.join(", ")}.`]);
  instructions.addRow([`Up to ${maxRows} participants may be imported per workbook. Rows are added to existing participants; they do not replace them.`]);
  instructions.addRow(["The entire workbook is validated before any participants are added. Import is available only while the Form 4A is editable."]);
  instructions.getColumn(1).width = 120;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function parseTrainingParticipantWorkbook(file: File, trainingAreas: readonly string[]) {
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size === 0 || file.size > maxWorkbookBytes) {
    throw new Error("Upload a non-empty .xlsx participant workbook no larger than 2 MB.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 2).toString() !== "PK") throw new Error("File content is not an Excel workbook.");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new Error("Participant workbook could not be opened.");
  }
  const sheet = workbook.getWorksheet("Participants");
  if (!sheet) throw new Error("Workbook must contain a Participants sheet.");
  if (sheet.rowCount > maxRows + 1) throw new Error(`Workbook may contain at most ${maxRows} participants.`);
  const cellText = (row: number, column: number) => {
    const value = sheet.getRow(row).getCell(column).value;
    if (value === null || value === undefined) return "";
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(`Row ${row}: ${columns[column - 1]} must be plain text, not a formula or formatted object.`);
    }
    const text = String(value).trim();
    if (text.length > 250) throw new Error(`Row ${row}: ${columns[column - 1]} exceeds 250 characters.`);
    return text;
  };
  if (columns.some((column, index) => cellText(1, index + 1).toLowerCase() !== column)) {
    throw new Error(`First row must be: ${columns.join(", ")}.`);
  }
  const rows = [];
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    const values = columns.map((_, index) => cellText(row, index + 1));
    if (values.every((value) => !value)) continue;
    const [name, jobTitle, trainingArea, educationalQualification, nationality, courseTitle, courseOrganiser, venue] = values;
    if (!name) throw new Error(`Row ${row}: participant name is required.`);
    if (trainingArea && !trainingAreas.includes(trainingArea)) {
      throw new Error(`Row ${row}: training area must be one of ${trainingAreas.join(", ")}.`);
    }
    rows.push({
      name,
      jobTitle: jobTitle || null,
      trainingArea: trainingArea || null,
      educationalQualification: educationalQualification || null,
      nationality: nationality || null,
      courseTitle: courseTitle || null,
      courseOrganiser: courseOrganiser || null,
      venue: venue || null,
    });
  }
  if (rows.length === 0) throw new Error("Workbook contains no participants.");
  return rows;
}
